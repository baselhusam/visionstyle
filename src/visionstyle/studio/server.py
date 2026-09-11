"""FastAPI backend for the Studio. Renders previews with the real ``Annotator`` so what the
browser shows is exactly what ``visionstyle`` produces."""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import sys
import threading
import time
import webbrowser
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from visionstyle import __version__
from visionstyle.detections import Detections
from visionstyle.render.annotator import Annotator
from visionstyle.style.presets import (
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
MODEL_SUFFIXES = {".pt", ".onnx", ".engine", ".torchscript"}


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
        for p in sorted(SAMPLES_DIR.glob("*.jpg")):
            self.images[f"sample:{p.stem}"] = p
        home = studio_home()
        for p in sorted((home / "images").iterdir()):
            if p.suffix.lower() in IMAGE_SUFFIXES:
                self.images[p.stem] = p
        for p in sorted((home / "models").iterdir()):
            if p.suffix.lower() in MODEL_SUFFIXES:
                self.models[p.stem] = p

    def image(self, image_id: str) -> np.ndarray:
        path = self.images.get(image_id)
        if path is None:
            raise HTTPException(404, f"Unknown image {image_id!r}")
        with self.lock:
            img = self.image_cache.get(image_id)
            if img is None:
                img = cv2.imread(str(path))
                if img is None:
                    raise HTTPException(415, f"Cannot decode {path.name}")
                self.image_cache[image_id] = img
        return img

    def model(self, model_id: str) -> Any:
        path = self.models.get(model_id)
        if path is None and model_id.endswith(".pt") and "/" not in model_id:
            path = Path(model_id)  # let ultralytics download e.g. yolo11n.pt
        if path is None:
            raise HTTPException(404, f"Unknown model {model_id!r}")
        with self.lock:
            if model_id not in self.loaded_models:
                try:
                    from visionstyle.integrations.ultralytics import load_model
                except ImportError as exc:
                    raise HTTPException(501, "Install visionstyle[yolo] to run models.") from exc
                self.loaded_models[model_id] = load_model(path)
        return self.loaded_models[model_id]


def _ultralytics_available() -> bool:
    try:
        import ultralytics  # noqa: F401
    except ImportError:
        return False
    return True


# ----------------------------------------------------------------------------- schemas
class DetectRequest(BaseModel):
    image_id: str
    model_id: str | None = None
    conf: float = Field(0.25, ge=0.01, le=1)
    imgsz: int = Field(640, ge=160, le=1920)


class RenderRequest(BaseModel):
    image_id: str
    style: dict[str, Any]
    detections: list[dict[str, Any]] | None = None
    t: float = 0.0
    max_size: int = Field(1600, ge=200, le=4096)
    synthetic_trails: bool = True
    format: str = Field("jpeg", pattern="^(jpeg|png|webp)$")
    quality: int = Field(90, ge=30, le=100)


class SavePresetRequest(BaseModel):
    style: dict[str, Any]
    directory: str | None = None


class SnippetRequest(BaseModel):
    style: dict[str, Any]
    preset_name: str | None = None


# ----------------------------------------------------------------------------- app
def create_app(presets_dir: str | Path | None = None) -> FastAPI:
    app = FastAPI(title="visionstyle studio", version=__version__)
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
            }
            sidecar = path.with_suffix(".detections.json")
            entry["has_detections"] = sidecar.exists()
            out.append(entry)
        return out

    @app.get("/api/images/{image_id}/file")
    def image_file(image_id: str) -> FileResponse:
        path = state.images.get(image_id)
        if path is None:
            raise HTTPException(404, "Unknown image")
        return FileResponse(path)

    @app.post("/api/images")
    async def upload_image(file: UploadFile = File(...)) -> dict[str, Any]:
        suffix = Path(file.filename or "upload.jpg").suffix.lower() or ".jpg"
        if suffix not in IMAGE_SUFFIXES:
            raise HTTPException(415, f"Unsupported image type {suffix}")
        data = await file.read()
        digest = hashlib.sha1(data).hexdigest()[:10]
        image_id = f"{Path(file.filename or 'upload').stem[:40]}-{digest}"
        path = studio_home() / "images" / f"{image_id}{suffix}"
        path.write_bytes(data)
        img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
        if img is None:
            path.unlink(missing_ok=True)
            raise HTTPException(415, "Could not decode image")
        state.images[image_id] = path
        state.image_cache[image_id] = img
        return {
            "id": image_id,
            "name": path.name,
            "width": img.shape[1],
            "height": img.shape[0],
            "sample": False,
            "has_detections": False,
        }

    @app.delete("/api/images/{image_id}")
    def delete_image(image_id: str) -> dict[str, Any]:
        if image_id.startswith("sample:"):
            raise HTTPException(403, "Samples cannot be deleted")
        path = state.images.pop(image_id, None)
        state.image_cache.pop(image_id, None)
        if path and path.exists():
            path.unlink()
        return {"deleted": image_id}

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
            "default": "yolo11n.pt" if _ultralytics_available() else None,
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
            path = state.images[body.image_id]
            sidecar = path.with_suffix(".detections.json")
            if not sidecar.exists():
                raise HTTPException(
                    404, "No model selected and no stored detections for this image"
                )
            raw = json.loads(sidecar.read_text())
            items = [d for d in raw["detections"] if (d.get("confidence") or 1) >= body.conf]
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

    # ---- render -------------------------------------------------------------
    @app.post("/api/render")
    def render(body: RenderRequest) -> Response:
        img = state.image(body.image_id)
        try:
            style = Style.from_dict(body.style)
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc
        h, w = img.shape[:2]
        scale = min(1.0, body.max_size / max(h, w))
        dets_items = body.detections
        if dets_items is None:
            sidecar = state.images[body.image_id].with_suffix(".detections.json")
            dets_items = json.loads(sidecar.read_text())["detections"] if sidecar.exists() else []
        dets = Detections.from_dicts(dets_items)
        if scale < 1.0:
            img = cv2.resize(
                img, (round(w * scale), round(h * scale)), interpolation=cv2.INTER_AREA
            )
            dets.xyxy = dets.xyxy * np.float32(scale)
        annotator = Annotator(style)
        t0 = time.perf_counter()
        out = annotator.annotate(img, dets, t=body.t, synthetic_trails=body.synthetic_trails)
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
