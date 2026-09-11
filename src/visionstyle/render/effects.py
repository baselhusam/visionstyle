"""Whole-frame effects (color grade, vignette, grain, spotlight) and the glass blur."""

from __future__ import annotations

from functools import lru_cache

import cv2
import numpy as np
import numpy.typing as npt

from visionstyle.color import RGB
from visionstyle.render.canvas import ROI, Layer, gaussian
from visionstyle.style.schema import ColorGrade, GlassEffect, GrainEffect, VignetteEffect

U8 = npt.NDArray[np.uint8]
F32 = npt.NDArray[np.float32]


@lru_cache(maxsize=8)
def _grade_luts(contrast: float, temperature: float, lift: float) -> np.ndarray:
    """Per-channel (B, G, R) lookup tables for the point-wise part of the grade."""
    x = np.arange(256, dtype=np.float32) / 255.0
    base = (x - 0.5) * contrast + 0.5 + lift
    t = temperature * 0.12
    luts = np.stack([base - t, base, base + t], axis=1)  # BGR
    return (np.clip(luts, 0, 1) * 255).astype(np.uint8)


def apply_grade(frame: U8, grade: ColorGrade) -> U8:
    img = frame
    if grade.monochrome:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        img = np.asarray(cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR), np.uint8)
    elif grade.saturation != 1.0:
        gray = cv2.cvtColor(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY), cv2.COLOR_GRAY2BGR)
        img = np.asarray(
            cv2.addWeighted(img, grade.saturation, gray, 1.0 - grade.saturation, 0), np.uint8
        )
    if grade.contrast != 1.0 or grade.temperature or grade.lift:
        luts = _grade_luts(grade.contrast, grade.temperature, grade.lift)
        channels = [cv2.LUT(img[..., i], luts[:, i]) for i in range(3)]
        img = np.asarray(cv2.merge(channels), np.uint8)
    return np.asarray(img, np.uint8)


@lru_cache(maxsize=8)
def _vignette_mult(h: int, w: int, strength: float, radius: float) -> F32:
    ys, xs = np.ogrid[:h, :w]
    nx = (xs - w / 2) / (w / 2)
    ny = (ys - h / 2) / (h / 2)
    d = np.sqrt(nx**2 + ny**2) / radius
    falloff = np.clip((d - 0.55) / 0.9, 0, 1) ** 1.6
    return (1.0 - falloff * strength).astype(np.float32)


def apply_vignette(frame: U8, v: VignetteEffect) -> U8:
    h, w = frame.shape[:2]
    mult = _vignette_mult(h, w, v.strength, v.radius)
    out = frame.astype(np.float32) * mult[..., None]
    return np.asarray(np.clip(out, 0, 255), np.uint8)


@lru_cache(maxsize=4)
def _noise_tile(h: int, w: int, seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    return rng.normal(0, 1, size=(h + 64, w + 64)).astype(np.float32)


def apply_grain(frame: U8, g: GrainEffect, frame_index: int = 0) -> U8:
    h, w = frame.shape[:2]
    tile = _noise_tile(h, w, g.seed)
    ox, oy = (frame_index * 17) % 64, (frame_index * 29) % 64
    noise = tile[oy : oy + h, ox : ox + w] * np.float32(255 * g.amount * 0.35)
    out = frame.astype(np.float32) + noise[..., None]
    return np.asarray(np.clip(out, 0, 255), np.uint8)


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
