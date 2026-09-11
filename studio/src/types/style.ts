/* Generated from the visionstyle Style JSON schema. Do not edit by hand: run `npm run gen:types`. */

/**
 * Written on save; used for migrations.
 */
export type SchemaVersion = number;
export type Name = string;
export type Description = string;
/**
 * Built-in palette name or explicit list of colors.
 */
export type Colors = string | string[];
/**
 * What `palette` colors are keyed on.
 */
export type By = 'class' | 'track' | 'single';
/**
 * Hide detections below this.
 */
export type ConfidenceThreshold = number;
/**
 * `auto` scales sizes with image resolution (1080p ≈ 1.0).
 */
export type Scale = number | 'auto';
/**
 * Frame rate assumed for animations.
 */
export type Fps = number;
/**
 * Outline construction.
 */
export type Shape = 'rectangle' | 'rounded' | 'corners' | 'reticle' | 'none';
/**
 * Radius for `rounded` (ref px).
 */
export type CornerRadius = number;
/**
 * Bracket length for `corners`: <=1 is a fraction of the short side, else px.
 */
export type CornerLength = number;
/**
 * Round the elbow of corner brackets.
 */
export type CornerCurve = boolean;
/**
 * Draw a second, thinner outline inside the first.
 */
export type DoubleLine = boolean;
/**
 * Gap between the two lines (ref px).
 */
export type DoubleGap = number;
/**
 * Opacity of the inner line.
 */
export type DoubleOpacity = number;
/**
 * Tick length for `reticle` (ref px).
 */
export type ReticleLength = number;
/**
 * Draw a small cross at the box center.
 */
export type CenterMark = boolean;
export type Enabled = boolean;
/**
 * Line weight (ref px).
 */
export type Thickness = number;
export type Opacity = number;
/**
 * Hex / rgb() / name, or `palette` (per class/track) or `confidence` (red→green ramp).
 */
export type Color = string;
export type Enabled1 = boolean;
export type Opacity1 = number;
/**
 * `inherit` follows the stroke color.
 */
export type Color1 = string;
export type Mode = 'solid' | 'gradient' | 'hatch';
export type GradientDirection = 'down' | 'up' | 'left' | 'right' | 'radial';
/**
 * Opacity multiplier at the start.
 */
export type GradientStart = number;
/**
 * Opacity multiplier at the end.
 */
export type GradientEnd = number;
/**
 * Distance between hatch lines (ref px).
 */
export type HatchSpacing = number;
/**
 * Hatch angle in degrees.
 */
export type HatchAngle = number;
export type HatchThickness = number;
export type Pattern = 'solid' | 'dashed' | 'dotted';
/**
 * Dash length (ref px).
 */
export type DashLength = number;
/**
 * Gap between dashes/dots (ref px).
 */
export type GapLength = number;
/**
 * Dot radius for `dotted` (ref px).
 */
export type DotRadius = number;
/**
 * `segments` alternates `segment_colors`; `gradient` sweeps the perimeter.
 */
export type Multicolor = 'none' | 'segments' | 'gradient';
/**
 * Colors used by `multicolor`.
 */
export type SegmentColors = string[];
/**
 * `march` moves dashes along the outline, `hue_cycle` rotates hue, `pulse` breathes opacity.
 */
export type Animation = 'none' | 'march' | 'hue_cycle' | 'pulse';
/**
 * Animation speed multiplier.
 */
export type Speed = number;
export type Enabled2 = boolean;
/**
 * Ordered parts of the label. Add/remove/reorder freely.
 */
export type Components = ('text' | 'confidence' | 'track_id' | 'class_id' | 'custom')[];
/**
 * Where the tag sits relative to the box.
 */
export type Anchor =
  | 'top_left'
  | 'top_center'
  | 'top_right'
  | 'bottom_left'
  | 'bottom_center'
  | 'bottom_right'
  | 'left'
  | 'right'
  | 'center';
export type Placement = 'outside' | 'inside';
/**
 * `auto` rotates the tag for `left`/`right` anchors.
 */
export type Orientation = 'auto' | 'horizontal' | 'vertical';
/**
 * Extra distance from the box edge (ref px).
 */
export type Offset = number;
/**
 * Flush with the outline (True) or floating (False).
 */
export type Attached = boolean;
/**
 * `inter`, `mono`, or a path to a .ttf/.otf file.
 */
export type Font = string;
/**
 * Font size (ref px).
 */
export type FontSize = number;
/**
 * Weight for variable fonts.
 */
export type FontWeight = number;
export type Uppercase = boolean;
/**
 * `auto` picks black/white for contrast; `inherit` uses the box color.
 */
export type TextColor = string;
export type Background = 'none' | 'solid' | 'pill' | 'glass' | 'underline';
export type BackgroundColor = string;
export type BackgroundOpacity = number;
export type PaddingX = number;
export type PaddingY = number;
/**
 * Corner radius of `solid` backgrounds.
 */
