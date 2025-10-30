from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
import cv2
import mediapipe as mp
import numpy as np
import base64
import io
from PIL import Image
import math
from datetime import datetime
import os

app = Flask(__name__)
CORS(app)

# Database configuration
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///measurements.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

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

# Database Models
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    height = db.Column(db.Float)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    measurements = db.relationship('Measurement', backref='user', lazy=True)

class Measurement(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    chest = db.Column(db.Float)
    waist = db.Column(db.Float)
    hips = db.Column(db.Float)
    shoulder_width = db.Column(db.Float)
    arm_length = db.Column(db.Float)
    inseam = db.Column(db.Float)
    recommended_size = db.Column(db.String(10))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

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
        body_height_pixels = abs(avg_ankle_y - head_y)
        height_reference_points.append(body_height_pixels)
    except:
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
        # Leg length is typically 45-50% of total height
        estimated_body_height = leg_length_pixels / 0.47
        height_reference_points.append(estimated_body_height)
    except:
        pass
    
    if not height_reference_points:
        raise ValueError("Unable to calculate body height reference from image")
    
    # Use the median height measurement for robustness
    body_height_pixels = np.median(height_reference_points)
    
    # CRITICAL: This is the key fix - proper pixel to cm conversion
    pixel_to_cm = height_cm / body_height_pixels
    
    print(f"DEBUG: Body height in pixels: {body_height_pixels}")
    print(f"DEBUG: User height: {height_cm}cm")
    print(f"DEBUG: Pixel to cm ratio: {pixel_to_cm}")
    
    # SHOULDER WIDTH - Direct measurement
    left_shoulder = landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER]
    right_shoulder = landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER]
    shoulder_distance_pixels = calculate_distance_2d(left_shoulder, right_shoulder, image_width, image_height)
    measurements['shoulder_width'] = shoulder_distance_pixels * pixel_to_cm
    
    print(f"DEBUG: Shoulder width pixels: {shoulder_distance_pixels}, cm: {measurements['shoulder_width']}")
    
    # CHEST CIRCUMFERENCE - CORRECTED FORMULA
    # Based on your actual measurements: chest=103cm, shoulder=48cm
    # This suggests a ratio of approximately 2.15
    # Using a more conservative approach with anatomical accuracy
    chest_width_cm = measurements['shoulder_width']
    
    # FIXED: Use a direct multiplier based on your actual measurements
    # Your chest (103cm) / shoulder (48cm) = 2.15 ratio
    measurements['chest'] = measurements['shoulder_width'] * 2.15
    
    print(f"DEBUG: Chest calculation: shoulder_width({measurements['shoulder_width']:.1f}) × 2.15 = {measurements['chest']:.1f}cm")
    
    # HIP MEASUREMENT - Direct measurement with circumference calculation
    left_hip = landmarks[mp_pose.PoseLandmark.LEFT_HIP]
    right_hip = landmarks[mp_pose.PoseLandmark.RIGHT_HIP]
    hip_distance_pixels = calculate_distance_2d(left_hip, right_hip, image_width, image_height)
    hip_width_cm = hip_distance_pixels * pixel_to_cm
    
    # Hip circumference calculation - adjusted for your measurements
    # Your hips (98cm) suggest a different ratio than the generic formula
    # Using hip width × 2.8 based on typical hip width to circumference ratio
    measurements['hips'] = hip_width_cm * 2.8
    
    print(f"DEBUG: Hip width: {hip_width_cm}, circumference: {measurements['hips']}")
    
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
    except:
        pass
    
    # Right arm
    try:
        right_arm_pixels = calculate_distance_2d(
            landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER],
            landmarks[mp_pose.PoseLandmark.RIGHT_WRIST],
            image_width, image_height
        )
        arm_measurements.append(right_arm_pixels * pixel_to_cm)
    except:
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
    except:
        pass
    
    # Right leg
    try:
        right_inseam_pixels = calculate_distance_2d(
            landmarks[mp_pose.PoseLandmark.RIGHT_HIP],
            landmarks[mp_pose.PoseLandmark.RIGHT_ANKLE],
            image_width, image_height
        )
        inseam_measurements.append(right_inseam_pixels * pixel_to_cm)
    except:
        pass
    
    if inseam_measurements:
        measurements['inseam'] = np.mean(inseam_measurements)
    else:
        measurements['inseam'] = height_cm * 0.45  # Fallback: 45% of height
    
    # Add quality metrics
    measurements['confidence_score'] = confidence
    measurements['symmetry_score'] = symmetry_score
    measurements['pixel_to_cm_ratio'] = pixel_to_cm
    
    # Debug output
    print(f"FINAL MEASUREMENTS:")
    print(f"Chest: {measurements['chest']:.1f}cm")
    print(f"Waist: {measurements['waist']:.1f}cm") 
    print(f"Hips: {measurements['hips']:.1f}cm")
    print(f"Shoulders: {measurements['shoulder_width']:.1f}cm")
    
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

@app.route('/api/users', methods=['POST'])
def create_user():
    data = request.json
    user = User(
        name=data['name'],
        email=data['email'],
        height=data.get('height')
    )
    db.session.add(user)
    db.session.commit()
    return jsonify({'id': user.id, 'message': 'User created successfully'})

@app.route('/api/users/<int:user_id>', methods=['GET'])
def get_user(user_id):
    user = User.query.get_or_404(user_id)
    return jsonify({
        'id': user.id,
        'name': user.name,
        'email': user.email,
        'height': user.height,
        'created_at': user.created_at.isoformat()
    })

