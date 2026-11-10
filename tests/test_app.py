"""API tests for app.py. MediaPipe is replaced by a lightweight fake so the
request handling, validation, aggregation and persistence logic can be tested
without the model; real pose accuracy is NOT covered here."""
import base64
import enum
import io
import os
import sys
import types
import unittest
from types import SimpleNamespace

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)


class PoseLandmark(enum.IntEnum):
    NOSE = 0
    LEFT_SHOULDER = 11
    RIGHT_SHOULDER = 12
    LEFT_ELBOW = 13
    RIGHT_ELBOW = 14
    LEFT_WRIST = 15
    RIGHT_WRIST = 16
    LEFT_HIP = 23
    RIGHT_HIP = 24
    LEFT_KNEE = 25
    RIGHT_KNEE = 26
    LEFT_ANKLE = 27
    RIGHT_ANKLE = 28


def make_landmarks(shoulder_half=0.148):
    lm = [SimpleNamespace(x=0.5, y=0.5, visibility=0.99) for _ in range(33)]
    def put(p, x, y):
        lm[p] = SimpleNamespace(x=x, y=y, visibility=0.99)
    put(PoseLandmark.NOSE, 0.5, 0.08)
    put(PoseLandmark.LEFT_SHOULDER, 0.5 - shoulder_half, 0.2)
    put(PoseLandmark.RIGHT_SHOULDER, 0.5 + shoulder_half, 0.2)
    put(PoseLandmark.LEFT_ELBOW, 0.3, 0.35)
    put(PoseLandmark.RIGHT_ELBOW, 0.7, 0.35)
    put(PoseLandmark.LEFT_WRIST, 0.28, 0.5)
    put(PoseLandmark.RIGHT_WRIST, 0.72, 0.5)
    put(PoseLandmark.LEFT_HIP, 0.40, 0.5)
    put(PoseLandmark.RIGHT_HIP, 0.60, 0.5)
    put(PoseLandmark.LEFT_KNEE, 0.43, 0.7)
    put(PoseLandmark.RIGHT_KNEE, 0.57, 0.7)
    put(PoseLandmark.LEFT_ANKLE, 0.43, 0.95)
    put(PoseLandmark.RIGHT_ANKLE, 0.57, 0.95)
    return lm


class FakePose:
    next_landmarks = None
    def __init__(self, *a, **k): pass
    def process(self, image):
        lm = FakePose.next_landmarks
        return SimpleNamespace(pose_landmarks=SimpleNamespace(landmark=lm) if lm else None)


def install_fake_mediapipe():
    mp = types.ModuleType('mediapipe')
    drawing = SimpleNamespace(
        DrawingSpec=lambda **k: None,
        draw_landmarks=lambda *a, **k: None)
    mp.solutions = SimpleNamespace(
        pose=SimpleNamespace(Pose=FakePose, PoseLandmark=PoseLandmark, POSE_CONNECTIONS=[]),
        drawing_utils=drawing,
        drawing_styles=SimpleNamespace())
    sys.modules['mediapipe'] = mp


install_fake_mediapipe()
os.environ.pop('FLASK_DEBUG', None)
import app as backend  # noqa: E402
from PIL import Image  # noqa: E402


def data_url(w=600, h=800):
    buf = io.BytesIO()
    Image.new('RGB', (w, h), (120, 130, 140)).save(buf, 'JPEG')
    return 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode()


class ApiTests(unittest.TestCase):
    def setUp(self):
        backend.app.config.update(TESTING=True)
        self.client = backend.app.test_client()
        FakePose.next_landmarks = make_landmarks()

    def test_health(self):
        self.assertEqual(self.client.get('/api/health').status_code, 200)

    def test_measure_requires_images(self):
        r = self.client.post('/api/measure', json={'height': 170})
        self.assertEqual(r.status_code, 400)
        r = self.client.post('/api/measure', data='nope', content_type='text/plain')
        self.assertEqual(r.status_code, 400)

    def test_measure_rejects_bad_height_and_image(self):
        r = self.client.post('/api/measure', json={'images': [data_url()], 'height': 50})
        self.assertEqual(r.status_code, 400)
        r = self.client.post('/api/measure', json={'images': ['data:image/jpeg;base64,@@@'], 'height': 170})
        self.assertEqual(r.status_code, 400)
        r = self.client.post('/api/measure', json={'images': ['garbage'], 'height': 170})
        self.assertEqual(r.status_code, 400)
        r = self.client.post('/api/measure', json={'images': [data_url(100, 100)], 'height': 170})
        self.assertIn('resolution', r.get_json()['error'])

    def test_implausible_pose_is_rejected(self):
        FakePose.next_landmarks = make_landmarks(shoulder_half=0.04)  # ~10 cm shoulders
        r = self.client.post('/api/measure', json={'images': [data_url()], 'height': 175})
        self.assertEqual(r.status_code, 400)
        self.assertIn('unrealistic', r.get_json()['error'])

    def test_scale_uses_stature_not_nose_to_ankle(self):
        # nose->ankle is 0.87 of an 800px image = 696px; stature ~ 696/0.9 => 175cm/773px
        m, _ = backend.measure_image(backend.decode_image(data_url()), 175)
        self.assertAlmostEqual(m['pixel_to_cm_ratio'], 175 / (696 / 0.9), delta=0.02)

    def test_measure_too_many_images(self):
        r = self.client.post('/api/measure', json={'images': [data_url()] * 4, 'height': 170})
        self.assertEqual(r.status_code, 400)

    def test_measure_no_pose(self):
        FakePose.next_landmarks = None
        r = self.client.post('/api/measure', json={'images': [data_url()], 'height': 170})
        self.assertEqual(r.status_code, 400)
        self.assertIn('No pose', r.get_json()['error'])

    def test_measure_multiple_images_and_legacy_single(self):
        r = self.client.post('/api/measure', json={'images': [data_url(), data_url()], 'height': 175})
        self.assertEqual(r.status_code, 200, r.get_json())
        body = r.get_json()
        self.assertEqual(body['images_processed'], 2)
        m = body['measurements']
        for k in backend.MEASURE_KEYS + ['recommended_size']:
            self.assertIn(k, m)
        self.assertTrue(body['annotated_image'].startswith('data:image/jpeg;base64,'))
        # deterministic: same landmarks => same result as single legacy call
        r2 = self.client.post('/api/measure', json={'image': data_url(), 'height': 175})
        self.assertEqual(r2.get_json()['measurements'], m)

    def test_size_recommendation(self):
        size, conf = backend.recommend_size_enhanced({'chest': 98, 'waist': 82, 'hips': 107})
        self.assertEqual(size, 'M')
        self.assertGreater(conf, 0.9)


if __name__ == '__main__':
    unittest.main()
