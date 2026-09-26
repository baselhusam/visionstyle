import { useRef } from "react";
import { useStore } from "../store";
import { Icon } from "./Icon";
import { SourcePicker } from "./SourcePicker";

export function MediaSetup() {
  const images = useStore((s) => s.images);
  const imageId = useStore((s) => s.imageId);
  const uploadImage = useStore((s) => s.uploadImage);
  const yolo = useStore((s) => s.yoloAvailable);
  const conf = useStore((s) => s.conf);
  const setConf = useStore((s) => s.setConf);
  const detect = useStore((s) => s.detect);
  const detecting = useStore((s) => s.detecting);
  const job = useStore((s) => s.job);
  const cancelDetection = useStore((s) => s.cancelDetection);
  const frames = useStore((s) => s.frames);
  const imageInput = useRef<HTMLInputElement>(null);
  const current = images.find((image) => image.id === imageId);
  const isVideo = current?.kind === "video";
  const tracked = frames !== null;
  const progress = job ? `${job.done} / ${job.total}` : null;

  // only say something when the user has to act on it
  const note = isVideo && !tracked && !job && !yolo
    ? "Install visionstyle[yolo] to track uploaded videos; the sample ships with its tracks."
    : null;

  return (
    <div className="media-setup">
      <div className="setup-group">
        <div className="setup-group-heading">
          <span className="setup-icon"><Icon name="source" /></span>
          <strong>Scene</strong>
        </div>
        <SourcePicker />
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
            <strong>Detector</strong>
          </div>
          <div className="model-lockup" aria-label="Active detector: YOLO26 Nano with ByteTrack">
            <strong>YOLO26 Nano</strong>
            <span>+ ByteTrack · every frame</span>
          </div>
        </div>
      )}

      <div className="setup-group setup-confidence">
        <div className="setup-group-heading">
          <span className="setup-icon"><Icon name="confidence" /></span>
          <strong>Threshold</strong>
        </div>
        <div className="setup-label-row">
          <label className="setup-label" htmlFor="confidence">Confidence</label>
          <output htmlFor="confidence">{conf.toFixed(2)}</output>
        </div>
        <input id="confidence" name="confidence" type="range" min={0.05} max={0.95} step={0.05} value={conf} style={{ "--range": `${((conf - 0.05) / 0.9) * 100}%` } as React.CSSProperties} onChange={(event) => setConf(parseFloat(event.target.value))} />
      </div>

      <div className="setup-run">
        {job ? (
          <button type="button" className="detect-wide cancel" onClick={() => cancelDetection()}><Icon name="detect" /> Cancel · {progress}</button>
        ) : (
          <button type="button" className="detect-wide" onClick={() => detect()} disabled={detecting || !imageId}><Icon name="detect" /> {detecting ? "Detecting…" : isVideo ? (tracked ? "Track again" : "Run detection") : "Run detection"}</button>
        )}
        {note && <p className="setup-note">{note}</p>}
      </div>
    </div>
  );
}
