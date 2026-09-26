import { describe, expect, it } from 'vitest';
import { CONTROL_INDEX, SECTIONS } from '../controls/registry';
import { defaultStyle, schemaAt } from '../schema';
import { aboveThreshold, getDeep, setDeep, useStore } from '../store';

describe('schema helpers', () => {
  it('builds a full default style with every section', () => {
    const s = defaultStyle();
    expect(s.box.shape).toBe('rectangle');
    expect(s.label.components).toEqual(['text', 'confidence']);
    expect(s.effects.glow.enabled).toBe(false);
    expect(s.trail.length).toBe(30);
  });
  it('resolves nested paths through $ref', () => {
    expect(schemaAt('effects.glow.radius')?.maximum).toBe(120);
    expect(schemaAt('stroke.color')?.format).toBe('color');
    expect(schemaAt('nope.nope')).toBeUndefined();
  });
});

describe('control registry', () => {
  it('every control points at a real schema field', () => {
    for (const sec of SECTIONS) {
      for (const c of sec.controls) {
        expect(schemaAt(c.path), c.path).toBeDefined();
      }
      if (sec.master) expect(schemaAt(sec.master)?.type).toBe('boolean');
    }
  });
  it('derives kinds, ranges and options from the schema', () => {
    expect(CONTROL_INDEX['stroke.thickness'].kind).toBe('slider');
    expect(CONTROL_INDEX['stroke.thickness'].min).toBe(0.5);
    expect(CONTROL_INDEX['box.shape'].options).toContain('corners');
    expect(CONTROL_INDEX['stroke.color'].specials).toEqual(['confidence', 'palette']);
    expect(CONTROL_INDEX['label.uppercase'].kind).toBe('toggle');
  });
});

describe('deep set/get', () => {
  it('returns a new object without mutating the source', () => {
    const a = defaultStyle();
    const b = setDeep(a, 'effects.glow.radius', 30);
    expect(getDeep(b, 'effects.glow.radius')).toBe(30);
    expect(getDeep(a, 'effects.glow.radius')).toBe(12);
    expect(b).not.toBe(a);
  });
});

describe('confidence threshold on a tracked video', () => {
  const det = (track_id: number, confidence: number | null) => ({ xyxy: [0, 0, 1, 1] as [number, number, number, number], class_id: 0, class_name: 'car', confidence, track_id });

  it('keeps detections at or above the threshold and those without a score', () => {
    const kept = aboveThreshold([det(1, 0.12), det(2, 0.3), det(3, 0.55), det(4, null)], 0.3);
    expect(kept.map((d) => d.track_id)).toEqual([2, 3, 4]);
  });

  it('filters the stored frame live as the slider moves, without detecting again', () => {
    const frames = [
      { index: 0, time: 0, detections: [det(1, 0.15), det(2, 0.8)] },
      { index: 1, time: 0.1, detections: [det(1, 0.45), det(2, 0.8)] },
    ];
    useStore.setState({ frames, frameIndex: 0, conf: 0.3, detections: [], imageId: null });
    useStore.getState().setFrame(0);
    expect(useStore.getState().detections.map((d) => d.track_id)).toEqual([2]);
    useStore.getState().setConf(0.1);
    expect(useStore.getState().detections.map((d) => d.track_id)).toEqual([1, 2]);
    useStore.getState().setConf(0.5);
    useStore.getState().setFrame(1);
    expect(useStore.getState().detections.map((d) => d.track_id)).toEqual([2]);
    expect(useStore.getState().detecting).toBe(false);
  });
});
