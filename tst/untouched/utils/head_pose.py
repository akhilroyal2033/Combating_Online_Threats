# head_pose.py
import numpy as np

def compute_head_pose_variance(landmarks_list):
    if len(landmarks_list) < 2:
        return 0.0
    # Simple yaw/pitch approx: nose(30), chin(8), forehead(27? 19 is eye, use 27 for center)
    # Correct indices: nose tip 33, chin 8, left ear 0? But simple
    poses = []
    for lm in landmarks_list:
        nose = lm[30]  # Nose bridge
        chin = lm[8]
        left_eye_center = np.mean(lm[36:42], axis=0)
        # Yaw: atan2( (left_eye_x - nose_x), dist_y )
        dx = left_eye_center[0] - nose[0]
        dy = abs(left_eye_center[1] - nose[1])
        yaw = np.arctan2(dx, dy + 1e-6)
        # Pitch: vertical tilt chin-nose
        pitch = np.arctan2(chin[1] - nose[1], np.linalg.norm(chin - nose) + 1e-6)
        poses.append([yaw, pitch])
    poses = np.array(poses)
    var_yaw = np.var(poses[:, 0])
    var_pitch = np.var(poses[:, 1])
    # Low var -> fake; adjust divisor for reasonable range
    score = np.clip(np.tanh(1 - (var_yaw + var_pitch) / 0.1), 0, 1)
    return float(score)