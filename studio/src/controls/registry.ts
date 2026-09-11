/* Declarative description of the sidebar: sections → controls keyed by schema path.
   Ranges, enums and defaults come from the JSON schema, so adding a field to the Python
   schema is usually a one-line addition here. */
import { enumOf, schemaAt } from '../schema';

export type ControlKind =
  | 'slider'
  | 'toggle'
  | 'segment'
  | 'select'
  | 'color'
  | 'text'
  | 'anchor'
  | 'components'
  | 'palette'
  | 'colorlist'
  | 'font'
  | 'classcolors';

export interface ControlDef {
  path: string;
  label: string;
  kind: ControlKind;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  optionLabels?: Record<string, string>;
  specials?: string[];
  hint?: string;
  unit?: string;
  /** Only show when this predicate holds for the current style. */
  when?: (style: any) => boolean;
}

export interface SectionDef {
  id: string;
  title: string;
  code: string;
  intro?: string;
  /** Path of a boolean that acts as this section's master switch. */
  master?: string;
  controls: ControlDef[];
}

type Spec = Partial<ControlDef> & { path: string; label: string };

function control(spec: Spec): ControlDef {
  const node = schemaAt(spec.path);
  const options = spec.options ?? enumOf(node);
  let kind = spec.kind;
  if (!kind) {
    if (node?.format === 'color') kind = 'color';
    else if (node?.type === 'boolean') kind = 'toggle';
    else if (options) kind = options.length <= 4 ? 'segment' : 'select';
    else if (node?.type === 'number' || node?.type === 'integer') kind = 'slider';
    else kind = 'text';
  }
  const min = spec.min ?? node?.minimum ?? node?.exclusiveMinimum;
  const max = spec.max ?? node?.maximum;
  let step = spec.step;
  if (step === undefined && kind === 'slider') {
    if (node?.type === 'integer') step = 1;
    else if (max !== undefined && max <= 1) step = 0.01;
    else if (max !== undefined && max <= 20) step = 0.25;
    else step = 1;
  }
  return {
    kind,
    min,
    max,
    step,
    options,
    specials: node?.specials,
    hint: spec.hint ?? node?.description,
    ...spec,
  } as ControlDef;
}

const g = (s: any, p: string) => p.split('.').reduce((o, k) => (o == null ? o : o[k]), s);
const on = (p: string) => (s: any) => Boolean(g(s, p));
const eq = (p: string, ...v: string[]) => (s: any) => v.includes(g(s, p));

