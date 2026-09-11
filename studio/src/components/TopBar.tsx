import { useRef } from 'react';
import { useStore } from '../store';

export function TopBar() {
  const images = useStore((s) => s.images);
  const imageId = useStore((s) => s.imageId);
  const selectImage = useStore((s) => s.selectImage);
  const uploadImage = useStore((s) => s.uploadImage);
  const models = useStore((s) => s.models);
  const modelId = useStore((s) => s.modelId);
  const setModel = useStore((s) => s.setModel);
  const uploadModel = useStore((s) => s.uploadModel);
  const yolo = useStore((s) => s.yoloAvailable);
  const conf = useStore((s) => s.conf);
  const setConf = useStore((s) => s.setConf);
  const detect = useStore((s) => s.detect);
  const detecting = useStore((s) => s.detecting);
  const info = useStore((s) => s.info);
  const imgInput = useRef<HTMLInputElement>(null);
  const modelInput = useRef<HTMLInputElement>(null);
  const current = images.find((i) => i.id === imageId);

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true" />
        visionstyle <span className="brand-sub">studio</span>
      </div>

      <div className="source">
        <label className="source-field">
          <span className="eyebrow">Image</span>
          <select value={imageId ?? ''} onChange={(e) => selectImage(e.target.value)}>
            {images.map((i) => (
              <option key={i.id} value={i.id}>
                {i.sample ? `sample · ${i.name}` : i.name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn" onClick={() => imgInput.current?.click()}>
          Upload image
        </button>
        <input ref={imgInput} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])} />

        <label className="source-field">
          <span className="eyebrow">Model</span>
          <select value={modelId ?? ''} onChange={(e) => setModel(e.target.value || null)}>
            <option value="">{current?.has_detections ? 'bundled detections' : yolo ? 'yolo11n.pt (auto)' : 'none'}</option>
            {yolo && <option value="yolo11n.pt">yolo11n.pt</option>}
            {yolo && <option value="yolov8n.pt">yolov8n.pt</option>}
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn" onClick={() => modelInput.current?.click()} disabled={!yolo} title={yolo ? 'Upload .pt or .onnx' : 'Install visionstyle[yolo] to run models'}>
          Upload model
        </button>
        <input ref={modelInput} type="file" accept=".pt,.onnx" hidden onChange={(e) => e.target.files?.[0] && uploadModel(e.target.files[0])} />

        <label className="source-field conf">
          <span className="eyebrow">Conf ≥ {conf.toFixed(2)}</span>
          <input type="range" min={0.05} max={0.95} step={0.05} value={conf} onChange={(e) => setConf(parseFloat(e.target.value))} onMouseUp={() => detect()} onTouchEnd={() => detect()} />
        </label>
        <button type="button" className="btn primary" onClick={() => detect()} disabled={detecting || !imageId}>
          {detecting ? 'Detecting…' : 'Detect'}
        </button>
      </div>

      <div className="top-meta mono">
        <span>v{info?.version ?? '—'}</span>
        <span className={`live-dot ${info ? 'ok' : ''}`}>{info ? 'server live' : 'connecting'}</span>
      </div>
    </header>
  );
}
