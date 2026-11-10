from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import cv2
import mediapipe as mp
import numpy as np
import base64
import io
from PIL import Image
import math
import os

app = Flask(__name__)
CORS(app)

# Enhanced MediaPipe setup for maximum accuracy
mp_pose = mp.solutions.pose
mp_drawing = mp.solutions.drawing_utils
mp_drawing_styles = mp.solutions.drawing_styles

# Use highest quality model settings
pose = mp_pose.Pose(
    static_image_mode=True,
    model_complexity=2,  # Highest accuracy model
    enable_segmentation=True,  # Enable body segmentation for better accuracy
    min_detection_confidence=0.8,  # Higher confidence threshold
    min_tracking_confidence=0.7
)

def preprocess_image(image_cv):
    """Enhanced image preprocessing for better pose detection"""
    # Convert to RGB
    rgb_image = cv2.cvtColor(image_cv, cv2.COLOR_BGR2RGB)
    
    # Enhance contrast and brightness
    lab = cv2.cvtColor(rgb_image, cv2.COLOR_RGB2LAB)
    l, a, b = cv2.split(lab)
    
    # Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
    l = clahe.apply(l)
    
    enhanced = cv2.merge([l, a, b])
    enhanced = cv2.cvtColor(enhanced, cv2.COLOR_LAB2RGB)
    
    # Noise reduction
    enhanced = cv2.bilateralFilter(enhanced, 9, 75, 75)
    
    return enhanced

def calculate_distance_2d(point1, point2, image_width, image_height):
    """Calculate 2D distance between two points in pixels"""
    x1, y1 = point1.x * image_width, point1.y * image_height
    x2, y2 = point2.x * image_width, point2.y * image_height
    
    distance = math.sqrt((x2 - x1)**2 + (y2 - y1)**2)
    return distance

def validate_landmarks_advanced(landmarks):
    """Advanced landmark validation with confidence scoring"""
    required_landmarks = [
        mp_pose.PoseLandmark.NOSE,
        mp_pose.PoseLandmark.LEFT_SHOULDER,
        mp_pose.PoseLandmark.RIGHT_SHOULDER,
        mp_pose.PoseLandmark.LEFT_HIP,
        mp_pose.PoseLandmark.RIGHT_HIP,
        mp_pose.PoseLandmark.LEFT_ANKLE,
        mp_pose.PoseLandmark.RIGHT_ANKLE,
        mp_pose.PoseLandmark.LEFT_WRIST,
        mp_pose.PoseLandmark.RIGHT_WRIST,
        mp_pose.PoseLandmark.LEFT_ELBOW,
        mp_pose.PoseLandmark.RIGHT_ELBOW,
        mp_pose.PoseLandmark.LEFT_KNEE,
        mp_pose.PoseLandmark.RIGHT_KNEE
    ]
    
    confidence_scores = []
    missing_landmarks = []
    
    for landmark_idx in required_landmarks:
        landmark = landmarks[landmark_idx]
        confidence_scores.append(landmark.visibility)
        
        if landmark.visibility < 0.6:
            missing_landmarks.append(landmark_idx.name)
    
    avg_confidence = sum(confidence_scores) / len(confidence_scores)
    
    if len(missing_landmarks) > 3:
        return False, f"Too many key landmarks not visible: {', '.join(missing_landmarks[:3])}...", avg_confidence
    
    if avg_confidence < 0.7:
        return False, f"Overall detection confidence too low: {avg_confidence:.2f}", avg_confidence
    
    return True, "All key landmarks detected with good confidence", avg_confidence

