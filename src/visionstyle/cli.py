"""``visionstyle`` command line: render, gallery, presets, schema, studio."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np

from visionstyle import __version__
from visionstyle.detections import Detections
from visionstyle.style.presets import list_presets, load_preset, resolve_preset_path
from visionstyle.style.schema import Style

VIDEO_SUFFIXES = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"}


def _load_style(spec: str) -> Style:
    return load_preset(spec)


def _sample_path(name: str) -> Path:
    return Path(__file__).resolve().parent / "assets" / "samples" / name


def _read_image(path: Path) -> np.ndarray | None:
    import cv2

    img = cv2.imread(str(path))
    return None if img is None else np.asarray(img, np.uint8)


def _load_detections_json(path: Path) -> Detections:
    raw = json.loads(path.read_text())
    items = raw["detections"] if isinstance(raw, dict) else raw
    return Detections.from_dicts(items)


# ----------------------------------------------------------------------------- commands
def cmd_render(args: argparse.Namespace) -> int:
    import cv2

    from visionstyle.render.annotator import Annotator

    style = _load_style(args.style)
    annotator = Annotator(style)
    src = Path(args.source)
    if not src.exists() and args.source == "sample":
        src = _sample_path("street.jpg")
    is_video = src.suffix.lower() in VIDEO_SUFFIXES or args.source.isdigit()

    model = None
    if args.model:
        from visionstyle.integrations.ultralytics import load_model

        model = load_model(args.model)

    def detections_for(frame: np.ndarray, index: int) -> Detections:  # type: ignore[type-arg]
        if model is not None:
            from visionstyle.integrations.ultralytics import detect, track

            fn = track if (args.track or style.trail.enabled) and is_video else detect
            return fn(model, frame, conf=args.conf)
        if args.detections:
            return _load_detections_json(Path(args.detections))
        sidecar = src.with_suffix(".detections.json")
        if sidecar.exists() and index == 0:
            return _load_detections_json(sidecar)
        print(
            "No model or detections given; rendering nothing. Use --model or --detections.",
            file=sys.stderr,
        )
        return Detections.empty()

    if not is_video:
        frame = _read_image(src)
        if frame is None:
            print(f"Could not read image {src}", file=sys.stderr)
            return 2
        out = annotator.annotate(frame, detections_for(frame, 0))
        out_path = Path(args.output or f"{src.stem}_{style.name}.jpg")
        cv2.imwrite(str(out_path), out)
        print(out_path)
        return 0

    from visionstyle.integrations.ultralytics import iter_video

    writer = None
    out_path = Path(args.output or f"{src.stem}_{style.name}.mp4")
    for i, (frame, fps) in enumerate(
        iter_video(int(args.source) if args.source.isdigit() else src)
    ):
        if args.max_frames and i >= args.max_frames:
            break
        annotator.style.fps = fps
        out = annotator.annotate(frame, detections_for(frame, i))
        if writer is None:
            h, w = out.shape[:2]
            writer = cv2.VideoWriter(str(out_path), cv2.VideoWriter.fourcc(*"mp4v"), fps, (w, h))
        writer.write(out)
        if i % 30 == 0:
            print(f"\rframe {i}", end="", file=sys.stderr)
    if writer is not None:
        writer.release()
    print(f"\n{out_path}", file=sys.stderr)
    print(out_path)
    return 0


def cmd_gallery(args: argparse.Namespace) -> int:
    """Render every preset on one image into a labelled contact sheet."""
    import cv2

    from visionstyle.render.annotator import Annotator
    from visionstyle.render.text import load_font, render_text_mask

    src = (
        Path(args.source) if args.source and args.source != "sample" else _sample_path("street.jpg")
    )
    frame = _read_image(src)
    if frame is None:
        print(f"Could not read image {src}", file=sys.stderr)
        return 2
    if args.detections:
        dets = _load_detections_json(Path(args.detections))
    elif src.with_suffix(".detections.json").exists():
        dets = _load_detections_json(src.with_suffix(".detections.json"))
    elif args.model:
        from visionstyle.integrations.ultralytics import detect, load_model

        dets = detect(load_model(args.model), frame, conf=args.conf)
    else:
        print(
            "Need --detections or --model (or a <image>.detections.json sidecar).", file=sys.stderr
        )
        return 2

    names = args.presets or [p.name for p in list_presets()]
    tiles = []
    tile_w = args.tile_width
    for name in names:
        style = load_preset(name)
        out = Annotator(style).annotate(frame, dets, synthetic_trails=True)
        h, w = out.shape[:2]
        tile = cv2.resize(out, (tile_w, int(h * tile_w / w)), interpolation=cv2.INTER_AREA)
        # caption strip
        strip = np.full((34, tile_w, 3), (18, 18, 20), np.uint8)
        font = load_font("mono", 15, 600)
        mask = render_text_mask(name.upper(), font)
        mh, mw = mask.shape
        y0, x0 = (34 - mh) // 2, 12
        region = strip[y0 : y0 + mh, x0 : x0 + mw].astype(np.float32)
        a = mask[..., None].astype(np.float32) / 255
        strip[y0 : y0 + mh, x0 : x0 + mw] = (
            region * (1 - a) + np.array((235, 232, 226)) * a
        ).astype(np.uint8)
        tiles.append(np.vstack([strip, tile]))
    cols = args.columns
    rows = []
    blank = np.zeros_like(tiles[0])
    for i in range(0, len(tiles), cols):
        row = tiles[i : i + cols]
        row += [blank] * (cols - len(row))
        rows.append(np.hstack(row))
    sheet = np.vstack(rows)
    out_path = Path(args.output or "gallery.png")
    cv2.imwrite(str(out_path), sheet)
    print(out_path)
    return 0


def cmd_presets(args: argparse.Namespace) -> int:
    if args.action == "list":
        for p in list_presets():
            print(f"{p.name:16s} {p.origin:8s} {p.description}")
        return 0
    if args.action == "show":
        print(load_preset(args.name).to_yaml(), end="")
        return 0
    if args.action == "path":
        print(resolve_preset_path(args.name))
        return 0
    if args.action == "export":
        style = load_preset(args.name)
        if args.output:
            style.save(args.output)
            print(args.output)
        else:
            print(style.to_yaml(), end="")
        return 0
    return 1


def cmd_schema(args: argparse.Namespace) -> int:
    text = json.dumps(Style.json_schema(), indent=2)
    if args.output:
        Path(args.output).write_text(text)
        print(args.output)
    else:
        print(text)
    return 0


def cmd_studio(args: argparse.Namespace) -> int:
    try:
        from visionstyle.studio.server import run
    except ImportError as exc:
        print(
            f"Studio dependencies missing ({exc}). Run `pip install visionstyle[studio]`.",
            file=sys.stderr,
        )
        return 2
    run(
        host=args.host,
        port=args.port,
        presets_dir=args.presets_dir,
        open_browser=not args.no_browser,
        reload=args.reload,
    )
    return 0


# ----------------------------------------------------------------------------- parser
def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="visionstyle", description="Beautiful bounding boxes.")
    p.add_argument("--version", action="version", version=f"visionstyle {__version__}")
    sub = p.add_subparsers(dest="command", required=True)

    r = sub.add_parser("render", help="Annotate an image, video or webcam feed.")
    r.add_argument("source", help="Image/video path, webcam index, or 'sample'.")
    r.add_argument("-s", "--style", default="default", help="Preset name or YAML path.")
    r.add_argument("-o", "--output", help="Output path.")
    r.add_argument("-m", "--model", help="Ultralytics weights (.pt/.onnx), e.g. yolo11n.pt.")
    r.add_argument("-d", "--detections", help="JSON file with detections instead of a model.")
    r.add_argument("--conf", type=float, default=0.25, help="Confidence threshold for the model.")
    r.add_argument("--track", action="store_true", help="Use the tracker for videos (trails).")
    r.add_argument("--max-frames", type=int, default=0)
    r.set_defaults(func=cmd_render)

    g = sub.add_parser("gallery", help="Contact sheet of every preset on one image.")
    g.add_argument("source", nargs="?", default="sample")
    g.add_argument("-o", "--output", default="gallery.png")
    g.add_argument("-m", "--model")
    g.add_argument("-d", "--detections")
    g.add_argument("--conf", type=float, default=0.25)
    g.add_argument("--presets", nargs="*", help="Subset of presets to render.")
    g.add_argument("--columns", type=int, default=3)
    g.add_argument("--tile-width", type=int, default=640)
    g.set_defaults(func=cmd_gallery)

    pr = sub.add_parser("presets", help="List / show / export presets.")
    pr.add_argument("action", choices=["list", "show", "path", "export"])
    pr.add_argument("name", nargs="?")
    pr.add_argument("-o", "--output")
    pr.set_defaults(func=cmd_presets)

    sc = sub.add_parser("schema", help="Print the Style JSON schema.")
    sc.add_argument("-o", "--output")
    sc.set_defaults(func=cmd_schema)

    st = sub.add_parser("studio", help="Launch the Studio web app.")
    st.add_argument("--host", default="127.0.0.1")
    st.add_argument("--port", type=int, default=8420)
    st.add_argument(
        "--presets-dir", help="Directory to save presets into (default ~/.visionstyle/presets)."
    )
    st.add_argument("--no-browser", action="store_true")
    st.add_argument("--reload", action="store_true", help="Dev: auto-reload the server.")
    st.set_defaults(func=cmd_studio)
    return p


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if args.command == "presets" and args.action != "list" and not args.name:
        print("presets: a preset name is required", file=sys.stderr)
        return 2
    return int(args.func(args))


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
