import { useStore } from '../store';

export function Detections() {
  const detections = useStore((s) => s.detections);
  const hidden = useStore((s) => s.hidden);
  const selected = useStore((s) => s.selected);
  const toggle = useStore((s) => s.toggleHidden);
  const select = useStore((s) => s.select);
  const visible = detections.length - hidden.size;

  return (
    <section className="rail-section">
      <div className="section-label">
        <span>Detected objects</span>
        <span>
          {String(visible).padStart(2, '0')} / {String(detections.length).padStart(2, '0')}
        </span>
      </div>
      <div className="object-list">
        {detections.length === 0 && <p className="muted small">No detections yet. Choose a model and press Detect.</p>}
        {detections.map((d, i) => (
          <div key={i} className={`object-row ${selected === i ? 'active' : ''} ${hidden.has(i) ? 'hidden' : ''}`}>
            <button type="button" className="object-toggle" aria-label={hidden.has(i) ? 'Show' : 'Hide'} aria-pressed={!hidden.has(i)} onClick={() => toggle(i)} />
            <button type="button" className="object-main" onClick={() => select(i)} title="Click to isolate">
              <span className="object-name">{d.class_name ?? `class ${d.class_id}`}</span>
              <span className="object-meta mono">
                {d.track_id !== null && `#${d.track_id} · `}
                {Math.round(d.xyxy[0])},{Math.round(d.xyxy[1])} · {Math.round(d.xyxy[2] - d.xyxy[0])}×{Math.round(d.xyxy[3] - d.xyxy[1])}
              </span>
            </button>
            <span className="confidence mono">{d.confidence !== null ? `${Math.round(d.confidence * 100)}%` : '—'}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
