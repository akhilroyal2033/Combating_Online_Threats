# blink_detector.py
import numpy as np

def eye_aspect_ratio(eye):
    A = np.linalg.norm(eye[1] - eye[5])
    B = np.linalg.norm(eye[2] - eye[4])
    C = np.linalg.norm(eye[0] - eye[3])
    ear = (A + B) / (2.0 * C)
    return ear

def detect_blinks(landmarks_list, fps=30, ear_threshold=0.2, min_consecutive=3):
    left_idx = [36,37,38,39,40,41]
    right_idx = [42,43,44,45,46,47]

    ear_list = []
    for lm in landmarks_list:
        left_eye = lm[left_idx]
        right_eye = lm[right_idx]
        ear = (eye_aspect_ratio(left_eye) + eye_aspect_ratio(right_eye)) / 2.0
        ear_list.append(ear)

    ear_array = np.array(ear_list)
    
    # Fixed threshold, no dynamic to avoid bias

    # Improved detection: Count blink on recovery after consecutive closed
    blinks = 0
    consecutive_closed = 0
    for ear in ear_array:
        if ear < ear_threshold:
            consecutive_closed += 1
        else:
            if consecutive_closed >= min_consecutive:
                blinks += 1
            consecutive_closed = 0
    # Check end
    if consecutive_closed >= min_consecutive:
        blinks += 1

    duration_sec = len(landmarks_list) / fps
    duration_min = duration_sec / 60
    blink_rate = blinks / duration_min if duration_min > 0 else 0
    # Cap at 60/min to handle noise
    blink_rate = min(blink_rate, 60)
    # Fake if low rate (real 15-20/min); adjust thresh to 15
    fake_blink_score = np.clip(np.tanh(1 - (blink_rate / 15)), 0, 1)
    return float(fake_blink_score), blink_rate, ear_list