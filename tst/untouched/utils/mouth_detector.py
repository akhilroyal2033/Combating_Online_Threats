# mouth_detector.py
import numpy as np

def mouth_aspect_ratio(mouth):
    A = np.linalg.norm(mouth[2] - mouth[8])  # Vertical
    B = np.linalg.norm(mouth[4] - mouth[6])  # Vertical
    C = np.linalg.norm(mouth[0] - mouth[6])  # Horizontal
    mar = (A + B) / (2.0 * C)
    return mar

def detect_mouth_movement(landmarks_list, mar_threshold=0.02):
    mouth_idx = [48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67]
    
    mar_list = []
    for lm in landmarks_list:
        mouth = lm[mouth_idx]
        mar = mouth_aspect_ratio(mouth)
        mar_list.append(mar)
    
    mar_array = np.array(mar_list)
    # Fraction of frames with significant mouth movement
    movement_fraction = np.mean(mar_array > mar_threshold)
    # Variance indicator
    var_score = np.var(mar_array)
    # Normalize: low movement/variance = fake
    fake_mouth_score = np.clip(1 - (movement_fraction + np.tanh(var_score * 50)) / 2, 0, 1)
    return float(fake_mouth_score), mar_list