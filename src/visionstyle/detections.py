"""The ``Detections`` container: boxes plus optional classes, confidences and track ids."""

from __future__ import annotations

from collections.abc import Iterator, Mapping, Sequence
from dataclasses import dataclass, field
from typing import Any

import numpy as np
import numpy.typing as npt

FloatArray = npt.NDArray[np.float32]
IntArray = npt.NDArray[np.int64]


def _as_float(a: Any) -> FloatArray:
    return np.asarray(_to_numpy(a), dtype=np.float32)


def _as_int(a: Any) -> IntArray:
    return np.asarray(_to_numpy(a), dtype=np.int64)


def _to_numpy(a: Any) -> Any:
    # Accept torch tensors (and anything else with .cpu()/.numpy()) without importing torch.
    if hasattr(a, "detach"):
        a = a.detach()
    if hasattr(a, "cpu"):
        a = a.cpu()
    if hasattr(a, "numpy"):
        a = a.numpy()
    return a


@dataclass(frozen=True)
class Detection:
    """A single detection, yielded when iterating over :class:`Detections`."""

    xyxy: tuple[float, float, float, float]
    class_id: int | None = None
    class_name: str | None = None
    confidence: float | None = None
    track_id: int | None = None
    data: Mapping[str, Any] = field(default_factory=dict)

    @property
    def x1(self) -> float:
        return self.xyxy[0]

    @property
    def y1(self) -> float:
        return self.xyxy[1]

    @property
    def x2(self) -> float:
        return self.xyxy[2]

    @property
    def y2(self) -> float:
        return self.xyxy[3]

    @property
    def width(self) -> float:
        return self.x2 - self.x1

    @property
    def height(self) -> float:
        return self.y2 - self.y1

    @property
    def center(self) -> tuple[float, float]:
        return ((self.x1 + self.x2) / 2, (self.y1 + self.y2) / 2)

    @property
    def label(self) -> str:
        """Best human-readable name: class_name, else ``class {id}``, else ``object``."""
        if self.class_name:
            return self.class_name
        if self.class_id is not None:
            return f"class {self.class_id}"
        return "object"


