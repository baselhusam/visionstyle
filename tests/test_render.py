from __future__ import annotations

import itertools

import numpy as np
import pytest

import visionstyle as vs
from visionstyle.render import shapes
from visionstyle.render.canvas import Layer, object_scale_factor, scale_factor
from visionstyle.render.labels import compose_label, format_confidence, place_tag
from visionstyle.render.trails import TrailBuffer, synthetic_trajectory
from visionstyle.style.presets import list_presets
from visionstyle.style.schema import LabelStyle


def changed(a: np.ndarray, b: np.ndarray) -> float:
    return float((a != b).any(axis=2).mean())


# --------------------------------------------------------------------------- presets render
@pytest.mark.parametrize("name", [p.name for p in list_presets()])
def test_every_preset_renders(name, frame, detections):
    out = vs.annotate(frame, detections, style=name, synthetic_trails=True)
    assert out.shape == frame.shape and out.dtype == np.uint8
    assert changed(frame, out) > 0.005
    assert not np.shares_memory(out, frame)


def test_default_only_touches_box_regions(frame, detections):
    out = vs.annotate(frame, detections, style="default")
    diff = (out != frame).any(axis=2)
    # far corner without any detection should be untouched
    assert not diff[440:470, 5:20].any()
    assert diff.mean() < 0.15


def test_annotate_is_deterministic(frame, detections):
    s = vs.Style.preset("cinematic")
    a = vs.Annotator(s).annotate(frame, detections, t=0)
    b = vs.Annotator(s).annotate(frame, detections, t=0)
    assert np.array_equal(a, b)


def test_empty_and_none_detections(frame):
    assert np.array_equal(vs.annotate(frame, None), frame)
    assert np.array_equal(vs.annotate(frame, vs.Detections.empty()), frame)


def test_rgb_and_grayscale_inputs(frame, detections):
    out = vs.annotate(frame, detections, rgb=True)
    assert out.shape == frame.shape
    gray = frame.mean(axis=2).astype(np.uint8)
    out2 = vs.annotate(gray, detections)
    assert out2.shape == (480, 640, 3)


def test_copy_false_draws_in_place(frame, detections):
    img = frame.copy()
    out = vs.Annotator("default").annotate(img, detections, copy=False)
    assert np.shares_memory(out, img)
    assert not np.array_equal(img, frame)  # drawn into the caller's buffer


def test_confidence_threshold_hides(frame, detections):
    st = vs.Style().copy_with(confidence_threshold=0.99)
    assert np.array_equal(vs.annotate(frame, detections, style=st), frame)


def test_boxes_partially_outside_image_are_clipped(frame):
    d = vs.Detections(xyxy=[[-50, -50, 100, 100], [600, 400, 900, 900]], class_name=["a", "b"])
    out = vs.annotate(frame, d, style="neon")
    assert out.shape == frame.shape


def test_string_and_style_arguments(frame, detections):
    ann = vs.Annotator("minimal")
    assert ann.style.name == "minimal"
    ann2 = vs.Annotator(vs.Style.preset("hud"))
    assert ann2.style.name == "hud"
    assert vs.Annotator().style.name == "default"


# --------------------------------------------------------------------------- shape / style matrix
@pytest.mark.parametrize(
    ("shape", "pattern", "multicolor"),
    list(
        itertools.product(
            ["rectangle", "rounded", "corners", "reticle", "none"],
            ["solid", "dashed", "dotted"],
            ["none", "segments", "gradient"],
        )
    ),
)
def test_shape_pattern_matrix(frame, detections, shape, pattern, multicolor):
    st = vs.Style().copy_with(
        box={"shape": shape, "double_line": True, "center_mark": True},
        line={"pattern": pattern, "multicolor": multicolor, "animation": "march"},
    )
    out = vs.Annotator(st).annotate(frame, detections, t=0.7)
    assert changed(frame, out) > 0


@pytest.mark.parametrize("mode", ["solid", "gradient", "hatch"])
@pytest.mark.parametrize("direction", ["down", "up", "left", "right", "radial"])
def test_fill_modes(frame, detections, mode, direction):
    st = vs.Style().copy_with(
        fill={"enabled": True, "mode": mode, "gradient_direction": direction, "opacity": 0.5}
    )
    out = vs.annotate(frame, detections, style=st)
    # interior of the first box must have changed for a fill
    assert (out[200:300, 150:200] != frame[200:300, 150:200]).any()


def test_animation_changes_over_time(frame, detections):
    st = vs.Style().copy_with(line={"pattern": "dashed", "animation": "march", "speed": 2})
    ann = vs.Annotator(st)
    a = ann.annotate(frame, detections, t=0.0)
    b = ann.annotate(frame, detections, t=0.37)
    assert not np.array_equal(a, b)
    assert st.is_animated


