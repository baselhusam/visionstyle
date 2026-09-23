/** A saved preset's Library thumbnail, derived from its style: one box drawn the way the
 *  annotator would draw it (shape, stroke, pattern, fill, label chip, glow, trail), at card size.
 *  Pure data here; `PresetThumb` turns it into SVG. */
import type { Style } from './types/style';

/** Confidence colors (red → amber → green), as in `visionstyle.color.confidence_color`. */
export const RAMP = ['#ff4d4d', '#ffbf00', '#5cff9d'];
/** A color, or the confidence ramp, which renders as a gradient. */
export type Paint = string | 'ramp';

export const VIEW = { w: 160, h: 60 };
export const BOX = { x: 58, y: 16, w: 44, h: 30 };

export interface Chip {
  x: number; y: number; w: number; h: number;
  text: string; size: number; mono: boolean;
  background: 'none' | 'solid' | 'pill' | 'glass' | 'underline';
  fill: Paint; opacity: number; textColor: Paint; radius: number;
}

export interface Thumb {
  shape: 'rectangle' | 'rounded' | 'corners' | 'reticle' | 'none';
  stroke: { paint: Paint; width: number; opacity: number; dash?: string; round: boolean; segments?: string[]; gradient?: string[] } | null;
  radius: number;
  cornerLength: number;
  reticleLength: number;
  double: { gap: number; opacity: number } | null;
  centerMark: boolean;
  fill: { paint: Paint; opacity: number; mode: 'solid' | 'gradient' | 'hatch'; direction: string; start: number; end: number; hatchAngle: number; hatchSpacing: number } | null;
  chip: Chip | null;
  glow: { paint: Paint; blur: number; strength: number } | null;
  shadow: { dx: number; dy: number; blur: number; opacity: number } | null;
  /** Frosted-glass box fill (effects.glass on boxes). */
  glass: number;
  trail: { paint: Paint; width: number; kind: string } | null;
  dim: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The color one detection gets: the palette's first entry (single / class / track all start there). */
export function objectColor(style: Style, palettes: Record<string, string[]>): string {
  const colors = style.palette?.colors;
  const list = Array.isArray(colors) ? colors : palettes[colors ?? 'default'];
  return list?.[0] ?? '#6f95ff';
}

function paint(value: string | undefined, object: string, inherit: Paint): Paint {
  if (!value || value === 'palette') return object;
  if (value === 'confidence') return 'ramp';
  if (value === 'inherit' || value === 'auto') return inherit;
  return value;
}

function luminance(color: string): number {
  const hex = /^#?([0-9a-f]{6})$/i.exec(color)?.[1];
  if (!hex) return 0.5;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The label text a sample "person, 98%, track 7" detection would get. */
export function chipText(style: Style): string {
  const label = style.label ?? {};
  const parts = (label.components ?? ['text', 'confidence']).map((part) => {
    if (part === 'text') return 'person';
    if (part === 'confidence') return (label.confidence_format ?? '').includes('%') ? '98%' : '0.98';
    if (part === 'track_id') return '#7';
    if (part === 'class_id') return '0';
    return (label.custom_template ?? '').replace(/\{[^}]*\}/g, '').trim() || 'tag';
  });
  const text = parts.join(' ');
  return label.uppercase ? text.toUpperCase() : text;
}

function placeChip(style: Style, w: number, h: number): { x: number; y: number } {
  const label = style.label ?? {};
  const anchor = label.anchor ?? 'top_left';
  const inside = label.placement === 'inside';
  const gap = label.attached === false ? 1.5 : 0;
  const { x, y, w: bw, h: bh } = BOX;
  const horizontal = anchor.endsWith('left') ? x : anchor.endsWith('right') ? x + bw - w : x + (bw - w) / 2;
  if (anchor.startsWith('top')) return { x: horizontal, y: inside ? y + gap : y - h - gap };
  if (anchor.startsWith('bottom')) return { x: horizontal, y: inside ? y + bh - h - gap : y + bh + gap };
  const middle = y + (bh - h) / 2;
  if (anchor === 'left') return { x: inside ? x + gap : x - w - gap, y: middle };
  if (anchor === 'right') return { x: inside ? x + bw - w - gap : x + bw + gap, y: middle };
  return { x: x + (bw - w) / 2, y: middle };
}

export function thumbFor(style: Style, palettes: Record<string, string[]>): Thumb {
  const object = objectColor(style, palettes);
  const strokeStyle = style.stroke ?? {};
  const strokePaint = paint(strokeStyle.color, object, object);
  // reference sizes are ~1080p pixels; the card box is ~44 units wide, so scale them down
  const k = 0.42;
  const line = style.line ?? {};
  const width = clamp((strokeStyle.thickness ?? 2) * k, 0.7, 3.6);
  const pattern = line.pattern ?? 'solid';
  const dash = pattern === 'dashed'
    ? `${clamp((line.dash_length ?? 12) * k, 1.5, 12)} ${clamp((line.gap_length ?? 8) * k, 1, 10)}`
    : pattern === 'dotted' ? `0 ${clamp((line.gap_length ?? 8) * k + width, 2, 10)}` : undefined;
  const multicolor = line.multicolor ?? 'none';
  const stroke = strokeStyle.enabled === false ? null : {
    paint: strokePaint,
    width,
    opacity: strokeStyle.opacity ?? 1,
    dash,
    round: pattern === 'dotted',
    segments: multicolor === 'segments' ? line.segment_colors : undefined,
    gradient: multicolor === 'gradient' ? line.segment_colors : undefined,
  };

  const box = style.box ?? {};
  const fillStyle = style.fill ?? {};
  const fill = fillStyle.enabled ? {
    paint: paint(fillStyle.color, object, strokePaint),
    opacity: clamp(fillStyle.opacity ?? 0.2, 0, 1),
    mode: fillStyle.mode ?? 'solid',
    direction: fillStyle.gradient_direction ?? 'down',
    start: fillStyle.gradient_start ?? 1,
    end: fillStyle.gradient_end ?? 0,
    hatchAngle: fillStyle.hatch_angle ?? 45,
    hatchSpacing: clamp((fillStyle.hatch_spacing ?? 8) * k, 2, 8),
  } : null;

  const label = style.label ?? {};
  let chip: Chip | null = null;
  const text = chipText(style);
  if (label.enabled !== false && (label.components ?? ['text']).length > 0 && text) {
    const size = clamp((label.font_size ?? 13) * 0.4, 4.2, 6.5);
    const mono = (label.font ?? '').toLowerCase().includes('mono');
    const background = label.background ?? 'solid';
    const padX = background === 'none' || background === 'underline' ? 0.5 : clamp((label.padding_x ?? 6) * 0.3, 1.5, 3.5);
    const padY = background === 'none' || background === 'underline' ? 0.5 : clamp((label.padding_y ?? 3) * 0.3, 0.8, 2.2);
    const w = text.length * size * (mono ? 0.62 : 0.56) + padX * 2;
    const h = size + padY * 2;
    const fillPaint = background === 'glass' ? '#ffffff' : paint(label.background_color, object, strokePaint);
    const bg = fillPaint === 'ramp' ? RAMP[2] : fillPaint;
    const textColor: Paint = label.text_color && label.text_color !== 'auto'
      ? paint(label.text_color, object, strokePaint)
      : background === 'none' || background === 'underline' || background === 'glass'
        ? (background === 'glass' ? '#ffffff' : strokePaint)
        : luminance(bg) > 0.55 ? '#111214' : '#ffffff';
    chip = {
      ...placeChip(style, w, h), w, h, text, size, mono, background,
      fill: background === 'glass' ? '#ffffff' : fillPaint,
      opacity: background === 'glass' ? 0.2 : clamp(label.background_opacity ?? 1, 0, 1),
      textColor,
      radius: background === 'pill' ? h / 2 : clamp((label.radius ?? 2) * 0.4, 0, h / 2),
    };
  }

  const effects = style.effects ?? {};
  const glowStyle = effects.glow ?? {};
  const shadowStyle = effects.shadow ?? {};
  const trailStyle = style.trail ?? {};
  return {
    shape: box.shape ?? 'rectangle',
    stroke,
    radius: box.shape === 'rounded' ? clamp((box.corner_radius ?? 6) * 0.5, 1, 10) : 1,
    cornerLength: clamp((box.corner_length ?? 0.22) * Math.min(BOX.w, BOX.h) * 1.3, 4, 14),
    reticleLength: clamp((box.reticle_length ?? 12) * 0.25, 3, 10),
    double: box.double_line && box.shape !== 'reticle' && box.shape !== 'none'
      ? { gap: clamp((box.double_gap ?? 4) * 0.5, 1.5, 4), opacity: box.double_opacity ?? 0.45 }
      : null,
    centerMark: Boolean(box.center_mark),
    fill,
    chip,
    glow: glowStyle.enabled
      ? { paint: paint(glowStyle.color, object, strokePaint), blur: clamp((glowStyle.radius ?? 10) * 0.18, 1, 4), strength: clamp(glowStyle.intensity ?? 0.8, 0.2, 2) }
      : null,
    shadow: shadowStyle.enabled
      ? { dx: clamp((shadowStyle.offset_x ?? 2) * 0.4, -3, 3), dy: clamp((shadowStyle.offset_y ?? 3) * 0.4, -3, 3), blur: clamp((shadowStyle.blur ?? 6) * 0.25, 0.5, 3), opacity: shadowStyle.opacity ?? 0.5 }
      : null,
    trail: trailStyle.enabled
      ? { paint: strokePaint, width: trailStyle.line === 'ribbon' ? width * 1.8 : Math.max(0.9, width * 0.8), kind: trailStyle.line ?? 'solid' }
      : null,
    glass: effects.glass?.enabled && effects.glass.apply_to !== 'label' ? clamp((effects.glass.opacity ?? 0.5) * 0.35, 0.08, 0.3) : 0,
    dim: clamp(effects.dim_outside ?? 0, 0, 1),
  };
}
