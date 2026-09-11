/* Helpers that read the bundled Style JSON schema so controls know their ranges/options. */
import schema from '../schema.json';

type JsonSchema = Record<string, any>;

const root = schema as JsonSchema;
const defs: Record<string, JsonSchema> = root.$defs ?? {};

function deref(node: JsonSchema): JsonSchema {
  if (node && node.$ref) {
    const name = String(node.$ref).split('/').pop() as string;
    return deref(defs[name]);
  }
  return node;
}

/** Resolve the schema node for a dotted path like "label.font_size". */
export function schemaAt(path: string): JsonSchema | undefined {
  let node: JsonSchema = root;
  for (const key of path.split('.')) {
    node = deref(node);
    const props = node.properties ?? {};
    if (!(key in props)) return undefined;
    node = props[key];
  }
  return deref(node);
}

export function defaultAt(path: string): any {
  const node = schemaAt(path);
  return node?.default;
}

/** Build a full default Style object from the schema. */
export function defaultStyle(): any {
  const build = (node: JsonSchema): any => {
    node = deref(node);
    if (node.type === 'object' && node.properties) {
      const out: Record<string, any> = {};
      for (const [k, v] of Object.entries<JsonSchema>(node.properties)) {
        const child = deref(v);
        if (child.type === 'object' && child.properties) out[k] = build(child);
        else if ('default' in child) out[k] = structuredClone(child.default);
        else if (child.$ref) out[k] = build(child);
      }
      return out;
    }
    return structuredClone(node.default);
  };
  return build(root);
}

export function enumOf(node: JsonSchema | undefined): string[] | undefined {
  if (!node) return undefined;
  if (node.enum) return node.enum as string[];
  if (node.anyOf) {
    const consts = node.anyOf.map((n: JsonSchema) => n.const).filter((c: any) => c !== undefined);
    if (consts.length) return consts;
  }
  return undefined;
}

export function descriptionOf(path: string): string {
  return schemaAt(path)?.description ?? '';
}
