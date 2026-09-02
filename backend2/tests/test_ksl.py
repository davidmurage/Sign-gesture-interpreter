import unittest
from types import SimpleNamespace
from unittest.mock import patch

import numpy as np

from backend2.providers.ksl import (FEATURE_COUNT, KSL_LABELS, SEQUENCE_LENGTH,
                                    KslInferenceEngine, extract_keypoints)


def landmarks(count, visibility=False):
    values = []
    for index in range(count):
        point = {"x": index / max(count, 1), "y": 0.2, "z": -0.1}
        if visibility:
            point["visibility"] = 0.9
        values.append(SimpleNamespace(**point))
    return SimpleNamespace(landmark=values)


def holistic_result(tracked=True):
    return SimpleNamespace(
        pose_landmarks=landmarks(33, True) if tracked else None,
        face_landmarks=landmarks(468) if tracked else None,
        left_hand_landmarks=landmarks(21) if tracked else None,
        right_hand_landmarks=landmarks(21) if tracked else None,
    )


class FakeHolistic:
    def __init__(self, results=None):
        self.results = list(results or [])

    def process(self, image):
        self.image = image
        return self.results.pop(0) if self.results else holistic_result()


class FakeModel:
    def __init__(self, index=16, confidence=0.9):
        self.index, self.confidence, self.calls = index, confidence, 0

    def predict(self, tensor, verbose=0):
        self.calls += 1
        self.tensor = tensor
        scores = np.full((1, len(KSL_LABELS)),
                         (1 - self.confidence) / (len(KSL_LABELS) - 1))
        scores[0, self.index] = self.confidence
        return scores


class KslProviderTests(unittest.TestCase):
    def test_feature_order_has_exact_upstream_shape(self):
        features = extract_keypoints(holistic_result())
        self.assertEqual(features.shape, (FEATURE_COUNT,))
        self.assertEqual(features.dtype, np.float32)
        self.assertAlmostEqual(float(features[3]), 0.9)

    def test_sequence_warms_up_stabilizes_and_recognizes(self):
        model = FakeModel()
        engine = KslInferenceEngine(model=model, holistic=FakeHolistic(),
                                    threshold=0.7, stability=3)
        image = np.zeros((24, 32, 3), dtype=np.uint8)
        for progress in range(1, SEQUENCE_LENGTH):
            result = engine.infer(image, "stream-one")
            self.assertEqual(result, {"status": "warming-up", "progress": progress})
        self.assertEqual(engine.infer(image, "stream-one")["status"], "stabilizing")
        self.assertEqual(engine.infer(image, "stream-one")["status"], "stabilizing")
        result = engine.infer(image, "stream-one")
        self.assertEqual((result["status"], result["label"], result["text"]),
                         ("recognized", "hello", "Hello"))
        self.assertEqual(model.tensor.shape, (1, 30, 1662))
        self.assertEqual(engine.infer(image, "stream-one"),
                         {"status": "awaiting-reset", "progress": 0})

    def test_tracking_loss_resets_sequence(self):
        holistic = FakeHolistic([holistic_result(), holistic_result(False), holistic_result()])
        engine = KslInferenceEngine(model=FakeModel(), holistic=holistic)
        image = np.zeros((8, 8, 3), dtype=np.uint8)
        self.assertEqual(engine.infer(image, "stream")["progress"], 1)
        self.assertEqual(engine.infer(image, "stream"), {"status": "no-landmarks", "progress": 0})
        self.assertEqual(engine.infer(image, "stream")["progress"], 1)

    def test_low_confidence_abstains(self):
        engine = KslInferenceEngine(model=FakeModel(confidence=0.4),
                                    holistic=FakeHolistic(), threshold=0.7)
        image = np.zeros((8, 8, 3), dtype=np.uint8)
        result = None
        for _ in range(SEQUENCE_LENGTH):
            result = engine.infer(image, "stream")
        self.assertEqual(result["status"], "low-confidence")
        self.assertNotIn("label", result)

    def test_pose_without_a_hand_does_not_enter_sequence(self):
        pose_only = holistic_result(False)
        pose_only.pose_landmarks = landmarks(33, True)
        engine = KslInferenceEngine(model=FakeModel(), holistic=FakeHolistic([pose_only]))
        self.assertEqual(engine.infer(np.zeros((8, 8, 3), dtype=np.uint8), "stream"),
                         {"status": "no-landmarks", "progress": 0})

    def test_explicit_configuration_is_not_overridden_by_environment(self):
        with patch.dict("os.environ", {"KSL_CONFIDENCE_THRESHOLD": "0.2",
                                       "KSL_STABILITY_FRAMES": "9"}):
            engine = KslInferenceEngine(model=FakeModel(), holistic=FakeHolistic(),
                                        threshold=0.8, stability=2)
        self.assertEqual((engine.threshold, engine.stability), (0.8, 2))
        with self.assertRaises(ValueError):
            KslInferenceEngine(model=FakeModel(), holistic=FakeHolistic(), threshold=0)


if __name__ == "__main__":
    unittest.main()
