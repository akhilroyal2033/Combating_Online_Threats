# landmark_jitter.py
import numpy as np

def compute_jitter(landmarks_list):
    if len(landmarks_list) < 2:
        return 0.0
    diffs = [np.mean(np.linalg.norm(landmarks_list[i] - landmarks_list[i-1], axis=1))
             for i in range(1, len(landmarks_list))]
    # Balanced sensitivity: /8 to further reduce FP
    score = np.clip(np.tanh(np.mean(diffs) / 8), 0, 1)
    return float(score)