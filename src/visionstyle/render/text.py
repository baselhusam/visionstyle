"""TrueType text rendering through Pillow, producing anti-aliased masks for :class:`Layer`."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import numpy as np
import numpy.typing as npt
from PIL import Image, ImageDraw, ImageFont

FONTS_DIR = Path(__file__).resolve().parent.parent / "assets" / "fonts"
BUILTIN_FONTS: dict[str, Path] = {
    "inter": FONTS_DIR / "Inter-Variable.ttf",
    "mono": FONTS_DIR / "JetBrainsMono-Medium.ttf",
    "mono-bold": FONTS_DIR / "JetBrainsMono-SemiBold.ttf",
}

U8 = npt.NDArray[np.uint8]


def resolve_font_path(name: str) -> Path:
    if name in BUILTIN_FONTS:
        return BUILTIN_FONTS[name]
    p = Path(name).expanduser()
    if p.is_file():
        return p
    raise FileNotFoundError(f"Font {name!r} not found. Use 'inter', 'mono' or a .ttf path.")


@lru_cache(maxsize=256)
def load_font(name: str, size_px: int, weight: int = 600) -> ImageFont.FreeTypeFont:
    path = resolve_font_path(name)
    size = max(4, int(size_px))
    if name == "mono" and weight >= 650 and BUILTIN_FONTS["mono-bold"].is_file():
        path = BUILTIN_FONTS["mono-bold"]
    font = ImageFont.truetype(str(path), size)
    try:  # variable fonts (Inter) expose a weight axis
        axes = font.get_variation_axes()
        values: list[float] = [float(a.get("default") or 400) for a in axes]
        for i, axis in enumerate(axes):
            lo, hi = float(axis.get("minimum") or 0), float(axis.get("maximum") or 1000)
            if axis.get("name", b"") in (b"Weight", "Weight", b"wght", "wght"):
                values[i] = max(lo, min(hi, float(weight)))
            elif axis.get("name", b"") in (b"Optical size", "Optical size", b"opsz", "opsz"):
                values[i] = max(lo, min(hi, float(size)))
        font.set_variation_by_axes(values)
    except Exception:
        pass
    return font


def measure(text: str, font: ImageFont.FreeTypeFont) -> tuple[int, int, int]:
    """Return ``(width, height, ascent_offset)`` of ``text`` in pixels.

    Height is the font's line height (ascent+descent) so all tags of one style line up
    regardless of which glyphs they contain."""
    ascent, descent = font.getmetrics()
    left, _top, right, _bottom = font.getbbox(text)
    return max(1, int(right - left)), int(ascent + descent), int(left)


def render_text_mask(text: str, font: ImageFont.FreeTypeFont, pad: int = 2) -> U8:
    """Rasterise ``text`` as a uint8 alpha mask (white on black)."""
    w, h, left = measure(text, font)
    img = Image.new("L", (w + pad * 2, h + pad * 2), 0)
    ImageDraw.Draw(img).text((pad - left, pad), text, font=font, fill=255)
    return np.asarray(img, dtype=np.uint8)
