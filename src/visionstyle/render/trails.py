"""Per-track position history and trail drawing."""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field

import numpy as np

from visionstyle.detections import Detection

Point = tuple[float, float]


@dataclass
class Track:
    points: deque[Point]
    last_seen: int
    color_key: int
    class_id: int | None = None
    class_name: str | None = None
    history_frames: deque[int] = field(default_factory=deque)


class TrailBuffer:
    """Remembers where each ``track_id`` has been for the last ``length`` frames."""

    def __init__(self, length: int = 30, max_age: int = 30, anchor: str = "bottom_center") -> None:
        self.length = length
        self.max_age = max_age
        self.anchor = anchor
        self.tracks: dict[int, Track] = {}
        self.frame = 0

    def configure(self, length: int, max_age: int, anchor: str) -> None:
        if length != self.length:
            for t in self.tracks.values():
                t.points = deque(t.points, maxlen=length)
        self.length, self.max_age, self.anchor = length, max_age, anchor

    def anchor_point(self, det: Detection) -> Point:
        cx, cy = det.center
        if self.anchor == "bottom_center":
            return (cx, det.y2)
        if self.anchor == "top_center":
            return (cx, det.y1)
        return (cx, cy)

    def update(self, detections: list[Detection]) -> None:
        """Append this frame's positions and drop tracks unseen for ``max_age`` frames."""
        self.frame += 1
        for det in detections:
            if det.track_id is None:
                continue
            track = self.tracks.get(det.track_id)
            if track is None:
                track = Track(
                    deque(maxlen=self.length),
                    self.frame,
                    det.track_id,
                    det.class_id,
                    det.class_name,
                )
                self.tracks[det.track_id] = track
            track.points.append(self.anchor_point(det))
            track.history_frames.append(self.frame)
            while len(track.history_frames) > len(track.points):
                track.history_frames.popleft()
            track.last_seen = self.frame
            track.class_id, track.class_name = det.class_id, det.class_name
        stale = [tid for tid, t in self.tracks.items() if self.frame - t.last_seen > self.max_age]
        for tid in stale:
            del self.tracks[tid]

    def seed(self, track_id: int, points: list[Point], det: Detection | None = None) -> None:
        """Pre-fill a track (used by the Studio to preview trails on a still image)."""
        track = Track(
            deque(points, maxlen=max(self.length, len(points))),
            self.frame,
            track_id,
            det.class_id if det else None,
            det.class_name if det else None,
        )
        track.history_frames = deque(range(self.frame - len(points) + 1, self.frame + 1))
        self.tracks[track_id] = track

    def clear(self) -> None:
        self.tracks.clear()
        self.frame = 0

    @staticmethod
    def smooth(points: list[Point], window: int) -> list[Point]:
        if window <= 1 or len(points) < 3:
            return points
        arr = np.asarray(points, dtype=np.float32)
        k = min(window, len(points))
        kernel = np.ones(k, np.float32) / k
        pad = k // 2
        padded = np.pad(arr, ((pad, k - 1 - pad), (0, 0)), mode="edge")
        xs = np.convolve(padded[:, 0], kernel, mode="valid")
        ys = np.convolve(padded[:, 1], kernel, mode="valid")
        out = list(zip(xs.tolist(), ys.tolist(), strict=True))
        out[-1] = points[-1]  # keep the head exactly on the object
        return out


def synthetic_trajectory(
    det: Detection, anchor: str, n: int, image_w: int, image_h: int, seed: int = 0
) -> list[Point]:
    """A plausible curved path ending at the detection's anchor point, for still-image previews."""
    rng = np.random.default_rng(seed + (det.track_id or 0) * 7919)
    cx, cy = det.center
    ex, ey = (
        (cx, det.y2)
        if anchor == "bottom_center"
        else (cx, det.y1)
        if anchor == "top_center"
        else (cx, cy)
    )
    span = max(60.0, min(image_w, image_h) * 0.18) * (0.6 + rng.random())
    direction = rng.uniform(0, 2 * np.pi)
    dx, dy = np.cos(direction), np.sin(direction) * 0.35
    margin = 8.0
    # keep the start point inside the frame by flipping the offending component
    if not margin <= ex - dx * span <= image_w - margin:
        dx = -dx
    if not margin <= ey - dy * span <= image_h - margin:
        dy = -dy
    direction = float(np.arctan2(dy, dx))
    sx, sy = ex - dx * span, ey - dy * span
    bend = rng.uniform(-0.6, 0.6) * span
    pts: list[Point] = []
    for i in range(n):
        t = i / max(1, n - 1)
        # quadratic bezier from start to end with a sideways control point
        mx, my = (
            (sx + ex) / 2 - np.sin(direction) * bend,
            (sy + ey) / 2 + np.cos(direction) * bend * 0.4,
        )
        x = (1 - t) ** 2 * sx + 2 * (1 - t) * t * mx + t**2 * ex
        y = (1 - t) ** 2 * sy + 2 * (1 - t) * t * my + t**2 * ey
        x += rng.normal(0, span * 0.01)
        y += rng.normal(0, span * 0.006)
        pts.append((float(np.clip(x, 0, image_w - 1)), float(np.clip(y, 0, image_h - 1))))
    pts[-1] = (ex, ey)
    return pts
