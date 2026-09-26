# Changelog

## Unreleased

- Default detector is now Ultralytics YOLO26n (`yolo26n.pt`) everywhere: the Studio's video
  tracking, `from_ultralytics` examples, CLI help, README and site. The `[yolo]` extra requires
  `ultralytics>=8.4`, the first release that ships YOLO26.
- Bundled sample detections (`night`, `street`, `city-walkthrough`) regenerated with YOLO26n;
  README, site and showcase renders and the Studio screenshot refreshed to match.
- Ten new built-in presets for specific jobs, fields and audiences: `target` (red lock-on for
  following one subject), `redact` (blurs each box for anonymizing), `review` (label-audit look),
  `safety` (hazard-tape alerts), `broadcast` (sports-TV player paths and numbers), `cctv`,
  `traffic`, `documentary`, `blueprint` and `high-contrast`.
- Tags on built-in presets now stay a constant, readable size: every built-in scales only the box
  with object size (`object_scale.apply_to: box`). Before, tags on distant objects shrank to about
  7 px on a 1600 px frame. Your own saved presets are unchanged.
- Studio: glyphs for the new presets, and built-in names like `cctv` display as "CCTV".
- `docs/presets.py` renders the site's preset images and thumbnails; the site's preset picker
  scrolls within the board on desktop.

## 0.1.0 — 2026-09-24

- Initial release: configurable box / stroke / fill / line / label / effects / trail styles,
  built-in presets, Ultralytics integration, CLI and the Studio app.
- Per-object scaling (`style.object_scale`, on by default): stroke weight, corner geometry and
  label size now follow each detected box's size relative to the frame, clamped to
  `min_factor`..`max_factor`; `apply_to` limits it to the box or the label.