def test_effects_render(frame, detections):
    st = vs.Style().copy_with(
        effects={
            "glow": {"enabled": True, "apply_to": "both"},
            "shadow": {"enabled": True},
            "glass": {"enabled": True, "apply_to": "both"},
            "grain": {"enabled": True},
            "vignette": {"enabled": True},
            "grade": {"enabled": True, "monochrome": True},
            "dim_outside": 0.5,
        }
    )
    out = vs.annotate(frame, detections, style=st)
    assert changed(frame, out) > 0.9  # whole-frame effects touch everything


def test_color_modes(frame, detections):
    for spec in ("palette", "confidence", "#00ff00"):
        st = vs.Style().copy_with(stroke={"color": spec}, fill={"enabled": True, "color": spec})
        vs.annotate(frame, detections, style=st)
    st = vs.Style().copy_with(palette={"by": "track"})
    ann = vs.Annotator(st)
    d0 = detections[0]
    c_track = ann.resolve_color("palette", d0, 0)
    st2 = vs.Style().copy_with(palette={"class_colors": {"person": "#123456"}})
    assert vs.Annotator(st2).resolve_color("palette", d0, 0) == (0x12, 0x34, 0x56)
    assert isinstance(c_track, tuple)


# --------------------------------------------------------------------------- labels
def test_compose_label_components():
    det = detections_one()
    st = LabelStyle(components=["track_id", "text", "confidence"], separator=" | ")
    assert compose_label(det, st) == "#3 | person | 0.93"
    st = LabelStyle(components=["confidence"], confidence_format="92%")
    assert compose_label(det, st) == "93%"
    st = LabelStyle(components=["custom"], custom_template="{name}:{conf:.1f}:{id}")
    assert compose_label(det, st) == "person:0.9:3"
    st = LabelStyle(components=["text"], uppercase=True)
    assert compose_label(det, st) == "PERSON"
    st = LabelStyle(components=[])
    assert compose_label(det, st) == ""


def test_format_confidence():
    assert format_confidence(0.926, "0.92") == "0.93"
    assert format_confidence(0.926, "92%") == "93%"
    assert format_confidence(0.926, "92") == "93"
    assert format_confidence(0.926, ".92") == ".93"


def detections_one():
    return vs.Detections(
        xyxy=[[100, 120, 260, 420]], class_name=["person"], confidence=[0.93], track_id=[3]
    )[0]


@pytest.mark.parametrize(
    "anchor",
    [
        "top_left",
        "top_center",
        "top_right",
        "bottom_left",
        "bottom_center",
        "bottom_right",
        "left",
        "right",
        "center",
    ],
)
@pytest.mark.parametrize("placement", ["outside", "inside"])
def test_place_tag_stays_inside_image(anchor, placement):
    st = LabelStyle(anchor=anchor, placement=placement)
    for box in [(100, 120, 260, 420), (0, 0, 40, 30), (600, 450, 640, 480), (-10, -10, 20, 20)]:
        tag = place_tag(box, 80, 22, st, 640, 480, 2)
        assert tag.x >= 0 and tag.x2 <= 640 + 1e-6
        assert tag.y >= 0 and tag.y2 <= 480 + 1e-6
        assert tag.vertical == (anchor in ("left", "right"))


def test_place_tag_outside_top_sits_above_box():
    tag = place_tag(
        (100, 120, 260, 420),
        80,
        22,
        LabelStyle(anchor="top_left", placement="outside"),
        640,
        480,
        2,
    )
    assert tag.y2 <= 120 and abs(tag.x - 99) < 1.5


def test_labels_render_all_anchors_and_backgrounds(frame, detections):
    for anchor in ("top_left", "left", "right", "bottom_center", "center"):
        for bg in ("none", "solid", "pill", "glass", "underline"):
            st = vs.Style().copy_with(
                label={
                    "anchor": anchor,
                    "background": bg,
                    "border": True,
                    "components": ["track_id", "text", "confidence"],
                }
            )
            out = vs.annotate(frame, detections, style=st)
            assert changed(frame, out) > 0


def test_label_truncation_and_min_confidence(frame):
    d = vs.Detections(
        xyxy=[[100, 100, 200, 200]],
        class_name=["a very long class name that goes on"],
        confidence=[0.3],
    )
    st = vs.Style().copy_with(label={"max_width_fraction": 0.1})
    vs.annotate(frame, d, style=st)
    st2 = vs.Style().copy_with(label={"min_confidence": 0.5}, stroke={"enabled": False})
    assert np.array_equal(vs.annotate(frame, d, style=st2), frame)


