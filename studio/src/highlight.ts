/** Tiny syntax highlighters for the Export panel. They only need to cover what the Studio itself
 *  generates (a short Python snippet and a style YAML), so they tokenize with a handful of regexes
 *  instead of pulling in a full highlighting library. Concatenating the token texts always gives
 *  back the input unchanged. */

export type TokenType =
  | 'plain' | 'comment' | 'keyword' | 'string' | 'number' | 'constant'
  | 'function' | 'class' | 'param' | 'key' | 'punct';

export interface Token {
  type: TokenType;
  text: string;
}

const PY_KEYWORDS = new Set([
  'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue', 'def', 'del', 'elif', 'else',
  'except', 'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal', 'not',
  'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield',
]);
const PY_CONSTANTS = new Set(['True', 'False', 'None']);

const PY_TOKEN = new RegExp([
  /(#[^\n]*)/.source,
  /((?:[rRbBuUfF]{1,2})?(?:"""[\s\S]*?(?:"""|$)|'''[\s\S]*?(?:'''|$)|"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?))/.source,
  /(\b(?:0[xob][\da-f_]+|\d[\d_]*(?:\.\d*)?(?:e[+-]?\d+)?)\b)/.source,
  /([A-Za-z_]\w*)/.source,
  /([()[\]{}.,:;=+\-*/%<>!&|^~@]+)/.source,
].join('|'), 'giy');

function push(tokens: Token[], type: TokenType, text: string) {
  const last = tokens[tokens.length - 1];
  if (last && last.type === type) last.text += text;
  else tokens.push({ type, text });
}

export function highlightPython(code: string): Token[] {
  const tokens: Token[] = [];
  // depth of open call parentheses, so `name=` inside a call reads as a keyword argument
  let callDepth = 0;
  const parens: boolean[] = [];
  let index = 0;
  while (index < code.length) {
    PY_TOKEN.lastIndex = index;
    const match = PY_TOKEN.exec(code);
    if (!match) {
      push(tokens, 'plain', code[index]);
      index += 1;
      continue;
    }
    const [text, comment, string, number, word, punct] = match;
    index = PY_TOKEN.lastIndex;
    if (comment) push(tokens, 'comment', text);
    else if (string) push(tokens, 'string', text);
    else if (number) push(tokens, 'number', text);
    else if (word) {
      const rest = code.slice(index);
      if (PY_KEYWORDS.has(word)) push(tokens, 'keyword', word);
      else if (PY_CONSTANTS.has(word)) push(tokens, 'constant', word);
      else if (callDepth > 0 && /^\s*=(?!=)/.test(rest)) push(tokens, 'param', word);
      else if (/^[A-Z][A-Z0-9_]+$/.test(word)) push(tokens, 'constant', word);
      else if (/^[A-Z]/.test(word)) push(tokens, 'class', word);
      else if (/^\s*\(/.test(rest)) push(tokens, 'function', word);
      else push(tokens, 'plain', word);
    } else if (punct) {
      for (const char of punct) {
        if (char === '(') {
          const previous = tokens[tokens.length - 1];
          const isCall = previous !== undefined && (previous.type === 'function' || previous.type === 'class');
          parens.push(isCall);
          if (isCall) callDepth += 1;
        } else if (char === ')' && parens.length > 0 && parens.pop()) {
          callDepth -= 1;
        }
      }
      push(tokens, 'punct', punct);
    } else {
      push(tokens, 'plain', text);
    }
  }
  return tokens;
}

const YAML_SCALAR = /^(?:true|false|yes|no|on|off|null|~)$/i;
const YAML_NUMBER = /^[-+]?(?:\d[\d_]*(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?$/i;

function yamlValue(tokens: Token[], value: string) {
  const pieces = value.match(/"(?:\\.|[^"\\])*"?|'(?:''|[^'])*'?|(?<!\S)#.*|[[\]{},]|\s+|[^\s[\]{},"']+/g) ?? [];
  for (const piece of pieces) {
    if (/^["']/.test(piece)) push(tokens, 'string', piece);
    else if (piece.startsWith('#')) push(tokens, 'comment', piece);
    else if (/^[[\]{},]$/.test(piece)) push(tokens, 'punct', piece);
    else if (/^\s/.test(piece)) push(tokens, 'plain', piece);
    else push(tokens, YAML_NUMBER.test(piece) ? 'number' : YAML_SCALAR.test(piece) ? 'constant' : 'string', piece);
  }
}

export function highlightYaml(code: string): Token[] {
  const tokens: Token[] = [];
  code.split('\n').forEach((line, lineIndex) => {
    if (lineIndex > 0) push(tokens, 'plain', '\n');
    const match = line.match(/^(\s*)((?:-\s+)*)(.*)$/)!;
    const [, indent, dashes, rest] = match;
    if (indent) push(tokens, 'plain', indent);
    if (dashes) push(tokens, 'punct', dashes);
    if (rest.startsWith('#')) {
      push(tokens, 'comment', rest);
      return;
    }
    const key = rest.match(/^("(?:\\.|[^"\\])*"|'(?:''|[^'])*'|[^\s#'"[{][^:#]*?)(\s*:)(?=\s|$)/);
    if (key) {
      push(tokens, 'key', key[1]);
      push(tokens, 'punct', key[2]);
      yamlValue(tokens, rest.slice(key[0].length));
    } else {
      yamlValue(tokens, rest);
    }
  });
  return tokens;
}
