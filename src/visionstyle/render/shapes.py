"""Outline paths (rectangle, rounded, corner brackets, reticle) and stroke rasterisation with
solid / dashed / dotted patterns, multi-color segments and animation phase."""

from __future__ import annotations

import math
from collections.abc import Sequence

import cv2
import numpy as np
import numpy.typing as npt

from visionstyle.color import RGB, mix, shift_hue

Point = tuple[float, float]
Path = list[Point]
"""An open polyline. Closed outlines repeat the first point at the end."""

F32 = npt.NDArray[np.float32]
U8 = npt.NDArray[np.uint8]


# ----------------------------------------------------------------------------- path builders
def rect_path(x1: float, y1: float, x2: float, y2: float) -> Path:
    return [(x1, y1), (x2, y1), (x2, y2), (x1, y2), (x1, y1)]


def _arc(cx: float, cy: float, r: float, start_deg: float, end_deg: float, steps: int) -> Path:
    return [
        (cx + r * math.cos(math.radians(a)), cy + r * math.sin(math.radians(a)))
        for a in np.linspace(start_deg, end_deg, steps)
    ]


def rounded_rect_path(x1: float, y1: float, x2: float, y2: float, radius: float) -> Path:
    r = max(0.0, min(radius, (x2 - x1) / 2, (y2 - y1) / 2))
    if r < 0.5:
        return rect_path(x1, y1, x2, y2)
    steps = max(6, int(r / 1.5))
    pts: Path = []
    pts += _arc(x2 - r, y1 + r, r, -90, 0, steps)  # top-right
    pts += _arc(x2 - r, y2 - r, r, 0, 90, steps)  # bottom-right
    pts += _arc(x1 + r, y2 - r, r, 90, 180, steps)  # bottom-left
    pts += _arc(x1 + r, y1 + r, r, 180, 270, steps)  # top-left
    pts.append(pts[0])
    return pts


def corner_paths(
    x1: float, y1: float, x2: float, y2: float, length: float, curve_radius: float = 0.0
) -> list[Path]:
    """Four L-shaped brackets. ``length`` is in pixels (already resolved)."""
    w, h = x2 - x1, y2 - y1
    leg = max(1.0, min(length, w / 2, h / 2))
    r = min(curve_radius, leg * 0.9) if curve_radius > 0 else 0.0
    paths: list[Path] = []
    # (corner x, corner y, x direction, y direction)
    for cx, cy, dx, dy in ((x1, y1, 1, 1), (x2, y1, -1, 1), (x2, y2, -1, -1), (x1, y2, 1, -1)):
        if r < 0.5:
            paths.append([(cx, cy + dy * leg), (cx, cy), (cx + dx * leg, cy)])
            continue
        # vertical leg -> arc -> horizontal leg
        acx, acy = cx + dx * r, cy + dy * r
        if (dx, dy) == (1, 1):
            arc = _arc(acx, acy, r, 180, 270, 8)
        elif (dx, dy) == (-1, 1):
            arc = _arc(acx, acy, r, 270, 360, 8)
        elif (dx, dy) == (-1, -1):
            arc = _arc(acx, acy, r, 0, 90, 8)
        else:
            arc = _arc(acx, acy, r, 90, 180, 8)
        if abs(arc[0][0] - cx) > abs(arc[0][1] - cy):  # ensure we start on the vertical leg
            arc.reverse()
        paths.append([(cx, cy + dy * leg), *arc, (cx + dx * leg, cy)])
    return paths


def reticle_paths(x1: float, y1: float, x2: float, y2: float, tick: float) -> list[Path]:
    """Ticks at the middle of each edge, pointing inwards."""
    mx, my = (x1 + x2) / 2, (y1 + y2) / 2
    t = max(1.0, min(tick, (x2 - x1) / 3, (y2 - y1) / 3))
    return [
        [(mx, y1), (mx, y1 + t)],
        [(mx, y2), (mx, y2 - t)],
        [(x1, my), (x1 + t, my)],
        [(x2, my), (x2 - t, my)],
    ]


def center_cross_paths(cx: float, cy: float, size: float) -> list[Path]:
    return [[(cx - size, cy), (cx + size, cy)], [(cx, cy - size), (cx, cy + size)]]


def inset_box(
    x1: float, y1: float, x2: float, y2: float, d: float
) -> tuple[float, float, float, float]:
    d = min(d, (x2 - x1) / 2 - 0.5, (y2 - y1) / 2 - 0.5)
    return x1 + d, y1 + d, x2 - d, y2 - d


# ----------------------------------------------------------------------------- path walking
def path_length(path: Path) -> float:
    return sum(math.dist(path[i], path[i + 1]) for i in range(len(path) - 1))