# --------------------------------------------------------------------------- trails
def test_trail_buffer_updates_and_prunes():
    buf = TrailBuffer(length=3, max_age=2)
    d = vs.Detections(xyxy=[[0, 0, 10, 10]], track_id=[1])
    for _ in range(5):
        buf.update(list(d))
    assert len(buf.tracks[1].points) == 3
    for _ in range(3):
        buf.update([])
    assert 1 not in buf.tracks
    buf.update(list(vs.Detections(xyxy=[[0, 0, 10, 10]])))  # no track id -> ignored
    assert not buf.tracks


def test_trail_anchor_points():
    det = vs.Detections(xyxy=[[0, 0, 10, 20]], track_id=[1])[0]
    assert TrailBuffer(anchor="center").anchor_point(det) == (5, 10)
    assert TrailBuffer(anchor="bottom_center").anchor_point(det) == (5, 20)
    assert TrailBuffer(anchor="top_center").anchor_point(det) == (5, 0)


def test_trail_smoothing_keeps_head():
    pts = [(float(i), float(i % 2)) for i in range(10)]
    sm = TrailBuffer.smooth(pts, 3)
    assert len(sm) == 10 and sm[-1] == pts[-1]
    assert TrailBuffer.smooth(pts, 1) == pts


def test_synthetic_trajectory_inside_image():
    det = vs.Detections(xyxy=[[600, 400, 640, 480]], track_id=[4])[0]
    pts = synthetic_trajectory(det, "bottom_center", 20, 640, 480)
    assert len(pts) == 20
    assert all(0 <= x <= 640 and 0 <= y <= 480 for x, y in pts)
    assert pts[-1] == (620, 480)


def test_trails_render_across_frames(frame):
    st = vs.Style.preset("tracking")
    ann = vs.Annotator(st)
    outs = []
    for i in range(6):
        d = vs.Detections(
            xyxy=[[100 + i * 20, 200, 160 + i * 20, 320]], class_name=["person"], track_id=[1]
        )
        outs.append(ann.annotate(frame, d))
    assert changed(outs[0], outs[-1]) > 0
    assert len(ann.trails.tracks[1].points) == 6
    ann.reset()
    assert not ann.trails.tracks and ann.frame_index == 0


@pytest.mark.parametrize("line", ["solid", "dotted", "dashed", "ribbon"])
def test_trail_line_styles(frame, detections, line):
    st = vs.Style().copy_with(
        trail={"enabled": True, "line": line, "glow": True, "show_points": True}
    )
    out = vs.annotate(frame, detections, style=st, synthetic_trails=True)
    assert changed(frame, out) > 0


# --------------------------------------------------------------------------- object scale
def _stroke_pixels(style: vs.Style, box: list[float], size=(1080, 1920)) -> int:
    """Count pixels the outline of one box changes on a flat frame (a proxy for line weight)."""
    frame = np.full((*size, 3), 90, np.uint8)
    dets = vs.Detections(xyxy=[box], class_id=[0], class_name=["x"])
    out = vs.annotate(frame, dets, style=style)
    return int((out != frame).any(axis=2).sum())


def _label_height(style: vs.Style, box: list[float], size=(1080, 1920)) -> int:
    """Height of the label tag drawn above an outside/top_left anchored box."""
    frame = np.full((*size, 3), 90, np.uint8)
    dets = vs.Detections(xyxy=[box], class_id=[0], class_name=["x"])
    out = vs.annotate(frame, dets, style=style)
    rows = (out[: int(box[1]) - 1] != frame[: int(box[1]) - 1]).any(axis=2).any(axis=1)
    return int(rows.sum())


def test_object_scale_factor_curve():
    kw = {"reference": 0.25, "strength": 0.5, "min_factor": 0.6, "max_factor": 1.8}
    # a box exactly at the reference size renders at 1x
    assert object_scale_factor(480, 270, 1920, 1080, **kw) == pytest.approx(1.0)
    small = object_scale_factor(60, 60, 1920, 1080, **kw)
    big = object_scale_factor(1500, 900, 1920, 1080, **kw)
    assert 0.6 <= small < 1.0 < big <= 1.8
    # clamps hold at the extremes
    assert object_scale_factor(2, 2, 1920, 1080, **kw) == 0.6
    assert (
        object_scale_factor(
            1920, 1080, 1920, 1080, reference=0.05, strength=1, min_factor=0.6, max_factor=1.8
        )
        == 1.8
    )
    # strength 0 disables the curve entirely
    assert (
        object_scale_factor(
            2, 2, 1920, 1080, reference=0.25, strength=0, min_factor=0.6, max_factor=1.8
        )
        == 1.0
    )
    # shape does not matter, only area
    assert object_scale_factor(400, 100, 1920, 1080, **kw) == pytest.approx(
        object_scale_factor(200, 200, 1920, 1080, **kw)
    )


