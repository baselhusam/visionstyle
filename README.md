<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/baselhusam/visionstyle/main/docs/images/hero-chroma-press-dark.png">
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/baselhusam/visionstyle/main/docs/images/hero-chroma-press-light.png">
    <img src="https://raw.githubusercontent.com/baselhusam/visionstyle/main/docs/images/hero-chroma-press-light.png" alt="visionstyle — expressive computer-vision styling" width="100%">
  </picture>
</p>

<p align="center">
  <b>Beautiful, fully configurable bounding boxes for object detection.</b><br>
  Boxes, labels, fills, glow, glass, film grain and tracking trails, described by one <code>Style</code>,<br>
  tuned live in the Studio, saved as YAML and rendered with one call.
</p>

<p align="center">
  <a href="https://pypi.org/project/visionstyle/"><img src="https://img.shields.io/pypi/v/visionstyle" alt="PyPI version"></a>
  <a href="https://pypi.org/project/visionstyle/"><img src="https://img.shields.io/pypi/pyversions/visionstyle" alt="Python versions"></a>
  <a href="https://github.com/baselhusam/visionstyle/actions/workflows/ci.yml"><img src="https://github.com/baselhusam/visionstyle/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/baselhusam/visionstyle/blob/main/LICENSE"><img src="https://img.shields.io/pypi/l/visionstyle" alt="License"></a>
</p>

<p align="center">
  <a href="https://baselhusam.github.io/visionstyle/"><b>Website</b></a> ·
  <a href="https://github.com/baselhusam/visionstyle#quickstart">Quickstart</a> ·
  <a href="https://github.com/baselhusam/visionstyle#presets">Presets</a> ·
  <a href="https://github.com/baselhusam/visionstyle#studio">Studio</a> ·
  <a href="https://github.com/baselhusam/visionstyle#python-api">Python API</a> ·
  <a href="https://github.com/baselhusam/visionstyle#cli">CLI</a> ·
  <a href="https://github.com/baselhusam/visionstyle/blob/main/CHANGELOG.md">Changelog</a>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/baselhusam/visionstyle/main/docs/images/hero-cinematic.jpg" alt="A rainy Manhattan street at night annotated with the cinematic preset: amber and teal rounded frames with pill labels around pedestrians, a bus and cars" width="100%">
  <br><sub>YOLO11n detections on a rainy Manhattan crossing, rendered with <code>style="cinematic"</code>.</sub>
</p>

## Quickstart

```bash
pip install "visionstyle[yolo]"
```

```python
import cv2
import visionstyle as vs
from ultralytics import YOLO

frame = cv2.imread("street.jpg")
result = YOLO("yolo11n.pt")(frame)[0]

dets = vs.Detections.from_ultralytics(result)
cv2.imwrite("out.jpg", vs.annotate(frame, dets, style="cinematic"))
```

No model handy? `visionstyle render sample -s neon -o out.jpg` renders a bundled photo with its
shipped detections.

