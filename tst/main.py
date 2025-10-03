import os
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'
os.environ['PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION'] = 'python'

import warnings
warnings.filterwarnings('ignore')

from flask import Flask, request, jsonify, render_template, make_response
import torch
from transformers import pipeline
from PIL import Image
import io
from werkzeug.utils import secure_filename
from datetime import datetime, timedelta
import uuid
from functools import wraps
import pytesseract  # OCR for text detection
from flask_cors import CORS
# ---------------- Flask App ----------------
app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  
CORS(app, supports_credentials=True) 
# ---------------- CORS ----------------
@app.after_request
def after_request(response):
    origin = request.headers.get('Origin')
    if origin:
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Access-Control-Allow-Credentials'] = 'true'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization'
    response.headers['Access-Control-Allow-Methods'] = 'GET,PUT,POST,DELETE,OPTIONS'
    return response

# ---------------- Models ----------------
print("Loading deepfake detection model...")
deepfake_detector = pipeline("image-classification", model="Wvolf/ViT_Deepfake_Detection", use_fast=True)
print("Model loaded!")

# ---------------- API Key Manager ----------------
api_keys = {}
api_usage = {}

class APIKey:
    def __init__(self, key, tier='free'):
        self.key = key
        self.tier = tier
        self.created_at = datetime.now()
        self.limits = {'free': 100, 'basic': 1000, 'premium': 10000, 'enterprise': float('inf')}
        self.daily_limit = self.limits[tier]

