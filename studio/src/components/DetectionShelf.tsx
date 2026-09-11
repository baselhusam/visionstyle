import { useMemo } from 'react';
import { useStore } from '../store';

export function DetectionShelf() {
  const detections = useStore((s) => s.detections);
  const hidden = useStore((s) => s.hidden);
  const selectedClass = useStore((s) => s.selectedClass);
  const selectClass = useStore((s) => s.selectClass);
  const groups = useMemo(() => {
    const counted = new Map<string, number>();
    detections.forEach((detection, index) => {
      if (hidden.has(index)) return;
      const name = detection.class_name ?? `class ${detection.class_id ?? '—'}`;
      counted.set(name, (counted.get(name) ?? 0) + 1);
    });
    return [...counted.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [detections, hidden]);
  const visible = detections.length - hidden.size;
  if (!detections.length) return <div className="detection-shelf empty"><span>Run detection to see classes here.</span></div>;
  return <div className="detection-shelf" aria-label="Filter detections by class">
    <span className="shelf-label">Show boxes</span>
    <button type="button" className={!selectedClass ? 'active' : ''} onClick={() => selectClass(null)}>all <b>{visible}</b></button>
    {groups.map(([name, count]) => <button type="button" className={selectedClass === name ? 'active' : ''} key={name} onClick={() => selectClass(name)}>{name} <b>{count}</b></button>)}
  </div>;
}
