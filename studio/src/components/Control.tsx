import type { ControlDef } from '../controls/registry';
import { getDeep, useStore } from '../store';
import { AnchorPicker } from './AnchorPicker';
import { ColorInput, ColorList } from './ColorInput';
import { ComponentChips } from './ComponentChips';
import { PaletteInput, ClassColors } from './PaletteInput';

function fmt(v: number, step: number | undefined, unit?: string) {
  const digits = step && step < 1 ? (step < 0.1 ? 2 : 1) : 0;
  return `${Number(v).toFixed(digits)}${unit ?? ''}`;
}

export function Control({ def }: { def: ControlDef }) {
  const style = useStore((s) => s.style);
  const setPath = useStore((s) => s.setPath);
  const value = getDeep(style, def.path);
  if (def.when && !def.when(style)) return null;
  const set = (v: unknown) => setPath(def.path, v);

  switch (def.kind) {
    case 'toggle':
      return (
        <label className="field row toggle-row">
          <span className="field-label" title={def.hint}>
            {def.label}
          </span>
          <input type="checkbox" checked={Boolean(value)} onChange={(e) => set(e.target.checked)} />
          <span className="toggle" />
        </label>
      );
    case 'slider':
      return (
        <div className="field">
          <div className="field-head">
            <label className="field-label" title={def.hint}>
              {def.label}
            </label>
            <output className="mono">{fmt(Number(value), def.step, def.unit)}</output>
          </div>
          <input
            type="range"
            name={def.path}
            aria-label={def.label}
            min={def.min}
            max={def.max}
            step={def.step}
            value={Number(value)}
            style={{ '--range': `${((Number(value) - (def.min ?? 0)) / ((def.max ?? 1) - (def.min ?? 0))) * 100}%` } as React.CSSProperties}
            onChange={(e) => set(parseFloat(e.target.value))}
          />
        </div>
      );
    case 'segment':
      return (
        <div className="field">
          <label className="field-label" title={def.hint}>
            {def.label}
          </label>
          <div className="segment" role="radiogroup" aria-label={def.label}>
            {def.options?.map((o) => (
              <button key={o} type="button" role="radio" aria-checked={value === o} className={value === o ? 'active' : ''} onClick={() => set(o)}>
                {def.optionLabels?.[o] ?? o.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      );
    case 'select':
    case 'font':
      return (
        <div className="field row">
          <label className="field-label" title={def.hint}>
            {def.label}
          </label>
          <select name={def.path} aria-label={def.label} value={def.options?.includes(value) ? value : def.options?.[0]} onChange={(e) => set(e.target.value)}>
            {def.options?.map((o) => (
              <option key={o} value={o}>
                {def.optionLabels?.[o] ?? o.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>
      );
    case 'color':
      return (
        <div className="field">
          <label className="field-label" title={def.hint}>
            {def.label}
          </label>
          <ColorInput value={String(value)} specials={def.specials} onChange={set} />
        </div>
      );
    case 'colorlist':
      return (
        <div className="field">
          <label className="field-label">{def.label}</label>
          <ColorList value={value as string[]} onChange={set} />
        </div>
      );
    case 'anchor':
      return (
        <div className="field">
          <label className="field-label" title={def.hint}>
            {def.label}
          </label>
          <AnchorPicker value={String(value)} placement={String(getDeep(style, 'label.placement'))} onChange={set} />
        </div>
      );
    case 'components':
      return (
        <div className="field">
          <label className="field-label" title={def.hint}>
            {def.label}
          </label>
          <ComponentChips value={value as string[]} onChange={set} />
        </div>
      );
    case 'palette':
      return (
        <div className="field">
          <label className="field-label" title={def.hint}>
            {def.label}
          </label>
          <PaletteInput value={value} onChange={set} />
        </div>
      );
    case 'classcolors':
      return (
        <div className="field">
          <label className="field-label" title={def.hint}>
            {def.label}
          </label>
          <ClassColors value={(value ?? {}) as Record<string, string>} onChange={set} />
        </div>
      );
    case 'text':
    default:
      return (
        <div className="field row">
          <label className="field-label" title={def.hint}>
            {def.label}
          </label>
          <input name={def.path} autoComplete="off" aria-label={def.label} className="text-input mono" value={String(value ?? '')} onChange={(e) => set(e.target.value)} spellCheck={false} />
        </div>
      );
  }
}