visionstyle only draws, so any detector works: pass boxes as lists, NumPy arrays or torch tensors
(see [Python API](https://github.com/baselhusam/visionstyle#python-api)).

### Install options

| Command | Adds |
|---|---|
| `pip install visionstyle` | The renderer: NumPy, OpenCV (headless), Pillow, pydantic, PyYAML |
| `pip install "visionstyle[yolo]"` | Ultralytics YOLO for `from_ultralytics`, the CLI `--model` flag and video tracking |
| `pip install "visionstyle[studio]"` | FastAPI + Uvicorn for the Studio web app |
| `pip install "visionstyle[all]"` | Everything above |

Python 3.10 – 3.13.

## Why visionstyle

- **One object describes the look.** A `Style` covers boxes, strokes, fills, line patterns,
  labels, effects and trails. Every option is a typed, validated attribute, and the whole thing
  round-trips to YAML.
- **Twelve presets to start from.** Use one by name, or copy its YAML and make it yours.
- **Looks the same at any resolution.** Sizes are in reference pixels and scale with the frame, and
  each object's outline and label scale with its size, so distant objects stay light.
- **Built for video.** Keep one `Annotator` per stream and you get tracking trails, marching
  dashes, hue cycling and pulses that carry across frames.
- **A Studio to design in.** Tune a style visually on your own image or video. The Python package
  renders every preview, so what you see is exactly what `annotate()` produces.

## Presets

Every preset is a plain YAML file you can copy and edit.

<p align="center"><img src="https://raw.githubusercontent.com/baselhusam/visionstyle/main/docs/images/gallery.jpg" alt="The twelve built-in presets rendered on the same night street in Osaka" width="100%"></p>

| Preset | Look | Preset | Look |
|---|---|---|---|
| `default` | Clean rectangle, solid tag | `neon` | Glowing hue-cycling gradient outlines |
| `minimal` | Hairline outline, bare text | `hud` | Double frame, reticle marks, inside mono labels, dotted trails |
| `corners` | Thin L-brackets, monospace tag | `cinematic` | Rounded amber/teal frames, gradient fill, pill labels, glow, filmic grade |
| `rounded` | Rounded corners, gradient tint, pill label | `tracking` | Bold per-track trails, id-first labels |
| `dashed` | Dashed perimeter with marching ants | `spotlight` | Dims everything outside the detections |
| `glass` | Frosted-glass fill and label | `confidence` | Stroke and tag color follow the confidence score |

```bash
visionstyle presets list
visionstyle presets show cinematic
visionstyle presets export cinematic -o my-look.yaml
```

## Studio

Design a style visually on your own image, video and model, then save it as a preset the package
loads by name.

```bash
pip install "visionstyle[studio,yolo]"
visionstyle studio          # opens http://127.0.0.1:8420
```

<p align="center"><img src="https://raw.githubusercontent.com/baselhusam/visionstyle/main/docs/images/studio.jpg" alt="The visionstyle Studio: a tracked street video with the cinematic preset in the preview, the timeline below it, and the style library and design sections on the right" width="100%"></p>

1. **Source.** Pick a bundled scene or upload an image or video, set the confidence threshold and
   run detection. Videos are tracked, so trails show up as you scrub. The sample video ships with
   its tracks; tracking a new video needs the `yolo` extra.
2. **Design.** Start from a preset, then adjust box, stroke, fill, line, label, effects, tracking
   and global settings, or search for any setting by name. **Save** next to the Style menu stores
   the look as a named preset.
3. **Objects.** Filter by class, hide objects or isolate a single track. Scrub or play the timeline,
   and save the annotated frame from the preview menu.
4. **Export.** Copy or download the YAML, a self-contained Python snippet, or a prompt for AI
   coding tools.

Saved presets go to `~/.visionstyle/presets` and load by name anywhere on that machine with
`vs.Style.preset("my-look")`. To keep them in a project instead, run
`visionstyle studio --presets-dir ./styles`, commit `styles/<name>.yaml`, and load it with
`vs.Style.load("styles/my-look.yaml")` (or set `VISIONSTYLE_PRESETS_DIR=./styles` to load by name).

<details>
<summary><b>Keyboard shortcuts</b></summary>

| Key | Action |
|---|---|
| <kbd>Space</kbd> | Play / pause |
| <kbd>←</kbd> / <kbd>→</kbd> | Previous / next frame |
| <kbd>Shift</kbd> + <kbd>←</kbd> / <kbd>→</kbd> | Jump ten frames |
| <kbd>R</kbd> | Reset the style |

Focused controls keep their own keyboard behavior.

</details>

## Python API

```python
import cv2
import visionstyle as vs

frame = cv2.imread("street.jpg")

# 1. Detections: boxes in pixels, everything else optional
dets = vs.Detections(
    xyxy=[[590, 650, 720, 1040], [1060, 660, 1520, 1000]],
    class_name=["person", "car"],
    confidence=[0.93, 0.88],
    track_id=[14, 31],
)
# or: dets = vs.Detections.from_ultralytics(model.predict(frame)[0])

# 2. A style: preset name, YAML path, or built in code
style = vs.Style.preset("cinematic")
style.label.components = ["track_id", "text"]   # every option is a typed attribute
style.trail.enabled = True

# 3. Render. Keep one Annotator per video stream so trails and animations carry across frames.
annotator = vs.Annotator(style)
out = annotator.annotate(frame, dets)

# One-liner for stills
out = vs.annotate(frame, dets, style="minimal")
```

`xyxy` is pixel `x1, y1, x2, y2`; `Detections.from_xywh`, `from_xywh_topleft` and `from_dicts`
cover other formats. Frames are BGR `uint8` like OpenCV; pass `rgb=True` for RGB arrays.

### What you can configure

| Section | Options |
|---|---|
| **Box** | `rectangle`, `rounded` (radius), `corners` (bracket length, curved elbows), `reticle`, `none`; double line; center mark |
| **Stroke** | Thickness, opacity, color (`palette` per class/track, `confidence` ramp, or any hex/rgb/name) |
| **Fill** | On/off, opacity, color, `solid` / `gradient` (5 directions) / `hatch` |
| **Line** | `solid` / `dashed` / `dotted`, dash and gap sizes, multi-color `segments` or perimeter `gradient`, animation `march` / `hue_cycle` / `pulse` |
| **Label** | Ordered components (`text`, `confidence`, `track_id`, `class_id`, `custom` template), 9 anchors × inside/outside, vertical tags on the sides, fonts (Inter, JetBrains Mono or your `.ttf`), size, weight, uppercase, `solid` / `pill` / `glass` / `underline` / `none` backgrounds, border, padding, formats |
| **Effects** | Glow, shadow, frosted glass, spotlight dimming, vignette, film grain, color grade |
| **Tracking** | Trail length, anchor (feet/center/top), `solid` / `dotted` / `dashed` / `ribbon`, fade and taper, smoothing, glow, points |
| **Global** | Palette (built-in or custom list), per-class color overrides, confidence threshold, resolution scaling, per-object scaling, fps |

<details>
<summary><b>How sizes scale</b></summary>

All sizes are in *reference pixels* at about 1080p and scale automatically with the frame
(`style.scale = "auto"`), so one style looks the same on a webcam and a 4K photo.

On top of that, strokes and label tags scale with each detected object's size
(`style.object_scale`, on by default): far-away objects get thin outlines and small tags, close-up
ones get heavier outlines and larger text. Tune `strength` and `min_factor` / `max_factor`,
restrict it with `apply_to: box | label`, or set `enabled: false` for constant sizes.

</details>

### Save and share styles

```python
style.save("my_style.yaml")                 # anywhere
style.save_preset("my-look")                # ~/.visionstyle/presets/my-look.yaml
vs.Style.preset("my-look")                  # found by name from now on
vs.presets.list()                           # built-in + yours
```

Presets are looked up in `$VISIONSTYLE_PRESETS_DIR`, then `~/.visionstyle/presets`, then the
built-ins, then as a file path.

## CLI

```bash
visionstyle render photo.jpg -s neon --model yolo11n.pt -o out.jpg
visionstyle render clip.mp4  -s tracking --model yolo11n.pt --track -o out.mp4
visionstyle render 0         -s hud --model yolo11n.pt --track -o webcam.mp4   # webcam index
visionstyle render photo.jpg -d detections.json -s corners                    # no model needed
visionstyle gallery photo.jpg --model yolo11n.pt -o gallery.png               # every preset at once
visionstyle presets list | show NAME | export NAME -o my.yaml
visionstyle schema -o style.schema.json
```

`detections.json` is a list of `{"xyxy": [...], "class_name": "...", "confidence": 0.9, "track_id": 1}`.

## Development

```bash
uv sync --all-extras --group dev
uv run pytest && uv run ruff check . && uv run mypy src

cd studio && npm install
npm run dev            # Vite dev server on :5173, proxying /api to :8420
npm run build          # -> src/visionstyle/studio/static (bundled into the wheel)
```

When `src/visionstyle/style/schema.py` changes, regenerate the frontend schema and types:

```bash
uv run visionstyle schema -o studio/schema.json && (cd studio && npm run gen:types)
```

<details>
<summary><b>Releasing and the website</b></summary>

**Releases.** Bump `__version__` in `src/visionstyle/__init__.py`, add a section to
`CHANGELOG.md`, then tag `vX.Y.Z` and push the tag. `release.yml` builds the Studio and the wheel,
checks them, publishes to PyPI through trusted publishing and creates a GitHub release.

**Website.** The [project site](https://baselhusam.github.io/visionstyle/) deploys from `site/`
through GitHub Actions on every push to `main`; see
[`site/README.md`](https://github.com/baselhusam/visionstyle/blob/main/site/README.md).

</details>

## Credits

Sample photos: see [`CREDITS.md`](https://github.com/baselhusam/visionstyle/blob/main/src/visionstyle/assets/samples/CREDITS.md).
Fonts: [Inter](https://rsms.me/inter/) and [JetBrains Mono](https://www.jetbrains.com/lp/mono/),
both under the SIL Open Font License.

## Author

Built by **Basel Mather**. See more of my work at **[baselhusam.com](https://baselhusam.com)**.

Released under the [MIT License](https://github.com/baselhusam/visionstyle/blob/main/LICENSE).
