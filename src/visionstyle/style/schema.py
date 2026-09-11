"""The ``Style`` schema - the single source of truth for every visual option.

Every section the Studio exposes is a sub-model here. Sizes (thickness, radius, font size,
padding, ...) are expressed in *reference pixels* at roughly 1080p and multiplied by the
resolved scale factor at render time, so one style looks the same on a 640px webcam frame
and a 4K photo.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Literal

import yaml
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from visionstyle.color import PALETTES, parse_color

SCHEMA_VERSION = 1

# ----------------------------------------------------------------------------- color specs
_SPECIAL_COLORS = {"palette", "confidence", "inherit", "auto", "none"}


def _validate_color(value: str, allowed_specials: set[str]) -> str:
    text = value.strip().lower()
    if text in allowed_specials:
        return text
    if text in _SPECIAL_COLORS:
        raise ValueError(f"{value!r} is not allowed here; use one of {sorted(allowed_specials)}")
    parse_color(text)  # raises on garbage
    return text


def _color_field(allowed: set[str], default: str, description: str) -> Any:
    extra: dict[str, Any] = {"format": "color", "specials": sorted(allowed)}
    return Field(
        default,
        description=description,
        json_schema_extra=extra,
    )


class _Model(BaseModel):
    model_config = ConfigDict(
        extra="forbid", validate_assignment=True, use_attribute_docstrings=True
    )

    @model_validator(mode="after")
    def _validate_color_fields(self) -> _Model:
        for name, info in type(self).model_fields.items():
            extra = info.json_schema_extra
            if isinstance(extra, dict) and extra.get("format") == "color":
                specials = {str(x) for x in (extra.get("specials") or [])}  # type: ignore[union-attr]
                # Bypass validate_assignment to avoid recursion.
                self.__dict__[name] = _validate_color(getattr(self, name), specials)
        return self


# ----------------------------------------------------------------------------- Section A: box
BoxShape = Literal["rectangle", "rounded", "corners", "reticle", "none"]


class BoxStyle(_Model):
    """Geometry of the box outline."""

    shape: BoxShape = Field("rectangle", description="Outline construction.")
    corner_radius: float = Field(10, ge=0, le=200, description="Radius for `rounded` (ref px).")
    corner_length: float = Field(
        0.22,
        ge=0,
        le=400,
        description="Bracket length for `corners`: <=1 is a fraction of the short side, else px.",
    )
    corner_curve: bool = Field(False, description="Round the elbow of corner brackets.")
    double_line: bool = Field(False, description="Draw a second, thinner outline inside the first.")
    double_gap: float = Field(4, ge=1, le=60, description="Gap between the two lines (ref px).")
    double_opacity: float = Field(0.45, ge=0, le=1, description="Opacity of the inner line.")
    reticle_length: float = Field(
        14, ge=2, le=200, description="Tick length for `reticle` (ref px)."
    )
    center_mark: bool = Field(False, description="Draw a small cross at the box center.")


# ----------------------------------------------------------------------------- Section B: stroke
class StrokeStyle(_Model):
    """The main outline stroke."""

    enabled: bool = True
    thickness: float = Field(2.0, ge=0.5, le=40, description="Line weight (ref px).")
    opacity: float = Field(1.0, ge=0, le=1)
    color: str = _color_field(
        {"palette", "confidence"},
        "palette",
        "Hex / rgb() / name, or `palette` (per class/track) or `confidence` (red→green ramp).",
    )


# ----------------------------------------------------------------------------- Section C: fill
class FillStyle(_Model):
    """Interior fill of the box."""

    enabled: bool = False
    opacity: float = Field(0.15, ge=0, le=1)
    color: str = _color_field(
        {"inherit", "palette", "confidence"}, "inherit", "`inherit` follows the stroke color."
    )
    mode: Literal["solid", "gradient", "hatch"] = "solid"
    gradient_direction: Literal["down", "up", "left", "right", "radial"] = "down"
    gradient_start: float = Field(1.0, ge=0, le=1, description="Opacity multiplier at the start.")
    gradient_end: float = Field(0.0, ge=0, le=1, description="Opacity multiplier at the end.")
    hatch_spacing: float = Field(
        8, ge=2, le=100, description="Distance between hatch lines (ref px)."
    )
    hatch_angle: float = Field(45, ge=-90, le=90, description="Hatch angle in degrees.")
    hatch_thickness: float = Field(1.0, ge=0.5, le=10)


# ----------------------------------------------------------------------------- Section D: line
class LinePattern(_Model):
    """How the outline stroke is patterned and animated."""

    pattern: Literal["solid", "dashed", "dotted"] = "solid"
    dash_length: float = Field(12, ge=1, le=200, description="Dash length (ref px).")
    gap_length: float = Field(8, ge=1, le=200, description="Gap between dashes/dots (ref px).")
    dot_radius: float = Field(1.5, ge=0.5, le=20, description="Dot radius for `dotted` (ref px).")
    multicolor: Literal["none", "segments", "gradient"] = Field(
        "none",
        description="`segments` alternates `segment_colors`; `gradient` sweeps the perimeter.",
    )
    segment_colors: list[str] = Field(
        ["#ff5c35", "#54dff4", "#d8ff3e"],
        description="Colors used by `multicolor`.",
    )
    animation: Literal["none", "march", "hue_cycle", "pulse"] = Field(
        "none",
        description="`march` moves dashes along the outline, `hue_cycle` rotates hue, "
        "`pulse` breathes opacity.",
    )
    speed: float = Field(1.0, ge=0, le=10, description="Animation speed multiplier.")

    @field_validator("segment_colors")
    @classmethod
    def _colors(cls, v: list[str]) -> list[str]:
        if not v:
            raise ValueError("segment_colors needs at least one color")
        return [_validate_color(c, set()) for c in v]


# ----------------------------------------------------------------------------- Section E: label
LabelComponent = Literal["text", "confidence", "track_id", "class_id", "custom"]
LabelAnchor = Literal[
    "top_left",
    "top_center",
    "top_right",
    "bottom_left",
    "bottom_center",
    "bottom_right",
    "left",
    "right",
    "center",
]


class LabelStyle(_Model):
    """Text tag with class name / confidence / tracking id."""

    enabled: bool = True
    components: list[LabelComponent] = Field(
        ["text", "confidence"],
        description="Ordered parts of the label. Add/remove/reorder freely.",
    )
    anchor: LabelAnchor = Field("top_left", description="Where the tag sits relative to the box.")
    placement: Literal["outside", "inside"] = "outside"
    orientation: Literal["auto", "horizontal", "vertical"] = Field(
        "auto",
        description="`auto` rotates the tag for `left`/`right` anchors.",
    )
    offset: float = Field(
        0, ge=-100, le=100, description="Extra distance from the box edge (ref px)."
    )
    attached: bool = Field(True, description="Flush with the outline (True) or floating (False).")
    font: str = Field("inter", description="`inter`, `mono`, or a path to a .ttf/.otf file.")
    font_size: float = Field(14, ge=4, le=120, description="Font size (ref px).")
    font_weight: int = Field(600, ge=100, le=900, description="Weight for variable fonts.")
    uppercase: bool = False
    text_color: str = _color_field(
        {"auto", "inherit"},
        "auto",
        "`auto` picks black/white for contrast; `inherit` uses the box color.",
    )
    background: Literal["none", "solid", "pill", "glass", "underline"] = "solid"
    background_color: str = _color_field({"inherit", "palette", "confidence"}, "inherit", "")
    background_opacity: float = Field(1.0, ge=0, le=1)
    padding_x: float = Field(7, ge=0, le=60)
    padding_y: float = Field(4, ge=0, le=60)
    radius: float = Field(3, ge=0, le=60, description="Corner radius of `solid` backgrounds.")
    border: bool = Field(False, description="Thin outline around the tag.")
    separator: str = Field("  ", max_length=8, description="Text between components.")
    confidence_format: Literal["0.92", "92%", "92", ".92"] = "0.92"
    track_id_format: str = Field("#{id}", max_length=24)
    class_id_format: str = Field("[{id}]", max_length=24)
    custom_template: str = Field(
        "",
        max_length=200,
        description="Python format string for the `custom` component, e.g. `{name} · {conf:.0%}`. "
        "Fields: name, conf, id, class_id, data.",
    )
    min_confidence: float = Field(
        0.0, ge=0, le=1, description="Hide the label below this confidence."
    )
    max_width_fraction: float = Field(
        0.0,
        ge=0,
        le=1,
        description="If > 0, truncate labels wider than this fraction of the image.",
    )


# ----------------------------------------------------------------------------- Section F: effects
class GlowEffect(_Model):
    enabled: bool = False
    radius: float = Field(12, ge=1, le=120, description="Blur radius (ref px).")
    intensity: float = Field(0.8, ge=0, le=3)
    color: str = _color_field({"inherit"}, "inherit", "")
    apply_to: Literal["stroke", "label", "both"] = "stroke"


class ShadowEffect(_Model):
    enabled: bool = False
    offset_x: float = Field(2, ge=-60, le=60)
    offset_y: float = Field(3, ge=-60, le=60)
    blur: float = Field(6, ge=0, le=100)
    opacity: float = Field(0.5, ge=0, le=1)
    color: str = _color_field(set(), "#000000", "")


class GlassEffect(_Model):
    """Frosted-glass blur behind the fill and/or the label."""

    enabled: bool = False
    blur: float = Field(10, ge=1, le=80, description="Blur radius (ref px).")
    opacity: float = Field(0.75, ge=0, le=1, description="How much the blur replaces the original.")
    tint: str = _color_field({"inherit"}, "#ffffff", "")
    tint_opacity: float = Field(0.18, ge=0, le=1)
    apply_to: Literal["fill", "label", "both"] = "both"
    brighten: float = Field(0.08, ge=-0.5, le=0.5, description="Lift/darken the blurred region.")


class GrainEffect(_Model):
    enabled: bool = False
    amount: float = Field(0.08, ge=0, le=1)
    seed: int = Field(7, ge=0)


class VignetteEffect(_Model):
    enabled: bool = False
    strength: float = Field(0.45, ge=0, le=1)
    radius: float = Field(0.85, ge=0.2, le=2.0, description="Clear-area radius as a fraction.")


class ColorGrade(_Model):
    """Whole-frame color treatment, for cinematic presets."""

    enabled: bool = False
    contrast: float = Field(1.05, ge=0.5, le=2)
    saturation: float = Field(1.0, ge=0, le=2)
    temperature: float = Field(0.0, ge=-1, le=1, description="<0 cools, >0 warms.")
    lift: float = Field(0.0, ge=-0.3, le=0.3, description="Black-level offset.")
    monochrome: bool = False


class EffectsStyle(_Model):
    glow: GlowEffect = Field(default_factory=GlowEffect)
    shadow: ShadowEffect = Field(default_factory=ShadowEffect)
    glass: GlassEffect = Field(default_factory=GlassEffect)
    grain: GrainEffect = Field(default_factory=GrainEffect)
    vignette: VignetteEffect = Field(default_factory=VignetteEffect)
    grade: ColorGrade = Field(default_factory=ColorGrade)
    dim_outside: float = Field(
        0.0,
        ge=0,
        le=1,
        description="Darken everything outside the boxes (spotlight effect).",
    )


# ----------------------------------------------------------------------------- Section G: trails
class TrailStyle(_Model):
    """Motion trail drawn from the tracking history of each `track_id`."""

    enabled: bool = False
    length: int = Field(30, ge=2, le=600, description="Number of past positions to keep.")
    anchor: Literal["center", "bottom_center", "top_center"] = "bottom_center"
    line: Literal["solid", "dotted", "dashed", "ribbon"] = "solid"
    thickness: float = Field(3, ge=0.5, le=40)
    color: str = _color_field({"inherit", "palette"}, "inherit", "")
    opacity: float = Field(0.9, ge=0, le=1)
    fade_opacity: bool = Field(True, description="Older segments become transparent.")
    fade_thickness: bool = Field(True, description="Older segments become thinner.")
    smoothing: int = Field(3, ge=1, le=15, description="Moving-average window over positions.")
    max_age: int = Field(
        30, ge=1, le=600, description="Frames a lost track is kept before dropping."
    )
    show_points: bool = False
    point_radius: float = Field(3, ge=0.5, le=30)
    glow: bool = Field(False, description="Soft glow under the trail.")
    dash_length: float = Field(10, ge=1, le=100)
    gap_length: float = Field(8, ge=1, le=100)


# ----------------------------------------------------------------------------- global
class PaletteSpec(_Model):
    colors: str | list[str] = Field(
        "default",
        description="Built-in palette name or explicit list of colors.",
    )
    by: Literal["class", "track", "single"] = Field(
        "class",
        description="What `palette` colors are keyed on.",
    )
    class_colors: dict[str, str] = Field(
        default_factory=dict,
        description="Per-class overrides, keyed by class name or id.",
    )

    @field_validator("colors")
    @classmethod
    def _colors(cls, v: str | list[str]) -> str | list[str]:
        if isinstance(v, str):
            if v not in PALETTES:
                raise ValueError(f"Unknown palette {v!r}; available: {', '.join(PALETTES)}")
            return v
        if not v:
            raise ValueError("palette.colors list must not be empty")
        return [_validate_color(c, set()) for c in v]

    @field_validator("class_colors")
    @classmethod
    def _class_colors(cls, v: dict[str, str]) -> dict[str, str]:
        return {str(k): _validate_color(c, set()) for k, c in v.items()}


class Style(_Model):
    """A complete visual style. Load with :meth:`Style.preset` / :meth:`Style.load`."""

    schema_version: int = Field(SCHEMA_VERSION, description="Written on save; used for migrations.")
    name: str = Field("custom", max_length=64)
    description: str = Field("", max_length=300)
    palette: PaletteSpec = Field(default_factory=PaletteSpec)
    confidence_threshold: float = Field(0.0, ge=0, le=1, description="Hide detections below this.")
    scale: float | Literal["auto"] = Field(
        "auto",
        description="`auto` scales sizes with image resolution (1080p ≈ 1.0).",
    )
    fps: float = Field(30, gt=0, le=240, description="Frame rate assumed for animations.")
    box: BoxStyle = Field(default_factory=BoxStyle)
    stroke: StrokeStyle = Field(default_factory=StrokeStyle)
    fill: FillStyle = Field(default_factory=FillStyle)
    line: LinePattern = Field(default_factory=LinePattern)
    label: LabelStyle = Field(default_factory=LabelStyle)
    effects: EffectsStyle = Field(default_factory=EffectsStyle)
    trail: TrailStyle = Field(default_factory=TrailStyle)

    # ------------------------------------------------------------------ loading
    @classmethod
    def preset(cls, name: str) -> Style:
        """Load a built-in or user preset by name (or a YAML/JSON path)."""
        from visionstyle.style.presets import load_preset

        return load_preset(name)

    @classmethod
    def load(cls, source: str | Path) -> Style:
        """Alias of :meth:`preset` that also accepts file paths."""
        return cls.preset(str(source))

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Style:
        from visionstyle.style.migrate import migrate

        return cls.model_validate(migrate(dict(data)))

    @classmethod
    def from_yaml(cls, text: str) -> Style:
        data = yaml.safe_load(text) or {}
        if not isinstance(data, dict):
            raise ValueError("Style YAML must be a mapping")
        return cls.from_dict(data)

    # ------------------------------------------------------------------ saving
    def to_dict(self, *, exclude_defaults: bool = False) -> dict[str, Any]:
        data = self.model_dump(mode="json", exclude_defaults=exclude_defaults)
        data["schema_version"] = SCHEMA_VERSION
        return data

    def to_yaml(self, *, exclude_defaults: bool = False) -> str:
        return yaml.safe_dump(
            self.to_dict(exclude_defaults=exclude_defaults), sort_keys=False, allow_unicode=True
        )

    def save(self, path: str | Path, *, exclude_defaults: bool = False) -> Path:
        """Write the style as YAML (or JSON if the suffix is .json)."""
        p = Path(path).expanduser()
        p.parent.mkdir(parents=True, exist_ok=True)
        if p.suffix.lower() == ".json":
            import json

            p.write_text(json.dumps(self.to_dict(exclude_defaults=exclude_defaults), indent=2))
        else:
            p.write_text(self.to_yaml(exclude_defaults=exclude_defaults))
        return p

    def save_preset(self, name: str | None = None, directory: str | Path | None = None) -> Path:
        """Save into the user presets directory so ``Style.preset(name)`` finds it."""
        from visionstyle.style.presets import save_preset

        return save_preset(self, name or self.name, directory)

    # ------------------------------------------------------------------ helpers
    def copy_with(self, **updates: Any) -> Style:
        """Return a deep copy with nested updates, e.g. ``copy_with(stroke={"thickness": 4})``."""
        data = self.model_dump()
        for key, value in updates.items():
            if isinstance(value, dict) and isinstance(data.get(key), dict):
                data[key] = {**data[key], **value}
            else:
                data[key] = value
        return Style.model_validate(data)

    @property
    def is_animated(self) -> bool:
        return self.line.animation != "none" and self.line.speed > 0

    @classmethod
    def json_schema(cls) -> dict[str, Any]:
        return cls.model_json_schema()
