"""Experimental temporal Kenyan Sign Language recognition provider."""
from collections import deque
import hashlib
import json
import math
import os
from pathlib import Path
import threading
import time

import mediapipe as mp
import numpy as np
import tensorflow as tf

KSL_LABELS = [
    "me", "you", "friend", "name", "mine", "who", "how", "please",
    "help-me", "wait", "now", "home", "where", "give-me", "thank-you",
    "polite", "hello", "good", "mother", "father", "uncle", "cousing",
    "brother", "sister", "doughter", "parent", "relative", "yes", "no",
    "sorry",
]
DISPLAY_TEXT = {
    "help-me": "Help me", "give-me": "Give me", "thank-you": "Thank you",
    "cousing": "Cousin", "doughter": "Daughter",
}
SEQUENCE_LENGTH = 30
FEATURE_COUNT = 1662
DEFAULT_THRESHOLD = 0.70
DEFAULT_STABILITY = 3
DEFAULT_SESSION_TTL = 60
DEFAULT_MAX_SESSIONS = 20
MODEL_DIR = Path(__file__).resolve().parents[1] / "models" / "ksl-lstm-v1"
MODEL_PATH = MODEL_DIR / "best_model.h5"
MANIFEST_PATH = MODEL_DIR / "manifest.json"


def _architecture():
    """Rebuild the upstream architecture without deserializing executable objects."""
    return tf.keras.Sequential([
        tf.keras.layers.Input(shape=(SEQUENCE_LENGTH, FEATURE_COUNT)),
        tf.keras.layers.LSTM(128, return_sequences=True, activation="tanh"),
        tf.keras.layers.BatchNormalization(),
        tf.keras.layers.Dropout(0.3),
        tf.keras.layers.LSTM(256, return_sequences=True, activation="tanh"),
        tf.keras.layers.BatchNormalization(),
        tf.keras.layers.Dropout(0.4),
        tf.keras.layers.LSTM(128, return_sequences=False, activation="tanh"),
        tf.keras.layers.BatchNormalization(),
        tf.keras.layers.Dropout(0.3),
        tf.keras.layers.Dense(128, activation="relu"),
        tf.keras.layers.Dropout(0.3),
        tf.keras.layers.Dense(64, activation="relu"),
        tf.keras.layers.Dense(len(KSL_LABELS), activation="softmax"),
    ])


