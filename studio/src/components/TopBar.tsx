import { useStore } from '../store';

export type StudioPanel = 'media' | 'style' | 'export' | null;

interface TopBarProps {
  panel: StudioPanel;
  onPanelChange: (panel: StudioPanel) => void;
  onOpenDetections: () => void;
}

export function TopBar({ panel, onPanelChange, onOpenDetections }: TopBarProps) {
  const images = useStore((s) => s.images);
  const imageId = useStore((s) => s.imageId);
  const detect = useStore((s) => s.detect);
  const detecting = useStore((s) => s.detecting);
  const detections = useStore((s) => s.detections);
  const hidden = useStore((s) => s.hidden);
  const activePreset = useStore((s) => s.activePreset);
  const dirty = useStore((s) => s.dirty);
  const info = useStore((s) => s.info);
  const current = images.find((i) => i.id === imageId);
  const visibleCount = detections.length - hidden.size;
  const toggle = (next: Exclude<StudioPanel, null>) => onPanelChange(panel === next ? null : next);

  return (
    <header className="appbar">
      <div className="appbar-brand" aria-label="visionstyle Studio">
        <span className="wordmark">visionstyle</span>
        <span className="brand-context">Studio</span>
      </div>
      <nav className="app-nav" aria-label="Studio workspace">
        <button type="button" className={panel === 'media' ? 'active' : ''} onClick={() => toggle('media')}>Media {current && <small>{current.name}</small>}</button>
        <button type="button" className={panel === 'style' ? 'active' : ''} onClick={() => toggle('style')}>Fine tune <small>{dirty ? 'unsaved' : activePreset ?? 'custom'}</small></button>
        <button type="button" className={panel === 'export' ? 'active' : ''} onClick={() => toggle('export')}>Export</button>
      </nav>
      <div className="appbar-actions">
        <button type="button" className="detection-count" onClick={onOpenDetections} aria-label="Open detections"><i /> {visibleCount} detections</button>
        <button type="button" className="detect-action" onClick={() => detect()} disabled={detecting || !imageId}><span className="detect-corners" aria-hidden="true" />{detecting ? 'Scanning…' : 'Detect'}</button>
        <span className={`server-state ${info ? 'ready' : ''}`} title={info ? `visionstyle ${info.version}` : 'Connecting to Studio'} />
      </div>
    </header>
  );
}
