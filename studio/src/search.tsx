/** Settings search: matches controls by section, label, hint, schema path and option names,
 *  and highlights the matched words wherever a control renders its text. */
import { createContext, Fragment, useContext } from 'react';
import type { PresetInfo } from './api';
import { CONTROL_INDEX, SECTIONS, type ControlDef, type SectionDef } from './controls/registry';

export interface SearchHit {
  def: ControlDef;
  /** False when the control's `when` hides it for the current style. */
  visible: boolean;
}

export interface SearchGroup {
  section: SectionDef;
  hits: SearchHit[];
}

export interface SearchResult {
  presets: PresetInfo[];
  groups: SearchGroup[];
  count: number;
}

export function searchTerms(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

function controlText(section: SectionDef, def: ControlDef): string {
  const options = (def.options ?? []).map((o) => `${o} ${def.optionLabels?.[o] ?? ''}`);
  return [section.title, def.label, def.hint ?? '', def.path.replace(/[._]/g, ' '), ...options].join(' ').toLowerCase();
}

/** Every term must appear somewhere in a control's text; sections keep their Design order. */
export function searchSettings(query: string, style: unknown, presets: PresetInfo[] = []): SearchResult {
  const terms = searchTerms(query);
  if (!terms.length) return { presets: [], groups: [], count: 0 };
  const matches = (text: string) => terms.every((t) => text.includes(t));
  // label matches outrank matches found only in hints, paths or option names
  const score = (def: ControlDef) => {
    const label = def.label.toLowerCase();
    return terms.every((t) => label.includes(t)) ? 2 : terms.some((t) => label.includes(t)) ? 1 : 0;
  };
  const groups = SECTIONS.map((section, order) => {
    const hits = section.controls
      .filter((def) => matches(controlText(section, def)))
      .map((def, index) => ({ def, visible: !def.when || def.when(style), rank: score(def), index }))
      .sort((a, b) => b.rank - a.rank || a.index - b.index);
    return { section, order, best: hits[0]?.rank ?? -1, hits: hits.map(({ def, visible }) => ({ def, visible })) };
  })
    .filter((group) => group.hits.length > 0)
    .sort((a, b) => b.best - a.best || a.order - b.order)
    .map(({ section, hits }) => ({ section, hits }));
  const presetHits = presets.filter((p) => matches(`${p.name} ${p.description} style preset library`.toLowerCase()));
  return { presets: presetHits, groups, count: presetHits.length + groups.reduce((n, g) => n + g.hits.length, 0) };
}

/** The control that reveals a hidden hit, when it is not itself part of the results. */
export function revealer(hit: SearchHit, group: SearchGroup): ControlDef | undefined {
  const dep = hit.def.dependsOn ? CONTROL_INDEX[hit.def.dependsOn] : undefined;
  return dep && !group.hits.some((h) => h.def.path === dep.path) ? dep : undefined;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Split `text` into plain and matched runs, case-insensitively. */
export function highlightRuns(text: string, terms: string[]): { text: string; match: boolean }[] {
  if (!terms.length || !text) return [{ text, match: false }];
  const pattern = new RegExp(`(${terms.map(escape).sort((a, b) => b.length - a.length).join('|')})`, 'gi');
  // split with a capturing group alternates plain (even) and matched (odd) parts
  return text.split(pattern).map((part, i) => ({ text: part, match: i % 2 === 1 })).filter((run) => run.text);
}

export const HighlightContext = createContext<string[]>([]);

/** Text that marks the active search terms; plain text outside a search. */
export function Hl({ text }: { text: string }) {
  const terms = useContext(HighlightContext);
  if (!terms.length) return <>{text}</>;
  return (
    <>
      {highlightRuns(text, terms).map((run, i) => (run.match ? <mark key={i}>{run.text}</mark> : <Fragment key={i}>{run.text}</Fragment>))}
    </>
  );
}
