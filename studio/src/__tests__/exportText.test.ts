import { describe, expect, it } from 'vitest';
import { aiPrompt, pythonSnippet } from '../exportText';

const yaml = 'name: my-look\nbox:\n  shape: rounded\n';

describe('python snippet', () => {
  it('references an untouched built-in preset by name', () => {
    const code = pythonSnippet({ yaml, builtinPreset: 'cinematic', trails: false });
    expect(code).toContain('style = vs.Style.preset("cinematic")');
    expect(code).not.toContain('STYLE_YAML');
    expect(code).toContain('model.predict');
  });
  it('embeds a customised style so it runs without a saved preset', () => {
    const code = pythonSnippet({ yaml: 'box:\n  shape: rounded\n', builtinPreset: null, trails: false });
    expect(code).toContain('STYLE_YAML = """\nbox:\n  shape: rounded\n"""');
    expect(code).toContain('vs.Style.from_yaml(STYLE_YAML)');
    expect(code).not.toContain('Style.preset(');
  });
  it('escapes backslashes and triple quotes inside the embedded YAML', () => {
    const code = pythonSnippet({ yaml: 'label:\n  template: a\\b """\n', builtinPreset: null, trails: false });
    expect(code).toContain('template: a\\\\b \\"\\"\\"\n"""');
  });
  it('switches the Ultralytics hint to tracking when trails are on', () => {
    expect(pythonSnippet({ yaml, builtinPreset: null, trails: true })).toContain('model.track(frame, persist=True)');
  });
});

describe('AI prompt', () => {
  it('carries the style YAML, the steps and the reference code', () => {
    const prompt = aiPrompt({ yaml: 'box:\n  shape: rounded\n', builtinPreset: null, trails: false });
    expect(prompt).toContain('```yaml\nbox:\n  shape: rounded\n```');
    expect(prompt).toContain('vs.Annotator(style)');
    expect(prompt).toContain('```python\nimport visionstyle as vs');
    expect(prompt).not.toContain('track ids across frames');
    expect(prompt.match(/shape: rounded/g)).toHaveLength(1);
    expect(prompt).toContain('# the YAML from the Style section above');
  });
  it('names the built-in preset instead of pasting YAML', () => {
    const prompt = aiPrompt({ yaml, builtinPreset: 'neon', trails: false });
    expect(prompt).toContain('vs.Style.preset("neon")');
    expect(prompt).not.toContain('```yaml');
  });
  it('explains track ids when the style draws trails', () => {
    expect(aiPrompt({ yaml, builtinPreset: null, trails: true })).toContain('persist=True');
  });
});
