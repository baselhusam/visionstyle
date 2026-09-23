import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { Icon } from './Icon';

/** The Style dropdown lists only your saved presets; built-ins live in the Library. */
export function PresetPicker({ onSave }: { onSave: () => void }) {
  const presets = useStore((s) => s.presets);
  const active = useStore((s) => s.activePreset);
  const dirty = useStore((s) => s.dirty);
  const apply = useStore((s) => s.applyPreset);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const mine = presets.filter((p) => p.origin !== 'builtin');
  const builtin = presets.some((p) => p.name === active && p.origin === 'builtin');
  // a search box only earns its place once the list is long
  const searchable = mine.length > 6;
  useEffect(() => {
    if (!open) return;
    (searchable ? search.current : root.current?.querySelector<HTMLButtonElement>('[role="menuitemradio"], .picker-empty button'))?.focus();
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open, searchable]);
  const filtered = mine.filter((p) => `${p.name} ${p.description}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="preset-picker" ref={root} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false); }} onKeyDown={(event) => {
    if (event.key === 'Escape' && open) { event.stopPropagation(); setOpen(false); trigger.current?.focus(); }
    if (open && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault();
      const options = Array.from(root.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? []);
      const index = options.indexOf(document.activeElement as HTMLButtonElement);
      const next = index === -1 ? (event.key === 'ArrowDown' ? 0 : options.length - 1) : (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
      options[next]?.focus();
    }
  }}>
    <button type="button" ref={trigger} className="preset-picker-trigger" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? 'preset-options' : undefined} onClick={() => { setOpen(!open); setQuery(''); }}><span className="picker-caption">Style</span><strong className={builtin ? 'builtin' : undefined}>{active ?? 'Custom'}{dirty && <i title="Modified" aria-label="modified" />}</strong><Icon name="chevron" /></button>
    {open && <div className="preset-popover">
      {searchable && <input ref={search} className="text-input" name="style-search" autoComplete="off" aria-label="Search your presets" placeholder="Search your presets…" value={query} onChange={(event) => setQuery(event.target.value)} />}
      <div id="preset-options" role="menu" aria-label="Your presets">
        {mine.length > 0 && <p className="picker-group">Your presets</p>}
        {filtered.map((preset) => <button type="button" role="menuitemradio" aria-checked={active === preset.name} key={preset.name} onClick={() => { apply(preset.name); setOpen(false); trigger.current?.focus(); }}><span><strong>{preset.name}</strong>{preset.description && <small>{preset.description}</small>}</span><span aria-hidden="true">{active === preset.name ? '✓' : ''}</span></button>)}
        {mine.length === 0 && (
          <div className="picker-empty">
            <strong>No saved presets yet</strong>
            <span>Save the current look to reuse it here and in Python.</span>
            <button type="button" className="btn" onClick={() => { setOpen(false); onSave(); }}><Icon name="save" /> Save current style</button>
          </div>
        )}
        {mine.length > 0 && !filtered.length && <p className="picker-none">No presets match your search.</p>}
      </div>
    </div>}
  </div>;
}