def require_api_key(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        api_key = request.headers.get('Authorization')
        if not api_key or not api_key.startswith('Bearer '):
            return make_response(jsonify({'error': 'No API key provided'}), 401)
        key = api_key.split(' ')[1]
        if key == 'c7d9f235-1976-40e4-a90f-172bfa408404':
            return f(*args, **kwargs)
        if key not in api_keys:
            return make_response(jsonify({'error': 'Invalid API key'}), 401)
        today = datetime.now().date()
        if today not in api_usage[key]:
            api_usage[key][today] = 0
        if api_usage[key][today] >= api_keys[key].daily_limit:
            return make_response(jsonify({'error': 'Daily API limit exceeded'}), 429)
        api_usage[key][today] += 1
        return f(*args, **kwargs)
    return decorated_function

def generate_api_key(tier='free'):
    key = str(uuid.uuid4())
    api_keys[key] = APIKey(key, tier)
    api_usage[key] = {}
    return key

# ---------------- Scam Keywords ----------------
SCAM_KEYWORDS = {
    "employment": ["job", "part time", "work from home", "typing work", "data entry"],
    "loan": ["loan", "credit", "instant loan", "personal loan"],
    "money": ["earn money", "easy money", "guaranteed income", "investment", "double money"],
    "crypto": ["bitcoin", "crypto", "usdt", "binance", "wallet"],
    "phishing": ["click here", "link", "register now", "signup bonus", "limited offer"],
    "others": ["100% guarantee", "zero risk", "urgent requirement", "whatsapp number", "telegram"]
}

def keyword_scam_detector(text):
    text_lower = text.lower()
    matches = []
    for category, keywords in SCAM_KEYWORDS.items():
        for kw in keywords:
            if kw in text_lower:
                matches.append((category, kw))

    score = len(matches) / (len(text.split()) + 1)
    if score > 0.3:
        verdict = f"⚠ Likely Scam detected ({len(matches)} keywords matched)"
    elif score > 0.1:
        verdict = f"⚠ Suspicious content ({len(matches)} scam-related words)"
    else:
        verdict = "✅ No scam detected"

    return {
        "matches": matches,
        "score": round(score, 3),
        "verdict": verdict
    }

# ---------------- Routes ----------------
@app.route('/')
def home():
    return render_template('index.html')

@app.route('/api')
def api():
    return render_template('api.html')

@app.route('/about')
def about():
    return render_template('about.html')

@app.route('/api/keys', methods=['POST'])
@require_api_key
def create_api_key():
    data = request.json
    tier = data.get('tier', 'free')
    if tier not in ['free', 'basic', 'premium', 'enterprise']:
        return make_response(jsonify({'error': 'Invalid tier'}), 400)
    key = generate_api_key(tier)
    return make_response(jsonify({'api_key': key, 'tier': tier, 'daily_limit': api_keys[key].daily_limit}))

# ---------------- Main Analyzer ----------------
@app.route('/api/analyze', methods=['POST'])
@require_api_key
def analyze():
    
    if 'image' not in request.files:
        return make_response(jsonify({'error': 'No image file provided'}), 400)
    file = request.files['image']
    if file.filename == '':
        return make_response(jsonify({'error': 'No selected file'}), 400)
    if file:
        filename = secure_filename(file.filename)
        if not filename.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.bmp')):
            return make_response(jsonify({'error': 'Invalid file type. Use image formats only.'}), 400)

        image_bytes = file.read()
        try:
            image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
        except Exception as e:
            return make_response(jsonify({'error': f'Invalid image: {str(e)}'}), 400)

        # --- Step 1: OCR Detection ---
        text = pytesseract.image_to_string(image).strip()
        if text:
            scam_check = keyword_scam_detector(text)
            return make_response(jsonify({
                'mode': 'scam-text',
                'extracted_text': text,
                'score': scam_check['score'],
                'matches': scam_check['matches'],
                'verdict': scam_check['verdict']
            }))

        # --- Step 2: Deepfake Detection (only if no text) ---
        result = deepfake_detector(image)
        prediction = max(result, key=lambda x: x['score'])
        label = prediction['label'].lower()
        confidence = prediction['score'] * 100

        if label == "fake" and confidence > 75:
            verdict = f"Deepfake Detected! Fake with {confidence:.2f}% confidence."
        elif label == "real" and confidence > 75:
            verdict = f"Real image with {confidence:.2f}% confidence."
        else:
            verdict = f"Uncertain — low confidence: {label.upper()} with {confidence:.2f}% confidence."

        return make_response(jsonify({
            'mode': 'deepfake',
            'label': label,
            'confidence': round(float(prediction['score']), 4),
            'verdict': verdict
        }))


@app.route('/predict', methods=['POST'])
def predict():
    if 'image' not in request.files:
        return make_response(jsonify({'error': 'No image file provided'}), 400)
    file = request.files['image']
    if file.filename == '':
        return make_response(jsonify({'error': 'No selected file'}), 400)
    if file:
        filename = secure_filename(file.filename)
        if not filename.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.bmp')):
            return make_response(jsonify({'error': 'Invalid file type. Use image formats only.'}), 400)

        image_bytes = file.read()
        try:
            image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
        except Exception as e:
            return make_response(jsonify({'error': f'Invalid image: {str(e)}'}), 400)

        # --- Step 1: OCR Detection ---
        text = pytesseract.image_to_string(image).strip()
        if text:
            scam_check = keyword_scam_detector(text)
            return make_response(jsonify({
                'mode': 'scam-text',
                'extracted_text': text,
                'score': scam_check['score'],
                'matches': scam_check['matches'],
                'verdict': scam_check['verdict']
            }))

        # --- Step 2: Deepfake Detection (only if no text) ---
        result = deepfake_detector(image)
        prediction = max(result, key=lambda x: x['score'])
        label = prediction['label'].lower()
        confidence = prediction['score'] * 100

        if label == "fake" and confidence > 75:
            verdict = f"Deepfake Detected! Fake with {confidence:.2f}% confidence."
        elif label == "real" and confidence > 75:
            verdict = f"Real image with {confidence:.2f}% confidence."
        else:
            verdict = f"Uncertain — low confidence: {label.upper()} with {confidence:.2f}% confidence."

        return make_response(jsonify({
            'mode': 'deepfake',
            'label': label,
            'confidence': round(float(prediction['score']), 4),
            'verdict': verdict
        }))

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True)
