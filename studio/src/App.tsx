import { useEffect, useState } from 'react';
import { Detections } from './components/Detections';
import { DetectionShelf } from './components/DetectionShelf';
import { Export } from './components/Export';
import { MediaSetup } from './components/MediaSetup';
import { Preview } from './components/Preview';
import { Sidebar } from './components/Sidebar';
import { StyleHero } from './components/StyleHero';
import { TopBar, type StudioPanel } from './components/TopBar';
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
  const animated = style.line?.animation !== 'none' && (style.line?.speed ?? 0) > 0;
  const [panel, setPanel] = useState<StudioPanel>(null);
  const [detectionsOpen, setDetectionsOpen] = useState(false);

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
      <TopBar panel={panel} onPanelChange={(next) => { setPanel(next); setDetectionsOpen(false); }} onOpenDetections={() => { setPanel(null); setDetectionsOpen(true); }} />
      <main className="studio-stage" aria-label="visionstyle live preview">
        <StyleHero onFineTune={() => { setPanel('style'); setDetectionsOpen(false); }} />
        <section className="cinema" aria-label="Live preview">
          <div className="cinema-meta mono"><span>Live scene</span><span>{img?.name ?? 'Choose a source'} {renderMs ? `· ${renderMs.toFixed(0)} ms` : ''}</span></div>
          <div className="cinema-canvas"><Preview /></div>
          <DetectionShelf />
          <div className="cinema-controls">
            <label className={`stage-toggle ${synthetic ? 'on' : ''}`} title="Preview trails on a still image"><input type="checkbox" checked={synthetic} onChange={(event) => setSynthetic(event.target.checked)} /><span /> trails</label>
            <button type="button" className={`playback ${playing ? 'active' : ''}`} onClick={() => setPlaying(!playing)} disabled={!animated} title={animated ? 'Play or pause animated overlay (Space)' : 'Enable line animation in Style to play'}><b>{playing ? 'Ⅱ' : '▶'}</b> {playing ? 'Playing' : 'Preview motion'}</button>
            <button type="button" className="reset-stage" onClick={resetStyle} title="Reset to preset (R)">Reset style</button>
            <span className="stage-hint">{animated ? 'Space to play · double-click for 1:1' : 'Turn on motion in Style to play'}</span>
          </div>
        </section>
      </main>

      <div className={`drawer-scrim ${panel || detectionsOpen ? 'visible' : ''}`} onClick={() => { setPanel(null); setDetectionsOpen(false); }} />
      <aside className={`studio-drawer ${panel ? 'open' : ''}`} aria-hidden={!panel}>
        <div className="drawer-bar"><span className="mono">{panel === 'style' ? 'Style controls' : panel === 'media' ? 'Media setup' : 'Export settings'}</span><button type="button" onClick={() => setPanel(null)} aria-label="Close panel">×</button></div>
        {panel === 'media' && <MediaSetup />}
        {panel === 'style' && <Sidebar />}
        {panel === 'export' && <Export />}
      </aside>
      <aside className={`detections-drawer ${detectionsOpen ? 'open' : ''}`} aria-hidden={!detectionsOpen}>
        <div className="drawer-bar"><span className="mono">Scene detections</span><button type="button" onClick={() => setDetectionsOpen(false)} aria-label="Close detections">×</button></div>
        <p className="detection-intro">Open only when you need to isolate or suppress an object. The scene stays clean by default.</p>
        <Detections />
      </aside>
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
