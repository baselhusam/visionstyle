import { useRef } from 'react';
import { useStore } from '../store';

export function MediaSetup() {
  const images = useStore((s) => s.images); const imageId = useStore((s) => s.imageId); const selectImage = useStore((s) => s.selectImage); const uploadImage = useStore((s) => s.uploadImage);
  const models = useStore((s) => s.models); const modelId = useStore((s) => s.modelId); const setModel = useStore((s) => s.setModel); const uploadModel = useStore((s) => s.uploadModel); const yolo = useStore((s) => s.yoloAvailable);
  const conf = useStore((s) => s.conf); const setConf = useStore((s) => s.setConf); const detect = useStore((s) => s.detect); const detecting = useStore((s) => s.detecting);
  const imageInput = useRef<HTMLInputElement>(null); const modelInput = useRef<HTMLInputElement>(null); const current = images.find((image) => image.id === imageId);
  return <div className="media-setup">
    <div className="drawer-intro"><p className="drawer-kicker">Source / 01</p><h2>Choose the scene.</h2><p>The image stays central. Detection settings are kept here until you need them.</p></div>
    <div className="setup-group"><label className="setup-label" htmlFor="source-image">Image</label><select id="source-image" value={imageId ?? ''} onChange={(event) => selectImage(event.target.value)}>{images.map((image) => <option key={image.id} value={image.id}>{image.sample ? `sample · ${image.name}` : image.name}</option>)}</select><button type="button" className="btn upload-button" onClick={() => imageInput.current?.click()}>Upload image</button><input ref={imageInput} type="file" accept="image/*" hidden onChange={(event) => event.target.files?.[0] && uploadImage(event.target.files[0])} /></div>
    <div className="setup-group setup-model"><label className="setup-label" htmlFor="source-model">Detector</label><select id="source-model" value={modelId ?? ''} onChange={(event) => setModel(event.target.value || null)}><option value="">{current?.has_detections ? 'bundled detections' : yolo ? 'yolo11n.pt (auto)' : 'none'}</option>{yolo && <option value="yolo11n.pt">yolo11n.pt</option>}{yolo && <option value="yolov8n.pt">yolov8n.pt</option>}{models.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}</select><button type="button" className="text-link" onClick={() => modelInput.current?.click()} disabled={!yolo}>Add a model</button><input ref={modelInput} type="file" accept=".pt,.onnx" hidden onChange={(event) => event.target.files?.[0] && uploadModel(event.target.files[0])} /></div>
    <div className="setup-group"><div className="setup-label-row"><label className="setup-label" htmlFor="confidence">Confidence</label><output>{conf.toFixed(2)}</output></div><input id="confidence" type="range" min={0.05} max={0.95} step={0.05} value={conf} onChange={(event) => setConf(parseFloat(event.target.value))} /></div>
    <button type="button" className="detect-wide" onClick={() => detect()} disabled={detecting || !imageId}>{detecting ? 'Detecting…' : 'Run detection'}</button>
    <p className="setup-note"><b>Motion preview:</b> animated overlays can play directly on the stage. Video import is not enabled by the image renderer yet.</p>
  </div>;
}
