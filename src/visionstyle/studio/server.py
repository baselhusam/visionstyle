"""FastAPI backend for the Studio. Renders previews with the real ``Annotator`` so what the
browser shows is exactly what ``visionstyle`` produces."""

from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import sys
import threading
import time
import uuid
import webbrowser
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from visionstyle import __version__
from visionstyle.detections import Detections
from visionstyle.render.annotator import Annotator
from visionstyle.style.presets import (
    builtin_presets_dir,
    delete_preset,
    list_presets,
    load_preset,
    save_preset,
    user_presets_dir,
)
from visionstyle.style.schema import Style

SAMPLES_DIR = Path(__file__).resolve().parent.parent / "assets" / "samples"
STATIC_DIR = Path(__file__).resolve().parent / "static"
IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff"}
VIDEO_SUFFIXES = {".mp4", ".mov", ".m4v", ".webm", ".avi"}
MODEL_SUFFIXES = {".pt", ".onnx", ".engine", ".torchscript"}
# Studio tracks a whole video once and replays the stored detections; a minute keeps that
# run short and the stored tracks small enough to scrub and restyle without lag.
MAX_VIDEO_SECONDS = 60.0
# Videos are tracked down to this confidence and the browser filters the stored detections by
# its threshold slider, so changing the threshold never re-runs the model.
TRACK_CONF_FLOOR = 0.1


def studio_home() -> Path:
    home = Path(os.environ.get("VISIONSTYLE_HOME", "~/.visionstyle")).expanduser() / "studio"
    (home / "images").mkdir(parents=True, exist_ok=True)
    (home / "models").mkdir(parents=True, exist_ok=True)
    return home


