# face_utils.py (Optional, but kept for MTCNN)
import torch
from facenet_pytorch import MTCNN
import cv2
import numpy as np

device = torch.device('cuda:0' if torch.cuda.is_available() else 'cpu')
mtcnn = MTCNN(keep_all=False, device=device)

def detect_and_crop_face(frame):
    # Returns cropped face as numpy array
    boxes, probs = mtcnn.detect(frame)
    if boxes is not None and len(boxes) > 0:
        x1, y1, x2, y2 = [int(b) for b in boxes[0]]
        face = frame[y1:y2, x1:x2]
        return face  # No resize here, handle in main
    return None