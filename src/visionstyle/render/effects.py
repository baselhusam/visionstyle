"""Whole-frame effects (color grade, vignette, grain, spotlight) and the glass blur."""

from __future__ import annotations

import cv2
import numpy as np
import numpy.typing as npt

from visionstyle.color import RGB
from visionstyle.render.canvas import ROI, Layer, gaussian
from visionstyle.style.schema import ColorGrade, GlassEffect, GrainEffect, VignetteEffect

U8 = npt.NDArray[np.uint8]
F32 = npt.NDArray[np.float32]


def apply_grade(frame: U8, grade: ColorGrade) -> U8:
    img = frame.astype(np.float32) / 255.0
    if grade.monochrome:
        gray = img @ np.array([0.114, 0.587, 0.299], np.float32)  # BGR weights
        img = np.repeat(gray[..., None], 3, axis=2)
    if grade.saturation != 1.0 and not grade.monochrome:
        gray = (img @ np.array([0.114, 0.587, 0.299], np.float32))[..., None]
        img = gray + (img - gray) * grade.saturation
    if grade.contrast != 1.0:
        img = (img - 0.5) * grade.contrast + 0.5
    if grade.temperature:
        t = grade.temperature * 0.12
        img[..., 2] += t  # red
        img[..., 0] -= t  # blue
    if grade.lift:
        img += grade.lift
    return (np.clip(img, 0, 1) * 255).astype(np.uint8)  # type: ignore[no-any-return]


def apply_vignette(frame: U8, v: VignetteEffect) -> U8:
    h, w = frame.shape[:2]
    ys, xs = np.ogrid[:h, :w]
    nx = (xs - w / 2) / (w / 2)
    ny = (ys - h / 2) / (h / 2)
    d = np.sqrt(nx**2 + ny**2) / v.radius
    falloff = np.clip((d - 0.55) / 0.9, 0, 1) ** 1.6
    mult = 1.0 - falloff * v.strength
    out = frame.astype(np.float32) * mult[..., None].astype(np.float32)
    return np.clip(out, 0, 255).astype(np.uint8)  # type: ignore[no-any-return]


def apply_grain(frame: U8, g: GrainEffect, frame_index: int = 0) -> U8:
    rng = np.random.default_rng(g.seed + frame_index)
    noise = rng.normal(0, 255 * g.amount * 0.35, size=frame.shape[:2]).astype(np.float32)
    out = frame.astype(np.float32) + noise[..., None]
    return np.clip(out, 0, 255).astype(np.uint8)  # type: ignore[no-any-return]


def apply_spotlight(
    frame: U8, boxes: list[tuple[float, float, float, float]], amount: float, feather: float
) -> U8:
    """Darken everything outside the union of ``boxes``."""
    h, w = frame.shape[:2]
    mask = np.zeros((h, w), np.uint8)
    for x1, y1, x2, y2 in boxes:
        cv2.rectangle(mask, (int(x1), int(y1)), (int(x2), int(y2)), 255, -1)
    keep = gaussian(mask, feather) / 255.0 if feather > 0 else mask.astype(np.float32) / 255.0
    mult = 1.0 - amount * (1.0 - keep)
    out = frame.astype(np.float32) * mult[..., None]
    return np.clip(out, 0, 255).astype(np.uint8)  # type: ignore[no-any-return]


def paint_glass(
    layer: Layer, frame: U8, mask: U8, roi: ROI, glass: GlassEffect, blur_px: float, tint: RGB
) -> None:
    """Blur the frame under ``mask`` and paint it (plus tint) into the layer."""
    if roi.empty:
        return
    region = frame[roi.y0 : roi.y1, roi.x0 : roi.x1].astype(np.float32)
    k = int(max(1, blur_px)) * 2 + 1
    blurred = cv2.GaussianBlur(region, (k, k), blur_px / 2.0)
    if glass.brighten:
        blurred = blurred + 255.0 * glass.brighten
    alpha = mask.astype(np.float32) / 255.0 * np.float32(glass.opacity)
    layer.paint_rgb(np.clip(blurred, 0, 255).astype(np.float32), alpha, roi)
    if glass.tint_opacity > 0:
        layer.paint(mask, tint, glass.tint_opacity, roi)
