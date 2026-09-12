import { useState } from 'react';
import { Icon } from './Icon';

const ALL = ['text', 'confidence', 'track_id', 'class_id', 'custom'] as const;
const LABELS: Record<string, string> = { text: 'Name', confidence: 'Confidence', track_id: 'Track id', class_id: 'Class id', custom: 'Custom' };

export function ComponentChips({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [drag, setDrag] = useState<number | null>(null);
  const missing = ALL.filter((c) => !value.includes(c));

  const move = (from: number, to: number) => {
    if (from === to) return;
    const next = [...value];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  return (
    <div className="chips">
      <div className="chip-row">
        {value.map((c, i) => (
          <span
            key={c}
            className={`chip ${drag === i ? 'dragging' : ''}`}
            draggable
            onDragStart={() => setDrag(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (drag !== null) move(drag, i);
              setDrag(null);
            }}
            onDragEnd={() => setDrag(null)}
            title="Drag to reorder, or use the arrow buttons"
          >
            <span className="chip-grip">⋮⋮</span>
            {LABELS[c] ?? c}
            <span className="chip-order">
              <button type="button" disabled={i === 0} aria-label={`Move ${LABELS[c] ?? c} earlier`} onClick={() => move(i, i - 1)}><Icon name="previous" /></button>
              <button type="button" disabled={i === value.length - 1} aria-label={`Move ${LABELS[c] ?? c} later`} onClick={() => move(i, i + 1)}><Icon name="next" /></button>
            </span>
            <button type="button" aria-label={`Remove ${c}`} onClick={() => onChange(value.filter((x) => x !== c))}>
              ×
            </button>
          </span>
        ))}
        {value.length === 0 && <span className="muted small">No components — label hidden.</span>}
      </div>
      {missing.length > 0 && (
        <div className="chip-row add-row">
          {missing.map((c) => (
            <button key={c} type="button" className="chip ghost" onClick={() => onChange([...value, c])}>
              + {LABELS[c]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
