from __future__ import annotations

import io

import cv2
import numpy as np
import pytest

pytest.importorskip("fastapi")
from fastapi.testclient import TestClient

from visionstyle.studio.server import create_app


@pytest.fixture
def client(tmp_path):
    return TestClient(create_app(tmp_path / "presets"))


def test_info_schema_palettes(client):
    info = client.get("/api/info").json()
    assert info["version"]
    assert "BoxStyle" in client.get("/api/schema").json()["$defs"]
    assert "default" in client.get("/api/palettes").json()


def test_samples_and_detect_from_sidecar(client):
    images = client.get("/api/images").json()
    ids = {i["id"] for i in images}
    assert "sample:street" in ids
    res = client.post("/api/detect", json={"image_id": "sample:street", "conf": 0.5}).json()
    assert res["source"] == "bundled" and res["detections"]
    assert all(d["confidence"] >= 0.5 for d in res["detections"])
    assert client.post("/api/detect", json={"image_id": "sample:street", "conf": 0.5}).json()[
        "cached"
    ]
    assert client.get("/api/images/sample:street/file").status_code == 200


def test_render_returns_image(client):
    style = client.get("/api/presets/cinematic").json()
    dets = client.post("/api/detect", json={"image_id": "sample:street"}).json()["detections"]
    r = client.post(
        "/api/render",
        json={"image_id": "sample:street", "style": style, "detections": dets, "max_size": 640},
    )
    assert r.status_code == 200 and r.headers["content-type"] == "image/jpeg"
    img = cv2.imdecode(np.frombuffer(r.content, np.uint8), cv2.IMREAD_COLOR)
    assert img.shape[1] == 640
    assert float(r.headers["X-Render-Ms"]) > 0
    png = client.post(
        "/api/render",
        json={
            "image_id": "sample:street",
            "style": style,
            "detections": dets[:2],
            "format": "png",
            "max_size": 400,
        },
    )
    assert png.headers["content-type"] == "image/png"


def test_render_rejects_bad_style(client):
    r = client.post(
        "/api/render",
        json={
            "image_id": "sample:street",
            "style": {"stroke": {"thickness": -1}},
            "detections": [],
        },
    )
    assert r.status_code == 422
    assert (
        client.post(
            "/api/render", json={"image_id": "nope", "style": {}, "detections": []}
        ).status_code
        == 404
    )


def test_preset_save_list_delete(client, tmp_path):
    style = client.get("/api/presets/default").json()
    style["stroke"]["thickness"] = 7
    r = client.put("/api/presets/my-look", json={"style": style})
    assert r.status_code == 200
    assert (tmp_path / "presets" / "my-look.yaml").exists()
    names = {p["name"]: p for p in client.get("/api/presets").json()}
    assert (
        names["my-look"]["origin"] == "user"
        and names["my-look"]["style"]["stroke"]["thickness"] == 7
    )
    assert client.get("/api/presets/my-look").json()["name"] == "my-look"
    assert client.put("/api/presets/bad name!", json={"style": style}).status_code == 422
    assert client.delete("/api/presets/my-look").status_code == 200
    assert client.delete("/api/presets/my-look").status_code == 404
    assert client.get("/api/presets/nope").status_code == 404


def test_yaml_validate_and_snippet(client):
    style = client.get("/api/presets/minimal").json()
    y = client.post("/api/style/yaml?exclude_defaults=true", json=style)
    assert y.status_code == 200 and "name: minimal" in y.text
    assert client.post("/api/style/validate", json=style).status_code == 200
    assert client.post("/api/style/validate", json={"box": {"shape": "hexagon"}}).status_code == 422
    assert (
        "Style.preset"
        in client.post("/api/snippet", json={"style": style, "preset_name": "minimal"}).json()[
            "python"
        ]
    )


def test_upload_image_and_delete(client):
    img = np.full((120, 160, 3), 90, np.uint8)
    ok, buf = cv2.imencode(".png", img)
    assert ok
    r = client.post(
        "/api/images", files={"file": ("tiny.png", io.BytesIO(buf.tobytes()), "image/png")}
    )
    assert r.status_code == 200
    info = r.json()
    assert info["width"] == 160 and not info["sample"]
    render = client.post(
        "/api/render",
        json={
            "image_id": info["id"],
            "style": {},
            "detections": [{"xyxy": [10, 10, 80, 80], "class_name": "x"}],
        },
    )
    assert render.status_code == 200
    assert client.delete(f"/api/images/{info['id']}").status_code == 200
    assert client.delete("/api/images/sample:street").status_code == 403
    bad = client.post("/api/images", files={"file": ("x.txt", io.BytesIO(b"hi"), "text/plain")})
    assert bad.status_code == 415


def test_upload_video_and_render_frame(client, tmp_path):
    video_path = tmp_path / "clip.avi"
    writer = cv2.VideoWriter(
        str(video_path), cv2.VideoWriter_fourcc(*"MJPG"), 10, (96, 64)
    )
    assert writer.isOpened()
    for value in (40, 120, 220):
        writer.write(np.full((64, 96, 3), value, np.uint8))
    writer.release()

    with video_path.open("rb") as video:
        response = client.post(
            "/api/images", files={"file": ("clip.avi", video, "video/x-msvideo")}
        )
    assert response.status_code == 200
    info = response.json()
    assert info["kind"] == "video"
    assert info["width"] == 96 and info["height"] == 64
    assert info["duration"] > 0

    render = client.post(
        "/api/render",
        json={
            "image_id": info["id"],
            "style": {},
            "detections": [],
            "media_time": 0.1,
        },
    )
    assert render.status_code == 200
    assert cv2.imdecode(np.frombuffer(render.content, np.uint8), cv2.IMREAD_COLOR).shape[:2] == (
        64,
        96,
    )


def test_model_upload_rejects_wrong_type(client):
    r = client.post("/api/models", files={"file": ("m.txt", io.BytesIO(b"x"), "text/plain")})
    assert r.status_code == 415
    assert "models" in client.get("/api/models").json()
