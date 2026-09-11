"""A premultiplied-alpha overlay layer that is composited onto the frame once per render.

All drawing goes through :class:`Layer`. Shapes render into small local masks (region of
interest + padding) and are painted with a color and opacity; the frame is touched only once,
in :meth:`Layer.composite`. That keeps rendering cheap even with dozens of boxes and effects.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import cv2
import numpy as np
import numpy.typing as npt

from visionstyle.color import RGB

F32 = npt.NDArray[np.float32]
U8 = npt.NDArray[np.uint8]

REFERENCE_DIAGONAL = math.hypot(1920, 1080)


def scale_factor(width: int, height: int, requested: float | str) -> float:
    """Resolve the style's ``scale``. ``auto`` follows the image diagonal with a gentle curve so
    small frames stay legible and 4K photos do not get hairline strokes."""
    if isinstance(requested, (int, float)):
        return float(requested)
    diag = math.hypot(width, height)
    return float(max(0.4, (diag / REFERENCE_DIAGONAL) ** 0.7))


@dataclass(frozen=True)
class ROI:
    """Integer pixel rectangle, clipped to the layer. ``x1``/``y1`` are exclusive."""

    x0: int
    y0: int
    x1: int
    y1: int

    @property
    def width(self) -> int:
        return self.x1 - self.x0

    @property
    def height(self) -> int:
        return self.y1 - self.y0

    @property
    def empty(self) -> bool:
        return self.width <= 0 or self.height <= 0


def _clip(x0: float, y0: float, x1: float, y1: float, w: int, h: int) -> ROI:
    return ROI(
        max(0, math.floor(x0)),
        max(0, math.floor(y0)),
        min(w, math.ceil(x1)),
        min(h, math.ceil(y1)),
    )


class Layer:
    """RGB (BGR order, premultiplied) + alpha float32 overlay the size of the frame."""

    def __init__(self, height: int, width: int) -> None:
        self.h = height
        self.w = width
        self.rgb: F32 = np.zeros((height, width, 3), np.float32)
        self.alpha: F32 = np.zeros((height, width), np.float32)

    # ------------------------------------------------------------------ region helpers
    def roi(self, x0: float, y0: float, x1: float, y1: float, pad: float = 0) -> ROI:
        return _clip(x0 - pad, y0 - pad, x1 + pad, y1 + pad, self.w, self.h)

    @staticmethod
    def blank_mask(roi: ROI) -> U8:
        return np.zeros((roi.height, roi.width), np.uint8)

    # ------------------------------------------------------------------ painting
    def paint(self, mask: U8 | F32, color: RGB, opacity: float, roi: ROI) -> None:
        """Alpha-composite a solid ``color`` through ``mask`` (uint8 0-255 or float 0-1)."""
        if roi.empty or opacity <= 0:
            return
        tight = _tight_bbox(mask)
        if tight is None:
            return
        x0, y0, x1, y1 = tight
        sub = mask[y0:y1, x0:x1]
        a: F32 = sub.astype(np.float32) / 255.0 if sub.dtype == np.uint8 else sub.astype(np.float32)
        if opacity != 1.0:
            a = (a * np.float32(opacity)).astype(np.float32)
        self._over(
            a,
            np.array((color[2], color[1], color[0]), np.float32),
            ROI(roi.x0 + x0, roi.y0 + y0, roi.x0 + x1, roi.y0 + y1),
        )

    def paint_rgb(self, bgr: F32, alpha: F32, roi: ROI) -> None:
        """Composite an arbitrary colored patch (``bgr`` float32 0-255, ``alpha`` float32 0-1)."""
        if roi.empty:
            return
        tight = _tight_bbox(alpha)
        if tight is None:
            return
        x0, y0, x1, y1 = tight
        self._over(
            alpha[y0:y1, x0:x1],
            bgr[y0:y1, x0:x1],
            ROI(roi.x0 + x0, roi.y0 + y0, roi.x0 + x1, roi.y0 + y1),
        )

    def _over(self, a: F32, src: F32, roi: ROI) -> None:
        ys, xs = slice(roi.y0, roi.y1), slice(roi.x0, roi.x1)
        a3 = a[..., None]
        dst_rgb = self.rgb[ys, xs]
        dst_a = self.alpha[ys, xs]
        # premultiplied "over": out = src*a + dst*(1-a)
        np.multiply(dst_rgb, 1.0 - a3, out=dst_rgb)
        dst_rgb += src * a3
        np.multiply(dst_a, 1.0 - a, out=dst_a)
        dst_a += a

    def erase(self, mask: U8, roi: ROI) -> None:
        """Punch a hole in the layer (used to keep glass regions crisp)."""
        if roi.empty:
            return
        keep = 1.0 - mask.astype(np.float32) / 255.0
        self.rgb[roi.y0 : roi.y1, roi.x0 : roi.x1] *= keep[..., None]
        self.alpha[roi.y0 : roi.y1, roi.x0 : roi.x1] *= keep

    # ------------------------------------------------------------------ output
    def composite(self, frame_bgr: U8, out: U8 | None = None) -> U8:
        """Blend the layer onto ``frame_bgr`` (uint8). Writes into ``out`` when given."""
        base = frame_bgr.astype(np.float32)
        base *= (1.0 - self.alpha)[..., None]
        base += self.rgb
        base += 0.5  # round instead of truncate
        np.clip(base, 0, 255, out=base)
        if out is not None:
            out[...] = base
            return out
        return np.asarray(base, np.uint8)

    def is_empty(self) -> bool:
        return not bool(self.alpha.any())


def _tight_bbox(mask: U8 | F32) -> tuple[int, int, int, int] | None:
    """Bounding box (x0, y0, x1, y1) of the non-zero area of ``mask``, or None if empty."""
    if mask.size == 0:
        return None
    nz = mask if mask.dtype == np.uint8 else (mask > 1e-4).astype(np.uint8)
    x, y, w, h = cv2.boundingRect(nz)
    if w == 0 or h == 0:
        return None
    return x, y, x + w, y + h


def gaussian(mask: F32 | U8, radius: float) -> F32:
    """Blur a mask with a Gaussian whose sigma tracks ``radius`` in pixels."""
    if radius <= 0:
        return mask.astype(np.float32)
    k = int(radius) * 2 + 1
    return np.asarray(cv2.GaussianBlur(mask.astype(np.float32), (k, k), radius / 2.0), np.float32)


def as_float_mask(mask: U8) -> F32:
    return mask.astype(np.float32) / 255.0
