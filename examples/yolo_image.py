"""Run YOLO on an image and draw the result. Requires `pip install visionstyle[yolo]`."""

import sys

import cv2
from ultralytics import YOLO

import visionstyle as vs

image_path = sys.argv[1] if len(sys.argv) > 1 else "src/visionstyle/assets/samples/street.jpg"

model = YOLO("yolo11n.pt")
frame = cv2.imread(image_path)
result = model.predict(frame, conf=0.3, verbose=False)[0]

dets = vs.Detections.from_ultralytics(result)
out = vs.annotate(frame, dets, style="corners")
cv2.imwrite("yolo_out.jpg", out)
print(f"{len(dets)} detections -> yolo_out.jpg")
