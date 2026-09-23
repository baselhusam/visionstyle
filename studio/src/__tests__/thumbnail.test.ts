import { describe, expect, it } from 'vitest';
import { defaultStyle } from '../schema';
import { BOX, chipText, objectColor, thumbFor } from '../thumbnail';

const palettes = { default: ['#6f95ff', '#ff5c35'], mono: ['#f4f1e8'] };

describe('preset thumbnails', () => {
  it('colors the box with the first palette color, or a custom list', () => {
    const style = defaultStyle();
    expect(objectColor(style, palettes)).toBe('#6f95ff');
    style.palette.colors = 'mono';
    expect(objectColor(style, palettes)).toBe('#f4f1e8');
    style.palette.colors = ['#123456'];
    expect(objectColor(style, palettes)).toBe('#123456');
  });
  it('turns confidence coloring into the ramp and hex colors into themselves', () => {
    const style = defaultStyle();
    style.stroke.color = 'confidence';
    expect(thumbFor(style, palettes).stroke?.paint).toBe('ramp');
    style.stroke.color = '#ff0000';
    expect(thumbFor(style, palettes).stroke?.paint).toBe('#ff0000');
  });
  it('follows the line pattern and multi-color segments', () => {
    const style = defaultStyle();
    style.line.pattern = 'dashed';
    style.line.multicolor = 'segments';
    const t = thumbFor(style, palettes);
    expect(t.stroke?.dash).toMatch(/^[\d.]+ [\d.]+$/);
    expect(t.stroke?.segments).toEqual(style.line.segment_colors);
    style.stroke.enabled = false;
    expect(thumbFor(style, palettes).stroke).toBeNull();
  });
  it('builds the label chip from the components and places it by anchor', () => {
    const style = defaultStyle();
    style.label.components = ['track_id', 'text'];
    style.label.uppercase = true;
    expect(chipText(style)).toBe('#7 PERSON');
    style.label.anchor = 'top_left';
    style.label.placement = 'outside';
    const outside = thumbFor(style, palettes).chip!;
    expect(outside.y + outside.h).toBeLessThanOrEqual(BOX.y);
    style.label.placement = 'inside';
    style.label.anchor = 'bottom_right';
    const inside = thumbFor(style, palettes).chip!;
    expect(inside.x + inside.w).toBeCloseTo(BOX.x + BOX.w, 0);
    expect(inside.y + inside.h).toBeLessThanOrEqual(BOX.y + BOX.h);
    style.label.enabled = false;
    expect(thumbFor(style, palettes).chip).toBeNull();
  });
  it('picks readable label text on light and dark tags', () => {
    const style = defaultStyle();
    style.label.background = 'solid';
    style.label.background_color = '#ffffff';
    expect(thumbFor(style, palettes).chip?.textColor).toBe('#111214');
    style.label.background_color = '#111214';
    expect(thumbFor(style, palettes).chip?.textColor).toBe('#ffffff');
  });
  it('carries effects, trails and spotlight dimming', () => {
    const style = defaultStyle();
    style.effects.glow.enabled = true;
    style.trail.enabled = true;
    style.effects.dim_outside = 0.6;
    const t = thumbFor(style, palettes);
    expect(t.glow).not.toBeNull();
    expect(t.trail).not.toBeNull();
    expect(t.dim).toBe(0.6);
  });
});
