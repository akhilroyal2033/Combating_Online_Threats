# fft_artifact.py
import cv2
import numpy as np

def fft_artifact_score(video_path):
    cap = cv2.VideoCapture(video_path)
    scores = []
    frame_count = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        # Resize to multiple of 8 for DCT efficiency
        h, w = gray.shape
        gray = cv2.resize(gray.astype(np.float32) / 255.0, (w // 8 * 8, h // 8 * 8))
        dct = cv2.dct(gray)
        # Divide into low and high frequency quadrants (simplified)
        size = dct.shape[0] // 2
        low_energy = np.sum(dct[0:size, 0:size] ** 2)
        high_energy = np.sum(dct[size:, size:] ** 2) + np.sum(dct[0:size, size:] ** 2) + np.sum(dct[size:, 0:size] ** 2)
        total_energy = low_energy + high_energy + 1e-6
        high_ratio = high_energy / total_energy
        # Deepfakes often have suppressed high frequencies, so low high_ratio indicates fake
        # Clamp and adjust: tanh for smoothing
        score = np.clip(np.tanh(3 * (1 - high_ratio)), 0, 1)
        scores.append(score)
        frame_count += 1
        if frame_count > 50:  # Reduce limit
            break
    cap.release()
    return float(np.mean(scores)) if scores else 0.5