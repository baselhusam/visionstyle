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

export function PresetList() {
  const presets = useStore((s) => s.presets);
  const active = useStore((s) => s.activePreset);
  const apply = useStore((s) => s.applyPreset);
  const remove = useStore((s) => s.deletePreset);
  const builtin = presets.filter((p) => p.origin === 'builtin');
  const mine = presets.filter((p) => p.origin !== 'builtin');

  const Item = ({ name, description, origin }: { name: string; description: string; origin: string }) => (
    <div className={`preset ${active === name ? 'active' : ''}`}>
      <button type="button" className="preset-main" onClick={() => apply(name)}>
        <span className={`glyph ${GLYPH[name] ?? 'rect'}`} aria-hidden="true" />
        <span className="preset-text">
          <strong>{name}</strong>
          <small>{description || (origin === 'builtin' ? 'Built-in' : 'Saved preset')}</small>
        </span>
      </button>
      {origin !== 'builtin' && (
        <button type="button" className="preset-delete" title="Delete preset" onClick={() => confirm(`Delete preset "${name}"?`) && remove(name)}>
          ×
        </button>
      )}
    </div>
  );

  return (
    <div className="preset-list">
      {mine.length > 0 && (
        <>
          <div className="section-label">
            <span>Your presets</span>
            <span>{String(mine.length).padStart(2, '0')}</span>
          </div>
          {mine.map((p) => (
            <Item key={p.name} {...p} />
          ))}
        </>
      )}
      <div className="section-label">
        <span>Built-in</span>
        <span>{String(builtin.length).padStart(2, '0')}</span>
      </div>
      {builtin.map((p) => (
        <Item key={p.name} {...p} />
      ))}
    </div>
  );
}
