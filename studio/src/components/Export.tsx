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
  const info = useStore((s) => s.info);
  const savePreset = useStore((s) => s.savePreset);
  const notify = useStore((s) => s.notify);
  const setError = useStore((s) => s.setError);
  const [tab, setTab] = useState<ExportTab>(initialTab);
  // compact YAML feeds the code and the prompt; the full dump is only fetched when asked for
  const [compactYaml, setCompactYaml] = useState<string | null>(null);
  const [fullYaml, setFullYaml] = useState<string | null>(null);
  const [yamlFailed, setYamlFailed] = useState(false);
  const [compact, setCompact] = useState(true);
  const [name, setName] = useState(activePreset && activePreset !== 'default' ? activePreset : 'my-style');
  const [dir, setDir] = useState('');
  const [saving, setSaving] = useState(false);
  const validName = /^[A-Za-z0-9][A-Za-z0-9_. -]{0,63}$/.test(name.trim());

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

  useEffect(() => {
    if (activePreset && activePreset !== 'default') setName(activePreset);
  }, [activePreset]);

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
  const presetName = activePreset && !dirty ? activePreset : name;

  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(presetName || 'my-style').replace(/[^a-zA-Z0-9._-]/g, '-')}${tab === 'prompt' ? '-prompt' : ''}.${current.ext}`;
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

  const save = async () => {
    if (!validName) return;
    setSaving(true);
    try {
      await savePreset(name.trim(), dir.trim() || undefined);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
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

      <div className="save-box">
        <div className="section-label">
          <span>Save as preset</span>
        </div>
        <div className="save-row">
          <input name="preset-name" autoComplete="off" aria-label="Preset name" aria-invalid={!validName} aria-describedby={validName ? undefined : 'preset-name-help'} maxLength={64} className="text-input mono" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. my-style…" spellCheck={false} />
          <button type="button" className="btn primary" onClick={save} disabled={saving || !validName}>
            <Icon name="save" /> {saving ? 'Saving…' : 'Save preset'}
          </button>
        </div>
        {!validName && (
          <p id="preset-name-help" className="field-error">Start with a letter or number; use up to 64 letters, numbers, spaces, dots, hyphens or underscores.</p>
        )}
        <input
          className="text-input mono small"
          name="preset-directory"
          autoComplete="off"
          aria-label="Preset directory"
          value={dir}
          onChange={(e) => setDir(e.target.value)}
          placeholder={info?.presets_dir ?? '~/.visionstyle/presets'}
          title="Directory to save into (leave blank for the default presets directory)"
          spellCheck={false}
        />
        {dir.trim() && (
          <p className="muted small">
            Set <code className="mono">VISIONSTYLE_PRESETS_DIR</code> to this directory to load it by name.
          </p>
        )}
      </div>
    </section>
  );
}