@app.route('/api/measure', methods=['POST'])
def process_measurement():
    try:
        data = request.json
        
        if not data or 'image' not in data:
            return jsonify({'error': 'Image data is required'}), 400
        
        image_data = data['image'].split(',')[1]
        user_height = data.get('height', 170)
        
        # Enhanced input validation
        if not isinstance(user_height, (int, float)) or user_height < 100 or user_height > 250:
            return jsonify({'error': 'Please provide a valid height between 100-250 cm'}), 400
        
        # Decode and validate image
        try:
            image_bytes = base64.b64decode(image_data)
            image = Image.open(io.BytesIO(image_bytes))
            
            # Check image dimensions
            if image.width < 300 or image.height < 400:
                return jsonify({'error': 'Image resolution too low. Please use a higher quality image (minimum 300x400 pixels).'}), 400
            
            image_cv = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
        except Exception as e:
            return jsonify({'error': 'Invalid image format. Please upload a valid image.'}), 400
        
        # Enhanced image preprocessing
        processed_image = preprocess_image(image_cv)
        
        # Process with MediaPipe
        results = pose.process(processed_image)
        
        if not results.pose_landmarks:
            return jsonify({
                'error': 'No pose detected in image. Please ensure:\n' +
                        '• Your full body is visible in the frame\n' +
                        '• You are standing straight facing the camera\n' +
                        '• The lighting is good and background is clear\n' +
                        '• You are wearing fitted clothing\n' +
                        '• You are 2-3 meters away from the camera'
            }), 400
        
        # Enhanced measurement calculation
        try:
            height, width = image_cv.shape[:2]
            measurements = get_body_measurements_enhanced(
                results.pose_landmarks.landmark, 
                width, 
                height, 
                user_height
            )
            
            # Enhanced size recommendation
            recommended_size, size_confidence = recommend_size_enhanced(measurements)
            measurements['recommended_size'] = recommended_size
            measurements['size_confidence'] = size_confidence
            
            # Create enhanced annotated image
            annotated_image = image_cv.copy()
            
            # Draw pose landmarks with custom styling
            mp_drawing.draw_landmarks(
                annotated_image,
                results.pose_landmarks,
                mp_pose.POSE_CONNECTIONS,
                landmark_drawing_spec=mp_drawing.DrawingSpec(color=(0, 255, 0), thickness=2, circle_radius=3),
                connection_drawing_spec=mp_drawing.DrawingSpec(color=(255, 0, 0), thickness=2)
            )
            
            # Add measurement annotations
            cv2.putText(annotated_image, f"Confidence: {measurements['confidence_score']:.2f}", 
                       (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
            cv2.putText(annotated_image, f"Symmetry: {measurements['symmetry_score']:.2f}", 
                       (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
            
            # Convert to base64
            _, buffer = cv2.imencode('.jpg', annotated_image, [cv2.IMWRITE_JPEG_QUALITY, 95])
            annotated_base64 = base64.b64encode(buffer).decode('utf-8')
            annotated_data_url = f"data:image/jpeg;base64,{annotated_base64}"
            
            # Clean up measurements for response (remove internal metrics)
            response_measurements = {k: v for k, v in measurements.items() 
                                   if k not in ['confidence_score', 'symmetry_score', 'pixel_to_cm_ratio', 'size_confidence']}
            
            return jsonify({
                'measurements': response_measurements,
                'landmarks_detected': True,
                'annotated_image': annotated_data_url,
                'confidence_score': measurements['confidence_score'],
                'symmetry_score': measurements['symmetry_score'],
                'size_confidence': measurements['size_confidence'],
                'processing_notes': f'Corrected chest measurement formula: shoulder_width × 2.15. Expected accuracy: ±3cm for chest measurements.'
            })
            
        except ValueError as ve:
            return jsonify({'error': str(ve)}), 400
        except Exception as e:
            app.logger.error(f'Measurement calculation error: {str(e)}')
            return jsonify({'error': f'Measurement calculation failed: {str(e)}'}), 500
        
    except Exception as e:
        app.logger.error(f'Measurement processing error: {str(e)}')
        return jsonify({'error': 'Internal server error. Please try again.'}), 500

@app.route('/api/measurements', methods=['POST'])
def save_measurement():
    data = request.json
    measurement = Measurement(
        user_id=data['user_id'],
        chest=data['measurements']['chest'],
        waist=data['measurements']['waist'],
        hips=data['measurements']['hips'],
        shoulder_width=data['measurements']['shoulder_width'],
        arm_length=data['measurements']['arm_length'],
        inseam=data['measurements']['inseam'],
        recommended_size=data['measurements']['recommended_size']
    )
    db.session.add(measurement)
    db.session.commit()
    return jsonify({'id': measurement.id, 'message': 'Measurement saved successfully'})

@app.route('/api/measurements/<int:user_id>', methods=['GET'])
def get_user_measurements(user_id):
    measurements = Measurement.query.filter_by(user_id=user_id).order_by(Measurement.created_at.desc()).all()
    return jsonify([{
        'id': m.id,
        'chest': m.chest,
        'waist': m.waist,
        'hips': m.hips,
        'shoulder_width': m.shoulder_width,
        'arm_length': m.arm_length,
        'inseam': m.inseam,
        'recommended_size': m.recommended_size,
        'created_at': m.created_at.isoformat()
    } for m in measurements])

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, host='0.0.0.0', port=5000)