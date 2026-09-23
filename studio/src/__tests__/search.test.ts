import { describe, expect, it } from 'vitest';
import { CONTROL_INDEX } from '../controls/registry';
import { defaultStyle } from '../schema';
import { highlightRuns, revealer, searchSettings } from '../search';

describe('settings search', () => {
  it('finds a setting by label across sections', () => {
    const { groups } = searchSettings('dash length', defaultStyle());
    expect(groups.map((g) => g.section.id)).toEqual(['line']);
    // "Gap" also matches (its description mentions dashes) but the label match leads
    expect(groups[0].hits[0].def.path).toBe('line.dash_length');
  });
  it('matches a section title to every setting in it', () => {
    const { groups } = searchSettings('effects', defaultStyle());
    const effects = groups.find((g) => g.section.id === 'effects')!;
    expect(effects.hits.length).toBeGreaterThan(10);
  });
  it('puts sections whose labels match ahead of description-only matches', () => {
    const { groups } = searchSettings('opacity', defaultStyle());
    expect(groups.length).toBeGreaterThan(1);
    expect(groups.every((g, i) => i === 0 || g.hits[0].def.label.toLowerCase().includes('opacity') <= groups[i - 1].hits[0].def.label.toLowerCase().includes('opacity'))).toBe(true);
  });
  it('requires every word, in any order', () => {
    expect(searchSettings('radius glow', defaultStyle()).count).toBe(1);
    expect(searchSettings('glow nonsense', defaultStyle()).count).toBe(0);
  });
  it('flags hidden matches and names the setting that reveals them', () => {
    const style = defaultStyle();
    const group = searchSettings('glow radius', style).groups[0];
    const hit = group.hits[0];
    expect(hit.visible).toBe(false);
    expect(revealer(hit, group)?.path).toBe('effects.glow.enabled');
    expect(hit.def.whenText).toBe('Glow is on');
    style.effects.glow.enabled = true;
    expect(searchSettings('glow radius', style).groups[0].hits[0].visible).toBe(true);
  });
  it('describes value conditions with option labels', () => {
    expect(CONTROL_INDEX['box.corner_length'].whenText).toBe('Shape is Corners');
    expect(CONTROL_INDEX['line.dash_length'].whenText).toBe('Pattern is Dashed');
  });
  it('includes matching presets from the library', () => {
    const presets = [{ name: 'neon', origin: 'builtin' as const, description: 'Glowing outlines', path: '', style: defaultStyle() }];
    expect(searchSettings('neon', defaultStyle(), presets).presets.map((p) => p.name)).toEqual(['neon']);
  });
  it('returns nothing for an empty query', () => {
    expect(searchSettings('   ', defaultStyle()).count).toBe(0);
  });
});

describe('highlightRuns', () => {
  it('marks every term case-insensitively', () => {
    expect(highlightRuns('Glow radius', ['glow', 'rad'])).toEqual([
      { text: 'Glow', match: true },
      { text: ' ', match: false },
      { text: 'rad', match: true },
      { text: 'ius', match: false },
    ]);
  });
  it('treats regex characters literally', () => {
    expect(highlightRuns('Size (px)', ['(px)'])).toEqual([
      { text: 'Size ', match: false },
      { text: '(px)', match: true },
    ]);
  });
});
