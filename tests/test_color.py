from __future__ import annotations

import pytest

from visionstyle.color import (
    PALETTES,
    confidence_color,
    contrast_text_color,
    palette_colors,
    parse_color,
    shift_hue,
    to_hex,
)


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("#ff5c35", (255, 92, 53)),
        ("FF5C35", (255, 92, 53)),
        ("#fff", (255, 255, 255)),
        ("rgb(1, 2, 3)", (1, 2, 3)),
        ("white", (255, 255, 255)),
        ((10, 20, 30), (10, 20, 30)),
        ((1.0, 0.0, 0.5), (255, 0, 128)),
    ],
)
def test_parse_color(value, expected):
    assert parse_color(value) == expected


def test_parse_color_rejects_garbage():
    with pytest.raises(ValueError):
        parse_color("not-a-color")
    with pytest.raises(ValueError):
        parse_color((1, 2))


def test_hex_roundtrip():
    assert to_hex(parse_color("#0a0b0c")) == "#0a0b0c"


def test_contrast_text_color():
    assert contrast_text_color((255, 255, 255))[0] < 50
    assert contrast_text_color((0, 0, 0))[0] > 200


def test_confidence_ramp_monotone_in_green():
    lo, mid, hi = confidence_color(0.0), confidence_color(0.5), confidence_color(1.0)
    assert lo[0] > hi[0]  # red decreases
    assert hi[1] > lo[1]  # green increases
    assert mid == (255, 191, 0)


def test_palettes_parse():
    for name in PALETTES:
        colors = palette_colors(name)
        assert colors and all(len(c) == 3 for c in colors)
    assert palette_colors(["#fff", "#000"]) == [(255, 255, 255), (0, 0, 0)]
    with pytest.raises(ValueError):
        palette_colors("nope")


def test_shift_hue_preserves_gray():
    assert shift_hue((128, 128, 128), 90) == (128, 128, 128)
