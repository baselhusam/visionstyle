import { useState } from 'react';
import { detectionKey, useStore } from '../store';
import { Icon } from './Icon';

export function Detections() {
  const detections = useStore((s) => s.detections);
  const tracked = useStore((s) => s.frames !== null);
  const hidden = useStore((s) => s.hidden);
  const selected = useStore((s) => s.selected);
  const toggle = useStore((s) => s.toggleHidden);
  const setHidden = useStore((s) => s.setHidden);
  const select = useStore((s) => s.select);
  const [query, setQuery] = useState('');
  const keys = detections.map((detection, index) => detectionKey(detection, index, tracked));
  const hiddenHere = keys.filter((key) => hidden.has(key)).length;
  const visible = detections.length - hiddenHere;
  const filtered = detections
    .map((detection, index) => ({ detection, index, key: keys[index] }))
    .filter(({ detection }) => (detection.class_name ?? `class ${detection.class_id}`).toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <section className="rail-section">
      <div className="section-label">
        <span>Detected objects</span>
        <span>
          {String(visible).padStart(2, '0')} / {String(detections.length).padStart(2, '0')}
        </span>
      </div>
      {detections.length > 0 && <div className="object-toolbar">
        <label className="object-search">
          <Icon name="search" />
          <span className="sr-only">Filter objects</span>
          <input name="object-filter" autoComplete="off" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="e.g. person…" />
          {query && <button type="button" aria-label="Clear object filter" onClick={() => setQuery('')}>×</button>}
        </label>
        <div className="visibility-actions" aria-label="Object visibility">
          <button type="button" onClick={() => setHidden(new Set())} disabled={hidden.size === 0}><Icon name="eye" /> Show all</button>
          <button type="button" onClick={() => setHidden(new Set([...hidden, ...keys]))} disabled={hiddenHere === detections.length}><Icon name="eyeOff" /> Hide all</button>
        </div>
      </div>}
      <div className="object-list">
        {detections.length === 0 && <p className="muted small">No detections yet. Choose a model and press Detect.</p>}
        {detections.length > 0 && filtered.length === 0 && <div className="object-empty"><Icon name="search" /><strong>No matching objects</strong><span>Try another class name.</span></div>}
        {filtered.map(({ detection: d, index: i, key }) => (
          <div key={key} className={`object-row ${selected === key ? 'active' : ''} ${hidden.has(key) ? 'hidden' : ''}`}>
            <button type="button" className="object-toggle" aria-label={`${hidden.has(key) ? 'Show' : 'Hide'} ${d.class_name ?? `class ${d.class_id}`} ${tracked && d.track_id !== null ? `#${d.track_id}` : i + 1}`} aria-pressed={!hidden.has(key)} onClick={() => toggle(key)} />
            <button type="button" className="object-main" aria-pressed={selected === key} onClick={() => select(key)} title={tracked ? 'Select to isolate this track' : 'Select to isolate'}>
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
