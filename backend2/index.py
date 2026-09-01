"""Browser-frame inference API for the supplied static gesture model."""
import base64
import binascii
import math
import os
import re
import threading
from io import BytesIO
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np
import tensorflow as tf
from flask import Flask, jsonify, request
from flask_cors import CORS
from PIL import Image, UnidentifiedImageError
from werkzeug.exceptions import RequestEntityTooLarge

MODULE_DIR = Path(__file__).resolve().parent
MODEL_DIR = MODULE_DIR / "Model"
MAX_FRAME_BYTES = 5 * 1024 * 1024
MAX_REQUEST_BYTES = 8 * 1024 * 1024
MAX_IMAGE_WIDTH = 4096
MAX_IMAGE_HEIGHT = 4096
MAX_IMAGE_PIXELS = 12_000_000
DATA_URL_RE = re.compile(r"^data:image/(?:jpeg|jpg|png|webp);base64,", re.IGNORECASE)


class FrameValidationError(ValueError):
    """Safe client-facing invalid frame error."""


class FrameTooLargeError(FrameValidationError):
    """Decoded frame or image dimensions exceed safe limits."""


class CustomDepthwiseConv2D(tf.keras.layers.DepthwiseConv2D):
    def __init__(self, **kwargs):
        kwargs.pop("groups", None)
        super().__init__(**kwargs)


tf.keras.utils.get_custom_objects()["DepthwiseConv2D"] = CustomDepthwiseConv2D


def load_labels(path=MODEL_DIR / "labels.txt"):
    with Path(path).open(encoding="utf-8") as label_file:
        labels = [re.sub(r"^\s*\d+\s+", "", line.strip())
                  for line in label_file if line.strip()]
    if not labels or any(not label for label in labels):
        raise ValueError("Label file is empty or invalid")
    return labels


def prediction_text(label):
    return {"Hello": "Hello there!", "Yes": "Yes, I agree.", "No": "No, I disagree.",
            "Thankyou": "Thank you very much."}.get(label, label)


class InferenceEngine:
    def __init__(self, model=None, hands=None, labels=None):
        self.model = model if model is not None else tf.keras.models.load_model(
            str(MODEL_DIR / "keras_model.h5"))
        self.hands = hands if hands is not None else mp.solutions.hands.Hands(max_num_hands=1)
        self.labels = labels if labels is not None else load_labels()
        if not self.labels:
            raise ValueError("At least one model label is required")
        self.lock = threading.Lock()

    def infer(self, rgb_image):
        with self.lock:
            results = self.hands.process(rgb_image)
            detected = getattr(results, "multi_hand_landmarks", None)
            if not detected:
                return None
            landmarks = getattr(detected[0], "landmark", None)
            if not landmarks:
                return None
            height, width = rgb_image.shape[:2]
            xs = [max(0, min(width - 1, int(point.x * width))) for point in landmarks]
            ys = [max(0, min(height - 1, int(point.y * height))) for point in landmarks]
            left = max(0, min(xs) - 20)
            top = max(0, min(ys) - 20)
            right = min(width, max(xs) + 21)
            bottom = min(height, max(ys) + 21)
            if right <= left or bottom <= top:
                return None
            crop = rgb_image[top:bottom, left:right]
            if crop.size == 0:
                return None

            crop_h, crop_w = crop.shape[:2]
            canvas = np.full((300, 300, 3), 255, dtype=np.uint8)
            scale = min(300 / crop_w, 300 / crop_h)
            resized_w = max(1, min(300, math.ceil(crop_w * scale)))
            resized_h = max(1, min(300, math.ceil(crop_h * scale)))
            resized = cv2.resize(crop, (resized_w, resized_h))
            x_gap, y_gap = (300 - resized_w) // 2, (300 - resized_h) // 2
            canvas[y_gap:y_gap + resized_h, x_gap:x_gap + resized_w] = resized
            tensor = np.expand_dims(
                cv2.resize(canvas, (224, 224)).astype(np.float32) / 255.0, 0)
            raw_prediction = np.asarray(self.model.predict(tensor, verbose=0))
            if raw_prediction.ndim != 2 or raw_prediction.shape != (1, len(self.labels)):
                raise ValueError("Model output does not match label count")
            scores = raw_prediction[0]
            if not np.all(np.isfinite(scores)):
                raise ValueError("Model returned non-finite scores")
            index = int(np.argmax(scores))
            confidence = float(scores[index] * 100)
            if not math.isfinite(confidence):
                raise ValueError("Model returned invalid confidence")
            return self.labels[index], confidence


def response_payload(hand_detected=False, label=None, text=None, confidence=None, error=None):
    return {"handDetected": hand_detected, "label": label, "text": text,
            "confidence": confidence, "error": error}


def decode_frame(payload):
    if not isinstance(payload, dict) or not isinstance(payload.get("image"), str):
        raise FrameValidationError("A base64 image data URL is required")
    encoded = DATA_URL_RE.sub("", payload["image"], count=1)
    if encoded == payload["image"]:
        raise FrameValidationError("Image must be a JPEG, PNG, or WebP data URL")
    try:
        raw = base64.b64decode(encoded, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise FrameValidationError("Image data is not valid base64") from exc
    if not raw:
        raise FrameValidationError("Image is empty")
    if len(raw) > MAX_FRAME_BYTES:
        raise FrameTooLargeError("Decoded frame is too large")
    try:
        with Image.open(BytesIO(raw)) as image:
            width, height = image.size
            if (width <= 0 or height <= 0 or width > MAX_IMAGE_WIDTH or
                    height > MAX_IMAGE_HEIGHT or width * height > MAX_IMAGE_PIXELS):
                raise FrameTooLargeError("Image dimensions are too large")
            image.load()
            return np.asarray(image.convert("RGB"))
    except FrameTooLargeError:
        raise
    except (Image.DecompressionBombError, UnidentifiedImageError, OSError, ValueError) as exc:
        raise FrameValidationError("Image data could not be decoded") from exc


def create_app(engine=None, engine_factory=InferenceEngine):
    app = Flask(__name__)
    app.config["MAX_CONTENT_LENGTH"] = MAX_REQUEST_BYTES
    origins = [item.strip() for item in os.getenv(
        "CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
               if item.strip()]
    CORS(app, resources={r"/interpret": {"origins": origins}})
    inference_engine = engine
    initialization_lock = threading.Lock()

    def get_engine():
        nonlocal inference_engine
        if inference_engine is None:
            with initialization_lock:
                if inference_engine is None:
                    inference_engine = engine_factory()
        return inference_engine

    @app.errorhandler(413)
    def too_large(_error):
        return jsonify(response_payload(error="Frame payload is too large")), 413

    @app.post("/interpret")
    def interpret():
        try:
            image = decode_frame(request.get_json(silent=True))
        except RequestEntityTooLarge:
            return jsonify(response_payload(error="Frame payload is too large")), 413
        except FrameTooLargeError as exc:
            return jsonify(response_payload(error=str(exc))), 413
        except FrameValidationError as exc:
            return jsonify(response_payload(error=str(exc))), 400
        try:
            prediction = get_engine().infer(image)
        except Exception:
            app.logger.exception("Inference failed")
            return jsonify(response_payload(error="Inference is temporarily unavailable")), 500
        if prediction is None:
            return jsonify(response_payload()), 200
        label, confidence = prediction
        return jsonify(response_payload(True, label, prediction_text(label), confidence)), 200

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host=os.getenv("INFERENCE_HOST", "127.0.0.1"),
            port=int(os.getenv("INFERENCE_PORT", "5001")), debug=False)