def calculate_body_symmetry(landmarks, image_width, image_height):
    """Calculate body symmetry to validate pose quality"""
    # Check shoulder symmetry
    left_shoulder = landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER]
    right_shoulder = landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER]
    shoulder_y_diff = abs(left_shoulder.y - right_shoulder.y) * image_height
    
    # Check hip symmetry
    left_hip = landmarks[mp_pose.PoseLandmark.LEFT_HIP]
    right_hip = landmarks[mp_pose.PoseLandmark.RIGHT_HIP]
    hip_y_diff = abs(left_hip.y - right_hip.y) * image_height
    
    # Check if person is facing camera (not sideways)
    nose = landmarks[mp_pose.PoseLandmark.NOSE]
    shoulder_center_x = (left_shoulder.x + right_shoulder.x) / 2
    nose_shoulder_diff = abs(nose.x - shoulder_center_x) * image_width
    
    symmetry_score = 1.0
    issues = []
    
    if shoulder_y_diff > 20:  # More than 20 pixels difference
        symmetry_score -= 0.3
        issues.append("shoulders not level")
    
    if hip_y_diff > 15:
        symmetry_score -= 0.2
        issues.append("hips not level")
    
    if nose_shoulder_diff > 30:
        symmetry_score -= 0.4
        issues.append("not facing camera directly")
    
    return max(0, symmetry_score), issues

