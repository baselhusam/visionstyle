import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { ColorList } from './ColorInput';

let cached: Record<string, string[]> | null = null;

export function usePalettes() {
  const [p, setP] = useState<Record<string, string[]>>(cached ?? {});
  useEffect(() => {
    if (cached) return;
    fetch('/api/palettes')
      .then((r) => r.json())
      .then((d) => {
        cached = d;
        setP(d);
      })
      .catch(() => undefined);
  }, []);
  return p;
}

export function PaletteInput({ value, onChange }: { value: string | string[]; onChange: (v: string | string[]) => void }) {
  const palettes = usePalettes();
  const custom = Array.isArray(value);
  return (
    <div className="palette-input">
      <div className="palette-grid">
        {Object.entries(palettes).map(([name, colors]) => (
          <button key={name} type="button" className={`palette ${value === name ? 'active' : ''}`} onClick={() => onChange(name)} title={name}>
            <span className="palette-strip">
              {colors.slice(0, 6).map((c) => (
                <i key={c} style={{ background: c }} />
              ))}
            </span>
            <span className="mono small">{name}</span>
          </button>
        ))}
        <button
          type="button"
          className={`palette ${custom ? 'active' : ''}`}
          onClick={() => onChange(custom ? value : palettes[typeof value === 'string' ? value : 'default'] ?? ['#ff5c35'])}
        >
          <span className="palette-strip custom">
            <i />
          </span>
          <span className="mono small">custom</span>
        </button>
      </div>
      {custom && <ColorList value={value as string[]} onChange={onChange} />}
    </div>
  );
}

export function ClassColors({ value, onChange }: { value: Record<string, string>; onChange: (v: Record<string, string>) => void }) {
  const detections = useStore((s) => s.detections);
  const classes = Array.from(new Set(detections.map((d) => d.class_name).filter(Boolean))) as string[];
  const [name, setName] = useState('');
  const entries = Object.entries(value);
  return (
    <div className="class-colors">
      {entries.map(([k, c]) => (
        <div key={k} className="color-list-row">
          <label className="color-well" style={{ background: c }}>
            <input type="color" value={c} onChange={(e) => onChange({ ...value, [k]: e.target.value })} />
          </label>
          <span className="mono small">{k}</span>
          <button
            type="button"
            className="ghost"
            onClick={() => {
              const next = { ...value };
              delete next[k];
              onChange(next);
            }}
            aria-label={`Remove ${k}`}
          >
            ×
          </button>
        </div>
      ))}
      <div className="color-list-row">
        <input className="text-input mono" list="class-names" placeholder="class name" value={name} onChange={(e) => setName(e.target.value)} />
        <datalist id="class-names">
          {classes.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <button
          type="button"
          className="ghost add"
          disabled={!name.trim()}
          onClick={() => {
            onChange({ ...value, [name.trim()]: '#ff5c35' });
            setName('');
          }}
        >
          + Add
        </button>
      </div>
    </div>
  );
}
