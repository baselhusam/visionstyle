# Changelog

## Unreleased

- Default detector is now Ultralytics YOLO26n (`yolo26n.pt`) everywhere: the Studio's video
  tracking, `from_ultralytics` examples, CLI help, README and site. The `[yolo]` extra requires
  `ultralytics>=8.4`, the first release that ships YOLO26.
- Bundled sample detections (`night`, `street`, `city-walkthrough`) regenerated with YOLO26n;
  README, site and showcase renders and the Studio screenshot refreshed to match.

## 0.1.0 — 2026-09-24

- Initial release: configurable box / stroke / fill / line / label / effects / trail styles,
  built-in presets, Ultralytics integration, CLI and the Studio app.
- Per-object scaling (`style.object_scale`, on by default): stroke weight, corner geometry and
  label size now follow each detected box's size relative to the frame, clamped to
  `min_factor`..`max_factor`; `apply_to` limits it to the box or the label.
