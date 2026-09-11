from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pytest

import visionstyle as vs

SAMPLES = Path(vs.__file__).resolve().parent / "assets" / "samples"


@pytest.fixture(autouse=True)
def isolated_presets(tmp_path, monkeypatch):
    """Never touch the developer's ~/.visionstyle during tests."""
    monkeypatch.setenv("VISIONSTYLE_HOME", str(tmp_path / "home"))
    monkeypatch.delenv("VISIONSTYLE_PRESETS_DIR", raising=False)
    return tmp_path / "home" / "presets"


@pytest.fixture
def frame() -> np.ndarray:
    rng = np.random.default_rng(0)
    img = rng.integers(40, 200, size=(480, 640, 3), dtype=np.uint8)
    img[200:400, 100:500] = (30, 60, 90)
    return img


@pytest.fixture
def detections() -> vs.Detections:
    return vs.Detections(
        xyxy=[[100, 120, 260, 420], [300, 200, 560, 380], [20, 20, 90, 110], [600, 440, 640, 480]],
        class_id=[0, 2, 1, 7],
        class_name=["person", "car", "bicycle", "truck"],
        confidence=[0.93, 0.71, 0.42, 0.88],
        track_id=[3, 8, 11, 5],
    )


@pytest.fixture
def sample_image() -> np.ndarray:
    import cv2

    return cv2.imread(str(SAMPLES / "street.jpg"))


@pytest.fixture
def sample_detections() -> vs.Detections:
    data = json.loads((SAMPLES / "street.detections.json").read_text())
    return vs.Detections.from_dicts(data["detections"])
