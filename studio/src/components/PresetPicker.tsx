import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';

export function PresetPicker() {
  const presets = useStore((s) => s.presets);
  const active = useStore((s) => s.activePreset);
  const dirty = useStore((s) => s.dirty);
  const apply = useStore((s) => s.applyPreset);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return;
    search.current?.focus();
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  const filtered = presets.filter((p) => `${p.name} ${p.description}`.toLowerCase().includes(query.toLowerCase()));
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
    <button type="button" ref={trigger} className="preset-picker-trigger" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? 'preset-options' : undefined} onClick={() => { setOpen(!open); setQuery(''); }}><span className="picker-caption">Current style</span><strong>{active ?? 'Custom'}{dirty && <i title="Modified" aria-label="modified" />}</strong><span aria-hidden="true">⌄</span></button>
    {open && <div className="preset-popover"><input ref={search} className="text-input" name="style-search" autoComplete="off" aria-label="Search styles" placeholder="Search styles…" value={query} onChange={(event) => setQuery(event.target.value)} /><div id="preset-options" role="menu" aria-label="Choose a style">
      {(['builtin', 'saved'] as const).map((group) => {
        const items = filtered.filter((p) => group === 'builtin' ? p.origin === 'builtin' : p.origin !== 'builtin');
        return items.length > 0 && <div key={group} role="group" aria-label={group === 'builtin' ? 'Built-in styles' : 'Your styles'}><p className="picker-group">{group === 'builtin' ? 'Built-in styles' : 'Your styles'}</p>{items.map((preset) => <button type="button" role="menuitemradio" aria-checked={active === preset.name} key={preset.name} onClick={() => { apply(preset.name); setOpen(false); trigger.current?.focus(); }}><span><strong>{preset.name}</strong><small>{preset.description}</small></span><span aria-hidden="true">{active === preset.name ? '✓' : ''}</span></button>)}</div>;
      })}
      {!filtered.length && <p className="picker-empty">No styles match your search.</p>}
    </div></div>}
  </div>;
}
