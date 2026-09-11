import { describe, expect, it } from 'vitest';
import { CONTROL_INDEX, SECTIONS } from '../controls/registry';
import { defaultStyle, schemaAt } from '../schema';
import { getDeep, setDeep } from '../store';

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
