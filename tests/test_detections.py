from __future__ import annotations

import numpy as np
import pytest

from visionstyle import Detections


def test_basic_construction_and_iteration():
    d = Detections(
        xyxy=[[0, 0, 10, 20]], class_id=[1], confidence=[0.5], track_id=[9], names={1: "cat"}
    )
    assert len(d) == 1
    det = d[0]
    assert det.class_name == "cat"
    assert det.width == 10 and det.height == 20
    assert det.center == (5, 10)
    assert det.label == "cat"
    assert det.track_id == 9


def test_empty():
    d = Detections.empty()
    assert len(d) == 0
    assert list(d) == []
    assert Detections.from_dicts([]).to_dicts() == []


def test_length_mismatch_raises():
    with pytest.raises(ValueError):
        Detections(xyxy=[[0, 0, 1, 1], [1, 1, 2, 2]], confidence=[0.5])
    with pytest.raises(ValueError):
        Detections(xyxy=[[0, 0, 1, 1]], class_name=["a", "b"])


def test_xywh_conversions():
    c = Detections.from_xywh([[50, 50, 20, 10]])
    np.testing.assert_allclose(c.xyxy[0], [40, 45, 60, 55])
    t = Detections.from_xywh_topleft([[40, 45, 20, 10]])
    np.testing.assert_allclose(t.xyxy[0], [40, 45, 60, 55])


def test_filter_and_subset():
    d = Detections(
        xyxy=np.zeros((3, 4)),
        class_id=[0, 1, 2],
        class_name=["a", "b", "c"],
        confidence=[0.2, 0.6, 0.9],
    )
    assert len(d.filter(min_confidence=0.5)) == 2
    assert d.filter(classes=["c"]).class_name == ["c"]
    assert d.filter(classes=[0, 1]).class_id.tolist() == [0, 1]


def test_from_dicts_roundtrip():
    items = [
        {"xyxy": [1, 2, 3, 4], "class_id": 0, "class_name": "x", "confidence": 0.5, "track_id": 2}
    ]
    d = Detections.from_dicts(items)
    assert d.to_dicts()[0]["class_name"] == "x"
    assert d.to_dicts()[0]["track_id"] == 2


def test_from_ultralytics_fake_result():
    class Boxes:
        xyxy = np.array([[0, 0, 5, 5], [1, 1, 6, 6]], dtype=np.float32)
        cls = np.array([0, 3])
        conf = np.array([0.9, 0.4])
        id = np.array([7, 8])

        def __len__(self):
            return 2

    class Result:
        boxes = Boxes()
        names = {0: "person", 3: "motorcycle"}

    d = Detections.from_ultralytics(Result())
    assert d.class_name == ["person", "motorcycle"]
    assert d.track_id.tolist() == [7, 8]

    class Empty:
        boxes = None

    assert len(Detections.from_ultralytics(Empty())) == 0


def test_torch_like_inputs():
    class Tensor:
        def __init__(self, a):
            self.a = a

        def detach(self):
            return self

        def cpu(self):
            return self

        def numpy(self):
            return self.a

    d = Detections(xyxy=Tensor(np.array([[0, 0, 2, 2]])), confidence=Tensor(np.array([0.3])))
    assert d.confidence is not None and float(d.confidence[0]) == pytest.approx(0.3)