def _sha256(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as artifact:
        for chunk in iter(lambda: artifact.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_ksl_model(model_path=MODEL_PATH, manifest_path=MANIFEST_PATH):
    """Validate provenance/contract, reconstruct the model, then load weights only."""
    model_path, manifest_path = Path(model_path), Path(manifest_path)
    with manifest_path.open(encoding="utf-8") as source:
        manifest = json.load(source)
    if (manifest.get("provider") != "ksl-experimental" or
            manifest.get("task") != "isolated-word-ksl" or
            manifest.get("artifact") != model_path.name):
        raise ValueError("KSL manifest identity is incompatible")
    if manifest.get("labels") != KSL_LABELS:
        raise ValueError("KSL manifest label order does not match the provider")
    if manifest.get("input_shape") != [SEQUENCE_LENGTH, FEATURE_COUNT]:
        raise ValueError("KSL manifest input shape is incompatible")
    expected_hash = manifest.get("sha256", "").lower()
    if len(expected_hash) != 64 or _sha256(model_path) != expected_hash:
        raise ValueError("KSL model checksum does not match its manifest")
    model = _architecture()
    model.load_weights(str(model_path))
    if model.input_shape != (None, SEQUENCE_LENGTH, FEATURE_COUNT):
        raise ValueError("KSL model input shape is incompatible")
    if model.output_shape != (None, len(KSL_LABELS)):
        raise ValueError("KSL model output shape is incompatible")
    return model


def extract_keypoints(results):
    """Match the upstream MediaPipe Holistic 1662-value feature ordering."""
    pose = np.array([[p.x, p.y, p.z, p.visibility]
                     for p in results.pose_landmarks.landmark]).flatten() \
        if results.pose_landmarks else np.zeros(33 * 4)
    face = np.array([[p.x, p.y, p.z]
                     for p in results.face_landmarks.landmark]).flatten() \
        if results.face_landmarks else np.zeros(468 * 3)
    left = np.array([[p.x, p.y, p.z]
                     for p in results.left_hand_landmarks.landmark]).flatten() \
        if results.left_hand_landmarks else np.zeros(21 * 3)
    right = np.array([[p.x, p.y, p.z]
                      for p in results.right_hand_landmarks.landmark]).flatten() \
        if results.right_hand_landmarks else np.zeros(21 * 3)
    features = np.concatenate([pose, face, left, right]).astype(np.float32)
    if features.shape != (FEATURE_COUNT,) or not np.all(np.isfinite(features)):
        raise ValueError("Holistic landmarks produced an invalid feature vector")
    return features


class _Session:
    def __init__(self):
        self.frames = deque(maxlen=SEQUENCE_LENGTH)
        self.predictions = deque(maxlen=DEFAULT_STABILITY)
        self.last_seen = time.monotonic()
        self.awaiting_reset = False


class KslInferenceEngine:
    provider_id = "ksl-experimental"

    def __init__(self, model=None, holistic=None, threshold=None, stability=None,
                 session_ttl=DEFAULT_SESSION_TTL, max_sessions=DEFAULT_MAX_SESSIONS):
        self.model = model if model is not None else load_ksl_model()
        self.holistic = holistic if holistic is not None else mp.solutions.holistic.Holistic(
            min_detection_confidence=0.5, min_tracking_confidence=0.5)
        self.threshold = float(threshold if threshold is not None else
                               os.getenv("KSL_CONFIDENCE_THRESHOLD", DEFAULT_THRESHOLD))
        self.stability = int(stability if stability is not None else
                             os.getenv("KSL_STABILITY_FRAMES", DEFAULT_STABILITY))
        if not 0 < self.threshold <= 1 or not 1 <= self.stability <= 10:
            raise ValueError("KSL confidence/stability configuration is invalid")
        self.session_ttl = session_ttl
        self.max_sessions = max_sessions
        self.sessions = {}
        self.lock = threading.Lock()

    @property
    def capability(self):
        return {"id": self.provider_id, "available": True, "experimental": True,
                "task": "isolated-word-ksl", "sequenceLength": SEQUENCE_LENGTH,
                "vocabulary": list(KSL_LABELS)}

    def _session(self, session_id):
        now = time.monotonic()
        expired = [key for key, value in self.sessions.items()
                   if now - value.last_seen > self.session_ttl]
        for key in expired:
            del self.sessions[key]
        if session_id not in self.sessions:
            if len(self.sessions) >= self.max_sessions:
                oldest = min(self.sessions, key=lambda key: self.sessions[key].last_seen)
                del self.sessions[oldest]
            self.sessions[session_id] = _Session()
        session = self.sessions[session_id]
        session.last_seen = now
        session.predictions = deque(session.predictions, maxlen=self.stability)
        return session

    def reset(self, session_id):
        with self.lock:
            self.sessions.pop(session_id, None)

    def infer(self, rgb_image, session_id):
        with self.lock:
            session = self._session(session_id)
            results = self.holistic.process(rgb_image)
            tracked = any((getattr(results, "left_hand_landmarks", None),
                           getattr(results, "right_hand_landmarks", None)))
            if not tracked:
                session.frames.clear()
                session.predictions.clear()
                session.awaiting_reset = False
                return {"status": "no-landmarks", "progress": 0}
            if session.awaiting_reset:
                return {"status": "awaiting-reset", "progress": 0}
            session.frames.append(extract_keypoints(results))
            progress = len(session.frames)
            if progress < SEQUENCE_LENGTH:
                return {"status": "warming-up", "progress": progress}
            scores = np.asarray(self.model.predict(
                np.expand_dims(np.asarray(session.frames, dtype=np.float32), 0), verbose=0))
            if scores.shape != (1, len(KSL_LABELS)) or not np.all(np.isfinite(scores)):
                raise ValueError("KSL model returned invalid scores")
            index = int(np.argmax(scores[0]))
            confidence = float(scores[0, index])
            if not math.isfinite(confidence) or confidence < self.threshold:
                session.predictions.clear()
                return {"status": "low-confidence", "progress": progress,
                        "confidence": confidence * 100}
            session.predictions.append(index)
            if len(session.predictions) < self.stability or len(set(session.predictions)) != 1:
                return {"status": "stabilizing", "progress": progress,
                        "confidence": confidence * 100}
            label = KSL_LABELS[index]
            session.awaiting_reset = True
            session.frames.clear()
            session.predictions.clear()
            return {"status": "recognized", "progress": progress, "label": label,
                    "text": DISPLAY_TEXT.get(label, label.replace("-", " ").title()),
                    "confidence": confidence * 100}