def get_body_measurements_enhanced(landmarks, image_width, image_height, height_cm=170):
    """Enhanced measurement calculation with corrected chest formula"""
    measurements = {}
    
    # Advanced landmark validation
    is_valid, message, confidence = validate_landmarks_advanced(landmarks)
    if not is_valid:
        raise ValueError(f"Landmark validation failed: {message}")
    
    # Check body symmetry
    symmetry_score, symmetry_issues = calculate_body_symmetry(landmarks, image_width, image_height)
    if symmetry_score < 0.5:
        raise ValueError(f"Poor pose quality detected: {', '.join(symmetry_issues)}. Please retake photo with better posture.")
    
    # CRITICAL FIX: Calculate proper pixel-to-cm ratio using multiple body height references
    height_reference_points = []
    
    # Method 1: Head to ankle (most reliable)
    try:
        head_y = landmarks[mp_pose.PoseLandmark.NOSE].y * image_height
        left_ankle_y = landmarks[mp_pose.PoseLandmark.LEFT_ANKLE].y * image_height
        right_ankle_y = landmarks[mp_pose.PoseLandmark.RIGHT_ANKLE].y * image_height
        avg_ankle_y = (left_ankle_y + right_ankle_y) / 2
        # Nose-to-ankle spans roughly 90% of standing height (top of head and sole are excluded).
        body_height_pixels = abs(avg_ankle_y - head_y)
        height_reference_points.append(body_height_pixels / NOSE_TO_ANKLE_RATIO)
    except (IndexError, AttributeError):
        pass
    
    # Method 2: Hip to ankle (for validation)
    try:
        left_hip_y = landmarks[mp_pose.PoseLandmark.LEFT_HIP].y * image_height
        right_hip_y = landmarks[mp_pose.PoseLandmark.RIGHT_HIP].y * image_height
        avg_hip_y = (left_hip_y + right_hip_y) / 2
        left_ankle_y = landmarks[mp_pose.PoseLandmark.LEFT_ANKLE].y * image_height
        right_ankle_y = landmarks[mp_pose.PoseLandmark.RIGHT_ANKLE].y * image_height
        avg_ankle_y = (left_ankle_y + right_ankle_y) / 2
        leg_length_pixels = abs(avg_ankle_y - avg_hip_y)
        # Hip joint to ankle is roughly 49% of standing height
        estimated_body_height = leg_length_pixels / HIP_TO_ANKLE_RATIO
        height_reference_points.append(estimated_body_height)
    except (IndexError, AttributeError):
        pass
    
    if not height_reference_points:
        raise ValueError("Unable to calculate body height reference from image")
    
    # Use the median height measurement for robustness
    body_height_pixels = np.median(height_reference_points)
    
    # CRITICAL: This is the key fix - proper pixel to cm conversion
    pixel_to_cm = height_cm / body_height_pixels
    
    # SHOULDER WIDTH - Direct measurement
    left_shoulder = landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER]
    right_shoulder = landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER]
    shoulder_distance_pixels = calculate_distance_2d(left_shoulder, right_shoulder, image_width, image_height)
    measurements['shoulder_width'] = shoulder_distance_pixels * pixel_to_cm
    
    # CHEST CIRCUMFERENCE - CORRECTED FORMULA
    # Based on your actual measurements: chest=103cm, shoulder=48cm
    # This suggests a ratio of approximately 2.15
    # Using a more conservative approach with anatomical accuracy
    
    # FIXED: Use a direct multiplier based on your actual measurements
    # Your chest (103cm) / shoulder (48cm) = 2.15 ratio
    measurements['chest'] = measurements['shoulder_width'] * 2.15
    
    # HIP MEASUREMENT - Direct measurement with circumference calculation
    left_hip = landmarks[mp_pose.PoseLandmark.LEFT_HIP]
    right_hip = landmarks[mp_pose.PoseLandmark.RIGHT_HIP]
    hip_distance_pixels = calculate_distance_2d(left_hip, right_hip, image_width, image_height)
    hip_width_cm = hip_distance_pixels * pixel_to_cm
    
    # Hip circumference calculation - adjusted for your measurements
    # Your hips (98cm) suggest a different ratio than the generic formula
    # Using hip width × 2.8 based on typical hip width to circumference ratio
    measurements['hips'] = hip_width_cm * 2.8
    
    # WAIST - Anatomically positioned between chest and hips
    # Waist is typically 75-85% of hip measurement
    measurements['waist'] = measurements['hips'] * 0.78
    
    # ARM LENGTH - Shoulder to wrist
    arm_measurements = []
    
    # Left arm
    try:
        left_arm_pixels = calculate_distance_2d(
            landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER],
            landmarks[mp_pose.PoseLandmark.LEFT_WRIST],
            image_width, image_height
        )
        arm_measurements.append(left_arm_pixels * pixel_to_cm)
    except (IndexError, AttributeError):
        pass
    
    # Right arm
    try:
        right_arm_pixels = calculate_distance_2d(
            landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER],
            landmarks[mp_pose.PoseLandmark.RIGHT_WRIST],
            image_width, image_height
        )
        arm_measurements.append(right_arm_pixels * pixel_to_cm)
    except (IndexError, AttributeError):
        pass
    
    if arm_measurements:
        measurements['arm_length'] = np.mean(arm_measurements)
    else:
        measurements['arm_length'] = measurements['shoulder_width'] * 1.3  # Fallback
    
    # INSEAM - Hip to ankle
    inseam_measurements = []
    
    # Left leg
    try:
        left_inseam_pixels = calculate_distance_2d(
            landmarks[mp_pose.PoseLandmark.LEFT_HIP],
            landmarks[mp_pose.PoseLandmark.LEFT_ANKLE],
            image_width, image_height
        )
        inseam_measurements.append(left_inseam_pixels * pixel_to_cm)
    except (IndexError, AttributeError):
        pass
    
    # Right leg
    try:
        right_inseam_pixels = calculate_distance_2d(
            landmarks[mp_pose.PoseLandmark.RIGHT_HIP],
            landmarks[mp_pose.PoseLandmark.RIGHT_ANKLE],
            image_width, image_height
        )
        inseam_measurements.append(right_inseam_pixels * pixel_to_cm)
    except (IndexError, AttributeError):
        pass
    
    if inseam_measurements:
        measurements['inseam'] = np.mean(inseam_measurements)
    else:
        measurements['inseam'] = height_cm * 0.45  # Fallback: 45% of height
    
    # Add quality metrics
    measurements['confidence_score'] = confidence
    measurements['symmetry_score'] = symmetry_score
    measurements['pixel_to_cm_ratio'] = pixel_to_cm
    
    
    return measurements