# ----------------------------------------------------------------------------- state
class _State:
    def __init__(self) -> None:
        self.images: dict[str, Path] = {}
        self.models: dict[str, Path] = {}
        self.loaded_models: dict[str, Any] = {}
        self.detect_cache: dict[str, list[dict[str, Any]]] = {}
        self.image_cache: dict[str, np.ndarray] = {}
        self.lock = threading.Lock()
        self.presets_dir: Path | None = None
        self.jobs: dict[str, _Job] = {}
        self.readers: dict[str, tuple[cv2.VideoCapture, int]] = {}
        self.reader_lock = threading.Lock()
        self.thumb_cache: dict[str, bytes] = {}
        # parsed sidecars, keyed by image id: (sidecar path, mtime, tracks, frame index -> position)
        self.tracks_cache: dict[str, tuple[Path, float, dict[str, Any], dict[int, int]]] = {}
        # renders run one at a time; a request superseded while it waited is skipped
        self.render_lock = threading.Lock()
        self.render_seq_lock = threading.Lock()
        self.render_seq: dict[str, int] = {}
        for p in sorted(SAMPLES_DIR.iterdir()):
            if p.suffix.lower() in IMAGE_SUFFIXES | VIDEO_SUFFIXES:
                self.images[f"sample:{p.stem}"] = p
        home = studio_home()
        for p in sorted((home / "images").iterdir()):
            if p.suffix.lower() in IMAGE_SUFFIXES | VIDEO_SUFFIXES:
                self.images[p.stem] = p
        for p in sorted((home / "models").iterdir()):
            if p.suffix.lower() in MODEL_SUFFIXES:
                self.models[p.stem] = p

    def is_video(self, image_id: str) -> bool:
        path = self.images.get(image_id)
        return path is not None and path.suffix.lower() in VIDEO_SUFFIXES

    def sidecar(self, image_id: str) -> Path | None:
        """The detections sidecar for ``image_id``: Studio-written first, then the bundled one."""
        path = self.images[image_id]
        for candidate in (self.sidecar_write_path(image_id), path.with_suffix(".detections.json")):
            if candidate.exists():
                return candidate
        return None

    @staticmethod
    def sidecar_write_path(image_id: str) -> Path:
        # samples live inside the package, so their tracks are written to the studio home
        return studio_home() / "images" / f"{image_id.replace(':', '_')}.detections.json"

    def tracks(self, image_id: str) -> dict[str, Any] | None:
        """Per-frame detections (``{"frames": [...]}``) for a video, if they were stored.

        Parsed once and kept in memory: every rendered frame looks its detections up here."""
        cached = self._cached_tracks(image_id)
        return cached[2] if cached else None

    def track_position(self, image_id: str, frame_index: int) -> int | None:
        """Position in ``tracks(image_id)["frames"]`` of the stored frame ``frame_index``."""
        cached = self._cached_tracks(image_id)
        return cached[3].get(frame_index) if cached else None

    def _cached_tracks(
        self, image_id: str
    ) -> tuple[Path, float, dict[str, Any], dict[int, int]] | None:
        sidecar = self.sidecar(image_id)
        if sidecar is None:
            self.tracks_cache.pop(image_id, None)
            return None
        mtime = sidecar.stat().st_mtime
        cached = self.tracks_cache.get(image_id)
        if cached is None or cached[0] != sidecar or cached[1] != mtime:
            raw = json.loads(sidecar.read_text())
            if "frames" not in raw:
                return None
            positions = {frame["index"]: i for i, frame in enumerate(raw["frames"])}
            cached = self.tracks_cache[image_id] = (sidecar, mtime, raw, positions)
        return cached

    def video_frame(self, image_id: str, frame_index: int) -> np.ndarray:
        """Decode one frame; a capture is kept open per video so playback reads sequentially."""
        path = self.images[image_id]
        with self.reader_lock:
            capture, position = self.readers.get(image_id, (None, -1))
            if capture is None:
                capture = cv2.VideoCapture(str(path))
                if not capture.isOpened():
                    raise HTTPException(415, f"Cannot decode {path.name}")
                position = -1
            gap = frame_index - position
            if 1 < gap <= 24:
                # skipping a few frames forward: grabbing without decoding beats a keyframe seek
                for _ in range(gap - 1):
                    capture.grab()
            elif gap != 1:
                capture.set(cv2.CAP_PROP_POS_FRAMES, frame_index)
            ok, frame = capture.read()
            if not ok or frame is None:
                capture.set(cv2.CAP_PROP_POS_FRAMES, 0)  # loop cleanly at the end
                ok, frame = capture.read()
                frame_index = 0
            self.readers[image_id] = (capture, frame_index)
        if not ok or frame is None:
            raise HTTPException(415, f"Cannot decode {path.name}")
        return frame

    def image(
        self, image_id: str, media_time: float = 0.0, frame_index: int | None = None
    ) -> np.ndarray:
        path = self.images.get(image_id)
        if path is None:
            raise HTTPException(404, f"Unknown image {image_id!r}")
        if path.suffix.lower() in VIDEO_SUFFIXES:
            if frame_index is None:
                capture = cv2.VideoCapture(str(path))
                fps = capture.get(cv2.CAP_PROP_FPS) or 30.0
                capture.release()
                frame_index = round(media_time * fps)
            return self.video_frame(image_id, max(0, frame_index))
        with self.lock:
            img = self.image_cache.get(image_id)
            if img is None:
                img = cv2.imread(str(path))
                if img is None:
                    raise HTTPException(415, f"Cannot decode {path.name}")
                self.image_cache[image_id] = img
        return img

    def model_path(self, model_id: str) -> Path:
        path = self.models.get(model_id)
        if path is None and model_id.endswith(".pt") and "/" not in model_id:
            path = Path(model_id)  # let ultralytics download e.g. yolo26n.pt
        if path is None:
            raise HTTPException(404, f"Unknown model {model_id!r}")
        return path

    def model(self, model_id: str) -> Any:
        path = self.model_path(model_id)
        with self.lock:
            if model_id not in self.loaded_models:
                try:
                    from visionstyle.integrations.ultralytics import load_model
                except ImportError as exc:
                    raise HTTPException(501, "Install visionstyle[yolo] to run models.") from exc
                self.loaded_models[model_id] = load_model(path)
        return self.loaded_models[model_id]

    def forget(self, image_id: str) -> None:
        self.image_cache.pop(image_id, None)
        self.thumb_cache.pop(image_id, None)
        self.tracks_cache.pop(image_id, None)
        self.detect_cache = {
            k: v for k, v in self.detect_cache.items() if not k.startswith(f"{image_id}|")
        }
        with self.reader_lock:
            reader = self.readers.pop(image_id, None)
        if reader:
            reader[0].release()


class _Job:
    """A whole-video tracking run, executed on a worker thread and polled by the browser."""

    def __init__(self, image_id: str, model_id: str, total: int) -> None:
        self.id = uuid.uuid4().hex[:12]
        self.image_id = image_id
        self.model_id = model_id
        self.total = total
        self.done = 0
        self.status = "running"
        self.error: str | None = None
        self.started = time.perf_counter()
        self.ms = 0.0
        self.cancel = threading.Event()

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "image_id": self.image_id,
            "model_id": self.model_id,
            "status": self.status,
            "done": self.done,
            "total": self.total,
            "ms": round(self.ms, 1),
            "error": self.error,
        }


