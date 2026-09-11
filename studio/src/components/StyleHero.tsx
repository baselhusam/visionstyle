import { useStore } from '../store';

interface StyleHeroProps { onFineTune: () => void; }

const PRESETS = ['minimal', 'default', 'corners', 'cinematic', 'neon'];

export function StyleHero({ onFineTune }: StyleHeroProps) {
  const presets = useStore((s) => s.presets);
  const activePreset = useStore((s) => s.activePreset);
  const applyPreset = useStore((s) => s.applyPreset);
  const style = useStore((s) => s.style);
  const setPath = useStore((s) => s.setPath);

  const choosePreset = (name: string) => applyPreset(name);
  const setShape = (shape: string) => setPath('box.shape', shape);
  const setMotion = (motion: string) => setPath('line.animation', motion);

  return (
    <section className="style-hero" aria-label="Style configuration">
      <div className="hero-copy">
        <p className="hero-kicker">Style direction / live</p>
        <h1>Frame the<br /><em>important.</em></h1>
        <p>Give detection a visual language, then see the result immediately below.</p>
      </div>
      <div className="hero-controls">
        <div className="hero-control hero-presets">
          <span className="control-caption">Starting point</span>
          <div className="preset-pills" role="radiogroup" aria-label="Style preset">
            {PRESETS.map((name) => {
              const preset = presets.find((item) => item.name === name);
              if (!preset) return null;
              return <button type="button" role="radio" aria-checked={activePreset === name} className={activePreset === name ? 'active' : ''} key={name} onClick={() => choosePreset(name)}>{name}</button>;
            })}
          </div>
        </div>
        <div className="quick-controls">
          <div className="hero-control">
            <span className="control-caption">Frame</span>
            <div className="inline-segment" role="radiogroup" aria-label="Frame shape">
              {['rectangle', 'corners', 'rounded'].map((shape) => <button type="button" role="radio" aria-checked={style.box?.shape === shape} className={style.box?.shape === shape ? 'active' : ''} key={shape} onClick={() => setShape(shape)}>{shape === 'rectangle' ? 'classic' : shape}</button>)}
            </div>
          </div>
          <div className="hero-control hero-toggles">
            <span className="control-caption">Essentials</span>
            <label className={style.label?.enabled ? 'active' : ''}><input type="checkbox" checked={Boolean(style.label?.enabled)} onChange={(event) => setPath('label.enabled', event.target.checked)} />labels</label>
            <label className={style.fill?.enabled ? 'active' : ''}><input type="checkbox" checked={Boolean(style.fill?.enabled)} onChange={(event) => setPath('fill.enabled', event.target.checked)} />fill</label>
            <label className={style.effects?.glow?.enabled ? 'active' : ''}><input type="checkbox" checked={Boolean(style.effects?.glow?.enabled)} onChange={(event) => setPath('effects.glow.enabled', event.target.checked)} />glow</label>
          </div>
          <div className="hero-control">
            <span className="control-caption">Motion</span>
            <div className="inline-segment motion" role="radiogroup" aria-label="Overlay motion">
              {[['none', 'still'], ['march', 'march'], ['pulse', 'pulse']].map(([value, label]) => <button type="button" role="radio" aria-checked={style.line?.animation === value} className={style.line?.animation === value ? 'active' : ''} key={value} onClick={() => setMotion(value)}>{label}</button>)}
            </div>
          </div>
        </div>
        <button type="button" className="fine-tune" onClick={onFineTune}>Fine tune style <span>↗</span></button>
      </div>
    </section>
  );
}
