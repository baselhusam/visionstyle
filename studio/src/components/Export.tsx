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
  const [compact, setCompact] = useState(true);
  const [name, setName] = useState(activePreset && activePreset !== 'default' ? activePreset : 'my-style');
  const [dir, setDir] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => {
      api.yaml(style, compact).then(setYaml).catch(() => setYaml('# invalid style'));
    }, 150);
    return () => window.clearTimeout(id);
  }, [style, compact]);

  useEffect(() => {
    if (activePreset && activePreset !== 'default') setName(activePreset);
  }, [activePreset]);

  const presetName = activePreset && !dirty ? activePreset : name;
  const python = [
    'import visionstyle as vs',
    '',
    activePreset && !dirty ? `style = vs.Style.preset("${presetName}")` : `style = vs.Style.preset("${name}")  # after saving below`,
    'annotator = vs.Annotator(style)',
    '',
    '# detections: boxes + optional class / confidence / track id',
    'dets = vs.Detections(xyxy=boxes, class_id=classes, confidence=scores, track_id=ids, names=model.names)',
    'frame = annotator.annotate(frame, dets)',
  ].join('\n');

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      notify(`${what} copied`);
    } catch {
      setError('Clipboard unavailable — select the text and copy manually.');
    }
  };

  const save = async () => {
    if (!name.trim()) return;
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
        <span>Export</span>
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
        {tab === 'yaml' ? yaml : python}
      </pre>
      <div className="export-actions">
        {tab === 'yaml' && (
          <label className="check small">
            <input type="checkbox" checked={compact} onChange={(e) => setCompact(e.target.checked)} /> only changed values
          </label>
        )}
        <button type="button" className="btn" onClick={() => copy(tab === 'yaml' ? yaml : python, tab === 'yaml' ? 'YAML' : 'Snippet')}>
          <Icon name="copy" /> Copy {tab === 'yaml' ? 'YAML' : 'snippet'}
        </button>
      </div>

      <div className="save-box">
        <div className="section-label">
          <span>Save as preset</span>
        </div>
        <div className="save-row">
          <input name="preset-name" autoComplete="off" aria-label="Preset name" className="text-input mono" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. my-style…" spellCheck={false} />
          <button type="button" className="btn primary" onClick={save} disabled={saving || !name.trim()}>
            <Icon name="save" /> {saving ? 'Saving…' : 'Save preset'}
          </button>
        </div>
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
