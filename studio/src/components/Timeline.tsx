import { useMemo, useRef } from 'react';
import { formatTime, useStore } from '../store';
import { Icon } from './Icon';

/** Scrubber under the preview: step frames, drag the playhead, and watch whole-video detection progress. */
export function Timeline() {
  const media = useStore((s) => s.images.find((item) => item.id === s.imageId));
  const frames = useStore((s) => s.frames);
  const frameIndex = useStore((s) => s.frameIndex);
  const fps = useStore((s) => s.fps);
  const setFrame = useStore((s) => s.setFrame);
  const stepFrame = useStore((s) => s.stepFrame);
  const playing = useStore((s) => s.playing);
  const setPlaying = useStore((s) => s.setPlaying);
  const job = useStore((s) => s.job);
  const cancelDetection = useStore((s) => s.cancelDetection);
  const resume = useRef(false);
  const tracks = useMemo(() => (frames ? new Set(frames.flatMap((frame) => frame.detections.map((d) => d.track_id))).size : 0), [frames]);

  if (media?.kind !== 'video') return null;

  const count = frames ? frames.length : (media.frame_count ?? 0);
  const sourceFrame = frames ? (frames[frameIndex]?.index ?? 0) : frameIndex;
  const rate = fps || 24;
  const duration = media.duration ?? (media.frame_count ?? 0) / rate;

  if (job) {
    const pct = job.total ? Math.round((job.done / job.total) * 100) : 0;
    return (
      <div className="timeline detecting" role="status" aria-live="polite">
        <span className="timeline-label">Tracking</span>
        <progress className="timeline-progress" value={job.done} max={Math.max(job.total, 1)} />
        <span className="timeline-time">
          {job.done} / {job.total} frames · {pct}%
        </span>
        <button type="button" className="timeline-cancel" onClick={() => cancelDetection()}>Cancel</button>
      </div>
    );
  }

  const pause = () => {
    resume.current = playing;
    if (playing) setPlaying(false);
  };
  const release = () => {
    if (resume.current) setPlaying(true);
    resume.current = false;
  };

  return (
    <div className="timeline" aria-label="Video timeline">
      <button
        type="button"
        className={`timeline-play ${playing ? 'active' : ''}`}
        onClick={() => setPlaying(!playing)}
        disabled={count === 0}
        aria-label={playing ? 'Pause' : 'Play'}
        title={playing ? 'Pause (Space)' : 'Play (Space)'}
      >
        <Icon name={playing ? 'pause' : 'play'} />
      </button>
      <div className="timeline-steps">
        <button type="button" aria-label="Previous frame" title="Previous frame (←)" onClick={() => stepFrame(-1)} disabled={count === 0}><Icon name="previous" /></button>
        <button type="button" aria-label="Next frame" title="Next frame (→)" onClick={() => stepFrame(1)} disabled={count === 0}><Icon name="next" /></button>
      </div>
      <input
        type="range"
        className="timeline-scrub"
        aria-label="Playhead"
        min={0}
        max={Math.max(count - 1, 0)}
        step={1}
        value={frameIndex}
        disabled={count === 0}
        style={{ '--range': `${count > 1 ? (frameIndex / (count - 1)) * 100 : 0}%` } as React.CSSProperties}
        onPointerDown={pause}
        onPointerUp={release}
        onPointerCancel={release}
        onChange={(event) => setFrame(parseInt(event.target.value, 10))}
      />
      <span className="timeline-time" aria-live="off">
        {formatTime(sourceFrame / rate)} <em>/ {formatTime(duration)}</em>
      </span>
      <span className="timeline-frame">
        f {sourceFrame + 1} / {media.frame_count ?? count}
      </span>
      <span className={`timeline-status ${frames ? 'tracked' : ''}`}>
        {frames ? `${tracks} tracked objects` : 'not tracked'}
      </span>
    </div>
  );
}
