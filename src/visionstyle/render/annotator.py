"""``Annotator`` - renders a :class:`Style` onto frames."""

from __future__ import annotations

import math
from collections.abc import Sequence
from typing import Any

import cv2
import numpy as np
import numpy.typing as npt

from visionstyle.color import (
    RGB,
    confidence_color,
    contrast_text_color,
    luminance,
    palette_colors,
    parse_color,
    shift_hue,
)
from visionstyle.detections import Detection, Detections
from visionstyle.render import shapes
from visionstyle.render.canvas import ROI, Layer, gaussian, object_scale_factor, scale_factor
from visionstyle.render.effects import (
    apply_grade,
    apply_grain,
    apply_spotlight,
    apply_vignette,
    paint_glass,
)
from visionstyle.render.labels import compose_label, place_tag
from visionstyle.render.text import load_font, measure, render_text_mask
from visionstyle.render.trails import TrailBuffer, synthetic_trajectory
from visionstyle.style.schema import LinePattern, Style

U8 = npt.NDArray[np.uint8]
F32 = npt.NDArray[np.float32]
Box = tuple[float, float, float, float]


class Annotator:
    """Stateful renderer. Keep one instance per video stream so tracking trails and animations
    carry across frames; for single images the state is harmless.

    >>> ann = Annotator("cinematic")
    >>> out = ann.annotate(frame, detections)
    """

    def __init__(self, style: Style | str | None = None) -> None:
        if style is None:
            style = Style.preset("default")
        elif isinstance(style, str):
            style = Style.preset(style)
        self.style: Style = style
        self.frame_index = 0
        self.trails = TrailBuffer(style.trail.length, style.trail.max_age, style.trail.anchor)
        self._palette: list[RGB] = []
        self._palette_key: Any = None

    # ------------------------------------------------------------------ public API
    def reset(self) -> None:
        """Forget trail history and restart animation time."""
        self.frame_index = 0
        self.trails.clear()

    def annotate(
        self,
        image: U8,
        detections: Detections | Sequence[Detection] | None,
        *,
        t: float | None = None,
        copy: bool = True,
        rgb: bool = False,
        synthetic_trails: bool = False,
    ) -> U8:
        """Draw ``detections`` on ``image`` and return the annotated frame.

        Parameters
        ----------
        image: ``(H, W, 3)`` uint8 frame, BGR unless ``rgb=True``.
        detections: a :class:`Detections` (or list of :class:`Detection`).
        t: animation time in seconds; defaults to ``frame_index / style.fps``.
        copy: return a new array (True) or draw in place when possible.
        rgb: treat the input (and output) as RGB instead of BGR.
        synthetic_trails: seed fake trajectories so trails show on a still image (Studio preview).
        """
        if image.ndim == 2:
            image = np.asarray(cv2.cvtColor(image, cv2.COLOR_GRAY2BGR), np.uint8)
        elif image.shape[2] == 4:
            image = image[..., :3]
        if image.dtype != np.uint8:
            image = np.clip(image, 0, 255).astype(np.uint8)
        frame = image[..., ::-1] if rgb else image
        frame = np.ascontiguousarray(frame) if (copy or rgb) else frame

        style = self.style
        h, w = frame.shape[:2]
        s = scale_factor(w, h, style.scale)
        time = self.frame_index / style.fps if t is None else t

        dets = self._as_list(detections)
        if style.confidence_threshold > 0:
            dets = [
                d
                for d in dets
                if d.confidence is None or d.confidence >= style.confidence_threshold
            ]

        self.trails.configure(style.trail.length, style.trail.max_age, style.trail.anchor)
        if style.trail.enabled:
            if synthetic_trails:
                self._seed_synthetic_trails(dets, w, h)
            else:
                self.trails.update(dets)

        base = self._prepare_base(frame, dets, s)
        layer = Layer(h, w)

        if style.trail.enabled:
            self._draw_trails(layer, s)
        for i, det in enumerate(dets):
            self._draw_detection(layer, base, det, i, s, time)

        in_place = not copy and not rgb and image.dtype == np.uint8 and image.ndim == 3
        out = base if layer.is_empty() else layer.composite(base, out=image if in_place else None)
        if style.effects.grain.enabled:
            out = apply_grain(out, style.effects.grain, self.frame_index)
        self.frame_index += 1
        if in_place and out is not image:
            image[...] = out
            out = image
        return np.ascontiguousarray(out[..., ::-1]) if rgb else out

    __call__ = annotate

    # ------------------------------------------------------------------ frame-level
    def _prepare_base(self, frame: U8, dets: list[Detection], s: float) -> U8:
        fx = self.style.effects
        base = frame
        if fx.grade.enabled:
            base = apply_grade(base, fx.grade)
        if fx.dim_outside > 0 and dets:
            base = apply_spotlight(base, [d.xyxy for d in dets], fx.dim_outside, 18 * s)
        if fx.vignette.enabled:
            base = apply_vignette(base, fx.vignette)
        return base

    @staticmethod
    def _as_list(detections: Detections | Sequence[Detection] | None) -> list[Detection]:
        if detections is None:
            return []
        return list(detections)

    def _seed_synthetic_trails(self, dets: list[Detection], w: int, h: int) -> None:
        self.trails.clear()
        for i, det in enumerate(dets):
            tid = det.track_id if det.track_id is not None else i + 1
            pts = synthetic_trajectory(
                det, self.style.trail.anchor, self.style.trail.length, w, h, seed=i
            )
            self.trails.seed(tid, pts, det)

    # ------------------------------------------------------------------ color
    def _palette_list(self) -> list[RGB]:
        key = (
            self.style.palette.colors
            if isinstance(self.style.palette.colors, str)
            else tuple(self.style.palette.colors)
        )
        if key != self._palette_key:
            self._palette = palette_colors(self.style.palette.colors)
            self._palette_key = key
        return self._palette

    def _palette_color(self, det: Detection, index: int) -> RGB:
        pal = self.style.palette
        overrides = pal.class_colors
        if overrides:
            for key in (det.class_name, None if det.class_id is None else str(det.class_id)):
                if key is not None and key in overrides:
                    return parse_color(overrides[key])
        colors = self._palette_list()
        if pal.by == "single":
            return colors[0]
        if pal.by == "track" and det.track_id is not None:
            return colors[det.track_id % len(colors)]
        if det.class_id is not None:
            return colors[det.class_id % len(colors)]
        if det.class_name:
            return colors[sum(map(ord, det.class_name)) % len(colors)]
        return colors[index % len(colors)]

    def resolve_color(
        self, spec: str, det: Detection, index: int, inherit: RGB | None = None
    ) -> RGB:
        if spec == "palette":
            return self._palette_color(det, index)
        if spec == "confidence":
            return confidence_color(det.confidence if det.confidence is not None else 1.0)
        if spec in ("inherit", "auto"):
            return inherit if inherit is not None else self._palette_color(det, index)
        return parse_color(spec)

    # ------------------------------------------------------------------ per detection
    def _draw_detection(
        self, layer: Layer, base: U8, det: Detection, index: int, s: float, time: float
    ) -> None:
        st = self.style
        h, w = base.shape[:2]
        x1, y1, x2, y2 = det.xyxy
        x1, x2 = sorted((max(0.0, min(w, x1)), max(0.0, min(w, x2))))
        y1, y2 = sorted((max(0.0, min(h, y1)), max(0.0, min(h, y2))))
        if x2 - x1 < 1 or y2 - y1 < 1:
            return
        box: Box = (x1, y1, x2, y2)
        color = self.resolve_color(st.stroke.color, det, index)
        # per-object scale: small boxes get lighter strokes/tags, big boxes heavier ones
        s_box, s_label = self._object_scales(box, w, h, s)
        thickness = max(0.75, st.stroke.thickness * s_box)

        outline = self._outline_paths(box, s_box)
        pad = thickness * 2 + 6
        if st.effects.glow.enabled:
            pad += st.effects.glow.radius * s * 2
        if st.effects.shadow.enabled:
            pad += (
                (
                    st.effects.shadow.blur
                    + max(abs(st.effects.shadow.offset_x), abs(st.effects.shadow.offset_y))
                )
                * s
                * 1.5
            )
        roi = layer.roi(x1, y1, x2, y2, pad)
        if roi.empty:
            return

        # --- fill (+ glass) ---------------------------------------------------------
        if st.fill.enabled or (st.effects.glass.enabled and st.effects.glass.apply_to != "label"):
            self._draw_fill(layer, base, box, det, index, color, s, roi, s_box)

        # --- shadow -----------------------------------------------------------------
        if st.effects.shadow.enabled and st.stroke.enabled and outline:
            self._draw_shadow(layer, outline, thickness, s, roi)

        # --- stroke (+ glow) ---------------------------------------------------------
        if st.stroke.enabled and outline:
            opacity = st.stroke.opacity
            if st.line.animation == "pulse":
                opacity *= 0.62 + 0.38 * (0.5 + 0.5 * math.sin(2 * math.pi * time * st.line.speed))
            union = self._stroke_paths(
                layer, outline, color, thickness, opacity, roi, st.line, s, time
            )
            if st.box.shape == "reticle":
                faint = shapes.rect_path(*box)
                self._stroke_paths(
                    layer,
                    [faint],
                    color,
                    max(0.75, thickness * 0.6),
                    opacity * 0.35,
                    roi,
                    LinePattern(),
                    s,
                    time,
                )
            if st.box.double_line and st.box.shape in ("rectangle", "rounded", "corners"):
                inset = st.box.double_gap * s_box + thickness
                ib = shapes.inset_box(x1, y1, x2, y2, inset)
                if ib[2] - ib[0] > 2 and ib[3] - ib[1] > 2:
                    inner = self._outline_paths(ib, s_box)
                    self._stroke_paths(
                        layer,
                        inner,
                        color,
                        max(0.75, thickness * 0.6),
                        opacity * st.box.double_opacity,
                        roi,
                        st.line,
                        s,
                        time,
                    )
            if st.box.center_mark:
                cx, cy = det.center
                cross = shapes.center_cross_paths(cx, cy, 5 * s_box)
                self._stroke_paths(
                    layer,
                    cross,
                    color,
                    max(0.75, thickness * 0.7),
                    opacity,
                    roi,
                    LinePattern(),
                    s,
                    time,
                )
            if st.effects.glow.enabled and st.effects.glow.apply_to in ("stroke", "both"):
                glow_color = self.resolve_color(st.effects.glow.color, det, index, inherit=color)
                self._paint_glow(layer, union, glow_color, s, roi)

        # --- label ------------------------------------------------------------------
        if st.label.enabled:
            self._draw_label(layer, base, det, index, box, color, thickness, s_label)

    def _object_scales(self, box: Box, w: int, h: int, s: float) -> tuple[float, float]:
        """Return ``(box_scale, label_scale)``: the frame scale ``s`` multiplied by the
        per-object factor for whichever parts ``object_scale.apply_to`` selects."""
        os_ = self.style.object_scale
        if not os_.enabled:
            return s, s
        k = object_scale_factor(
            box[2] - box[0],
            box[3] - box[1],
            w,
            h,
            reference=os_.reference,
            strength=os_.strength,
            min_factor=os_.min_factor,
            max_factor=os_.max_factor,
        )
        s_box = s * k if os_.apply_to in ("both", "box") else s
        s_label = s * k if os_.apply_to in ("both", "label") else s
        return s_box, s_label

    def _outline_paths(self, box: Box, s: float) -> list[shapes.Path]:
        b = self.style.box
        x1, y1, x2, y2 = box
        if b.shape == "rectangle":
            return [shapes.rect_path(x1, y1, x2, y2)]
        if b.shape == "rounded":
            return [shapes.rounded_rect_path(x1, y1, x2, y2, b.corner_radius * s)]
        if b.shape == "corners":
            length = (
                b.corner_length * min(x2 - x1, y2 - y1)
                if b.corner_length <= 1
                else b.corner_length * s
            )
            curve = b.corner_radius * s if b.corner_curve else 0.0
            return shapes.corner_paths(x1, y1, x2, y2, length, curve)
        if b.shape == "reticle":
            return shapes.reticle_paths(x1, y1, x2, y2, b.reticle_length * s)
        return []

    def _region_path(self, box: Box, s: float) -> shapes.Path:
        x1, y1, x2, y2 = box
        if self.style.box.shape == "rounded":
            return shapes.rounded_rect_path(x1, y1, x2, y2, self.style.box.corner_radius * s)
        return shapes.rect_path(x1, y1, x2, y2)

    # ------------------------------------------------------------------ stroke rasterising
    def _stroke_paths(
        self,
        layer: Layer,
        paths: list[shapes.Path],
        color: RGB,
        thickness: float,
        opacity: float,
        roi: ROI,
        line: LinePattern,
        s: float,
        time: float,
    ) -> U8:
        """Rasterise ``paths`` with the line pattern. Returns the union mask (for glow)."""
        union = layer.blank_mask(roi)
        if opacity <= 0:
            return union
        phase = time * line.speed * 40 * s if line.animation == "march" else 0.0
        hue = (time * line.speed * 60) % 360 if line.animation == "hue_cycle" else 0.0
        seg_colors = [parse_color(c) for c in line.segment_colors]
        multicolor = line.multicolor != "none"

        pieces: list[tuple[shapes.Path | tuple[float, float], RGB]] = []
        for path in paths:
            if line.pattern == "dashed":
                dashes = shapes.split_dashes(path, line.dash_length * s, line.gap_length * s, phase)
                for i, d in enumerate(dashes):
                    pieces.append(
                        (
                            d,
                            shapes.segment_color(
                                color, i, len(dashes), line.multicolor, seg_colors, hue
                            ),
                        )
                    )
            elif line.pattern == "dotted":
                spacing = (line.dot_radius * 2 + line.gap_length) * s
                pts = shapes.sample_points(path, spacing, phase)
                for i, p in enumerate(pts):
                    pieces.append(
                        (
                            p,
                            shapes.segment_color(
                                color, i, len(pts), line.multicolor, seg_colors, hue
                            ),
                        )
                    )
            elif multicolor:
                n = 48 if line.multicolor == "gradient" else max(4, len(seg_colors) * 4)
                parts = shapes.split_even(path, n)
                for i, part in enumerate(parts):
                    pieces.append(
                        (
                            part,
                            shapes.segment_color(
                                color,
                                i,
                                n,
                                line.multicolor,
                                seg_colors,
                                hue + (time * line.speed * 90 if line.animation == "march" else 0),
                            ),
                        )
                    )
            else:
                pieces.append((path, shift_hue(color, hue) if hue else color))

        # group by color so each color is one paint
        groups: dict[RGB, U8] = {}
        dot_r = line.dot_radius * s if line.pattern == "dotted" else 0.0
        for geom, c in pieces:
            m = groups.get(c)
            if m is None:
                m = groups[c] = layer.blank_mask(roi)
            if isinstance(geom, tuple) and len(geom) == 2 and not isinstance(geom[0], tuple):
                shapes.draw_dot(m, geom, max(dot_r, thickness / 2), roi.x0, roi.y0)  # type: ignore[arg-type]
            else:
                shapes.draw_polyline(m, geom, thickness, roi.x0, roi.y0)  # type: ignore[arg-type]
        for c, m in groups.items():
            layer.paint(m, c, opacity, roi)
            np.maximum(union, m, out=union)
        return union

    def _paint_glow(self, layer: Layer, mask: U8, color: RGB, s: float, roi: ROI) -> None:
        g = self.style.effects.glow
        radius = max(1.0, g.radius * s)
        soft = gaussian(mask, radius) / 255.0
        # normalise so thin strokes still produce a visible halo
        peak = float(soft.max()) if soft.size else 0.0
        if peak > 0:
            soft = soft / peak
        tight = gaussian(mask, radius / 3) / 255.0
        halo = np.clip(soft * (g.intensity * 0.9) + tight * (g.intensity * 0.5), 0, 1)
        layer.paint(halo.astype(np.float32), color, 1.0, roi)

    def _draw_shadow(
        self, layer: Layer, paths: list[shapes.Path], thickness: float, s: float, roi: ROI
    ) -> None:
        sh = self.style.effects.shadow
        ox, oy = sh.offset_x * s, sh.offset_y * s
        mask = layer.blank_mask(roi)
        for p in paths:
            shapes.draw_polyline(mask, [(x + ox, y + oy) for x, y in p], thickness, roi.x0, roi.y0)
        soft = (
            gaussian(mask, sh.blur * s) / 255.0 if sh.blur > 0 else mask.astype(np.float32) / 255.0
        )
        layer.paint(soft.astype(np.float32), parse_color(sh.color), sh.opacity, roi)

    # ------------------------------------------------------------------ fill
    def _draw_fill(
        self,
        layer: Layer,
        base: U8,
        box: Box,
        det: Detection,
        index: int,
        color: RGB,
        s: float,
        roi: ROI,
        s_box: float,
    ) -> None:
        st = self.style
        region = self._region_path(box, s_box)
        mask = layer.blank_mask(roi)
        shapes.fill_polygon(mask, region, roi.x0, roi.y0)
        glass = st.effects.glass
        if glass.enabled and glass.apply_to in ("fill", "both"):
            tint = self.resolve_color(glass.tint, det, index, inherit=color)
            paint_glass(layer, base, mask, roi, glass, glass.blur * s, tint)
        if not st.fill.enabled or st.fill.opacity <= 0:
            return
        fill_color = self.resolve_color(st.fill.color, det, index, inherit=color)
        alpha = mask.astype(np.float32) / 255.0
        x1, y1, x2, y2 = box
        if st.fill.mode == "gradient":
            alpha *= self._gradient_ramp(
                roi, box, st.fill.gradient_direction, st.fill.gradient_start, st.fill.gradient_end
            )
        elif st.fill.mode == "hatch":
            hatch = layer.blank_mask(roi)
            spacing = max(2.0, st.fill.hatch_spacing * s)
            ang = math.radians(st.fill.hatch_angle)
            dx, dy = math.cos(ang), math.sin(ang)
            nx, ny = -dy, dx
            diag = math.hypot(roi.width, roi.height)
            cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
            k = int(diag / spacing) + 2
            for i in range(-k, k + 1):
                px, py = cx + nx * i * spacing, cy + ny * i * spacing
                line = [(px - dx * diag, py - dy * diag), (px + dx * diag, py + dy * diag)]
                shapes.draw_polyline(
                    hatch, line, max(0.75, st.fill.hatch_thickness * s), roi.x0, roi.y0
                )
            alpha *= hatch.astype(np.float32) / 255.0
        layer.paint(alpha.astype(np.float32), fill_color, st.fill.opacity, roi)

    @staticmethod
    def _gradient_ramp(roi: ROI, box: Box, direction: str, start: float, end: float) -> F32:
        x1, y1, x2, y2 = box
        ys = np.arange(roi.y0, roi.y1, dtype=np.float32)[:, None] + 0.5
        xs = np.arange(roi.x0, roi.x1, dtype=np.float32)[None, :] + 0.5
        if direction in ("down", "up"):
            t = (ys - y1) / max(1.0, y2 - y1)
            t = np.broadcast_to(t, (roi.height, roi.width))
            if direction == "up":
                t = 1 - t
        elif direction in ("left", "right"):
            t = (xs - x1) / max(1.0, x2 - x1)
            t = np.broadcast_to(t, (roi.height, roi.width))
            if direction == "left":
                t = 1 - t
        else:  # radial
            cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
            t = np.sqrt(
                ((xs - cx) / max(1.0, (x2 - x1) / 2)) ** 2
                + ((ys - cy) / max(1.0, (y2 - y1) / 2)) ** 2
            )
        t = np.clip(t, 0, 1).astype(np.float32)
        return (start + (end - start) * t).astype(np.float32)

    # ------------------------------------------------------------------ label
    def _draw_label(
        self,
        layer: Layer,
        base: U8,
        det: Detection,
        index: int,
        box: Box,
        color: RGB,
        stroke_px: float,
        s: float,
    ) -> None:
        ls = self.style.label
        if det.confidence is not None and det.confidence < ls.min_confidence:
            return
        text = compose_label(det, ls)
        if not text:
            return
        h, w = base.shape[:2]
        font_px = max(8, round(ls.font_size * s))
        font = load_font(ls.font, font_px, ls.font_weight)
        tw, th, _ = measure(text, font)
        if ls.max_width_fraction > 0 and tw > w * ls.max_width_fraction:
            while len(text) > 3 and tw > w * ls.max_width_fraction:
                text = text[:-2].rstrip() + "…"
                tw, th, _ = measure(text, font)
        px, py = ls.padding_x * s, ls.padding_y * s
        if ls.background == "none":
            px, py = px * 0.4, py * 0.4
        tag_w, tag_h = tw + 2 * px, th + 2 * py
        stroke_for_tag = stroke_px if self.style.stroke.enabled else 0.0
        tag = place_tag(box, tag_w, tag_h, ls, w, h, stroke_for_tag)

        # build tag in its own (unrotated) frame, then rotate for vertical tags
        tw_i, th_i = math.ceil(tag_w), math.ceil(tag_h)
        bg = np.zeros((th_i, tw_i), np.uint8)
        radius = (tag_h / 2) if ls.background == "pill" else ls.radius * s
        rect = (
            shapes.rounded_rect_path(0.5, 0.5, tag_w - 0.5, tag_h - 0.5, radius)
            if radius > 0.5
            else shapes.rect_path(0, 0, tag_w, tag_h)
        )
        if ls.background in ("solid", "pill", "glass"):
            shapes.fill_polygon(bg, rect, 0, 0)
        elif ls.background == "underline":
            shapes.draw_polyline(bg, [(0, tag_h - 1), (tag_w, tag_h - 1)], max(1.0, 1.5 * s), 0, 0)

        text_mask_full = render_text_mask(text, font, pad=2)
        txt = np.zeros((th_i, tw_i), np.uint8)
        ox, oy = round(px) - 2, round(py) - 2
        self._blit_max(txt, text_mask_full, ox, oy)

        if tag.vertical:
            k = 1 if ls.anchor == "left" else -1  # left: read bottom→top; right: top→bottom
            bg, txt = np.rot90(bg, k), np.rot90(txt, k)
        roi = layer.roi(tag.x, tag.y, tag.x + bg.shape[1], tag.y + bg.shape[0], pad=8 * s + 4)
        if roi.empty:
            return
        bg_full = layer.blank_mask(roi)
        txt_full = layer.blank_mask(roi)
        bx, by = round(tag.x) - roi.x0, round(tag.y) - roi.y0
        self._blit_max(bg_full, bg, bx, by)
        self._blit_max(txt_full, txt, bx, by)

        bg_color = self.resolve_color(ls.background_color, det, index, inherit=color)
        fx = self.style.effects
        if fx.shadow.enabled and ls.background != "none":
            soft = (
                gaussian(
                    np.roll(
                        bg_full, (int(fx.shadow.offset_y * s), int(fx.shadow.offset_x * s)), (0, 1)
                    ),
                    fx.shadow.blur * s,
                )
                / 255.0
            )
            layer.paint(
                soft.astype(np.float32), parse_color(fx.shadow.color), fx.shadow.opacity * 0.8, roi
            )
        if fx.glow.enabled and fx.glow.apply_to in ("label", "both") and ls.background != "none":
            glow_color = self.resolve_color(fx.glow.color, det, index, inherit=color)
            self._paint_glow(layer, bg_full, glow_color, s, roi)

        if ls.background == "glass" or (
            fx.glass.enabled
            and fx.glass.apply_to in ("label", "both")
            and ls.background in ("solid", "pill")
        ):
            glass = (
                fx.glass
                if fx.glass.enabled
                else fx.glass.model_copy(
                    update={"tint": "#ffffff", "tint_opacity": 0.22, "blur": 10, "brighten": 0.06}
                )
            )
            tint = self.resolve_color(glass.tint, det, index, inherit=color)
            paint_glass(layer, base, bg_full, roi, glass, glass.blur * s, tint)
            if ls.background != "glass":
                layer.paint(bg_full, bg_color, ls.background_opacity * 0.55, roi)
        elif ls.background in ("solid", "pill", "underline"):
            layer.paint(bg_full, bg_color, ls.background_opacity, roi)

        if ls.border and ls.background in ("solid", "pill", "glass"):
            edge = layer.blank_mask(roi)
            outline = np.zeros((th_i, tw_i), np.uint8)
            shapes.draw_polyline(outline, rect, max(1.0, 1.2 * s), 0, 0)
            if tag.vertical:
                outline = np.rot90(outline, 1 if ls.anchor == "left" else -1)
            self._blit_max(edge, outline, bx, by)
            layer.paint(edge, color, 0.9, roi)

        text_color = self._text_color(
            ls.text_color,
            ls.background,
            bg_color,
            color,
            base,
            tag,
            det,
            index,
            ls.background_opacity,
        )
        if ls.background in ("none", "underline") and fx.shadow.enabled:
            soft = gaussian(txt_full, 2.5 * s) / 255.0
            layer.paint(np.clip(soft * 1.4, 0, 1).astype(np.float32), (0, 0, 0), 0.6, roi)
        layer.paint(txt_full, text_color, 1.0, roi)

    def _text_color(
        self,
        spec: str,
        background: str,
        bg_color: RGB,
        box_color: RGB,
        base: U8,
        tag: Any,
        det: Detection,
        index: int,
        bg_opacity: float,
    ) -> RGB:
        if spec == "inherit":
            return box_color
        if spec != "auto":
            return parse_color(spec)
        if background in ("solid", "pill") and bg_opacity >= 0.5:
            return contrast_text_color(bg_color)
        # transparent / glass / none: judge the frame under the tag
        x0, y0 = int(max(0, tag.x)), int(max(0, tag.y))
        x1, y1 = int(min(base.shape[1], tag.x2)), int(min(base.shape[0], tag.y2))
        if x1 > x0 and y1 > y0:
            patch = base[y0:y1, x0:x1].reshape(-1, 3).mean(axis=0)
            lum = luminance((int(patch[2]), int(patch[1]), int(patch[0])))
            if background == "glass":
                lum = lum * 0.7 + 0.25  # glass brightens the region
            return (14, 15, 14) if lum > 0.55 else (247, 245, 240)
        return (247, 245, 240)

    @staticmethod
    def _blit_max(dst: U8, src: U8, x: int, y: int) -> None:
        h, w = src.shape
        dx0, dy0 = max(0, x), max(0, y)
        dx1, dy1 = min(dst.shape[1], x + w), min(dst.shape[0], y + h)
        if dx1 <= dx0 or dy1 <= dy0:
            return
        sx0, sy0 = dx0 - x, dy0 - y
        region = dst[dy0:dy1, dx0:dx1]
        np.maximum(region, src[sy0 : sy0 + (dy1 - dy0), sx0 : sx0 + (dx1 - dx0)], out=region)

    # ------------------------------------------------------------------ trails
    def _draw_trails(self, layer: Layer, s: float) -> None:
        ts = self.style.trail
        for tid, track in self.trails.tracks.items():
            pts = list(track.points)
            if len(pts) < 2:
                continue
            pts = TrailBuffer.smooth(pts, ts.smoothing)
            fake = Detection((0, 0, 1, 1), track.class_id, track.class_name, None, tid)
            color = self.resolve_color(ts.color, fake, tid, inherit=self._palette_color(fake, tid))
            xs, ys = zip(*pts, strict=True)
            thick = max(0.75, ts.thickness * s)
            roi = layer.roi(
                min(xs), min(ys), max(xs), max(ys), pad=thick * 3 + (14 * s if ts.glow else 4)
            )
            if roi.empty:
                continue
            n = len(pts) - 1
            union = layer.blank_mask(roi)
            # accumulate each segment's faded alpha into one float mask, then paint once
            acc = np.zeros((roi.height, roi.width), np.float32)
            if ts.line == "dotted":
                for i, p in enumerate(pts):
                    age = 1 - i / max(1, n)
                    a = ts.opacity * ((1 - age * 0.85) if ts.fade_opacity else 1)
                    r = max(
                        0.75, ts.point_radius * s * ((1 - age * 0.6) if ts.fade_thickness else 1)
                    )
                    m = layer.blank_mask(roi)
                    shapes.draw_dot(m, p, r, roi.x0, roi.y0)
                    np.maximum(acc, m.astype(np.float32) * np.float32(a / 255.0), out=acc)
                    np.maximum(union, m, out=union)
            else:
                buckets = 12 if ts.fade_opacity or ts.fade_thickness else 1
                per = max(1, math.ceil(n / buckets))
                for b0 in range(0, n, per):
                    b1 = min(n, b0 + per)
                    seg = pts[b0 : b1 + 1]
                    age = 1 - (b1 / n)  # 0 = newest
                    a = ts.opacity * ((1 - age * 0.9) if ts.fade_opacity else 1)
                    t_px = thick * ((1 - age * 0.75) if ts.fade_thickness else 1)
                    if ts.line == "ribbon":
                        t_px = thick * (1.6 - age * 1.3)
                    m = layer.blank_mask(roi)
                    if ts.line == "dashed":
                        for d in shapes.split_dashes(seg, ts.dash_length * s, ts.gap_length * s):
                            shapes.draw_polyline(m, d, t_px, roi.x0, roi.y0)
                    else:
                        shapes.draw_polyline(m, seg, t_px, roi.x0, roi.y0)
                    np.maximum(acc, m.astype(np.float32) * np.float32(a / 255.0), out=acc)
                    np.maximum(union, m, out=union)
            layer.paint(acc, color, 1.0, roi)
            if ts.show_points and ts.line != "dotted":
                m = layer.blank_mask(roi)
                for p in pts:
                    shapes.draw_dot(m, p, ts.point_radius * s, roi.x0, roi.y0)
                layer.paint(m, color, ts.opacity, roi)
            if ts.glow:
                soft = gaussian(union, 7 * s) / 255.0
                layer.paint(np.clip(soft * 1.2, 0, 1).astype(np.float32), color, 0.6, roi)


def annotate(
    image: U8,
    detections: Detections | Sequence[Detection] | None,
    style: Style | str | None = None,
    **kwargs: Any,
) -> U8:
    """Stateless one-liner: ``annotate(frame, dets, style="cinematic")``."""
    return Annotator(style).annotate(image, detections, **kwargs)