def test_object_scale_is_on_by_default():
    assert vs.Style().object_scale.enabled is True
    assert vs.Style().object_scale.apply_to == "both"


def test_object_scale_thins_small_boxes_and_thickens_large_ones():
    base = vs.Style().copy_with(label={"enabled": False}, stroke={"thickness": 4})
    off = base.copy_with(object_scale={"enabled": False})
    small = [100, 100, 160, 160]
    large = [200, 100, 1700, 1000]
    # small box: fewer changed pixels than the constant-size render; large box: more
    assert _stroke_pixels(base, small) < _stroke_pixels(off, small)
    assert _stroke_pixels(base, large) > _stroke_pixels(off, large)


def test_object_scale_scales_label_text():
    base = vs.Style().copy_with(
        stroke={"enabled": False}, label={"components": ["text"], "anchor": "top_left"}
    )
    off = base.copy_with(object_scale={"enabled": False})
    small = [100, 200, 160, 260]
    large = [200, 400, 1700, 1000]
    assert _label_height(base, small) < _label_height(off, small)
    assert _label_height(base, large) > _label_height(off, large)


def test_object_scale_apply_to_limits_effect():
    small = [100, 200, 160, 260]
    off = vs.Style().copy_with(object_scale={"enabled": False})
    box_only = vs.Style().copy_with(object_scale={"apply_to": "box"})
    label_only = vs.Style().copy_with(object_scale={"apply_to": "label"})
    # label-only leaves the outline identical to the constant-size render
    no_label = {"label": {"enabled": False}}
    assert _stroke_pixels(label_only.copy_with(**no_label), small) == _stroke_pixels(
        off.copy_with(**no_label), small
    )
    assert _stroke_pixels(box_only.copy_with(**no_label), small) < _stroke_pixels(
        off.copy_with(**no_label), small
    )
    # box-only leaves the tag identical
    no_stroke = {"stroke": {"enabled": False}}
    assert _label_height(box_only.copy_with(**no_stroke), small) == _label_height(
        off.copy_with(**no_stroke), small
    )
    assert _label_height(label_only.copy_with(**no_stroke), small) < _label_height(
        off.copy_with(**no_stroke), small
    )


def test_object_scale_validation():
    s = vs.Style().copy_with(object_scale={"min_factor": 1.0, "max_factor": 1.0})
    assert s.object_scale.min_factor == s.object_scale.max_factor == 1.0
    with pytest.raises(ValueError):
        vs.Style().copy_with(object_scale={"strength": 2})
    with pytest.raises(ValueError):
        vs.Style().copy_with(object_scale={"apply_to": "stroke"})


# --------------------------------------------------------------------------- primitives
def test_scale_factor():
    assert scale_factor(1920, 1080, "auto") == pytest.approx(1.0)
    assert scale_factor(640, 480, "auto") >= 0.4
    assert scale_factor(3840, 2160, "auto") > 1.3
    assert scale_factor(10, 10, 2.5) == 2.5


def test_layer_paint_and_composite():
    layer = Layer(10, 10)
    roi = layer.roi(0, 0, 10, 10)
    mask = layer.blank_mask(roi)
    mask[2:4, 2:4] = 255
    layer.paint(mask, (255, 0, 0), 0.5, roi)
    frame = np.zeros((10, 10, 3), np.uint8)
    out = layer.composite(frame)
    assert out[2, 2].tolist() == [0, 0, 128]  # BGR: red at 50%
    assert out[0, 0].tolist() == [0, 0, 0]
    assert not layer.is_empty()


def test_path_helpers():
    rect = shapes.rect_path(0, 0, 10, 10)
    assert shapes.path_length(rect) == pytest.approx(40)
    dashes = shapes.split_dashes(rect, 5, 5)
    assert len(dashes) == 4
    assert len(shapes.sample_points(rect, 10)) == 4
    assert len(shapes.split_even(rect, 8)) == 8
    rr = shapes.rounded_rect_path(0, 0, 100, 50, 10)
    assert rr[0] == rr[-1] and len(rr) > 20
    assert shapes.rounded_rect_path(0, 0, 10, 10, 0) == shapes.rect_path(0, 0, 10, 10)
    assert len(shapes.corner_paths(0, 0, 100, 100, 20)) == 4
    assert len(shapes.corner_paths(0, 0, 100, 100, 20, curve_radius=8)[0]) > 3
    assert len(shapes.reticle_paths(0, 0, 100, 100, 10)) == 4
