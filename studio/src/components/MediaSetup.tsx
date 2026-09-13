import { useRef } from "react";
import { useStore } from "../store";
import { Icon } from "./Icon";

export function MediaSetup() {
  const images = useStore((s) => s.images);
  const imageId = useStore((s) => s.imageId);
  const selectImage = useStore((s) => s.selectImage);
  const uploadImage = useStore((s) => s.uploadImage);
  const yolo = useStore((s) => s.yoloAvailable);
  const conf = useStore((s) => s.conf);
  const setConf = useStore((s) => s.setConf);
  const detect = useStore((s) => s.detect);
  const detecting = useStore((s) => s.detecting);
  const imageInput = useRef<HTMLInputElement>(null);
  const current = images.find((image) => image.id === imageId);
  const isVideo = current?.kind === "video";

  return (
    <div className="media-setup">
      <div className="drawer-intro">
        <p className="drawer-kicker">Source / 01</p>
        <h2>Choose the scene.</h2>
        <p>Use the included moving scene, or add your own image or video.</p>
      </div>

      <div className="setup-group">
        <div className="setup-group-heading">
          <span className="setup-icon"><Icon name="source" /></span>
          <div><strong>Scene</strong><small>Image or video input</small></div>
        </div>
        <label className="setup-label" htmlFor="source-image">Source</label>
        <select id="source-image" name="source" value={imageId ?? ""} onChange={(event) => selectImage(event.target.value)}>
          {images.map((image) => <option key={image.id} value={image.id}>{image.kind === "video" ? "Video · " : ""}{image.sample ? `Sample · ${image.name}` : image.name}</option>)}
        </select>
        <button type="button" className="btn upload-button" onClick={() => imageInput.current?.click()}><Icon name="source" /> Upload media</button>
        <input ref={imageInput} type="file" accept="image/*,video/mp4,video/quicktime,video/webm,video/x-msvideo,.mp4,.mov,.m4v,.webm,.avi" hidden onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) uploadImage(file);
          event.target.value = "";
        }} />
      </div>

      {isVideo && (
        <div className="setup-group setup-model">
          <div className="setup-group-heading">
            <span className="setup-icon"><Icon name="model" /></span>
            <div><strong>Detector</strong><small>Video analysis only</small></div>
          </div>
          <div className="model-lockup" aria-label="Active detector: YOLOv8 Nano">
            <strong>YOLOv8 Nano</strong>
            <span>Single-model preview</span>
          </div>
          <p className="setup-note">{yolo ? "Runs at a 0.30 confidence threshold." : "Uses the bundled detections at a 0.30 confidence threshold."}</p>
        </div>
      )}

      <div className="setup-group setup-confidence">
        <div className="setup-group-heading">
          <span className="setup-icon"><Icon name="confidence" /></span>
          <div><strong>Threshold</strong><small>Minimum object confidence</small></div>
        </div>
        <div className="setup-label-row">
          <label className="setup-label" htmlFor="confidence">Confidence</label>
          <output htmlFor="confidence">{conf.toFixed(2)}</output>
        </div>
        <input id="confidence" name="confidence" type="range" min={0.05} max={0.95} step={0.05} value={conf} style={{ "--range": `${((conf - 0.05) / 0.9) * 100}%` } as React.CSSProperties} onChange={(event) => setConf(parseFloat(event.target.value))} />
      </div>

      <div className="setup-run">
        <button type="button" className="detect-wide" onClick={() => detect()} disabled={detecting || !imageId}><Icon name="detect" /> {detecting ? "Detecting…" : "Run detection"}</button>
        <p className="setup-note">{current?.kind === "video" ? `Video ready${current.duration ? ` · ${current.duration.toFixed(1)}s` : ""}. Use play on the preview.` : "Select the included video to preview the YOLOv8 Nano workflow."}</p>
      </div>
    </div>
  );
}
