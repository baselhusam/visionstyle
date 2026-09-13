import { useMemo } from 'react';
import { detectionKey, useStore } from '../store';

export function DetectionShelf() {
  const detections = useStore((s) => s.detections);
  const tracked = useStore((s) => s.frames !== null);
  const hidden = useStore((s) => s.hidden);
  const selectedClass = useStore((s) => s.selectedClass);
  const selectClass = useStore((s) => s.selectClass);
  const groups = useMemo(() => {
    const counted = new Map<string, number>();
    let visible = 0;
    detections.forEach((detection, index) => {
      if (hidden.has(detectionKey(detection, index, tracked))) return;
      visible += 1;
      const name = detection.class_name ?? `class ${detection.class_id ?? '—'}`;
      counted.set(name, (counted.get(name) ?? 0) + 1);
    });
    return { visible, entries: [...counted.entries()].sort(([a], [b]) => a.localeCompare(b)) };
  }, [detections, hidden, tracked]);
  const visible = groups.visible;
  if (!detections.length) return <div className="detection-shelf empty"><span>Run detection to see classes here.</span></div>;
  return <div className="detection-shelf" aria-label="Filter detections by class">
    <span className="shelf-label">Show boxes</span>
    <button type="button" className={!selectedClass ? 'active' : ''} onClick={() => selectClass(null)}>all <b>{visible}</b></button>
    {groups.entries.map(([name, count]) => <button type="button" className={selectedClass === name ? 'active' : ''} key={name} onClick={() => selectClass(name)}>{name} <b>{count}</b></button>)}
  </div>;
}