export type Radius = number;
/**
 * Thin outline around the tag.
 */
export type Border = boolean;
/**
 * Text between components.
 */
export type Separator = string;
export type ConfidenceFormat = '0.92' | '92%' | '92' | '.92';
export type TrackIdFormat = string;
export type ClassIdFormat = string;
/**
 * Python format string for the `custom` component, e.g. `{name} · {conf:.0%}`. Fields: name, conf, id, class_id, data.
 */
export type CustomTemplate = string;
/**
 * Hide the label below this confidence.
 */
export type MinConfidence = number;
/**
 * If > 0, truncate labels wider than this fraction of the image.
 */
export type MaxWidthFraction = number;
export type Enabled3 = boolean;
/**
 * Blur radius (ref px).
 */
export type Radius1 = number;
export type Intensity = number;
export type Color2 = string;
export type ApplyTo = 'stroke' | 'label' | 'both';
export type Enabled4 = boolean;
export type OffsetX = number;
export type OffsetY = number;
export type Blur = number;
export type Opacity2 = number;
export type Color3 = string;
export type Enabled5 = boolean;
/**
 * Blur radius (ref px).
 */
export type Blur1 = number;
/**
 * How much the blur replaces the original.
 */
export type Opacity3 = number;
export type Tint = string;
export type TintOpacity = number;
export type ApplyTo1 = 'fill' | 'label' | 'both';
/**
 * Lift/darken the blurred region.
 */
export type Brighten = number;
export type Enabled6 = boolean;
export type Amount = number;
export type Seed = number;
export type Enabled7 = boolean;
export type Strength = number;
/**
 * Clear-area radius as a fraction.
 */
export type Radius2 = number;
export type Enabled8 = boolean;
export type Contrast = number;
export type Saturation = number;
/**
 * <0 cools, >0 warms.
 */
export type Temperature = number;
/**
 * Black-level offset.
 */
export type Lift = number;
export type Monochrome = boolean;
/**
 * Darken everything outside the boxes (spotlight effect).
 */
export type DimOutside = number;
export type Enabled9 = boolean;
/**
 * Number of past positions to keep.
 */
export type Length = number;
export type Anchor1 = 'center' | 'bottom_center' | 'top_center';
export type Line = 'solid' | 'dotted' | 'dashed' | 'ribbon';
export type Thickness1 = number;
export type Color4 = string;
export type Opacity4 = number;
/**
 * Older segments become transparent.
 */
export type FadeOpacity = boolean;
/**
 * Older segments become thinner.
 */
export type FadeThickness = boolean;
/**
 * Moving-average window over positions.
 */
export type Smoothing = number;
/**
 * Frames a lost track is kept before dropping.
 */
export type MaxAge = number;
export type ShowPoints = boolean;
export type PointRadius = number;
/**
 * Soft glow under the trail.
 */
export type Glow = boolean;
export type DashLength1 = number;
export type GapLength1 = number;

/**
 * A complete visual style. Load with :meth:`Style.preset` / :meth:`Style.load`.
 */
export interface Style {
  schema_version?: SchemaVersion;
  name?: Name;
  description?: Description;
  palette?: PaletteSpec;
  confidence_threshold?: ConfidenceThreshold;
  scale?: Scale;
  fps?: Fps;
  box?: BoxStyle;
  stroke?: StrokeStyle;
  fill?: FillStyle;
  line?: LinePattern;
  label?: LabelStyle;
  effects?: EffectsStyle;
  trail?: TrailStyle;
}
/**
 * This interface was referenced by `Style`'s JSON-Schema
 * via the `definition` "PaletteSpec".
 */
export interface PaletteSpec {
  colors?: Colors;
  by?: By;
  class_colors?: ClassColors;
}
/**
 * Per-class overrides, keyed by class name or id.
 */
export interface ClassColors {
  [k: string]: string;
}
/**
 * Geometry of the box outline.
 *
 * This interface was referenced by `Style`'s JSON-Schema
 * via the `definition` "BoxStyle".
 */
export interface BoxStyle {
  shape?: Shape;
  corner_radius?: CornerRadius;
  corner_length?: CornerLength;
  corner_curve?: CornerCurve;
  double_line?: DoubleLine;
  double_gap?: DoubleGap;
  double_opacity?: DoubleOpacity;
  reticle_length?: ReticleLength;
  center_mark?: CenterMark;
}
/**
 * The main outline stroke.
 *
 * This interface was referenced by `Style`'s JSON-Schema
 * via the `definition` "StrokeStyle".
 */
export interface StrokeStyle {
  enabled?: Enabled;
  thickness?: Thickness;
  opacity?: Opacity;
  color?: Color;
}
/**
 * Interior fill of the box.
 *
 * This interface was referenced by `Style`'s JSON-Schema
 * via the `definition` "FillStyle".
 */
