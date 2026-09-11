import { SECTIONS } from '../controls/registry';
import { getDeep, useStore, type PanelId } from '../store';
import { Control } from './Control';
import { PresetList } from './PresetList';

export function Sidebar() {
  const open = useStore((s) => s.openPanels);
  const toggle = useStore((s) => s.togglePanel);
  const style = useStore((s) => s.style);
  const setPath = useStore((s) => s.setPath);
  const dirty = useStore((s) => s.dirty);
  const activePreset = useStore((s) => s.activePreset);

  return (
    <aside className="sidebar" aria-label="Style configuration">
      <div className="side-head">
        <strong>Style</strong>
        <span className="counter mono">{activePreset ? activePreset.toUpperCase() : 'CUSTOM'}{dirty ? ' •' : ''}</span>
      </div>

      <section className={`panel ${open.has('presets') ? 'open' : ''}`}>
        <button type="button" className="panel-head" onClick={() => toggle('presets')} aria-expanded={open.has('presets')}>
          <span className="panel-code mono">00</span>
          <span className="panel-title">Presets</span>
          <span className="panel-caret" />
        </button>
        {open.has('presets') && (
          <div className="panel-body">
            <PresetList />
          </div>
        )}
      </section>

      {SECTIONS.map((sec) => {
        const isOpen = open.has(sec.id as PanelId);
        const masterOn = sec.master ? Boolean(getDeep(style, sec.master)) : true;
        return (
          <section key={sec.id} className={`panel ${isOpen ? 'open' : ''} ${masterOn ? '' : 'off'}`}>
            <button type="button" className="panel-head" onClick={() => toggle(sec.id as PanelId)} aria-expanded={isOpen}>
              <span className="panel-code mono">{sec.code}</span>
              <span className="panel-title">{sec.title}</span>
              {sec.master && (
                <span
                  className={`mini-toggle ${masterOn ? 'on' : ''}`}
                  role="switch"
                  aria-checked={masterOn}
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPath(sec.master!, !masterOn);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                      setPath(sec.master!, !masterOn);
                    }
                  }}
                />
              )}
              <span className="panel-caret" />
            </button>
            {isOpen && (
              <div className="panel-body">
                {sec.intro && <p className="panel-intro">{sec.intro}</p>}
                {sec.controls.map((c) => (
                  <Control key={c.path} def={c} />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </aside>
  );
}
