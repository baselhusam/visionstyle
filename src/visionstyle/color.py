"""Color parsing, palettes and per-detection color resolution."""

from __future__ import annotations

import colorsys
import re
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from collections.abc import Sequence

RGB = tuple[int, int, int]
"""A color as an (R, G, B) tuple of 0-255 ints. Rendering converts to BGR at the last moment."""

# Palettes are ordered so consecutive classes contrast well. Values are RGB.
PALETTES: dict[str, list[str]] = {
    "default": [
        "#ff5c35",
        "#54dff4",
        "#d8ff3e",
        "#ef6dff",
        "#ffdd75",
        "#5cff9d",
        "#ff7ab6",
        "#7d8cff",
        "#ffa94d",
        "#4dd4ac",
        "#f4f1e8",
        "#c9b1ff",
    ],
    "neon": [
        "#00f0ff",
        "#ff2bd6",
        "#c8ff00",
        "#ff6a00",
        "#7c4dff",
        "#00ff85",
        "#ffe600",
        "#ff3860",
        "#3d7bff",
        "#ff9ecb",
    ],
    "pastel": [
        "#ffb3a7",
        "#a7d8ff",
        "#c9f2a7",
        "#e0b3ff",
        "#fff0a7",
        "#a7f5d8",
        "#ffc9e3",
        "#b3c2ff",
        "#ffd9a7",
        "#b3ffe6",
    ],
    "cinematic": ["#f3af45", "#5de1e6", "#f5f0e8", "#ff7d68", "#bc8cff", "#82d890"],
    "mono": ["#f4f1e8"],
    "warm": ["#ff5c35", "#ffa94d", "#ffdd75", "#ff7ab6", "#ff3860", "#f3af45"],
    "cool": ["#54dff4", "#7d8cff", "#5cff9d", "#4dd4ac", "#bc8cff", "#3d7bff"],
    "tab10": [
        "#1f77b4",
        "#ff7f0e",
        "#2ca02c",
        "#d62728",
        "#9467bd",
        "#8c564b",
        "#e377c2",
        "#7f7f7f",
        "#bcbd22",
        "#17becf",
    ],
}

_CSS_NAMES: dict[str, str] = {
    "white": "#ffffff",
    "black": "#000000",
    "red": "#ff0000",
    "green": "#00ff00",
    "blue": "#0000ff",
    "yellow": "#ffff00",
    "cyan": "#00ffff",
    "magenta": "#ff00ff",
    "orange": "#ffa500",
    "purple": "#800080",
    "pink": "#ffc0cb",
    "gray": "#808080",
    "grey": "#808080",
    "lime": "#00ff00",
    "teal": "#008080",
    "amber": "#ffbf00",
    "coral": "#ff7f50",
    "violet": "#ee82ee",
    "gold": "#ffd700",
    "navy": "#000080",
}

_HEX_RE = re.compile(r"^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$")
_RGB_RE = re.compile(r"^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*[\d.]+\s*)?\)$")


def parse_color(value: str | Sequence[int] | Sequence[float]) -> RGB:
    """Parse ``#rrggbb``, ``#rgb``, ``rgb(r,g,b)``, a CSS name or an (r,g,b) sequence into RGB."""
    if isinstance(value, str):
        text = value.strip().lower()
        if text in _CSS_NAMES:
            text = _CSS_NAMES[text]
        if m := _HEX_RE.match(text):
            digits = m.group(1)
            if len(digits) == 3:
                digits = "".join(ch * 2 for ch in digits)
            return (int(digits[0:2], 16), int(digits[2:4], 16), int(digits[4:6], 16))
        if m := _RGB_RE.match(text):
            return tuple(min(255, max(0, int(g))) for g in m.groups())  # type: ignore[return-value]
        raise ValueError(f"Unrecognised color: {value!r}")
    channels = list(value)[:3]
    if len(channels) != 3:
        raise ValueError(f"Color sequence must have 3 channels, got {value!r}")
    if all(isinstance(c, float) and 0.0 <= c <= 1.0 for c in channels):
        channels = [round(c * 255) for c in channels]
    return tuple(int(min(255, max(0, c))) for c in channels)  # type: ignore[return-value]


def to_hex(rgb: RGB) -> str:
    return "#{:02x}{:02x}{:02x}".format(*rgb)


def to_bgr(rgb: RGB) -> tuple[int, int, int]:
    return (rgb[2], rgb[1], rgb[0])


def luminance(rgb: RGB) -> float:
    """Relative luminance in 0..1 (WCAG)."""

    def channel(c: int) -> float:
        v = c / 255
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4

    r, g, b = (channel(c) for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast_text_color(background: RGB) -> RGB:
    """Near-black or near-white, whichever reads better on ``background``."""
    return (12, 14, 12) if luminance(background) > 0.35 else (245, 242, 235)


def mix(a: RGB, b: RGB, t: float) -> RGB:
    t = min(1.0, max(0.0, t))
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))  # type: ignore[return-value]


def shift_hue(rgb: RGB, degrees: float) -> RGB:
    h, s, v = colorsys.rgb_to_hsv(*(c / 255 for c in rgb))
    h = (h + degrees / 360.0) % 1.0
    return tuple(round(c * 255) for c in colorsys.hsv_to_rgb(h, s, v))  # type: ignore[return-value]


def lighten(rgb: RGB, amount: float) -> RGB:
    return mix(rgb, (255, 255, 255), amount)


def darken(rgb: RGB, amount: float) -> RGB:
    return mix(rgb, (0, 0, 0), amount)


def confidence_color(
    conf: float, low: RGB = (255, 77, 77), mid: RGB = (255, 191, 0), high: RGB = (92, 255, 157)
) -> RGB:
    """Red → amber → green ramp used by ``ColorSpec == "confidence"``."""
    conf = min(1.0, max(0.0, conf))
    return mix(low, mid, conf / 0.5) if conf < 0.5 else mix(mid, high, (conf - 0.5) / 0.5)


def palette_colors(spec: str | Sequence[str]) -> list[RGB]:
    """Resolve a palette name or an explicit list of colors."""
    if isinstance(spec, str):
        if spec not in PALETTES:
            raise ValueError(f"Unknown palette {spec!r}. Available: {', '.join(PALETTES)}")
        return [parse_color(c) for c in PALETTES[spec]]
    return [parse_color(c) for c in spec]
