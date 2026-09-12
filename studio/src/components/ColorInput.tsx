import { useEffect, useState } from 'react';

const SWATCHES = ['#ff5c35', '#d8ff3e', '#54dff4', '#ffdd75', '#f4f1e8', '#ef6dff', '#5cff9d', '#7d8cff', '#111214', '#f3af45'];

const SPECIAL_LABEL: Record<string, string> = {
  palette: 'Palette',
  confidence: 'Confidence',
  inherit: 'Inherit',
  auto: 'Auto',
};

function isSpecial(v: string) {
  return v in SPECIAL_LABEL || v === 'none';
}

function toHex(v: string): string {
  return /^#[0-9a-f]{6}$/i.test(v) ? v : '#ff5c35';
}

export function ColorInput({ value, specials = [], onChange }: { value: string; specials?: string[]; onChange: (v: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const special = isSpecial(value) ? value : null;

  return (
    <div className="color-input">
      {specials.length > 0 && (
        <div className="segment" role="radiogroup" aria-label="Color mode">
          {specials.map((s) => (
            <button key={s} type="button" className={special === s ? 'active' : ''} onClick={() => onChange(s)} title={s}>
              {SPECIAL_LABEL[s] ?? s}
            </button>
          ))}
          <button type="button" className={special ? '' : 'active'} onClick={() => onChange(toHex(value))}>
            Custom
          </button>
        </div>
      )}
      {(!special || specials.length === 0) && (
        <div className="color-row">
          <label className="color-well" style={{ background: toHex(value) }}>
            <input type="color" value={toHex(value)} onChange={(e) => onChange(e.target.value)} aria-label="Pick color" />
          </label>
          <input
            className="text-input mono"
            name="color-value"
            autoComplete="off"
            aria-label="Color value"
            value={text}
            spellCheck={false}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => {
              if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(text) || /^[a-z]+$/i.test(text) || /^rgb/.test(text)) onChange(text.toLowerCase());
              else setText(value);
            }}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
          <div className="swatches">
            {SWATCHES.map((c) => (
              <button key={c} type="button" className={`swatch ${c === value ? 'active' : ''}`} style={{ background: c }} onClick={() => onChange(c)} aria-label={c} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function ColorList({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="color-list">
      {value.map((c, i) => (
        <div key={i} className="color-list-row">
          <label className="color-well" style={{ background: toHex(c) }}>
            <input type="color" value={toHex(c)} aria-label={`Pick color ${i + 1}`} onChange={(e) => onChange(value.map((x, j) => (j === i ? e.target.value : x)))} />
          </label>
          <span className="mono small">{c}</span>
          <button type="button" className="ghost" disabled={value.length <= 1} onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="Remove color">
            ×
          </button>
        </div>
      ))}
      <button type="button" className="ghost add" onClick={() => onChange([...value, SWATCHES[value.length % SWATCHES.length]])}>
        + Add color
      </button>
    </div>
  );
}