export const SECTIONS: SectionDef[] = [
  {
    id: 'box',
    title: 'Box',
    code: 'A',
    intro: 'Frame construction.',
    controls: [
      control({ path: 'box.shape', label: 'Shape', kind: 'segment', optionLabels: { rectangle: 'Rect', rounded: 'Round', corners: 'Corners', reticle: 'Reticle', none: 'None' } }),
      control({ path: 'box.corner_radius', label: 'Corner radius', max: 60, unit: 'px', when: eq('box.shape', 'rounded', 'corners') }),
      control({ path: 'box.corner_length', label: 'Bracket length', min: 0.05, max: 0.5, step: 0.01, when: eq('box.shape', 'corners'), hint: 'Fraction of the shorter side.' }),
      control({ path: 'box.corner_curve', label: 'Curved elbows', when: eq('box.shape', 'corners') }),
      control({ path: 'box.reticle_length', label: 'Tick length', max: 60, unit: 'px', when: eq('box.shape', 'reticle') }),
      control({ path: 'box.double_line', label: 'Double line', when: eq('box.shape', 'rectangle', 'rounded', 'corners') }),
      control({ path: 'box.double_gap', label: 'Inner gap', max: 20, unit: 'px', when: on('box.double_line') }),
      control({ path: 'box.double_opacity', label: 'Inner opacity', when: on('box.double_line') }),
      control({ path: 'box.center_mark', label: 'Center mark' }),
    ],
  },
  {
    id: 'stroke',
    title: 'Stroke',
    code: 'B',
    intro: 'Weight, opacity and color of the outline.',
    master: 'stroke.enabled',
    controls: [
      control({ path: 'stroke.thickness', label: 'Thickness', max: 12, unit: 'px' }),
      control({ path: 'stroke.opacity', label: 'Opacity' }),
      control({ path: 'stroke.color', label: 'Color' }),
    ],
  },
  {
    id: 'fill',
    title: 'Fill',
    code: 'C',
    intro: 'What happens inside the box.',
    master: 'fill.enabled',
    controls: [
      control({ path: 'fill.opacity', label: 'Opacity' }),
      control({ path: 'fill.color', label: 'Color' }),
      control({ path: 'fill.mode', label: 'Mode' }),
      control({ path: 'fill.gradient_direction', label: 'Direction', kind: 'select', when: eq('fill.mode', 'gradient') }),
      control({ path: 'fill.gradient_start', label: 'Start opacity', when: eq('fill.mode', 'gradient') }),
      control({ path: 'fill.gradient_end', label: 'End opacity', when: eq('fill.mode', 'gradient') }),
      control({ path: 'fill.hatch_spacing', label: 'Hatch spacing', max: 40, unit: 'px', when: eq('fill.mode', 'hatch') }),
      control({ path: 'fill.hatch_angle', label: 'Hatch angle', unit: '°', when: eq('fill.mode', 'hatch') }),
      control({ path: 'fill.hatch_thickness', label: 'Hatch weight', max: 4, when: eq('fill.mode', 'hatch') }),
    ],
  },
  {
    id: 'line',
    title: 'Line',
    code: 'D',
    intro: 'Pattern, colour cycling and motion of the outline.',
    controls: [
      control({ path: 'line.pattern', label: 'Pattern' }),
      control({ path: 'line.dash_length', label: 'Dash length', max: 60, unit: 'px', when: eq('line.pattern', 'dashed') }),
      control({ path: 'line.gap_length', label: 'Gap', max: 60, unit: 'px', when: eq('line.pattern', 'dashed', 'dotted') }),
      control({ path: 'line.dot_radius', label: 'Dot radius', max: 8, unit: 'px', when: eq('line.pattern', 'dotted') }),
      control({ path: 'line.multicolor', label: 'Multi-color' }),
      control({ path: 'line.segment_colors', label: 'Colors', kind: 'colorlist', when: (s) => g(s, 'line.multicolor') !== 'none' }),
      control({ path: 'line.animation', label: 'Animation', optionLabels: { none: 'Off', march: 'March', hue_cycle: 'Hue', pulse: 'Pulse' } }),
      control({ path: 'line.speed', label: 'Speed', max: 4, when: (s) => g(s, 'line.animation') !== 'none' }),
    ],
  },
  {
    id: 'label',
    title: 'Label',
    code: 'E',
    intro: 'Class, confidence and tracking id tag.',
    master: 'label.enabled',
    controls: [
      control({ path: 'label.components', label: 'Components', kind: 'components' }),
      control({ path: 'label.custom_template', label: 'Custom template', kind: 'text', when: (s) => (g(s, 'label.components') ?? []).includes('custom') }),
      control({ path: 'label.anchor', label: 'Anchor', kind: 'anchor' }),
      control({ path: 'label.placement', label: 'Placement' }),
      control({ path: 'label.orientation', label: 'Orientation', when: eq('label.anchor', 'left', 'right') }),
      control({ path: 'label.attached', label: 'Attached to edge' }),
      control({ path: 'label.offset', label: 'Offset', min: -20, max: 40, unit: 'px' }),
      control({ path: 'label.font', label: 'Font', kind: 'font', options: ['inter', 'mono'] }),
      control({ path: 'label.font_size', label: 'Font size', min: 8, max: 40, unit: 'px' }),
      control({ path: 'label.font_weight', label: 'Weight', min: 300, max: 800, step: 100 }),
      control({ path: 'label.uppercase', label: 'Uppercase' }),
      control({ path: 'label.text_color', label: 'Text color' }),
      control({ path: 'label.background', label: 'Background', kind: 'select' }),
      control({ path: 'label.background_color', label: 'Background color', when: eq('label.background', 'solid', 'pill', 'underline') }),
      control({ path: 'label.background_opacity', label: 'Background opacity', when: eq('label.background', 'solid', 'pill', 'underline') }),
      control({ path: 'label.radius', label: 'Corner radius', max: 20, unit: 'px', when: eq('label.background', 'solid', 'glass') }),
      control({ path: 'label.border', label: 'Border', when: eq('label.background', 'solid', 'pill', 'glass') }),
      control({ path: 'label.padding_x', label: 'Padding X', max: 24, unit: 'px' }),
      control({ path: 'label.padding_y', label: 'Padding Y', max: 16, unit: 'px' }),
      control({ path: 'label.separator', label: 'Separator', kind: 'text' }),
      control({ path: 'label.confidence_format', label: 'Confidence format' }),
      control({ path: 'label.track_id_format', label: 'Track id format', kind: 'text' }),
      control({ path: 'label.min_confidence', label: 'Hide below confidence' }),
    ],
  },
  {
    id: 'effects',
    title: 'Effects',
    code: 'F',
    intro: 'Glow, shadow, glass and frame-wide grading.',
    controls: [
      control({ path: 'effects.glow.enabled', label: 'Glow' }),
      control({ path: 'effects.glow.radius', label: 'Glow radius', max: 40, unit: 'px', when: on('effects.glow.enabled') }),
      control({ path: 'effects.glow.intensity', label: 'Glow intensity', max: 2, when: on('effects.glow.enabled') }),
      control({ path: 'effects.glow.color', label: 'Glow color', when: on('effects.glow.enabled') }),
      control({ path: 'effects.glow.apply_to', label: 'Glow on', when: on('effects.glow.enabled') }),
      control({ path: 'effects.shadow.enabled', label: 'Shadow' }),
      control({ path: 'effects.shadow.offset_x', label: 'Shadow X', min: -20, max: 20, unit: 'px', when: on('effects.shadow.enabled') }),
      control({ path: 'effects.shadow.offset_y', label: 'Shadow Y', min: -20, max: 20, unit: 'px', when: on('effects.shadow.enabled') }),
      control({ path: 'effects.shadow.blur', label: 'Shadow blur', max: 30, unit: 'px', when: on('effects.shadow.enabled') }),
      control({ path: 'effects.shadow.opacity', label: 'Shadow opacity', when: on('effects.shadow.enabled') }),
      control({ path: 'effects.glass.enabled', label: 'Glass' }),
      control({ path: 'effects.glass.blur', label: 'Glass blur', max: 30, unit: 'px', when: on('effects.glass.enabled') }),
      control({ path: 'effects.glass.opacity', label: 'Glass strength', when: on('effects.glass.enabled') }),
      control({ path: 'effects.glass.tint', label: 'Glass tint', when: on('effects.glass.enabled') }),
      control({ path: 'effects.glass.tint_opacity', label: 'Tint opacity', when: on('effects.glass.enabled') }),
      control({ path: 'effects.glass.apply_to', label: 'Glass on', when: on('effects.glass.enabled') }),
      control({ path: 'effects.dim_outside', label: 'Spotlight (dim outside)' }),
      control({ path: 'effects.vignette.enabled', label: 'Vignette' }),
      control({ path: 'effects.vignette.strength', label: 'Vignette strength', when: on('effects.vignette.enabled') }),
      control({ path: 'effects.grain.enabled', label: 'Film grain' }),
      control({ path: 'effects.grain.amount', label: 'Grain amount', max: 0.4, when: on('effects.grain.enabled') }),
      control({ path: 'effects.grade.enabled', label: 'Color grade' }),
      control({ path: 'effects.grade.contrast', label: 'Contrast', min: 0.6, max: 1.6, when: on('effects.grade.enabled') }),
      control({ path: 'effects.grade.saturation', label: 'Saturation', when: on('effects.grade.enabled') }),
      control({ path: 'effects.grade.temperature', label: 'Temperature', when: on('effects.grade.enabled') }),
      control({ path: 'effects.grade.lift', label: 'Lift', when: on('effects.grade.enabled') }),
      control({ path: 'effects.grade.monochrome', label: 'Monochrome', when: on('effects.grade.enabled') }),
    ],
  },
  {
    id: 'trail',
    title: 'Tracking',
    code: 'G',
    intro: 'Motion trail from each track id history.',
    master: 'trail.enabled',
    controls: [
      control({ path: 'trail.length', label: 'History (frames)', max: 120 }),
      control({ path: 'trail.anchor', label: 'Anchor point', optionLabels: { center: 'Center', bottom_center: 'Feet', top_center: 'Top' } }),
      control({ path: 'trail.line', label: 'Line' }),
      control({ path: 'trail.thickness', label: 'Thickness', max: 14, unit: 'px' }),
      control({ path: 'trail.color', label: 'Color' }),
      control({ path: 'trail.opacity', label: 'Opacity' }),
      control({ path: 'trail.fade_opacity', label: 'Fade opacity' }),
      control({ path: 'trail.fade_thickness', label: 'Taper' }),
      control({ path: 'trail.smoothing', label: 'Smoothing', max: 9 }),
      control({ path: 'trail.glow', label: 'Glow' }),
      control({ path: 'trail.show_points', label: 'Show points' }),
      control({ path: 'trail.point_radius', label: 'Point radius', max: 10, unit: 'px', when: (s) => g(s, 'trail.show_points') || g(s, 'trail.line') === 'dotted' }),
      control({ path: 'trail.max_age', label: 'Keep lost tracks (frames)', max: 120 }),
    ],
  },
  {
    id: 'global',
    title: 'Global',
    code: 'H',
    intro: 'Palette, thresholds and scaling.',
    controls: [
      control({ path: 'palette.colors', label: 'Palette', kind: 'palette' }),
      control({ path: 'palette.by', label: 'Color by', optionLabels: { class: 'Class', track: 'Track', single: 'Single' } }),
      control({ path: 'palette.class_colors', label: 'Per-class overrides', kind: 'classcolors' }),
      control({ path: 'confidence_threshold', label: 'Hide below confidence' }),
      control({ path: 'fps', label: 'Animation fps', min: 1, max: 120, step: 1 }),
    ],
  },
];

export const CONTROL_INDEX: Record<string, ControlDef> = Object.fromEntries(
  SECTIONS.flatMap((s) => s.controls.map((c) => [c.path, c])),
);