def _point_at(path: Path, cum: list[float], s: float) -> Point:
    """Point at arc length ``s`` along ``path`` (``cum`` = cumulative lengths)."""
    if s <= 0:
        return path[0]
    if s >= cum[-1]:
        return path[-1]
    i = int(np.searchsorted(cum, s, side="right")) - 1
    i = max(0, min(i, len(path) - 2))
    seg = cum[i + 1] - cum[i]
    t = 0.0 if seg <= 0 else (s - cum[i]) / seg
    (ax, ay), (bx, by) = path[i], path[i + 1]
    return (ax + (bx - ax) * t, ay + (by - ay) * t)


def _sub_path(path: Path, cum: list[float], s0: float, s1: float) -> Path:
    """Portion of ``path`` between arc lengths ``s0`` and ``s1``."""
    pts = [_point_at(path, cum, s0)]
    for i, c in enumerate(cum):
        if s0 < c < s1:
            pts.append(path[i])
    pts.append(_point_at(path, cum, s1))
    return pts


def split_dashes(path: Path, dash: float, gap: float, phase: float = 0.0) -> list[Path]:
    """Cut a path into dashes. ``phase`` (pixels) shifts the pattern along the path."""
    cum = [0.0]
    for i in range(len(path) - 1):
        cum.append(cum[-1] + math.dist(path[i], path[i + 1]))
    total = cum[-1]
    if total <= 0:
        return []
    period = dash + gap
    dashes: list[Path] = []
    start = -(phase % period)
    while start < total:
        s0, s1 = max(0.0, start), min(total, start + dash)
        if s1 > s0 + 0.01:
            dashes.append(_sub_path(path, cum, s0, s1))
        start += period
    return dashes


def sample_points(path: Path, spacing: float, phase: float = 0.0) -> list[Point]:
    cum = [0.0]
    for i in range(len(path) - 1):
        cum.append(cum[-1] + math.dist(path[i], path[i + 1]))
    total = cum[-1]
    if total <= 0 or spacing <= 0:
        return []
    pts: list[Point] = []
    s = -(phase % spacing)
    while s < total:
        if s >= 0:
            pts.append(_point_at(path, cum, s))
        s += spacing
    return pts


def split_even(path: Path, n: int) -> list[Path]:
    """Cut a path into ``n`` equal-length pieces (for perimeter gradients)."""
    cum = [0.0]
    for i in range(len(path) - 1):
        cum.append(cum[-1] + math.dist(path[i], path[i + 1]))
    total = cum[-1]
    if total <= 0:
        return []
    step = total / n
    return [_sub_path(path, cum, i * step, (i + 1) * step) for i in range(n)]


# ----------------------------------------------------------------------------- rasterising
def _to_cv(path: Path, ox: float, oy: float) -> npt.NDArray[np.int32]:
    # cv2 supports fixed-point coordinates through `shift`; we use 3 fractional bits.
    arr = np.array([[(x - ox) * 8, (y - oy) * 8] for x, y in path], dtype=np.float64)
    return np.round(arr).astype(np.int32).reshape(-1, 1, 2)


def draw_polyline(
    mask: U8, path: Path, thickness: float, ox: float, oy: float, value: int = 255
) -> None:
    if len(path) < 2:
        return
    t = max(1, round(thickness))
    cv2.polylines(mask, [_to_cv(path, ox, oy)], False, int(value), t, cv2.LINE_AA, shift=3)


def fill_polygon(mask: U8, path: Path, ox: float, oy: float, value: int = 255) -> None:
    if len(path) < 3:
        return
    cv2.fillPoly(mask, [_to_cv(path, ox, oy)], int(value), cv2.LINE_AA, shift=3)


def draw_dot(mask: U8, p: Point, radius: float, ox: float, oy: float, value: int = 255) -> None:
    cx, cy = round((p[0] - ox) * 8), round((p[1] - oy) * 8)
    cv2.circle(mask, (cx, cy), max(1, round(radius * 8)), int(value), -1, cv2.LINE_AA, shift=3)


# ----------------------------------------------------------------------------- color along path
def segment_color(
    base: RGB, i: int, n: int, mode: str, segment_colors: Sequence[RGB], hue_phase: float
) -> RGB:
    """Color of the i-th of n pieces for `multicolor` modes; ``hue_phase`` in degrees."""
    if mode == "segments" and segment_colors:
        c = segment_colors[i % len(segment_colors)]
    elif mode == "gradient" and segment_colors:
        pos = (i / max(1, n)) * len(segment_colors)
        j = int(pos) % len(segment_colors)
        c = mix(segment_colors[j], segment_colors[(j + 1) % len(segment_colors)], pos - int(pos))
    else:
        c = base
    return shift_hue(c, hue_phase) if hue_phase else c