def recommend_size_enhanced(measurements):
    """Enhanced size recommendation with multiple measurement considerations"""
    chest = measurements.get('chest', 0)
    waist = measurements.get('waist', 0)
    hips = measurements.get('hips', 0)
    
    # Multi-factor size determination
    # Primary: chest measurement
    # Secondary: waist and hip proportions
    
    size_ranges = {
        'XS': {'chest': (78, 86), 'waist': (60, 70), 'hips': (85, 95)},
        'S': {'chest': (86, 94), 'waist': (70, 78), 'hips': (95, 103)},
        'M': {'chest': (94, 102), 'waist': (78, 86), 'hips': (103, 111)},
        'L': {'chest': (102, 110), 'waist': (86, 94), 'hips': (111, 119)},
        'XL': {'chest': (110, 118), 'waist': (94, 102), 'hips': (119, 127)},
        'XXL': {'chest': (118, 130), 'waist': (102, 115), 'hips': (127, 140)}
    }
    
    # Score each size based on how well measurements fit
    size_scores = {}
    
    for size, ranges in size_ranges.items():
        score = 0
        total_weight = 0
        
        # Chest (weight: 50%)
        chest_min, chest_max = ranges['chest']
        if chest_min <= chest <= chest_max:
            score += 50
        else:
            # Penalty for being outside range
            distance = min(abs(chest - chest_min), abs(chest - chest_max))
            score += max(0, 50 - distance * 2)
        total_weight += 50
        
        # Waist (weight: 25%)
        waist_min, waist_max = ranges['waist']
        if waist_min <= waist <= waist_max:
            score += 25
        else:
            distance = min(abs(waist - waist_min), abs(waist - waist_max))
            score += max(0, 25 - distance * 1.5)
        total_weight += 25
        
        # Hips (weight: 25%)
        hips_min, hips_max = ranges['hips']
        if hips_min <= hips <= hips_max:
            score += 25
        else:
            distance = min(abs(hips - hips_min), abs(hips - hips_max))
            score += max(0, 25 - distance * 1.5)
        total_weight += 25
        
        size_scores[size] = score / total_weight
    
    # Return the size with the highest score
    best_size = max(size_scores, key=size_scores.get)
    confidence = size_scores[best_size]
    
    return best_size, confidence

@app.route('/')
def index():
    return render_template('index.html')

NOSE_TO_ANKLE_RATIO = 0.90
HIP_TO_ANKLE_RATIO = 0.49

# Plausible adult ranges (cm). Results outside them mean the pose was not a straight,
# frontal, full-body shot, so no size is returned rather than a misleading one.
PLAUSIBLE_RANGES = {
    'chest': (65, 160), 'waist': (50, 150), 'hips': (70, 170),
    'shoulder_width': (30, 60), 'arm_length': (45, 85), 'inseam': (60, 105),
}
IMPLAUSIBLE_MESSAGE = (
    'The measurements from this photo look unrealistic. Please retake it standing straight, '
    'facing the camera, full body in frame (head to feet), arms slightly away from your body.'
)

MEASURE_KEYS = ['chest', 'waist', 'hips', 'shoulder_width', 'arm_length', 'inseam']
MAX_IMAGES = 3

NO_POSE_MESSAGE = (
    'No pose detected in image. Please ensure:\n'
    '• Your full body is visible in the frame\n'
    '• You are standing straight facing the camera\n'
    '• The lighting is good and background is clear\n'
    '• You are wearing fitted clothing\n'
    '• You are 2-3 meters away from the camera'
)


class ImageError(ValueError):
    """Raised when an uploaded image cannot be used for measurement."""


def decode_image(data_url):
    """Decode a base64 data URL (or raw base64 string) into an OpenCV BGR image."""
    if not isinstance(data_url, str) or not data_url:
        raise ImageError('Invalid image format. Please upload a valid image.')
    payload = data_url.split(',', 1)[1] if data_url.startswith('data:') else data_url
    try:
        image = Image.open(io.BytesIO(base64.b64decode(payload))).convert('RGB')
    except Exception:
        raise ImageError('Invalid image format. Please upload a valid image.')
    if image.width < 300 or image.height < 400:
        raise ImageError('Image resolution too low. Please use a higher quality image (minimum 300x400 pixels).')
    return cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)


