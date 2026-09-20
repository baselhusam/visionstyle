# Changelog

## Unreleased

- Per-object scaling (`style.object_scale`, on by default): stroke weight, corner geometry and
  label size now follow each detected box's size relative to the frame, clamped to
  `min_factor`..`max_factor`; `apply_to` limits it to the box or the label.
- Initial release: configurable box / stroke / fill / line / label / effects / trail styles,
  built-in presets, Ultralytics integration, CLI and the Studio app.
