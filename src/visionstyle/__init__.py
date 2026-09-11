"""visionstyle - beautiful, configurable bounding boxes for object detection.

>>> import visionstyle as vs
>>> dets = vs.Detections(xyxy=[[50, 40, 220, 300]], class_name=["person"], confidence=[0.93])
>>> out = vs.annotate(frame, dets, style="cinematic")
"""

from __future__ import annotations

from visionstyle import presets
from visionstyle.color import PALETTES, parse_color
from visionstyle.detections import Detection, Detections
from visionstyle.render.annotator import Annotator, annotate
from visionstyle.render.trails import TrailBuffer
from visionstyle.style.schema import (
    BoxStyle,
    EffectsStyle,
    FillStyle,
    LabelStyle,
    LinePattern,
    PaletteSpec,
    StrokeStyle,
    Style,
    TrailStyle,
)

__version__ = "0.1.0"

__all__ = [
    "PALETTES",
    "Annotator",
    "BoxStyle",
    "Detection",
    "Detections",
    "EffectsStyle",
    "FillStyle",
    "LabelStyle",
    "LinePattern",
    "PaletteSpec",
    "StrokeStyle",
    "Style",
    "TrailBuffer",
    "TrailStyle",
    "__version__",
    "annotate",
    "parse_color",
    "presets",
]
