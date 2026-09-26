"""Render docs/images/presets/<name>.jpg and thumbs/<name>.jpg for every built-in preset.

These feed the site's preset explorer. Each render is the bundled street.jpg (Osaka taxi alley)
with its shipped detections. Like the Studio preview and ``visionstyle gallery``, trails use
synthetic trajectories because the sample is a still image.

    uv run python docs/presets.py [name ...]
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import cv2
from PIL import Image

import visionstyle as vs
from visionstyle.style.presets import list_presets

ROOT = Path(__file__).resolve().parent.parent
SAMPLES = ROOT / "src" / "visionstyle" / "assets" / "samples"
OUT = ROOT / "docs" / "images" / "presets"

WIDTH = 1400  # full renders, JPEG q80
THUMB = (288, 180)
THUMB_CROP = (360, 330, 1360, 955)  # people, umbrellas and taxi, in 1600 px source coordinates


def main(names: list[str]) -> None:
    image = cv2.imread(str(SAMPLES / "street.jpg"))
    raw = json.loads((SAMPLES / "street.detections.json").read_text())["detections"]
    dets = vs.Detections.from_dicts(raw)
    builtin = [p.name for p in list_presets() if p.origin == "builtin"]
    (OUT / "thumbs").mkdir(parents=True, exist_ok=True)
    for name in names or builtin:
        out = vs.Annotator(vs.Style.preset(name)).annotate(image, dets, synthetic_trails=True)
        im = Image.fromarray(cv2.cvtColor(out, cv2.COLOR_BGR2RGB))
        k = im.width / 1600
        thumb = im.crop(tuple(round(v * k) for v in THUMB_CROP))
        thumb.resize(THUMB, Image.Resampling.LANCZOS).save(
            OUT / "thumbs" / f"{name}.jpg", quality=78, optimize=True, progressive=True
        )
        full = im.resize((WIDTH, round(im.height * WIDTH / im.width)), Image.Resampling.LANCZOS)
        full.save(OUT / f"{name}.jpg", quality=80, optimize=True, progressive=True)
        print(name)


if __name__ == "__main__":
    main(sys.argv[1:])
