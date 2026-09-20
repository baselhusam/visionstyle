import { useEffect, useState } from 'react';
import { api } from '../api';
import { useStore } from '../store';
import { Icon } from './Icon';

export function Export() {
  const style = useStore((s) => s.style);
  const activePreset = useStore((s) => s.activePreset);
  const dirty = useStore((s) => s.dirty);
  const info = useStore((s) => s.info);
  const savePreset = useStore((s) => s.savePreset);
  const notify = useStore((s) => s.notify);
  const setError = useStore((s) => s.setError);
  const [tab, setTab] = useState<'yaml' | 'python'>('yaml');
  const [yaml, setYaml] = useState('');
  const [yamlReady, setYamlReady] = useState(false);
  const [compact, setCompact] = useState(true);
  const [name, setName] = useState(activePreset && activePreset !== 'default' ? activePreset : 'my-style');
  const [dir, setDir] = useState('');
  const [saving, setSaving] = useState(false);
  const validName = /^[A-Za-z0-9][A-Za-z0-9_. -]{0,63}$/.test(name.trim());

  useEffect(() => {
    let cancelled = false;
    setYamlReady(false);
    const id = window.setTimeout(() => {
      api.yaml(style, compact).then((text) => {
        if (cancelled) return;
        setYaml(text);
        setYamlReady(true);
      }).catch(() => {
        if (!cancelled) setYaml('# Could not generate YAML. Check your style and try again.');
      });
    }, 150);
    return () => { cancelled = true; window.clearTimeout(id); };
  }, [style, compact]);

  useEffect(() => {
    if (activePreset && activePreset !== 'default') setName(activePreset);
  }, [activePreset]);

  const presetName = activePreset && !dirty ? activePreset : name;
  const python = [
    'import visionstyle as vs',
    '',
    activePreset && !dirty ? `style = vs.Style.preset(${JSON.stringify(presetName)})` : `style = vs.Style.preset(${JSON.stringify(name)})  # after saving below`,
    'annotator = vs.Annotator(style)',
    '',
    '# detections: boxes + optional class / confidence / track id',
    'dets = vs.Detections(xyxy=boxes, class_id=classes, confidence=scores, track_id=ids, names=model.names)',
    'frame = annotator.annotate(frame, dets)',
  ].join('\n');

  const download = () => {
    const content = tab === 'yaml' ? yaml : python;
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(presetName || 'my-style').replace(/[^a-zA-Z0-9._-]/g, '-')}.${tab === 'yaml' ? 'yaml' : 'py'}`;
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
          const next = event.key === 'ArrowLeft' || event.key === 'Home' ? 'yaml' : 'python';
          setTab(next);
          document.getElementById(`export-tab-${next}`)?.focus();
        }}>
          <button id="export-tab-yaml" type="button" role="tab" aria-controls="export-code" aria-selected={tab === 'yaml'} tabIndex={tab === 'yaml' ? 0 : -1} className={tab === 'yaml' ? 'active' : ''} onClick={() => setTab('yaml')}>
            YAML
          </button>
          <button id="export-tab-python" type="button" role="tab" aria-controls="export-code" aria-selected={tab === 'python'} tabIndex={tab === 'python' ? 0 : -1} className={tab === 'python' ? 'active' : ''} onClick={() => setTab('python')}>
            Python
          </button>
        </span>
      </div>
      <pre id="export-code" className="code mono" role="tabpanel" aria-labelledby={`export-tab-${tab}`} aria-live="polite">
        {tab === 'yaml' ? (yamlReady || yaml.startsWith('# Could not') ? yaml : '# Preparing your style…') : python}
      </pre>
      <div className="export-actions">
        {tab === 'yaml' && (
          <label className="check small">
            <input type="checkbox" checked={compact} onChange={(e) => setCompact(e.target.checked)} /> only changed values
          </label>
        )}
        <button type="button" className="btn" disabled={tab === 'yaml' && !yamlReady} onClick={() => copy(tab === 'yaml' ? yaml : python, tab === 'yaml' ? 'YAML' : 'Snippet')}>
          <Icon name="copy" /> Copy {tab === 'yaml' ? 'YAML' : 'snippet'}
        </button>
        <button type="button" className="btn" disabled={tab === 'yaml' && !yamlReady} onClick={download}>
          <Icon name="download" /> Download {tab === 'yaml' ? 'YAML' : 'Python'}
        </button>
      </div>

      <div className="save-box">
        <div className="section-label">
          <span>Save as preset</span>
        </div>
        <div className="save-row">
          <input name="preset-name" autoComplete="off" aria-label="Preset name" aria-invalid={!validName} aria-describedby="preset-name-help" maxLength={64} className="text-input mono" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. my-style…" spellCheck={false} />
          <button type="button" className="btn primary" onClick={save} disabled={saving || !validName}>
            <Icon name="save" /> {saving ? 'Saving…' : 'Save preset'}
          </button>
        </div>
        <p id="preset-name-help" className="muted small">Start with a letter or number. Use up to 64 letters, numbers, spaces, dots, hyphens or underscores.</p>
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
        <p className="muted small">
          Load it anywhere with <code className="mono">vs.Style.preset("{name || 'name'}")</code>
          {dir.trim() ? <> (set <code className="mono">VISIONSTYLE_PRESETS_DIR</code> to the custom directory)</> : null}.
        </p>
      </div>
    </section>
  );
}
