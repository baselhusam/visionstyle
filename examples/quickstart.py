"""Annotate one image with a preset. Run: python examples/quickstart.py [image] [preset]"""

import sys

import cv2

import visionstyle as vs

image_path = sys.argv[1] if len(sys.argv) > 1 else "src/visionstyle/assets/samples/street.jpg"
preset = sys.argv[2] if len(sys.argv) > 2 else "cinematic"

frame = cv2.imread(image_path)

# Any detector works - here are hand-written boxes in pixel coordinates.
dets = vs.Detections(
    xyxy=[[590, 650, 720, 1040], [1060, 660, 1520, 1000]],
    class_name=["person", "car"],
    confidence=[0.93, 0.88],
    track_id=[14, 31],
)

out = vs.annotate(frame, dets, style=preset)
cv2.imwrite("quickstart_out.jpg", out)
print("wrote quickstart_out.jpg")
