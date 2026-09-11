"""Ultralytics YOLO helpers (requires ``pip install visionstyle[yolo]``)."""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path
from typing import Any

import numpy as np
import numpy.typing as npt

from visionstyle.detections import Detections

DEFAULT_MODEL = "yolo11n.pt"


def _require_ultralytics() -> Any:
    try:
        import ultralytics
    except ImportError as exc:  # pragma: no cover - exercised only without the extra
        raise ImportError(
            "Ultralytics is not installed. Run `pip install visionstyle[yolo]`."
        ) from exc
    return ultralytics


def load_model(weights: str | Path = DEFAULT_MODEL) -> Any:
    """Load a YOLO model (``.pt`` or ``.onnx``). Weights are downloaded on first use."""
    ultralytics = _require_ultralytics()
    return ultralytics.YOLO(str(weights))


def detect(
    model: Any,
    image: npt.NDArray[np.uint8],
    conf: float = 0.25,
    classes: list[int] | None = None,
    imgsz: int = 640,
) -> Detections:
    """Run inference on one BGR frame and return :class:`Detections`."""
    results = model.predict(image, conf=conf, classes=classes, imgsz=imgsz, verbose=False)
    return Detections.from_ultralytics(results[0])


def track(
    model: Any,
    image: npt.NDArray[np.uint8],
    conf: float = 0.25,
    classes: list[int] | None = None,
    imgsz: int = 640,
    tracker: str = "bytetrack.yaml",
) -> Detections:
    """Run inference + tracking on one frame (call per frame, in order)."""
    results = model.track(
        image, conf=conf, classes=classes, imgsz=imgsz, persist=True, tracker=tracker, verbose=False
    )
    return Detections.from_ultralytics(results[0])


def iter_video(source: str | Path | int) -> Iterator[tuple[npt.NDArray[np.uint8], float]]:
    """Yield ``(frame, fps)`` from a video file, webcam index or stream URL."""
    import cv2

    cap = cv2.VideoCapture(source if isinstance(source, int) else str(source))
    if not cap.isOpened():
        raise FileNotFoundError(f"Could not open video source {source!r}")
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            yield np.asarray(frame, np.uint8), fps
    finally:
        cap.release()
