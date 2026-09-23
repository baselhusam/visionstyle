import type { PresetInfo } from '../api';
import { useStore } from '../store';

const GLYPH: Record<string, string> = {
  default: 'rect',
  minimal: 'hair',
  corners: 'corner',
  rounded: 'round',
  dashed: 'dash',
  glass: 'glass',
  neon: 'glow',
  hud: 'hud',
  cinematic: 'cine',
  tracking: 'trail',
  spotlight: 'spot',
  confidence: 'conf',
};

/** Saved presets have no hand-drawn art, so draw theirs from the box shape and line pattern. */
function glyphFor({ name, origin, style }: PresetInfo): string {
  if (origin === 'builtin') return GLYPH[name] ?? 'rect';
  const shape = style.box?.shape;
  if (shape === 'corners') return 'corner';
  if (shape === 'reticle') return 'hud';
  if (shape === 'rounded') return 'round';
  return style.line?.pattern === 'dashed' || style.line?.pattern === 'dotted' ? 'dash' : 'rect';
}

// Defined at module scope: a component created inside the render would be a new type every
// render, remounting every card (and eating clicks) whenever the list re-renders.
function Item(preset: PresetInfo) {
  const { name, description, origin } = preset;
  const active = useStore((s) => s.activePreset === name);
  const apply = useStore((s) => s.applyPreset);
  const remove = useStore((s) => s.deletePreset);
  return (
    <div className={`preset ${origin === 'builtin' ? 'builtin' : ''} ${active ? 'active' : ''}`}>
      <button type="button" className="preset-main" aria-pressed={active} onClick={() => apply(name)}>
        <span className={`preset-art art-${name}`} aria-hidden="true"><span className={`glyph ${glyphFor(preset)}`} /></span>
        <span className="preset-text">
          <strong>{name}</strong>
          <small>{description || (origin === 'builtin' ? 'Built-in style' : 'Saved preset')}</small>
        </span>
      </button>
      {origin !== 'builtin' && (
        <button type="button" className="preset-delete" aria-label={`Delete ${name} preset`} title="Delete preset" onClick={() => confirm(`Delete preset “${name}”?`) && remove(name)}>
          ×
        </button>
      )}
    </div>
  );
}

export function PresetList() {
  const presets = useStore((s) => s.presets);
  const builtin = presets.filter((p) => p.origin === 'builtin');
  const mine = presets.filter((p) => p.origin !== 'builtin');

  return (
    <div className="preset-list">
      {mine.length > 0 && (
        <section className="preset-group">
          <div className="section-label">
            <span>Your presets</span>
            <span>{String(mine.length).padStart(2, '0')}</span>
          </div>
          <div className="preset-rail">
            {mine.map((p) => <Item key={p.name} {...p} />)}
          </div>
        </section>
      )}
      <section className="preset-group">
        <div className="section-label">
          <span>Built-in</span>
          <span>{String(builtin.length).padStart(2, '0')}</span>
        </div>
        <div className="preset-rail">
          {builtin.map((p) => <Item key={p.name} {...p} />)}
        </div>
      </section>
    </div>
  );
}
