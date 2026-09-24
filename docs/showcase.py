"""Render docs/images/showcase.jpg, the README's "what it can draw" grid.

Each tile crops one of the bundled samples tightly around a few objects and renders them with a
style built to show one capability, so the differences stay visible at README width. Detections
are the samples' real YOLO11n output. The objects in the sample video barely move, so the trails
tile scripts plausible paths (pedestrians crossing the street) ending at the real boxes and
feeds them through the real trail renderer.

    uv run python docs/showcase.py
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

import visionstyle as vs

ROOT = Path(__file__).resolve().parent.parent
SAMPLES = ROOT / "src" / "visionstyle" / "assets" / "samples"
FONTS = ROOT / "src" / "visionstyle" / "assets" / "fonts"
OUT = ROOT / "docs" / "images" / "showcase.jpg"

RENDER = (1200, 800)  # each tile is rendered at 2x, then downsampled
TILE = (600, 400)
COLUMNS = 3
GUTTER = 10
CAPTION_H = 88
BG = (14, 15, 12)
INK = (244, 241, 232)
MUTED = (160, 162, 150)
ACCENT = (217, 255, 77)

# Sizes in the styles are the renderer's reference pixels. GitHub shows the grid at ~880 px wide
# (about half size), so SCALE is large enough to keep tags readable there. Object scaling only
# touches the boxes, so every tag in a tile has the same size.
SCALE = 2.4
BASE: dict[str, Any] = {"scale": SCALE, "object_scale": {"apply_to": "box"}}

TILES: list[dict[str, Any]] = [
    {
        "title": "Corner brackets",
        "caption": "Curved elbows, center marks, mono tags",
        "scene": "night",
        "crop": (1110, 500, 1600, 827),
        "style": {
            "palette": {"colors": "cool", "by": "class"},
            "box": {
                "shape": "corners",
                "corner_length": 0.28,
                "corner_curve": True,
                "center_mark": True,
            },
            "stroke": {"thickness": 2.2},
            "label": {
                "components": ["text"],
                "font": "mono",
                "uppercase": True,
                "font_size": 10,
                "background": "solid",
                "radius": 2,
                "text_color": "#0b0d12",
            },
        },
    },
    {
        "title": "Reticle HUD",
        "caption": "Reticle ticks, hatch fill, inside labels",
        "scene": "video",
        "frame": 120,
        "crop": (450, 218, 960, 558),
        "only": ["person", "car", "truck", "motorcycle"],
        "style": {
            "palette": {"colors": ["#ffb020"], "by": "single"},
            "box": {"shape": "reticle", "center_mark": True},
            "stroke": {"thickness": 1.6},
            "fill": {
                "enabled": True,
                "opacity": 0.22,
                "mode": "hatch",
                "hatch_spacing": 7,
                "hatch_angle": -45,
            },
            "label": {
                "components": ["track_id", "text"],
                "placement": "inside",
                "background": "none",
                "text_color": "inherit",
                "font": "mono",
                "font_size": 9,
                "uppercase": True,
                "separator": " ",
                "track_id_format": "ID {id}",
            },
            "effects": {
                "shadow": {
                    "enabled": True,
                    "offset_x": 0,
                    "offset_y": 1,
                    "blur": 2,
                    "opacity": 0.8,
                },
                "grade": {
                    "enabled": True,
                    "contrast": 1.1,
                    "saturation": 0.55,
                    "temperature": -0.3,
                    "lift": -0.05,
                },
            },
        },
    },
    {
        "title": "Rounded + gradient",
        "caption": "Gradient fill, pill labels, soft glow",
        "scene": "night",
        "crop": (270, 490, 780, 830),
        "style": {
            "palette": {"colors": "cinematic", "by": "class"},
            "box": {"shape": "rounded", "corner_radius": 12},
            "stroke": {"thickness": 2},
            "fill": {
                "enabled": True,
                "opacity": 0.45,
                "mode": "gradient",
                "gradient_direction": "up",
            },
            "label": {
                "components": ["text", "confidence"],
                "background": "pill",
                "font_size": 10,
                "offset": 5,
                "attached": False,
            },
            "effects": {"glow": {"enabled": True, "radius": 10, "intensity": 0.9}},
        },
    },
    {
        "title": "Dashed segments",
        "caption": "Multicolor dashes, underline tags",
        "scene": "street",
        "crop": (420, 340, 960, 700),
        "only": ["person", "car", "umbrella"],
        "style": {
            "stroke": {"thickness": 2.2},
            "line": {
                "pattern": "dashed",
                "dash_length": 12,
                "gap_length": 6,
                "multicolor": "segments",
                "segment_colors": ["#ff5c35", "#ffdd75", "#54dff4", "#bc8cff"],
            },
            "label": {
                "components": ["text", "confidence"],
                "background": "underline",
                "text_color": "#ffffff",
                "font_size": 10,
                "confidence_format": "92%",
            },
        },
    },
    {
        "title": "Frosted glass",
        "caption": "Blurred glass fill and label",
        "scene": "street",
        "crop": (600, 400, 1410, 940),
        "only": ["car"],
        "style": {
            "palette": {"colors": "mono", "by": "single"},
            "box": {"shape": "rounded", "corner_radius": 16},
            "stroke": {"thickness": 1.4, "opacity": 0.9},
            "fill": {"enabled": True, "opacity": 0.12},
            "label": {
                "components": ["text", "confidence"],
                "background": "glass",
                "text_color": "#ffffff",
                "font_size": 10,
                "border": True,
            },
            "effects": {
                "glass": {"enabled": True, "blur": 14, "opacity": 0.85, "apply_to": "both"}
            },
        },
    },
    {
        "title": "Neon gradient",
        "caption": "Perimeter gradient with glow",
        "scene": "night",
        "crop": (700, 500, 1100, 767),
        "style": {
            "palette": {"colors": "neon", "by": "class"},
            "box": {"shape": "rounded", "corner_radius": 8},
            "stroke": {"thickness": 2.4},
            "line": {"multicolor": "gradient", "segment_colors": ["#00f0ff", "#ff2bd6", "#c8ff00"]},
            "label": {
                "components": ["text"],
                "anchor": "top_center",
                "background": "pill",
                "background_color": "#0b0d12",
                "background_opacity": 0.85,
                "text_color": "#f4f4ff",
                "border": True,
                "font_size": 9,
                "attached": False,
                "offset": 5,
            },
            "effects": {
                "glow": {"enabled": True, "radius": 12, "intensity": 1.1, "apply_to": "both"}
            },
        },
    },
    {
        "title": "Tracking trails",
        "caption": "Ribbon trails with points, per-track color",
        "scene": "night",
        "crop": (700, 470, 1440, 963),
        "only": ["person", "car"],
        # scripted start offsets (source px) per track id; paths end at the real boxes
        "motion": {3: (-230, 30), 4: (260, 40), 6: (230, -10), 7: (110, 6), 8: (-100, 4)},
        "style": {
            "palette": {"colors": "neon", "by": "track"},
            "box": {"shape": "corners", "corner_length": 0.24},
            "stroke": {"thickness": 1.8},
            "label": {
                "components": ["track_id"],
                "track_id_format": "#{id}",
                "font": "mono",
                "font_size": 9,
                "background": "solid",
                "text_color": "#0b0d12",
            },
            "trail": {
                "enabled": True,
                "length": 40,
                "line": "ribbon",
                "thickness": 4,
                "show_points": True,
                "point_radius": 2.5,
                "glow": True,
                "smoothing": 3,
            },
            "effects": {"dim_outside": 0.25},
        },
    },
    {
        "title": "Spotlight",
        "caption": "Dims the frame outside detections",
        "scene": "video",
        "frame": 200,
        "crop": (170, 250, 620, 550),
        "only": ["person"],
        "style": {
            "palette": {"colors": "mono", "by": "single"},
            "stroke": {"thickness": 1.3},
            "label": {
                "components": ["text"],
                "anchor": "bottom_left",
                "background": "none",
                "text_color": "#ffffff",
                "font_size": 9,
            },
            "effects": {"dim_outside": 0.7, "vignette": {"enabled": True, "strength": 0.35}},
        },
    },
    {
        "title": "Confidence ramp",
        "caption": "Color follows the score, vertical side tags",
        "scene": "street",
        "crop": (0, 320, 960, 960),
        "only": ["person", "car", "bicycle"],
        "style": {
            "stroke": {"color": "confidence", "thickness": 2.2},
            "fill": {"enabled": True, "opacity": 0.12, "color": "confidence"},
            "label": {
                "components": ["confidence"],
                "anchor": "left",
                "orientation": "vertical",
                "background": "solid",
                "background_color": "confidence",
                "text_color": "#0b0d12",
                "font": "mono",
                "font_size": 10,
                "confidence_format": "92%",
            },
        },
    },
]


# ----------------------------------------------------------------------------- geometry
def _remap(
    dets: list[dict[str, Any]], crop: tuple[int, int, int, int], only: list[str] | None
) -> list[dict[str, Any]]:
    """Keep detections mostly inside the crop, in tile (RENDER) pixel coordinates."""
    x0, y0, x1, y1 = crop
    k = RENDER[0] / (x1 - x0)
    kept = []
    for d in dets:
        if only and d["class_name"] not in only:
            continue
        bx0, by0, bx1, by1 = d["xyxy"]
        ix0, iy0, ix1, iy1 = max(bx0, x0), max(by0, y0), min(bx1, x1), min(by1, y1)
        if ix1 <= ix0 or iy1 <= iy0:
            continue
        if (ix1 - ix0) * (iy1 - iy0) < 0.7 * (bx1 - bx0) * (by1 - by0):
            continue
        kept.append({**d, "xyxy": [(ix0 - x0) * k, (iy0 - y0) * k, (ix1 - x0) * k, (iy1 - y0) * k]})
    return kept


def _crop(image: np.ndarray, crop: tuple[int, int, int, int]) -> np.ndarray:
    x0, y0, x1, y1 = crop
    return cv2.resize(image[y0:y1, x0:x1], RENDER, interpolation=cv2.INTER_LANCZOS4)


def _shifted(
    dets: list[dict[str, Any]], motion: dict[int, tuple[float, float]], k: float, u: float
) -> list[dict[str, Any]]:
    """Detections moved back along a gently curved scripted path; u=1 is the real position."""
    out = []
    for d in dets:
        dx, dy = motion.get(d["track_id"], (0.0, 0.0))
        a = 1.0 - u
        bend = math.sin(u * math.pi) * 0.04 * math.hypot(dx, dy)
        ox, oy = (dx * a) * k, (dy * a - bend) * k
        x0, y0, x1, y1 = d["xyxy"]
        out.append({**d, "xyxy": [x0 + ox, y0 + oy, x1 + ox, y1 + oy]})
    return out


# ----------------------------------------------------------------------------- tiles
def render_tile(spec: dict[str, Any]) -> Image.Image:
    style = vs.Style.model_validate({"name": spec["title"], **BASE, **spec["style"]})
    crop = spec["crop"]
    x0, y0, x1, y1 = crop
    assert abs((x1 - x0) / (y1 - y0) - 1.5) < 0.01, f"{spec['title']}: crop must be 3:2"
    only = spec.get("only")

    if spec["scene"] == "video":
        sidecar = json.loads((SAMPLES / "city-walkthrough.detections.json").read_text())
        frames = {f["index"]: f["detections"] for f in sidecar["frames"]}
        cap = cv2.VideoCapture(str(SAMPLES / "city-walkthrough.mp4"))
        cap.set(cv2.CAP_PROP_POS_FRAMES, spec["frame"])
        ok, frame = cap.read()
        cap.release()
        assert ok, "could not read the sample video"
        dets = _remap(frames.get(spec["frame"], []), crop, only)
        out = vs.annotate(_crop(frame, crop), vs.Detections.from_dicts(dets), style=style)
    else:
        image = cv2.imread(str(SAMPLES / f"{spec['scene']}.jpg"))
        raw = json.loads((SAMPLES / f"{spec['scene']}.detections.json").read_text())["detections"]
        tile = _crop(image, crop)
        dets = _remap(raw, crop, only)
        if "motion" in spec:
            # feed a scripted sequence through one Annotator so the trail buffer fills naturally
            annotator = vs.Annotator(style)
            n = style.trail.length
            k = RENDER[0] / (x1 - x0)
            for i in range(n):
                step = _shifted(dets, spec["motion"], k, i / (n - 1))
                out = annotator.annotate(tile, vs.Detections.from_dicts(step), t=i / style.fps)
        else:
            out = vs.annotate(tile, vs.Detections.from_dicts(dets), style=style)

    rgb = Image.fromarray(cv2.cvtColor(out, cv2.COLOR_BGR2RGB))
    return rgb.resize(TILE, Image.Resampling.LANCZOS)


# ----------------------------------------------------------------------------- grid
def main() -> None:
    rows = -(-len(TILES) // COLUMNS)
    cell_h = TILE[1] + CAPTION_H
    width = COLUMNS * TILE[0] + (COLUMNS + 1) * GUTTER
    height = rows * cell_h + (rows + 1) * GUTTER
    sheet = Image.new("RGB", (width, height), BG)
    draw = ImageDraw.Draw(sheet)
    mono = ImageFont.truetype(str(FONTS / "JetBrainsMono-SemiBold.ttf"), 25)
    sans = ImageFont.truetype(str(FONTS / "Inter-Variable.ttf"), 22)
    for i, spec in enumerate(TILES):
        col, row = i % COLUMNS, i // COLUMNS
        x = GUTTER + col * (TILE[0] + GUTTER)
        y = GUTTER + row * (cell_h + GUTTER)
        sheet.paste(render_tile(spec), (x, y))
        ty = y + TILE[1] + 14
        number = f"{i + 1:02d}"
        draw.text((x + 16, ty), number, font=mono, fill=ACCENT)
        draw.text(
            (x + 16 + draw.textlength(number + "  ", font=mono), ty),
            spec["title"].upper(),
            font=mono,
            fill=INK,
        )
        draw.text((x + 16, ty + 36), spec["caption"], font=sans, fill=MUTED)
        print(f"{number} {spec['title']}")
    sheet.save(OUT, quality=85, optimize=True, progressive=True)
    print(f"-> {OUT.relative_to(ROOT)} {sheet.size} {OUT.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