export interface FillStyle {
  enabled?: Enabled1;
  opacity?: Opacity1;
  color?: Color1;
  mode?: Mode;
  gradient_direction?: GradientDirection;
  gradient_start?: GradientStart;
  gradient_end?: GradientEnd;
  hatch_spacing?: HatchSpacing;
  hatch_angle?: HatchAngle;
  hatch_thickness?: HatchThickness;
}
/**
 * How the outline stroke is patterned and animated.
 *
 * This interface was referenced by `Style`'s JSON-Schema
 * via the `definition` "LinePattern".
 */
export interface LinePattern {
  pattern?: Pattern;
  dash_length?: DashLength;
  gap_length?: GapLength;
  dot_radius?: DotRadius;
  multicolor?: Multicolor;
  segment_colors?: SegmentColors;
  animation?: Animation;
  speed?: Speed;
}
/**
 * Text tag with class name / confidence / tracking id.
 *
 * This interface was referenced by `Style`'s JSON-Schema
 * via the `definition` "LabelStyle".
 */
export interface LabelStyle {
  enabled?: Enabled2;
  components?: Components;
  anchor?: Anchor;
  placement?: Placement;
  orientation?: Orientation;
  offset?: Offset;
  attached?: Attached;
  font?: Font;
  font_size?: FontSize;
  font_weight?: FontWeight;
  uppercase?: Uppercase;
  text_color?: TextColor;
  background?: Background;
  background_color?: BackgroundColor;
  background_opacity?: BackgroundOpacity;
  padding_x?: PaddingX;
  padding_y?: PaddingY;
  radius?: Radius;
  border?: Border;
  separator?: Separator;
  confidence_format?: ConfidenceFormat;
  track_id_format?: TrackIdFormat;
  class_id_format?: ClassIdFormat;
  custom_template?: CustomTemplate;
  min_confidence?: MinConfidence;
  max_width_fraction?: MaxWidthFraction;
}
/**
 * This interface was referenced by `Style`'s JSON-Schema
 * via the `definition` "EffectsStyle".
 */
export interface EffectsStyle {
  glow?: GlowEffect;
  shadow?: ShadowEffect;
  glass?: GlassEffect;
  grain?: GrainEffect;
  vignette?: VignetteEffect;
  grade?: ColorGrade;
  dim_outside?: DimOutside;
}
/**
 * This interface was referenced by `Style`'s JSON-Schema
 * via the `definition` "GlowEffect".
 */
export interface GlowEffect {
  enabled?: Enabled3;
  radius?: Radius1;
  intensity?: Intensity;
  color?: Color2;
  apply_to?: ApplyTo;
}
/**
 * This interface was referenced by `Style`'s JSON-Schema
 * via the `definition` "ShadowEffect".
 */
export interface ShadowEffect {
  enabled?: Enabled4;
  offset_x?: OffsetX;
  offset_y?: OffsetY;
  blur?: Blur;
  opacity?: Opacity2;
  color?: Color3;
}
/**
 * Frosted-glass blur behind the fill and/or the label.
 *
 * This interface was referenced by `Style`'s JSON-Schema
 * via the `definition` "GlassEffect".
 */
export interface GlassEffect {
  enabled?: Enabled5;
  blur?: Blur1;
  opacity?: Opacity3;
  tint?: Tint;
  tint_opacity?: TintOpacity;
  apply_to?: ApplyTo1;
  brighten?: Brighten;
}
/**
 * This interface was referenced by `Style`'s JSON-Schema
 * via the `definition` "GrainEffect".
 */
export interface GrainEffect {
  enabled?: Enabled6;
  amount?: Amount;
  seed?: Seed;
}
/**
 * This interface was referenced by `Style`'s JSON-Schema
 * via the `definition` "VignetteEffect".
 */
export interface VignetteEffect {
  enabled?: Enabled7;
  strength?: Strength;
  radius?: Radius2;
}
/**
 * Whole-frame color treatment, for cinematic presets.
 *
 * This interface was referenced by `Style`'s JSON-Schema
 * via the `definition` "ColorGrade".
 */
export interface ColorGrade {
  enabled?: Enabled8;
  contrast?: Contrast;
  saturation?: Saturation;
  temperature?: Temperature;
  lift?: Lift;
  monochrome?: Monochrome;
}
/**
 * Motion trail drawn from the tracking history of each `track_id`.
 *
 * This interface was referenced by `Style`'s JSON-Schema
 * via the `definition` "TrailStyle".
 */
export interface TrailStyle {
  enabled?: Enabled9;
  length?: Length;
  anchor?: Anchor1;
  line?: Line;
  thickness?: Thickness1;
  color?: Color4;
  opacity?: Opacity4;
  fade_opacity?: FadeOpacity;
  fade_thickness?: FadeThickness;
  smoothing?: Smoothing;
  max_age?: MaxAge;
  show_points?: ShowPoints;
  point_radius?: PointRadius;
  glow?: Glow;
  dash_length?: DashLength1;
  gap_length?: GapLength1;
}