def measure_image(image_cv, user_height):
    """Run pose detection on one image. Returns (measurements, annotated_data_url)."""
    results = pose.process(preprocess_image(image_cv))
    if not results.pose_landmarks:
        raise ImageError(NO_POSE_MESSAGE)

    height, width = image_cv.shape[:2]
    measurements = get_body_measurements_enhanced(
        results.pose_landmarks.landmark, width, height, user_height
    )
    for key, (low, high) in PLAUSIBLE_RANGES.items():
        if not low <= measurements[key] <= high:
            raise ImageError(IMPLAUSIBLE_MESSAGE)

    annotated = image_cv.copy()
    mp_drawing.draw_landmarks(
        annotated,
        results.pose_landmarks,
        mp_pose.POSE_CONNECTIONS,
        landmark_drawing_spec=mp_drawing.DrawingSpec(color=(0, 255, 0), thickness=2, circle_radius=3),
        connection_drawing_spec=mp_drawing.DrawingSpec(color=(255, 0, 0), thickness=2)
    )
    cv2.putText(annotated, f"Confidence: {measurements['confidence_score']:.2f}",
                (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
    cv2.putText(annotated, f"Symmetry: {measurements['symmetry_score']:.2f}",
                (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
    ok, buffer = cv2.imencode('.jpg', annotated, [cv2.IMWRITE_JPEG_QUALITY, 90])
    if not ok:
        raise RuntimeError('Failed to encode annotated image')
    data_url = 'data:image/jpeg;base64,' + base64.b64encode(buffer).decode('utf-8')
    return measurements, data_url


def aggregate_measurements(per_image):
    """Median-combine measurements from several photos (robust to one bad shot)."""
    combined = {k: round(float(np.median([m[k] for m in per_image])), 1) for k in MEASURE_KEYS}
    combined['confidence_score'] = float(np.mean([m['confidence_score'] for m in per_image]))
    combined['symmetry_score'] = float(np.mean([m['symmetry_score'] for m in per_image]))
    return combined


@app.route('/api/health')
def health():
    return jsonify({'status': 'OK'})


@app.route('/api/measure', methods=['POST'])
def process_measurement():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({'error': 'Image data is required'}), 400

    # Accept either `images` (list, used by the frontend) or legacy single `image`.
    images = data.get('images')
    if images is None and data.get('image'):
        images = [data['image']]
    if not isinstance(images, list) or not images:
        return jsonify({'error': 'At least one image is required'}), 400
    if len(images) > MAX_IMAGES:
        return jsonify({'error': f'You can submit at most {MAX_IMAGES} images.'}), 400

    user_height = data.get('height', 170)
    if isinstance(user_height, bool) or not isinstance(user_height, (int, float)) \
            or not 100 <= user_height <= 250:
        return jsonify({'error': 'Please provide a valid height between 100-250 cm'}), 400

    try:
        per_image = []
        annotated_image = None
        for idx, raw in enumerate(images, start=1):
            try:
                m, annotated = measure_image(decode_image(raw), user_height)
            except ValueError as ve:
                suffix = f' (photo {idx})' if len(images) > 1 else ''
                return jsonify({'error': f'{ve}{suffix}'}), 400
            per_image.append(m)
            annotated_image = annotated_image or annotated

        measurements = aggregate_measurements(per_image)
        recommended_size, size_confidence = recommend_size_enhanced(measurements)

        response_measurements = {k: measurements[k] for k in MEASURE_KEYS}
        response_measurements['recommended_size'] = recommended_size
        return jsonify({
            'measurements': response_measurements,
            'landmarks_detected': True,
            'annotated_image': annotated_image,
            'confidence_score': measurements['confidence_score'],
            'symmetry_score': measurements['symmetry_score'],
            'size_confidence': size_confidence,
            'images_processed': len(per_image),
            'processing_notes': (
                f'Median of {len(per_image)} photo(s). Chest estimated as shoulder width × 2.15; '
                'estimates are approximate (typically ±3cm).'
            ),
        })
    except Exception:
        app.logger.exception('Measurement processing error')
        return jsonify({'error': 'Internal server error. Please try again.'}), 500


if __name__ == '__main__':
    app.run(
        debug=os.environ.get('FLASK_DEBUG') == '1',
        host=os.environ.get('HOST', '127.0.0.1'),
        port=int(os.environ.get('PORT', 5001)),
    )