import { useEffect, useState } from 'react';
import { api } from '../api';
import { useStore } from '../store';
import { aiPrompt, pythonSnippet, type ExportSource } from '../exportText';
import { Icon } from './Icon';

export type ExportTab = 'yaml' | 'python' | 'prompt';

const TABS: { id: ExportTab; label: string; copy: string; ext: string }[] = [
  { id: 'yaml', label: 'YAML', copy: 'YAML', ext: 'yaml' },
  { id: 'python', label: 'Python', copy: 'code', ext: 'py' },
  { id: 'prompt', label: 'AI prompt', copy: 'prompt', ext: 'md' },
];

export function Export({ initialTab = 'yaml' }: { initialTab?: ExportTab }) {
  const style = useStore((s) => s.style);
  const activePreset = useStore((s) => s.activePreset);
  const presets = useStore((s) => s.presets);
  const dirty = useStore((s) => s.dirty);
  const notify = useStore((s) => s.notify);
  const setError = useStore((s) => s.setError);
  const [tab, setTab] = useState<ExportTab>(initialTab);
  // compact YAML feeds the code and the prompt; the full dump is only fetched when asked for
  const [compactYaml, setCompactYaml] = useState<string | null>(null);
  const [fullYaml, setFullYaml] = useState<string | null>(null);
  const [yamlFailed, setYamlFailed] = useState(false);
  const [compact, setCompact] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setCompactYaml(null);
    setFullYaml(null);
    setYamlFailed(false);
    const id = window.setTimeout(() => {
      Promise.all([api.yaml(style, true), compact ? null : api.yaml(style, false)]).then(([short, full]) => {
        if (cancelled) return;
        setCompactYaml(short);
        setFullYaml(full);
      }).catch(() => {
        if (!cancelled) setYamlFailed(true);
      });
    }, 150);
    return () => { cancelled = true; window.clearTimeout(id); };
  }, [style, compact]);

  const origin = presets.find((p) => p.name === activePreset)?.origin;
  const source: ExportSource | null = compactYaml === null ? null : {
    yaml: compactYaml,
    // saved presets live on this machine only, so anything but an untouched built-in is embedded
    builtinPreset: activePreset && !dirty && origin === 'builtin' ? activePreset : null,
    trails: Boolean(style.trail?.enabled),
  };
  const current = TABS.find((t) => t.id === tab)!;
  const ready = source !== null && (tab !== 'yaml' || compact || fullYaml !== null);
  const text = yamlFailed
    ? '# Could not generate the export. Check your style and try again.'
    : !ready || !source
      ? '# Preparing your style…'
      : tab === 'yaml'
        ? (compact ? source.yaml : fullYaml!)
        : tab === 'python' ? pythonSnippet(source) : aiPrompt(source);
  const fileName = activePreset && !dirty ? activePreset : 'my-style';

  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName.replace(/[^a-zA-Z0-9._-]/g, '-')}${tab === 'prompt' ? '-prompt' : ''}.${current.ext}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      notify(`${what} copied`);
    } catch {
      setError('Clipboard unavailable — select the text and copy manually.');
    }
  };

  return (
    <section className="rail-section export">
      <div className="section-label">
        <span>Format</span>
        <span className="tabs-inline" role="tablist" aria-label="Export format" onKeyDown={(event) => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const index = TABS.findIndex((t) => t.id === tab);
          const nextIndex = event.key === 'Home' ? 0
            : event.key === 'End' ? TABS.length - 1
              : (index + (event.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length;
          const next = TABS[nextIndex].id;
          setTab(next);
          document.getElementById(`export-tab-${next}`)?.focus();
        }}>
          {TABS.map((t) => (
            <button key={t.id} id={`export-tab-${t.id}`} type="button" role="tab" aria-controls="export-code" aria-selected={tab === t.id} tabIndex={tab === t.id ? 0 : -1} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </span>
      </div>
      <pre id="export-code" className={`code mono ${tab === 'prompt' ? 'wrap' : ''}`} role="tabpanel" aria-labelledby={`export-tab-${tab}`} aria-live="polite" tabIndex={0}>
        {text}
      </pre>
      <div className="export-actions">
        {tab === 'yaml' && (
          <label className="check small">
            <input type="checkbox" checked={compact} onChange={(e) => setCompact(e.target.checked)} /> only changed values
          </label>
        )}
        <button type="button" className={`btn ${tab === 'prompt' ? 'primary' : ''}`} disabled={!ready} onClick={() => copy(text, tab === 'yaml' ? 'YAML' : tab === 'python' ? 'Code' : 'Prompt')}>
          <Icon name="copy" /> Copy {current.copy}
        </button>
        <button type="button" className="btn" disabled={!ready} onClick={download}>
          <Icon name="download" /> Download .{current.ext}
        </button>
      </div>

    </section>
  );
}
