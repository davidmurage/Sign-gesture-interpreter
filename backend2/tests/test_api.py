import base64
import io
import threading
import time
import unittest
from types import SimpleNamespace
from unittest.mock import patch
import numpy as np
from PIL import Image
from backend2.index import (InferenceEngine, MAX_FRAME_BYTES, MAX_REQUEST_BYTES,
                            create_app, decode_frame, load_labels)

def image_url():
    output = io.BytesIO()
    Image.new("RGB", (32, 24), "red").save(output, "JPEG")
    return "data:image/jpeg;base64," + base64.b64encode(output.getvalue()).decode()

class FakeEngine:
    def __init__(self, result=None, error=None):
        self.result, self.error, self.calls = result, error, 0
    def infer(self, image):
        self.calls += 1
        self.shape = image.shape
        if self.error:
            raise self.error
        return self.result

class ApiTests(unittest.TestCase):
    def client(self, engine):
        app = create_app(engine)
        app.testing = True
        return app.test_client()
    def test_recognized_hand_has_stable_schema_and_normalized_label(self):
        engine = FakeEngine(("Hello", 91.25))
        response = self.client(engine).post("/interpret", json={"image": image_url()})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {"handDetected": True, "label": "Hello",
            "text": "Hello there!", "confidence": 91.25, "error": None})
        self.assertEqual(engine.shape, (24, 32, 3))
    def test_no_hand_clears_prediction_fields(self):
        response = self.client(FakeEngine()).post("/interpret", json={"image": image_url()})
        self.assertEqual(response.get_json(), {"handDetected": False, "label": None,
            "text": None, "confidence": None, "error": None})
    def test_invalid_inputs_do_not_run_inference(self):
        engine = FakeEngine()
        for body in (None, {}, {"image": "bad"}, {"image": "data:image/jpeg;base64,%%%"}):
            response = self.client(engine).post("/interpret", json=body)
            self.assertEqual(response.status_code, 400)
        self.assertEqual(engine.calls, 0)
    def test_oversized_request_is_413(self):
        response = self.client(FakeEngine()).post(
            "/interpret", data=b"x" * (MAX_REQUEST_BYTES + 1),
            content_type="application/json")
        self.assertEqual(response.status_code, 413)
    def test_inference_failure_is_safe(self):
        response = self.client(FakeEngine(error=RuntimeError("secret"))).post("/interpret", json={"image": image_url()})
        self.assertEqual(response.status_code, 500)
        self.assertNotIn("secret", response.get_data(as_text=True))
    def test_engine_value_error_is_server_failure(self):
        response = self.client(FakeEngine(error=ValueError("model detail"))).post(
            "/interpret", json={"image": image_url()})
        self.assertEqual(response.status_code, 500)
        self.assertNotIn("model detail", response.get_data(as_text=True))
    def test_valid_base64_that_is_not_an_image_is_400(self):
        value = "data:image/jpeg;base64," + base64.b64encode(b"not an image").decode()
        self.assertEqual(self.client(FakeEngine()).post(
            "/interpret", json={"image": value}).status_code, 400)
    def test_decoded_size_boundary(self):
        url = image_url()
        raw_size = len(base64.b64decode(url.split(",", 1)[1]))
        with patch("backend2.index.MAX_FRAME_BYTES", raw_size):
            self.assertEqual(decode_frame({"image": url}).shape, (24, 32, 3))
        with patch("backend2.index.MAX_FRAME_BYTES", raw_size - 1):
            self.assertEqual(self.client(FakeEngine()).post(
                "/interpret", json={"image": url}).status_code, 413)
    def test_dimension_limit_is_413(self):
        output = io.BytesIO()
        Image.new("RGB", (4097, 1)).save(output, "PNG")
        value = "data:image/png;base64," + base64.b64encode(output.getvalue()).decode()
        self.assertEqual(self.client(FakeEngine()).post(
            "/interpret", json={"image": value}).status_code, 413)
    def test_pixel_limit_is_413_before_full_decode(self):
        output = io.BytesIO()
        Image.new("1", (4000, 4000)).save(output, "PNG")
        value = "data:image/png;base64," + base64.b64encode(output.getvalue()).decode()
        self.assertEqual(self.client(FakeEngine()).post(
            "/interpret", json={"image": value}).status_code, 413)
    def test_http_limit_allows_base64_overhead(self):
        app = create_app(FakeEngine())
        self.assertGreater(app.config["MAX_CONTENT_LENGTH"], MAX_FRAME_BYTES * 4 / 3)
    def test_numeric_label_prefixes_are_removed_in_order(self):
        labels = load_labels()
        self.assertEqual((labels[0], labels[27], labels[28]), ("A", "Hello", "Thankyou"))

    def test_lazy_initialization_is_synchronized(self):
        calls = []
        engine = FakeEngine()
        def factory():
            calls.append(1)
            time.sleep(.03)
            return engine
        app = create_app(engine_factory=factory)
        statuses = []
        def invoke():
            with app.test_client() as client:
                statuses.append(client.post("/interpret", json={"image": image_url()}).status_code)
        threads = [threading.Thread(target=invoke) for _ in range(4)]
        for thread in threads: thread.start()
        for thread in threads: thread.join()
        self.assertEqual(statuses, [200] * 4)
        self.assertEqual(len(calls), 1)


class FakeHands:
    def __init__(self, landmarks):
        self.landmarks = landmarks
    def process(self, image):
        self.input = image
        hand = SimpleNamespace(landmark=self.landmarks)
        return SimpleNamespace(multi_hand_landmarks=[hand])


class CapturingModel:
    def __init__(self, output):
        self.output = output
    def predict(self, tensor, verbose=0):
        self.tensor, self.verbose = tensor, verbose
        return self.output


class InferenceEngineTests(unittest.TestCase):
    def test_crop_tensor_normalization_label_and_confidence(self):
        points = [SimpleNamespace(x=0, y=0), SimpleNamespace(x=1, y=1)]
        hands = FakeHands(points)
        model = CapturingModel([[.1, .9]])
        engine = InferenceEngine(model=model, hands=hands, labels=["A", "B"])
        image = np.zeros((10, 20, 3), dtype=np.uint8)
        image[:] = [10, 20, 30]
        self.assertEqual(engine.infer(image), ("B", 90.0))
        self.assertIs(hands.input, image)
        self.assertEqual(model.tensor.shape, (1, 224, 224, 3))
        self.assertEqual(model.tensor.dtype, np.float32)
        self.assertGreaterEqual(float(model.tensor.min()), 0)
        self.assertLessEqual(float(model.tensor.max()), 1)
        np.testing.assert_allclose(
            model.tensor[0, 112, 112], np.array([10, 20, 30]) / 255, atol=.02)
    def test_empty_landmarks_is_no_hand(self):
        engine = InferenceEngine(model=CapturingModel([[1]]), hands=FakeHands([]), labels=["A"])
        self.assertIsNone(engine.infer(np.zeros((5, 5, 3), dtype=np.uint8)))
    def test_invalid_model_outputs_are_rejected(self):
        points = [SimpleNamespace(x=.2, y=.2), SimpleNamespace(x=.8, y=.8)]
        for output in ([[1]], [[.5, .5, 0]], [[np.nan, .5]], [np.inf, 0]):
            engine = InferenceEngine(model=CapturingModel(output), hands=FakeHands(points),
                                     labels=["A", "B"])
            with self.assertRaises(ValueError):
                engine.infer(np.zeros((20, 20, 3), dtype=np.uint8))

if __name__ == "__main__":
    unittest.main()
