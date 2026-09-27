import { describe, expect, it } from 'vitest';
import { highlightPython, highlightYaml, type Token } from '../highlight';
import { pythonSnippet } from '../exportText';

const typeOf = (tokens: Token[], text: string) => tokens.find((t) => t.text === text)?.type;

describe('python highlighting', () => {
  const code = pythonSnippet({ yaml: 'box:\n  shape: rounded\n', builtinPreset: null, trails: true });
  const tokens = highlightPython(code);

  it('round-trips the source text', () => {
    expect(tokens.map((t) => t.text).join('')).toBe(code);
  });
  it('tags keywords, classes, calls, keyword arguments, strings and comments', () => {
    expect(typeOf(tokens, 'import')).toBe('keyword');
    expect(typeOf(tokens, 'Annotator')).toBe('class');
    expect(typeOf(tokens, 'annotate')).toBe('function');
    expect(typeOf(tokens, 'xyxy')).toBe('param');
    expect(typeOf(tokens, 'STYLE_YAML')).toBe('constant');
    expect(tokens.some((t) => t.type === 'string' && t.text.startsWith('"""'))).toBe(true);
    expect(tokens.some((t) => t.type === 'comment' && t.text.startsWith('# One annotator'))).toBe(true);
  });
  it('does not treat assignments outside calls as keyword arguments', () => {
    expect(highlightPython('frame = f(x)').filter((t) => t.type === 'param')).toEqual([]);
  });
});

describe('yaml highlighting', () => {
  const yaml = 'name: my-look\nbox:\n  thickness: 2  # px\n  color: "#ff0000"\n  palette: [red, blue]\n  label: a#b c\n  - fill: true\n';
  const tokens = highlightYaml(yaml);

  it('round-trips the source text', () => {
    expect(tokens.map((t) => t.text).join('')).toBe(yaml);
  });
  it('tags keys, scalars and comments', () => {
    expect(typeOf(tokens, 'thickness')).toBe('key');
    expect(typeOf(tokens, 'my-look')).toBe('string');
    expect(typeOf(tokens, '2')).toBe('number');
    expect(typeOf(tokens, '"#ff0000"')).toBe('string');
    expect(typeOf(tokens, '# px')).toBe('comment');
    expect(typeOf(tokens, 'true')).toBe('constant');
    expect(typeOf(tokens, 'a#b')).toBe('string');
  });
});
