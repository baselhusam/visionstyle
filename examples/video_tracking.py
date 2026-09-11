"""Track objects through a video and draw trails. Requires `pip install visionstyle[yolo]`.

python examples/video_tracking.py input.mp4 output.mp4 [preset]
"""

import sys

import cv2
from ultralytics import YOLO

import visionstyle as vs

src, dst = sys.argv[1], sys.argv[2]
preset = sys.argv[3] if len(sys.argv) > 3 else "tracking"

model = YOLO("yolo11n.pt")
style = vs.Style.preset(preset)
style.trail.enabled = True  # make sure trails are on regardless of the preset
annotator = vs.Annotator(style)  # one instance per stream: it keeps the trail history

cap = cv2.VideoCapture(src)
fps = cap.get(cv2.CAP_PROP_FPS) or 30
style.fps = fps
writer = None
while True:
    ok, frame = cap.read()
    if not ok:
        break
    result = model.track(frame, persist=True, conf=0.3, verbose=False)[0]
    out = annotator.annotate(frame, vs.Detections.from_ultralytics(result))
    if writer is None:
        h, w = out.shape[:2]
        writer = cv2.VideoWriter(dst, cv2.VideoWriter.fourcc(*"mp4v"), fps, (w, h))
    writer.write(out)
cap.release()
if writer:
    writer.release()
print("wrote", dst)
