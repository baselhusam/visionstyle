"""Label text composition and tag placement geometry."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from visionstyle.detections import Detection
from visionstyle.style.schema import LabelStyle


def format_confidence(conf: float, fmt: str) -> str:
    if fmt == "92%":
        return f"{conf * 100:.0f}%"
    if fmt == "92":
        return f"{conf * 100:.0f}"
    if fmt == ".92":
        return f"{conf:.2f}"[1:]
    return f"{conf:.2f}"


def compose_label(det: Detection, style: LabelStyle) -> str:
    """Build the label string from the ordered ``components``. Missing data is skipped."""
    parts: list[str] = []
    for comp in style.components:
        if comp == "text":
            parts.append(det.label)
        elif comp == "confidence" and det.confidence is not None:
            parts.append(format_confidence(det.confidence, style.confidence_format))
        elif comp == "track_id" and det.track_id is not None:
            parts.append(style.track_id_format.replace("{id}", str(det.track_id)))
        elif comp == "class_id" and det.class_id is not None:
            parts.append(style.class_id_format.replace("{id}", str(det.class_id)))
        elif comp == "custom" and style.custom_template:
            try:
                parts.append(
                    style.custom_template.format(
                        name=det.label,
                        conf=det.confidence if det.confidence is not None else 0.0,
                        id=det.track_id if det.track_id is not None else "",
                        class_id=det.class_id if det.class_id is not None else "",
                        data=_DataProxy(det.data),
                    )
                )
            except (KeyError, ValueError, IndexError, AttributeError):
                parts.append(style.custom_template)
    text = style.separator.join(p for p in parts if p)
    return text.upper() if style.uppercase else text


class _DataProxy:
    """Lets templates use ``{data[speed]}`` or ``{data.speed}`` without KeyErrors."""

    def __init__(self, data: Any) -> None:
        self._d = dict(data) if data else {}

    def __getitem__(self, k: str) -> Any:
        return self._d.get(k, "")

    def __getattr__(self, k: str) -> Any:
        return self._d.get(k, "")


@dataclass(frozen=True)
class TagBox:
    x: float
    y: float
    w: float
    h: float
    vertical: bool

    @property
    def x2(self) -> float:
        return self.x + self.w

    @property
    def y2(self) -> float:
        return self.y + self.h


def place_tag(
    box: tuple[float, float, float, float],
    tag_w: float,
    tag_h: float,
    style: LabelStyle,
    image_w: int,
    image_h: int,
    stroke: float,
) -> TagBox:
    """Position a ``tag_w x tag_h`` tag around ``box`` following anchor/placement, then keep it
    inside the image (flipping outside → inside when there is no room)."""
    x1, y1, x2, y2 = box
    anchor, placement = style.anchor, style.placement
    vertical = style.orientation == "vertical" or (
        style.orientation == "auto" and anchor in ("left", "right")
    )
    if vertical:
        tag_w, tag_h = tag_h, tag_w  # rotated 90°
    gap = style.offset + (0.0 if style.attached else max(4.0, stroke * 2))
    half = stroke / 2.0
    cx, cy = (x1 + x2) / 2, (y1 + y2) / 2

    # horizontal position
    if anchor in ("top_left", "bottom_left"):
        x = x1 - half if style.attached else x1
    elif anchor in ("top_right", "bottom_right"):
        x = x2 + half - tag_w if style.attached else x2 - tag_w
    elif anchor in ("top_center", "bottom_center", "center"):
        x = cx - tag_w / 2
    elif anchor == "left":
        x = (x1 - half - gap - tag_w) if placement == "outside" else (x1 + half + gap)
    else:  # right
        x = (x2 + half + gap) if placement == "outside" else (x2 - half - gap - tag_w)

    # vertical position
    if anchor.startswith("top"):
        y = (y1 - half - gap - tag_h) if placement == "outside" else (y1 + half + gap)
    elif anchor.startswith("bottom"):
        y = (y2 + half + gap) if placement == "outside" else (y2 - half - gap - tag_h)
    elif anchor == "center":
        y = cy - tag_h / 2
    else:  # left / right
        y = y1 - half if style.attached else cy - tag_h / 2

    # keep inside the image: flip to the other side of the edge when clipped
    if y < 0:
        y = y1 + half + gap if anchor.startswith("top") else 0.0
    if y + tag_h > image_h:
        y = y2 - half - gap - tag_h if anchor.startswith("bottom") else image_h - tag_h
    if x < 0:
        x = x1 + half + gap if anchor == "left" else 0.0
    if x + tag_w > image_w:
        x = x2 - half - gap - tag_w if anchor == "right" else image_w - tag_w
    x = max(0.0, min(x, image_w - tag_w))
    y = max(0.0, min(y, image_h - tag_h))
    return TagBox(x, y, tag_w, tag_h, vertical)
