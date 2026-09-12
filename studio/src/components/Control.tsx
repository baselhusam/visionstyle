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

const CONTROL_GLYPHS: Record<string, string> = {
  'box.shape': 'M4 5h16v14H4z M4 10h16 M12 5v14',
  'box.double_line': 'M5 6h14v12H5z M8 9h8v6H8z',
  'box.center_mark': 'M12 4v16 M4 12h16',
  'stroke.thickness': 'M5 7h14 M5 12h14 M5 17h14',
  'stroke.opacity': 'M12 4c-3 4-5 6.8-5 9a5 5 0 0 0 10 0c0-2.2-2-5-5-9Z',
  'line.pattern': 'M4 12h4 M10 12h4 M16 12h4',
  'label.components': 'M5 6h14M5 12h10M5 18h14',
  'label.anchor': 'M12 4v16 M5 11l7-7 7 7',
  'effects.glow.enabled': 'm12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z',
};

function ControlGlyph({ path }: { path: string }) {
  const d = CONTROL_GLYPHS[path] ?? (path.includes('color') ? 'M6 18 18 6 M7 5h12v12H7z' : path.includes('opacity') ? 'M12 4c-3 4-5 6.8-5 9a5 5 0 0 0 10 0c0-2.2-2-5-5-9Z' : 'M5 7h14 M5 12h14 M5 17h14');
  return <span className="control-glyph" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg></span>;
}

function FieldLabel({ def }: { def: ControlDef }) {
  return <span className="field-label" title={def.hint}><ControlGlyph path={def.path} />{def.label}</span>;
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
          <FieldLabel def={def} />
          <input type="checkbox" checked={Boolean(value)} onChange={(e) => set(e.target.checked)} />
          <span className="toggle" />
        </label>
      );
    case 'slider':
      return (
        <div className="field">
          <div className="field-head">
            <label className="field-label" title={def.hint}><ControlGlyph path={def.path} />{def.label}</label>
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
          <label className="field-label" title={def.hint}><ControlGlyph path={def.path} />{def.label}</label>
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
          <label className="field-label" title={def.hint}><ControlGlyph path={def.path} />{def.label}</label>
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
          <label className="field-label" title={def.hint}><ControlGlyph path={def.path} />{def.label}</label>
          <ColorInput value={String(value)} specials={def.specials} onChange={set} />
        </div>
      );
    case 'colorlist':
      return (
        <div className="field">
          <label className="field-label"><ControlGlyph path={def.path} />{def.label}</label>
          <ColorList value={value as string[]} onChange={set} />
        </div>
      );
    case 'anchor':
      return (
        <div className="field">
          <label className="field-label" title={def.hint}><ControlGlyph path={def.path} />{def.label}</label>
          <AnchorPicker value={String(value)} placement={String(getDeep(style, 'label.placement'))} onChange={set} />
        </div>
      );
    case 'components':
      return (
        <div className="field">
          <label className="field-label" title={def.hint}><ControlGlyph path={def.path} />{def.label}</label>
          <ComponentChips value={value as string[]} onChange={set} />
        </div>
      );
    case 'palette':
      return (
        <div className="field">
          <label className="field-label" title={def.hint}><ControlGlyph path={def.path} />{def.label}</label>
          <PaletteInput value={value} onChange={set} />
        </div>
      );
    case 'classcolors':
      return (
        <div className="field">
          <label className="field-label" title={def.hint}><ControlGlyph path={def.path} />{def.label}</label>
          <ClassColors value={(value ?? {}) as Record<string, string>} onChange={set} />
        </div>
      );
    case 'text':
    default:
      return (
        <div className="field row">
          <label className="field-label" title={def.hint}><ControlGlyph path={def.path} />{def.label}</label>
          <input name={def.path} autoComplete="off" aria-label={def.label} className="text-input mono" value={String(value ?? '')} onChange={(e) => set(e.target.value)} spellCheck={false} />
        </div>
      );
  }
}
