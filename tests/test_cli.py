from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import cv2

from visionstyle.cli import main

SAMPLE = (
    Path(__file__).resolve().parents[1]
    / "src"
    / "visionstyle"
    / "assets"
    / "samples"
    / "street.jpg"
)


def run(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, "-m", "visionstyle.cli", *args],
        capture_output=True,
        text=True,
        check=False,
    )


def test_version_and_presets_list():
    assert "visionstyle" in run("--version").stdout
    out = run("presets", "list")
    assert out.returncode == 0 and "cinematic" in out.stdout


def test_presets_show_and_export(tmp_path):
    assert "shape: rounded" in run("presets", "show", "cinematic").stdout
    target = tmp_path / "c.yaml"
    assert run("presets", "export", "cinematic", "-o", str(target)).returncode == 0
    assert "cinematic" in target.read_text()
    assert run("presets", "show").returncode == 2


def test_schema_command(tmp_path):
    target = tmp_path / "schema.json"
    assert main(["schema", "-o", str(target)]) == 0
    assert "BoxStyle" in json.loads(target.read_text())["$defs"]


def test_render_image_with_sidecar(tmp_path):
    out = tmp_path / "out.jpg"
    assert main(["render", str(SAMPLE), "-s", "corners", "-o", str(out)]) == 0
    img = cv2.imread(str(out))
    assert img is not None and img.shape[:2] == (929, 1600)


def test_render_with_detection_file(tmp_path, frame):
    src = tmp_path / "f.png"
    cv2.imwrite(str(src), frame)
    dets = tmp_path / "d.json"
    dets.write_text(
        json.dumps([{"xyxy": [10, 10, 100, 100], "class_name": "thing", "confidence": 0.5}])
    )
    out = tmp_path / "o.png"
    assert main(["render", str(src), "-d", str(dets), "-o", str(out)]) == 0
    assert cv2.imread(str(out)) is not None


def test_render_missing_image(tmp_path):
    assert main(["render", str(tmp_path / "nope.jpg")]) == 2


def test_gallery(tmp_path):
    out = tmp_path / "g.png"
    assert (
        main(
            [
                "gallery",
                str(SAMPLE),
                "-o",
                str(out),
                "--presets",
                "default",
                "minimal",
                "--tile-width",
                "320",
                "--columns",
                "2",
            ]
        )
        == 0
    )
    img = cv2.imread(str(out))
    assert img is not None and img.shape[1] == 640


def test_render_video_roundtrip(tmp_path, frame):
    video = tmp_path / "clip.mp4"
    writer = cv2.VideoWriter(str(video), cv2.VideoWriter.fourcc(*"mp4v"), 10, (640, 480))
    for _ in range(4):
        writer.write(frame)
    writer.release()
    dets = tmp_path / "d.json"
    dets.write_text(
        json.dumps([{"xyxy": [10, 10, 100, 100], "class_name": "thing", "track_id": 1}])
    )
    out = tmp_path / "o.mp4"
    assert (
        main(
            [
                "render",
                str(video),
                "-d",
                str(dets),
                "-s",
                "tracking",
                "-o",
                str(out),
                "--max-frames",
                "3",
            ]
        )
        == 0
    )
    cap = cv2.VideoCapture(str(out))
    assert cap.isOpened() and int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) == 3
    cap.release()


def test_render_video_with_per_frame_sidecar(tmp_path):
    from visionstyle.cli import _load_detections_json

    sidecar = SAMPLE.with_name("city-walkthrough.detections.json")
    assert len(_load_detections_json(sidecar, 0)) > 0
    assert len(_load_detections_json(sidecar, 10_000)) == 0  # frame not stored → nothing
    out = tmp_path / "clip.mp4"
    video = SAMPLE.with_name("city-walkthrough.mp4")
    assert main(["render", str(video), "-s", "tracking", "-o", str(out), "--max-frames", "5"]) == 0
    capture = cv2.VideoCapture(str(out))
    assert capture.isOpened() and capture.get(cv2.CAP_PROP_FRAME_COUNT) == 5
    capture.release()
