import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { Icon } from './Icon';

const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9_. -]{0,63}$/;

/** Inline form under the Style row: name + optional description, saved to the user preset folder. */
export function SavePreset({ onClose }: { onClose: () => void }) {
  const presets = useStore((s) => s.presets);
  const activePreset = useStore((s) => s.activePreset);
  const savePreset = useStore((s) => s.savePreset);
  const setError = useStore((s) => s.setError);
  // editing one of your own presets pre-fills it, so saving updates it in place
  const current = presets.find((p) => p.name === activePreset && p.origin !== 'builtin');
  const [name, setName] = useState(current?.name ?? '');
  const [description, setDescription] = useState(current?.description ?? '');
  const [saving, setSaving] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);

  const trimmed = name.trim();
  const clash = presets.find((p) => p.name.toLowerCase() === trimmed.toLowerCase());
  const error = !trimmed
    ? null
    : !NAME_RE.test(trimmed)
      ? 'Use letters, numbers, spaces, dots, hyphens or underscores, starting with a letter or number.'
      : clash?.origin === 'builtin'
        ? `“${clash.name}” is a built-in style. Choose another name.`
        : null;
  const replacing = !error && clash && clash.origin !== 'builtin';

  const submit = async () => {
    if (!trimmed || error || saving) return;
    setSaving(true);
    try {
      await savePreset(trimmed, description.trim());
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <form
      className="save-preset"
      onSubmit={(event) => { event.preventDefault(); submit(); }}
      onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); onClose(); } }}
    >
      <label className="save-preset-field">
        <span>Name</span>
        <input
          ref={input}
          className="text-input"
          name="preset-name"
          autoComplete="off"
          spellCheck={false}
          maxLength={64}
          placeholder="e.g. night-patrol"
          value={name}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'save-preset-error' : undefined}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label className="save-preset-field">
        <span>Description <em>optional</em></span>
        <input
          className="text-input"
          name="preset-description"
          autoComplete="off"
          maxLength={300}
          placeholder="What is this look for?"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>
      {error && <p id="save-preset-error" className="field-error">{error}</p>}
      {replacing && <p className="save-preset-note">Replaces your saved “{clash.name}”.</p>}
      <div className="save-preset-actions">
        <button type="button" className="btn quiet" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn primary" disabled={!trimmed || Boolean(error) || saving}>
          <Icon name="save" /> {saving ? 'Saving…' : replacing ? 'Replace' : 'Save preset'}
        </button>
      </div>
    </form>
  );
}