class Detections:
    """Vectorised detections for one frame.

    Parameters
    ----------
    xyxy:
        ``(N, 4)`` boxes in absolute pixel coordinates ``x1, y1, x2, y2``.
    class_id:
        ``(N,)`` integer class ids. Optional.
    class_name:
        ``(N,)`` names. Optional; if omitted and ``names`` is given, names are looked up by id.
    confidence:
        ``(N,)`` floats in ``0..1``. Optional.
    track_id:
        ``(N,)`` integer tracker ids. Optional.
    names:
        Mapping of class id → name used when ``class_name`` is not given.
    data:
        Extra per-detection columns (``{key: (N,) array-like}``) available to label templates
        as ``{data[key]}``.
    """

    def __init__(
        self,
        xyxy: Any,
        class_id: Any | None = None,
        class_name: Sequence[str] | None = None,
        confidence: Any | None = None,
        track_id: Any | None = None,
        names: Mapping[int, str] | Sequence[str] | None = None,
        data: Mapping[str, Any] | None = None,
    ) -> None:
        boxes = _as_float(xyxy).reshape(-1, 4) if np.size(xyxy) else np.zeros((0, 4), np.float32)
        n = len(boxes)
        self.xyxy: FloatArray = boxes
        self.class_id: IntArray | None = None if class_id is None else _as_int(class_id).reshape(n)
        self.confidence: FloatArray | None = (
            None if confidence is None else _as_float(confidence).reshape(n)
        )
        self.track_id: IntArray | None = None if track_id is None else _as_int(track_id).reshape(n)
        self.data: dict[str, np.ndarray[Any, Any]] = {
            k: np.asarray(_to_numpy(v)).reshape(n) for k, v in (data or {}).items()
        }

        if class_name is not None:
            if len(class_name) != n:
                raise ValueError(f"class_name has {len(class_name)} entries, expected {n}")
            self.class_name: list[str] | None = [str(c) for c in class_name]
        elif names is not None and self.class_id is not None:
            lookup = dict(enumerate(names)) if not isinstance(names, Mapping) else names
            self.class_name = [str(lookup.get(int(c), f"class {c}")) for c in self.class_id]
        else:
            self.class_name = None

        for name, arr in (
            ("class_id", self.class_id),
            ("confidence", self.confidence),
            ("track_id", self.track_id),
        ):
            if arr is not None and len(arr) != n:
                raise ValueError(f"{name} has {len(arr)} entries, expected {n}")

    # ------------------------------------------------------------------ constructors
    @classmethod
    def empty(cls) -> Detections:
        return cls(np.zeros((0, 4), np.float32))

    @classmethod
    def from_xywh(cls, xywh: Any, **kwargs: Any) -> Detections:
        """Boxes given as ``x_center, y_center, width, height``."""
        b = _as_float(xywh).reshape(-1, 4)
        xyxy = np.stack(
            [
                b[:, 0] - b[:, 2] / 2,
                b[:, 1] - b[:, 3] / 2,
                b[:, 0] + b[:, 2] / 2,
                b[:, 1] + b[:, 3] / 2,
            ],
            axis=1,
        )
        return cls(xyxy, **kwargs)

    @classmethod
    def from_xywh_topleft(cls, xywh: Any, **kwargs: Any) -> Detections:
        """Boxes given as ``x_left, y_top, width, height`` (COCO convention)."""
        b = _as_float(xywh).reshape(-1, 4)
        xyxy = np.stack([b[:, 0], b[:, 1], b[:, 0] + b[:, 2], b[:, 1] + b[:, 3]], axis=1)
        return cls(xyxy, **kwargs)

    @classmethod
    def from_ultralytics(cls, result: Any) -> Detections:
        """Build from a single ``ultralytics.engine.results.Results`` object.

        Works for ``model.predict`` and ``model.track`` outputs; track ids are picked up when the
        tracker assigned them.
        """
        boxes = getattr(result, "boxes", None)
        if boxes is None or len(boxes) == 0:
            return cls.empty()
        names = getattr(result, "names", None)
        cls_ids = boxes.cls
        track = getattr(boxes, "id", None)
        return cls(
            xyxy=boxes.xyxy,
            class_id=cls_ids,
            confidence=boxes.conf,
            track_id=None if track is None else track,
            names=names,
        )

    @classmethod
    def from_dicts(
        cls, items: Sequence[Mapping[str, Any]], names: Mapping[int, str] | None = None
    ) -> Detections:
        """Build from ``[{"xyxy": [...], "class_id": 0, "class_name": "person",
        "confidence": 0.9, "track_id": 3}, ...]`` (the Studio JSON format)."""
        if not items:
            return cls.empty()
        has = {
            k: all(k in it and it[k] is not None for it in items)
            for k in ("class_id", "class_name", "confidence", "track_id")
        }
        return cls(
            xyxy=[it["xyxy"] for it in items],
            class_id=[it["class_id"] for it in items] if has["class_id"] else None,
            class_name=[it["class_name"] for it in items] if has["class_name"] else None,
            confidence=[it["confidence"] for it in items] if has["confidence"] else None,
            track_id=[it["track_id"] for it in items] if has["track_id"] else None,
            names=names,
        )

    # ------------------------------------------------------------------ container API
    def __len__(self) -> int:
        return len(self.xyxy)

    def __iter__(self) -> Iterator[Detection]:
        for i in range(len(self)):
            yield self[i]

    def __getitem__(self, i: int) -> Detection:
        if not isinstance(i, (int, np.integer)):
            raise TypeError("Use .filter()/.subset() for array indexing")
        x1, y1, x2, y2 = (float(v) for v in self.xyxy[i])
        return Detection(
            xyxy=(x1, y1, x2, y2),
            class_id=None if self.class_id is None else int(self.class_id[i]),
            class_name=None if self.class_name is None else self.class_name[i],
            confidence=None if self.confidence is None else float(self.confidence[i]),
            track_id=None if self.track_id is None else int(self.track_id[i]),
            data={k: v[i] for k, v in self.data.items()},
        )

    def subset(self, mask: Any) -> Detections:
        """Return a new ``Detections`` keeping rows where ``mask`` is truthy."""
        m = np.asarray(mask, dtype=bool).reshape(len(self))
        idx = np.flatnonzero(m)
        return Detections(
            xyxy=self.xyxy[idx],
            class_id=None if self.class_id is None else self.class_id[idx],
            class_name=None if self.class_name is None else [self.class_name[i] for i in idx],
            confidence=None if self.confidence is None else self.confidence[idx],
            track_id=None if self.track_id is None else self.track_id[idx],
            data={k: v[idx] for k, v in self.data.items()},
        )

    def filter(
        self,
        min_confidence: float | None = None,
        classes: Sequence[int] | Sequence[str] | None = None,
    ) -> Detections:
        mask = np.ones(len(self), dtype=bool)
        if min_confidence is not None and self.confidence is not None:
            mask &= self.confidence >= min_confidence
        if classes:
            if all(isinstance(c, str) for c in classes):
                mask &= np.array(
                    [n in classes for n in (self.class_name or [])] or [False] * len(self)
                )
            elif self.class_id is not None:
                mask &= np.isin(self.class_id, np.asarray(classes, dtype=np.int64))
        return self.subset(mask)

    def to_dicts(self) -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = []
        for d in self:
            out.append(
                {
                    "xyxy": [round(v, 2) for v in d.xyxy],
                    "class_id": d.class_id,
                    "class_name": d.class_name,
                    "confidence": None if d.confidence is None else round(d.confidence, 4),
                    "track_id": d.track_id,
                }
            )
        return out

    def __repr__(self) -> str:
        return (
            f"Detections(n={len(self)}, classes={self.class_id is not None}, "
            f"confidence={self.confidence is not None}, track_id={self.track_id is not None})"
        )
