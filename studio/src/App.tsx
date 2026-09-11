import { useEffect } from 'react';
import { Detections } from './components/Detections';
import { Export } from './components/Export';
import { Preview } from './components/Preview';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { useStore } from './store';

export default function App() {
  const boot = useStore((s) => s.boot);
  const toast = useStore((s) => s.toast);
  const error = useStore((s) => s.error);
  const setError = useStore((s) => s.setError);
  const playing = useStore((s) => s.playing);
  const setPlaying = useStore((s) => s.setPlaying);
  const style = useStore((s) => s.style);
  const renderMs = useStore((s) => s.renderMs);
  const resetStyle = useStore((s) => s.resetStyle);
  const synthetic = useStore((s) => s.syntheticTrails);
  const setSynthetic = useStore((s) => s.setSyntheticTrails);
  const images = useStore((s) => s.images);
  const imageId = useStore((s) => s.imageId);
  const detections = useStore((s) => s.detections);
  const hidden = useStore((s) => s.hidden);
  const animated = style.line?.animation !== 'none' && (style.line?.speed ?? 0) > 0;

  useEffect(() => {
    boot();
  }, [boot]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/input|select|textarea/i.test((e.target as HTMLElement).tagName)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        setPlaying(!useStore.getState().playing);
      }
      if (e.key.toLowerCase() === 'r') resetStyle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setPlaying, resetStyle]);

  const img = images.find((i) => i.id === imageId);

  return (
    <div className="app">
      <TopBar />
      <main className="layout">
        <Sidebar />
        <section className="workspace" aria-label="Live preview">
          <header className="workspace-head">
            <div className="file-name mono">
              <span>{img?.name ?? '—'}</span>
              <span className="dim">
                · {detections.length - hidden.size} objects · {renderMs ? `${renderMs.toFixed(0)} ms` : ''}
              </span>
            </div>
            <div className="workspace-actions">
              <label className={`pill-toggle ${synthetic ? 'on' : ''}`} title="Preview trails on a still image">
                <input type="checkbox" checked={synthetic} onChange={(e) => setSynthetic(e.target.checked)} />
                trail preview
              </label>
              <button type="button" className={`icon-button ${playing ? 'active' : ''}`} onClick={() => setPlaying(!playing)} disabled={!animated} title={animated ? 'Play / pause animation (Space)' : 'Enable a line animation to play'}>
                {playing ? '❚❚' : '▶'}
              </button>
              <button type="button" className="icon-button" onClick={resetStyle} title="Reset to preset (R)">
                ↺
              </button>
            </div>
          </header>
          <div className="canvas-wrap">
            <Preview />
          </div>
          <footer className="workspace-foot mono">
            <span>preview renders with the python package · what you see is what you ship</span>
            <span className="shortcut">
              <kbd>Space</kbd> play <kbd>R</kbd> reset <kbd>dbl-click</kbd> 1:1
            </span>
          </footer>
        </section>
        <aside className="rail">
          <Detections />
          <Export />
        </aside>
      </main>
      <div className={`toast ${toast ? 'show' : ''}`} role="status">
        {toast}
      </div>
      {error && (
        <div className="error-bar" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}
    </div>
  );
}