def _track_video(
    state: _State, job: _Job, path: Path, conf: float, imgsz: int, stride: int
) -> None:
    from visionstyle.integrations.ultralytics import load_model, track

    try:
        # A fresh model instance so the tracker state never leaks between videos.
        model = load_model(state.model_path(job.model_id))
        capture = cv2.VideoCapture(str(path))
        if not capture.isOpened():
            raise RuntimeError(f"Cannot decode {path.name}")
        fps = capture.get(cv2.CAP_PROP_FPS) or 30.0
        frames: list[dict[str, Any]] = []
        index = 0
        while not job.cancel.is_set():
            ok, frame = capture.read()
            if not ok or frame is None:
                break
            if index % stride == 0:
                dets = track(model, np.asarray(frame, np.uint8), conf=conf, imgsz=imgsz)
                items = dets.to_dicts()
                for item in items:  # keep the sidecar compact
                    item["xyxy"] = [round(v, 1) for v in item["xyxy"]]
                    if item.get("confidence") is not None:
                        item["confidence"] = round(item["confidence"], 3)
                frames.append({"index": index, "time": round(index / fps, 4), "detections": items})
            index += 1
            job.done = index
        width = round(capture.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = round(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
        capture.release()
        job.ms = (time.perf_counter() - job.started) * 1000
        if job.cancel.is_set():
            job.status = "cancelled"
            return
        payload = {
            "image": path.name,
            "model": job.model_id,
            "conf": conf,
            "imgsz": imgsz,
            "stride": stride,
            "fps": fps,
            "frame_count": index,
            "width": width,
            "height": height,
            "frames": frames,
        }
        state.sidecar_write_path(job.image_id).write_text(json.dumps(payload))
        state.forget(job.image_id)
        job.total = index
        job.status = "done"
    except Exception as exc:  # surfaced to the browser via the job status
        job.error = str(exc)
        job.status = "error"


def _ultralytics_available() -> bool:
    try:
        import ultralytics  # noqa: F401
    except ImportError:
        return False
    return True


def _confident(detection: dict[str, Any], threshold: float) -> bool:
    confidence = detection.get("confidence")
    return confidence is None or confidence >= threshold


def _video_meta(path: Path) -> dict[str, Any]:
    """Size, frame rate, frame count and duration from the container header."""
    capture = cv2.VideoCapture(str(path))
    fps = capture.get(cv2.CAP_PROP_FPS) or 0
    frames = capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0
    meta = {
        "width": round(capture.get(cv2.CAP_PROP_FRAME_WIDTH)),
        "height": round(capture.get(cv2.CAP_PROP_FRAME_HEIGHT)),
        "duration": frames / fps if fps > 0 else None,
        "fps": fps or None,
        "frame_count": int(frames),
    }
    capture.release()
    return meta


def _too_long(duration: float | None) -> bool:
    # a frame of slack: containers often report 60.03 s for a one-minute clip
    return duration is not None and duration > MAX_VIDEO_SECONDS + 0.1


def _trim_video(source: Path, target: Path, seconds: float) -> int:
    """Re-encode the first ``seconds`` of ``source`` into ``target`` (MPEG-4, no audio).

    Studio only ever decodes uploads server-side, so the codec just has to round-trip
    through OpenCV."""
    capture = cv2.VideoCapture(str(source))
    if not capture.isOpened():
        raise HTTPException(415, f"Cannot decode {source.name}")
    fps = capture.get(cv2.CAP_PROP_FPS) or 30.0
    limit = int(seconds * fps)
    writer: cv2.VideoWriter | None = None
    written = 0
    try:
        while written < limit:
            ok, frame = capture.read()
            if not ok or frame is None:
                break
            if writer is None:
                h, w = frame.shape[:2]
                writer = cv2.VideoWriter(str(target), cv2.VideoWriter.fourcc(*"mp4v"), fps, (w, h))
                if not writer.isOpened():
                    raise HTTPException(500, "OpenCV could not open an MPEG-4 writer")
            writer.write(frame)
            written += 1
    finally:
        capture.release()
        if writer is not None:
            writer.release()
    if written == 0:
        target.unlink(missing_ok=True)
        raise HTTPException(415, f"Cannot decode {source.name}")
    return written


# ----------------------------------------------------------------------------- schemas
class DetectRequest(BaseModel):
    image_id: str
    model_id: str | None = None
    conf: float = Field(0.25, ge=0.01, le=1)
    imgsz: int = Field(640, ge=160, le=1920)


class VideoDetectRequest(BaseModel):
    image_id: str
    model_id: str = "yolo26n.pt"
    conf: float = Field(0.25, ge=0.01, le=1)
    imgsz: int = Field(640, ge=160, le=1920)
    stride: int = Field(1, ge=1, le=30)


class TrimRequest(BaseModel):
    seconds: float = Field(MAX_VIDEO_SECONDS, gt=0, le=MAX_VIDEO_SECONDS)


class RenderRequest(BaseModel):
    image_id: str
    style: dict[str, Any]
    detections: list[dict[str, Any]] | None = None
    t: float = 0.0
    max_size: int = Field(1600, ge=200, le=4096)
    synthetic_trails: bool = True
    media_time: float = Field(0.0, ge=0)
    frame_index: int | None = Field(None, ge=0)
    format: str = Field("jpeg", pattern="^(jpeg|png|webp)$")
    # the browser's threshold, applied to stored frames (trail history, omitted detections)
    min_confidence: float = Field(0.0, ge=0, le=1)
    quality: int = Field(90, ge=30, le=100)
    # A preview tab's id and a number that grows with each of its requests, so the server can
    # skip frames that tab has already given up on.
    client: str = Field("", max_length=64)
    seq: int | None = None


class SavePresetRequest(BaseModel):
    style: dict[str, Any]
    directory: str | None = None


class SnippetRequest(BaseModel):
    style: dict[str, Any]
    preset_name: str | None = None


# ----------------------------------------------------------------------------- app
def create_app(presets_dir: str | Path | None = None) -> FastAPI:
    app = FastAPI(title="visionstyle studio", version=__version__)
    app.add_middleware(GZipMiddleware, minimum_size=1024)
    state = _State()
    state.presets_dir = Path(presets_dir).expanduser() if presets_dir else None
    app.state.vs = state

    def _presets_dir(override: str | None) -> Path | None:
        if override:
            return Path(override).expanduser()
        return state.presets_dir

    # ---- meta ---------------------------------------------------------------
    @app.get("/api/info")
    def info() -> dict[str, Any]:
        return {
            "version": __version__,
            "yolo_available": _ultralytics_available(),
            "presets_dir": str(state.presets_dir or user_presets_dir()),
            "user_presets_dir": str(user_presets_dir()),
            "python": sys.version.split()[0],
            "max_video_seconds": MAX_VIDEO_SECONDS,
        }

    @app.get("/api/schema")
    def schema() -> dict[str, Any]:
        return Style.json_schema()

    @app.get("/api/palettes")
    def palettes() -> dict[str, list[str]]:
        from visionstyle.color import PALETTES

        return PALETTES

    # ---- presets ------------------------------------------------------------
    @app.get("/api/presets")
    def presets(directory: str | None = None) -> list[dict[str, Any]]:
        out = []
        for p in list_presets(directory=_presets_dir(directory)):
            try:
                style = load_preset(p.name, _presets_dir(directory)).to_dict()
            except Exception as exc:
                style = {"error": str(exc)}
            out.append(
                {
                    "name": p.name,
                    "origin": p.origin,
                    "description": p.description,
                    "path": str(p.path),
                    "style": style,
                }
            )
        return out

    @app.get("/api/presets/{name}")
    def preset(name: str, directory: str | None = None) -> dict[str, Any]:
        try:
            return load_preset(name, _presets_dir(directory)).to_dict()
        except FileNotFoundError as exc:
            raise HTTPException(404, str(exc)) from exc

    @app.put("/api/presets/{name}")
    def put_preset(name: str, body: SavePresetRequest) -> dict[str, Any]:
        # a user preset with a built-in's name would silently shadow it everywhere
        if (builtin_presets_dir() / f"{name}.yaml").exists():
            raise HTTPException(409, f"{name!r} is a built-in style; choose another name")
        try:
            style = Style.from_dict(body.style)
            path = save_preset(style, name, _presets_dir(body.directory))
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc
        return {"name": name, "path": str(path)}

    @app.delete("/api/presets/{name}")
    def remove_preset(name: str, directory: str | None = None) -> dict[str, Any]:
        try:
            path = delete_preset(name, _presets_dir(directory))
        except FileNotFoundError as exc:
            raise HTTPException(404, str(exc)) from exc
        return {"deleted": str(path)}

    @app.post("/api/style/validate")
    def validate(style: dict[str, Any]) -> dict[str, Any]:
        try:
            return Style.from_dict(style).to_dict()
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc

    @app.post("/api/style/yaml")
    def to_yaml(style: dict[str, Any], exclude_defaults: bool = False) -> Response:
        try:
            text = Style.from_dict(style).to_yaml(exclude_defaults=exclude_defaults)
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc
        return Response(text, media_type="text/yaml")

    @app.post("/api/snippet")
    def snippet(body: SnippetRequest) -> dict[str, str]:
        if body.preset_name:
            code = (
                "import visionstyle as vs\n\n"
                f'style = vs.Style.preset("{body.preset_name}")\n'
                "annotator = vs.Annotator(style)\n"
                "frame = annotator.annotate(frame, detections)\n"
            )
        else:
            try:
                Style.from_dict(body.style)
            except ValueError as exc:
                raise HTTPException(422, str(exc)) from exc
            code = (
                "import visionstyle as vs\n\n"
                'style = vs.Style.load("my_style.yaml")  # export the YAML from the Studio\n'
                "annotator = vs.Annotator(style)\n"
                "frame = annotator.annotate(frame, detections)\n"
            )
        return {"python": code}

    # ---- images -------------------------------------------------------------
    @app.get("/api/images")
    def images() -> list[dict[str, Any]]:
        out = []
        for image_id, path in state.images.items():
            entry: dict[str, Any] = {
                "id": image_id,
                "name": path.name,
                "sample": image_id.startswith("sample:"),
                "kind": "video" if path.suffix.lower() in VIDEO_SUFFIXES else "image",
            }
            if entry["kind"] == "video":
                entry.update(_video_meta(path))
                entry["too_long"] = _too_long(entry["duration"])
            else:
                img = state.image(image_id)
                entry.update(width=img.shape[1], height=img.shape[0])
            sidecar = state.sidecar(image_id)
            entry["has_detections"] = sidecar is not None
            entry["tracked"] = (
                state.tracks(image_id) is not None if entry["kind"] == "video" else False
            )
            out.append(entry)
        return out

    @app.get("/api/images/{image_id}/file")
    def image_file(image_id: str) -> FileResponse:
        path = state.images.get(image_id)
        if path is None:
            raise HTTPException(404, "Unknown image")
        return FileResponse(path)

    @app.get("/api/images/{image_id}/thumbnail")
    def image_thumbnail(image_id: str) -> Response:
        if image_id not in state.images:
            raise HTTPException(404, "Unknown image")
        data = state.thumb_cache.get(image_id)
        if data is None:
            img = (
                state.image(image_id, frame_index=0)
                if state.is_video(image_id)
                else state.image(image_id)
            )
            h, w = img.shape[:2]
            scale = min(1.0, 320 / max(h, w))
            if scale < 1.0:
                img = cv2.resize(
                    img, (round(w * scale), round(h * scale)), interpolation=cv2.INTER_AREA
                )
            ok, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 80])
            if not ok:
                raise HTTPException(500, "Encoding failed")
            data = state.thumb_cache[image_id] = buf.tobytes()
        return Response(data, media_type="image/jpeg", headers={"Cache-Control": "no-cache"})

    @app.get("/api/images/{image_id}/tracks")
    def image_tracks(image_id: str) -> Response:
        if image_id not in state.images:
            raise HTTPException(404, "Unknown image")
        sidecar = state.sidecar(image_id)
        if sidecar is None or state.tracks(image_id) is None:
            raise HTTPException(404, "No stored tracks for this video; run detection first")
        return Response(sidecar.read_bytes(), media_type="application/json")

    @app.post("/api/images")
    async def upload_image(file: UploadFile = File(...)) -> dict[str, Any]:
        suffix = Path(file.filename or "upload.jpg").suffix.lower() or ".jpg"
        if suffix not in IMAGE_SUFFIXES | VIDEO_SUFFIXES:
            raise HTTPException(415, f"Unsupported media type {suffix}")
        data = await file.read()
        digest = hashlib.sha1(data).hexdigest()[:10]
        image_id = f"{Path(file.filename or 'upload').stem[:40]}-{digest}"
        path = studio_home() / "images" / f"{image_id}{suffix}"
        path.write_bytes(data)
        return _register_upload(image_id, path)

    def _register_upload(image_id: str, path: Path) -> dict[str, Any]:
        """Decode a freshly written upload and add it to the source list."""
        entry: dict[str, Any] = {
            "id": image_id,
            "name": path.name,
            "sample": False,
            "has_detections": False,
            "tracked": False,
        }
        img: np.ndarray | None
        if path.suffix.lower() in VIDEO_SUFFIXES:
            capture = cv2.VideoCapture(str(path))
            ok, frame = capture.read()
            capture.release()
            img = frame if ok else None
            entry.update(_video_meta(path), kind="video")
            # too long to track: the browser offers to trim it to the first minute
            entry["too_long"] = _too_long(entry["duration"])
        else:
            img = cv2.imdecode(np.fromfile(path, np.uint8), cv2.IMREAD_COLOR)
            entry.update(kind="image", duration=None, fps=None, frame_count=0)
        if img is None:
            path.unlink(missing_ok=True)
            raise HTTPException(415, "Could not decode image")
        entry.update(width=img.shape[1], height=img.shape[0])
        state.images[image_id] = path
        state.image_cache[image_id] = img
        return entry

    def _remove_upload(image_id: str) -> None:
        for job in state.jobs.values():
            if job.image_id == image_id:
                job.cancel.set()
        path = state.images.pop(image_id, None)
        state.forget(image_id)
        if path and path.exists():
            path.unlink()
            path.with_suffix(".detections.json").unlink(missing_ok=True)
        state.sidecar_write_path(image_id).unlink(missing_ok=True)

    @app.delete("/api/images/{image_id}")
    def delete_image(image_id: str) -> dict[str, Any]:
        if image_id.startswith("sample:"):
            raise HTTPException(403, "Samples cannot be deleted")
        _remove_upload(image_id)
        return {"deleted": image_id}

    @app.post("/api/images/{image_id}/trim")
    def trim_image(image_id: str, body: TrimRequest) -> dict[str, Any]:
        """Replace an uploaded video with its first ``seconds`` (a minute by default)."""
        path = state.images.get(image_id)
        if path is None:
            raise HTTPException(404, "Unknown image")
        if image_id.startswith("sample:"):
            raise HTTPException(403, "Samples cannot be trimmed")
        if not state.is_video(image_id):
            raise HTTPException(400, f"{image_id!r} is not a video")
        stem = re.sub(r"-[0-9a-f]{10}$", "", path.stem)
        label = f"{body.seconds:g}s"
        digest = hashlib.sha1(f"{path.name}|{label}".encode()).hexdigest()[:10]
        trimmed_id = f"{stem[:40]} (first {label})-{digest}"
        target = studio_home() / "images" / f"{trimmed_id}.mp4"
        _trim_video(path, target, body.seconds)
        entry = _register_upload(trimmed_id, target)
        _remove_upload(image_id)
        return entry

    # ---- models -------------------------------------------------------------
    @app.get("/api/models")
    def models() -> dict[str, Any]:
        entries = [
            {"id": mid, "name": p.name, "size": p.stat().st_size if p.exists() else None}
            for mid, p in state.models.items()
        ]
        return {
            "models": entries,
            "yolo_available": _ultralytics_available(),
            "default": "yolo26n.pt" if _ultralytics_available() else None,
        }

    @app.post("/api/models")
    async def upload_model(file: UploadFile = File(...)) -> dict[str, Any]:
        suffix = Path(file.filename or "").suffix.lower()
        if suffix not in MODEL_SUFFIXES:
            raise HTTPException(415, f"Unsupported model type {suffix}; use .pt or .onnx")
        model_id = Path(file.filename or "model").stem[:60]
        path = studio_home() / "models" / f"{model_id}{suffix}"
        with path.open("wb") as fh:
            shutil.copyfileobj(file.file, fh)
        state.models[model_id] = path
        state.loaded_models.pop(model_id, None)
        state.detect_cache = {
            k: v for k, v in state.detect_cache.items() if not k.endswith(f"|{model_id}|")
        }
        return {"id": model_id, "name": path.name, "size": path.stat().st_size}

    # ---- detection ----------------------------------------------------------
    @app.post("/api/detect")
    def detect(body: DetectRequest) -> dict[str, Any]:
        img = state.image(body.image_id)
        key = f"{body.image_id}|{body.model_id}|{body.conf}|{body.imgsz}"
        if key in state.detect_cache:
            return {"detections": state.detect_cache[key], "cached": True}
        if body.model_id is None:
            sidecar = state.sidecar(body.image_id)
            if sidecar is None:
                raise HTTPException(
                    404, "No model selected and no stored detections for this image"
                )
            raw = json.loads(sidecar.read_text())
            stored = raw["frames"][0]["detections"] if "frames" in raw else raw["detections"]
            items = [d for d in stored if (d.get("confidence") or 1) >= body.conf]
            state.detect_cache[key] = items
            return {"detections": items, "source": "bundled", "cached": False}
        model = state.model(body.model_id)
        from visionstyle.integrations.ultralytics import detect as run_detect

        t0 = time.perf_counter()
        dets = run_detect(model, img, conf=body.conf, imgsz=body.imgsz)
        items = dets.to_dicts()
        for i, it in enumerate(items):
            it["track_id"] = i + 1
        state.detect_cache[key] = items
        return {
            "detections": items,
            "source": body.model_id,
            "ms": round((time.perf_counter() - t0) * 1000, 1),
            "cached": False,
        }

    @app.post("/api/detect/video")
    def detect_video(body: VideoDetectRequest) -> dict[str, Any]:
        if not state.is_video(body.image_id):
            raise HTTPException(400, f"{body.image_id!r} is not a video")
        if not _ultralytics_available():
            raise HTTPException(501, "Install visionstyle[yolo] to track videos.")
        duration = _video_meta(state.images[body.image_id])["duration"]
        if _too_long(duration):
            raise HTTPException(
                413,
                f"This video is {duration:.0f} s long; Studio tracks up to "
                f"{MAX_VIDEO_SECONDS:.0f} s. Trim it to the first minute first.",
            )
        for job in state.jobs.values():
            if job.image_id == body.image_id and job.status == "running":
                return job.to_dict()
        path = state.images[body.image_id]
        capture = cv2.VideoCapture(str(path))
        total = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        capture.release()
        job = _Job(body.image_id, body.model_id, total)
        state.jobs[job.id] = job
        threading.Thread(
            target=_track_video,
            args=(state, job, path, min(body.conf, TRACK_CONF_FLOOR), body.imgsz, body.stride),
            daemon=True,
            name=f"track-{job.id}",
        ).start()
        return job.to_dict()

    @app.get("/api/jobs/{job_id}")
    def job_status(job_id: str) -> dict[str, Any]:
        job = state.jobs.get(job_id)
        if job is None:
            raise HTTPException(404, "Unknown job")
        if job.status == "running":
            job.ms = (time.perf_counter() - job.started) * 1000
        return job.to_dict()

    @app.delete("/api/jobs/{job_id}")
    def cancel_job(job_id: str) -> dict[str, Any]:
        job = state.jobs.get(job_id)
        if job is None:
            raise HTTPException(404, "Unknown job")
        job.cancel.set()
        return job.to_dict()

    # ---- render -------------------------------------------------------------
    def _replay_trails(
        annotator: Annotator,
        image_id: str,
        frame_index: int,
        current: list[dict[str, Any]],
        scale: float,
        min_confidence: float = 0.0,
    ) -> None:
        """Replay stored frames before ``frame_index`` through the trail buffer (real trails)."""
        tracks = state.tracks(image_id)
        if not tracks:
            return
        frames = tracks["frames"]
        exact = state.track_position(image_id, frame_index)
        position = (
            exact
            if exact is not None
            else next((i for i, f in enumerate(frames) if f["index"] >= frame_index), len(frames))
        )
        if exact is not None:
            stored_ids = {d.get("track_id") for d in frames[position]["detections"]}
            hidden = stored_ids - {d.get("track_id") for d in current}
        else:
            hidden = set()
        window = annotator.style.trail.length + annotator.style.trail.max_age
        for entry in frames[max(0, position - window) : position]:
            dets = Detections.from_dicts(
                [
                    d
                    for d in entry["detections"]
                    if d.get("track_id") not in hidden and _confident(d, min_confidence)
                ]
            )
            if scale < 1.0:
                dets.xyxy = dets.xyxy * np.float32(scale)
            annotator.trails.update(list(dets))

    @app.post("/api/render")
    def render(body: RenderRequest) -> Response:
        if body.seq is None:
            return _render(body)
        with state.render_seq_lock:
            state.render_seq[body.client] = max(body.seq, state.render_seq.get(body.client, -1))
        # Serialise previews: while one renders, newer requests queue up here, and only the
        # newest of them is worth drawing (the browser has already abandoned the rest).
        with state.render_lock:
            if body.seq < state.render_seq[body.client]:
                return Response(status_code=204, headers={"Cache-Control": "no-store"})
            return _render(body)

    def _render(body: RenderRequest) -> Response:
        img = state.image(body.image_id, body.media_time, body.frame_index)
        try:
            style = Style.from_dict(body.style)
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc
        h, w = img.shape[:2]
        scale = min(1.0, body.max_size / max(h, w))
        dets_items = body.detections
        if dets_items is None:
            tracks = state.tracks(body.image_id) if body.frame_index is not None else None
            if tracks:
                position = state.track_position(body.image_id, body.frame_index or 0)
                frame = tracks["frames"][position] if position is not None else None
                dets_items = [
                    d
                    for d in (frame["detections"] if frame else [])
                    if _confident(d, body.min_confidence)
                ]
            else:
                sidecar = state.sidecar(body.image_id)
                dets_items = (
                    json.loads(sidecar.read_text()).get("detections", []) if sidecar else []
                )
        dets = Detections.from_dicts(dets_items)
        if scale < 1.0:
            img = cv2.resize(
                img, (round(w * scale), round(h * scale)), interpolation=cv2.INTER_AREA
            )
            dets.xyxy = dets.xyxy * np.float32(scale)
        annotator = Annotator(style)
        t0 = time.perf_counter()
        synthetic = body.synthetic_trails
        if style.trail.enabled and not synthetic and body.frame_index is not None:
            _replay_trails(
                annotator, body.image_id, body.frame_index, dets_items, scale, body.min_confidence
            )
        out = annotator.annotate(img, dets, t=body.t, synthetic_trails=synthetic)
        ms = (time.perf_counter() - t0) * 1000
        if body.format == "png":
            ok, buf = cv2.imencode(".png", out)
            media = "image/png"
        elif body.format == "webp":
            ok, buf = cv2.imencode(".webp", out, [cv2.IMWRITE_WEBP_QUALITY, body.quality])
            media = "image/webp"
        else:
            ok, buf = cv2.imencode(".jpg", out, [cv2.IMWRITE_JPEG_QUALITY, body.quality])
            media = "image/jpeg"
        if not ok:
            raise HTTPException(500, "Encoding failed")
        return Response(
            buf.tobytes(),
            media_type=media,
            headers={
                "X-Render-Ms": f"{ms:.1f}",
                "X-Render-Scale": f"{scale:.4f}",
                "Cache-Control": "no-store",
            },
        )

    # ---- static frontend ----------------------------------------------------
    if (STATIC_DIR / "index.html").exists():
        app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

        @app.get("/{path:path}", include_in_schema=False)
        def spa(path: str) -> FileResponse:
            candidate = STATIC_DIR / path
            if path and candidate.is_file():
                return FileResponse(candidate)
            return FileResponse(STATIC_DIR / "index.html")
    else:

        @app.get("/", include_in_schema=False)
        def no_frontend() -> JSONResponse:
            return JSONResponse(
                {
                    "message": "The Studio frontend is not built. Run `npm run build` in studio/ "
                    "or use the API at /docs.",
                }
            )

    return app


def run(
    host: str = "127.0.0.1",
    port: int = 8420,
    presets_dir: str | None = None,
    open_browser: bool = True,
    reload: bool = False,
) -> None:
    import uvicorn

    url = f"http://{host}:{port}"
    if open_browser:
        threading.Timer(1.2, lambda: webbrowser.open(url)).start()
    print(f"visionstyle studio → {url}", file=sys.stderr)  # noqa: T201
    if presets_dir:
        os.environ["VISIONSTYLE_STUDIO_PRESETS_DIR"] = presets_dir
    if reload:
        uvicorn.run(
            "visionstyle.studio.server:app", host=host, port=port, reload=True, log_level="warning"
        )
    else:
        uvicorn.run(create_app(presets_dir), host=host, port=port, log_level="warning")


def _app_factory() -> FastAPI:
    return create_app(os.environ.get("VISIONSTYLE_STUDIO_PRESETS_DIR"))


app = _app_factory()
