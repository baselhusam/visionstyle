import { useEffect, useRef, useState } from 'react';
import { api, displayName } from '../api';
import { detectionKey, formatTime, useStore, visibleDetections } from '../store';
import { Icon } from './Icon';

const FRAME_MS = 90;
// Every preview request carries this tab's id and a growing number, so the server can drop
// frames this tab has already moved past instead of queueing them behind the current one.
const CLIENT_ID = Math.random().toString(36).slice(2, 12);
let renderSeq = 0;

export function Preview({ onChangeSource }: { onChangeSource?: () => void }) {
  const style = useStore((s) => s.style);
  const imageId = useStore((s) => s.imageId);
  const detections = useStore((s) => s.detections);
  const hidden = useStore((s) => s.hidden);
  const selected = useStore((s) => s.selected);
  const selectedClass = useStore((s) => s.selectedClass);
  // stills and untracked videos get a synthetic trail; tracked videos replay their real ones
  const syntheticTrails = useStore((s) => s.frames === null);
  const playing = useStore((s) => s.playing);
  const frames = useStore((s) => s.frames);
  const frameIndex = useStore((s) => s.frameIndex);
  const conf = useStore((s) => s.conf);
  const fps = useStore((s) => s.fps);
  const setFrame = useStore((s) => s.setFrame);
  const setRenderMs = useStore((s) => s.setRenderMs);
  const setError = useStore((s) => s.setError);
  const [rendered, setRendered] = useState<{ url: string; imageId: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [fit, setFit] = useState(true);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const tRef = useRef(0);
  const busyRef = useRef(false);
  const lastFrameRef = useRef(-1);
  const abortRef = useRef<AbortController | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const renderedUrlRef = useRef<string | null>(null);
  const animated = style.line?.animation !== 'none' && (style.line?.speed ?? 0) > 0;
  const media = useStore((s) => s.images.find((item) => item.id === s.imageId));
  const isVideo = media?.kind === 'video';
  const tooLong = Boolean(media?.too_long);
  // While the whole video is being tracked there are no boxes to style yet, and every preview
  // would compete with the detector for the CPU, so the stage waits for the stored tracks.
  const job = useStore((s) => (s.job?.image_id === s.imageId ? s.job : null));
  const waiting = tooLong || job !== null;
  const tracked = frames !== null;
  const frameCount = frames ? frames.length : (media?.frame_count ?? 0);
  // the frame number inside the file (differs from the position when tracks were sampled with a stride)
  const sourceFrame = frames ? (frames[frameIndex]?.index ?? 0) : frameIndex;
  // Do not briefly show the previous source while the next scene is loading.
  const renderedUrl = rendered?.imageId === imageId ? rendered.url : null;

  const dets = selected !== null
    ? detections.filter((detection, i) => detectionKey(detection, i, tracked) === selected)
    : selectedClass
      ? detections.filter((detection, i) => !hidden.has(detectionKey(detection, i, tracked)) && (detection.class_name ?? `class ${detection.class_id ?? '—'}`) === selectedClass)
      : visibleDetections(detections, hidden, tracked);
  // a tracked video's trail history is filtered by the threshold too, so it is part of the key
  const minConfidence = tracked ? conf : 0;
  const key = JSON.stringify({ style, imageId, dets, syntheticTrails, sourceFrame: isVideo ? sourceFrame : 0, minConfidence });

  useEffect(() => {
    if (!imageId || waiting) {
      busyRef.current = false;
      setBusy(false);
      return;
    }
    let cancelled = false;
    const run = async (t: number) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      busyRef.current = true;
      setBusy(true);
      try {
        // render no larger than the canvas can show (device pixels), capped at 1600 px
        const box = wrapRef.current;
        const dpr = window.devicePixelRatio || 1;
        const maxSize = fit && box ? Math.min(1600, Math.max(640, Math.round(Math.max(box.clientWidth, box.clientHeight) * dpr))) : 1600;
        const res = await api.render({ image_id: imageId, style, detections: dets, t, frame_index: isVideo ? sourceFrame : undefined, max_size: maxSize, synthetic_trails: syntheticTrails, min_confidence: minConfidence, client: CLIENT_ID, seq: ++renderSeq }, ctrl.signal);
        if (!res) return; // superseded by a newer request, which will paint instead
        if (!cancelled && !ctrl.signal.aborted) {
          // Decode off the main thread before swapping so playback never flashes or stalls.
          // Chrome defers decode() in a background tab, so never wait on it for long.
          const image = new Image();
          image.src = res.url;
          await Promise.race([image.decode().catch(() => undefined), new Promise((resolve) => setTimeout(resolve, 120))]);
        }
        if (cancelled || ctrl.signal.aborted) {
          URL.revokeObjectURL(res.url);
          return;
        }
        setRendered((old) => {
          if (old?.url && old.url !== res.url) URL.revokeObjectURL(old.url);
          renderedUrlRef.current = res.url;
          return { url: res.url, imageId };
        });
        setRenderMs(res.ms);
        setError(null);
      } catch (e) {
        if (!cancelled && !ctrl.signal.aborted && (e as Error).name !== 'AbortError') setError((e as Error).message);
      } finally {
        if (!ctrl.signal.aborted) busyRef.current = false;
        if (!cancelled) setBusy(false);
      }
    };
    // video animation time follows the playhead so every frame renders the same way twice
    const time = isVideo ? sourceFrame / (fps || 24) : tRef.current;
    // a new frame renders immediately; style edits are debounced so slider drags do not flood the server
    const frameChanged = isVideo && sourceFrame !== lastFrameRef.current;
    lastFrameRef.current = isVideo ? sourceFrame : -1;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => run(time), frameChanged ? 0 : 60);

    let raf: number | undefined;
    if (playing && animated && !isVideo) {
      let last = performance.now();
      const tick = (now: number) => {
        if (now - last >= FRAME_MS) {
          last = now;
          tRef.current += FRAME_MS / 1000;
          run(tRef.current);
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }
    return () => {
      cancelled = true;
      window.clearTimeout(timer.current);
      if (raf) cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, playing, animated, isVideo, fit, waiting]);

  // A source change invalidates the old bitmap immediately. Keeping the image id beside the
  // object URL also protects the first paint before this effect has had a chance to run.
  useEffect(() => {
    abortRef.current?.abort();
    lastFrameRef.current = -1;
    busyRef.current = false;
    setBusy(Boolean(imageId) && !waiting);
    setMenu(null);
    setRendered((old) => {
      if (old?.url) URL.revokeObjectURL(old.url);
      renderedUrlRef.current = null;
      return null;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageId]);

  useEffect(() => () => {
    abortRef.current?.abort();
    window.clearTimeout(timer.current);
    if (renderedUrlRef.current) URL.revokeObjectURL(renderedUrlRef.current);
  }, []);

  // Playback clock: advance the playhead in real time, skipping frames the renderer cannot keep up with.
  // A timer rather than requestAnimationFrame so playback survives a backgrounded tab (rAF pauses there).
  useEffect(() => {
    if (!playing || !isVideo || frameCount <= 0) return;
    const startFrame = useStore.getState().frameIndex;
    const start = performance.now();
    const rate = fps || 24;
    let timer: number | undefined;
    const tick = () => {
      timer = window.setTimeout(tick, Math.max(8, 500 / rate));
      if (busyRef.current) return;
      const next = (startFrame + Math.floor(((performance.now() - start) / 1000) * rate)) % frameCount;
      if (next !== useStore.getState().frameIndex) setFrame(next);
    };
    tick();
    return () => window.clearTimeout(timer);
  }, [playing, isVideo, frameCount, fps, setFrame]);

  useEffect(() => {
    if (!menu) return;
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    const close = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenu(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenu(null);
        menuButtonRef.current?.focus();
      }
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', escape);
    };
  }, [menu]);

  const openMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    setMenu({
      x: Math.min(event.clientX - bounds.left, bounds.width - 178),
      y: Math.min(event.clientY - bounds.top, bounds.height - 174),
    });
  };

  const toggleMenu = () => {
    if (menu) {
      setMenu(null);
      return;
    }
    setMenu({ x: 12, y: 12 });
  };

  const downloadFrame = () => {
    if (!renderedUrl) return;
    const anchor = document.createElement('a');
    anchor.href = renderedUrl;
    anchor.download = `${media?.name?.replace(/\.[^.]+$/, '') ?? 'visionstyle'}-frame.jpg`;
    anchor.click();
    setMenu(null);
  };

  return (
    <div ref={wrapRef} className={`stage-wrap ${fit ? 'fit' : 'actual'}`}>
      {renderedUrl ? <img className="stage" src={renderedUrl} alt="Annotated preview" width={media?.width} height={media?.height} draggable={false} onContextMenu={openMenu} />
        : waiting && imageId ? <img className="stage backdrop" src={api.thumbnailUrl(imageId)} alt="" width={media?.width} height={media?.height} draggable={false} />
        : <div className={`stage placeholder ${imageId ? 'loading' : 'empty'}`}><span>{imageId ? 'Rendering scene…' : 'Choose a source to begin.'}</span></div>}
      {renderedUrl && <button ref={menuButtonRef} type="button" className="stage-options" aria-label="Preview options" aria-haspopup="menu" aria-expanded={Boolean(menu)} onClick={toggleMenu}><Icon name="options" /></button>}
      {menu && <div ref={menuRef} className="stage-menu" role="menu" aria-label="Preview options" style={{ left: menu.x, top: menu.y }} onKeyDown={(event) => {
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
        const current = items.indexOf(document.activeElement as HTMLButtonElement);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items[next]?.focus();
      }}>
        <span className="stage-menu-label">Preview</span>
        <button type="button" role="menuitem" className={fit ? 'active' : ''} onClick={() => { setFit(true); setMenu(null); menuButtonRef.current?.focus(); }}><Icon name="fit" /> Fit to canvas</button>
        <button type="button" role="menuitem" className={!fit ? 'active' : ''} onClick={() => { setFit(false); setMenu(null); menuButtonRef.current?.focus(); }}><Icon name="actual" /> Actual size</button>
        <div className="stage-menu-rule" />
        <button type="button" role="menuitem" onClick={() => { setMenu(null); onChangeSource?.(); }}><Icon name="change" /> Change source</button>
        <button type="button" role="menuitem" onClick={downloadFrame}><Icon name="download" /> Save frame</button>
      </div>}
      {tooLong && media && <TrimPrompt name={displayName(media.name)} duration={media.duration ?? 0} />}
      {!tooLong && job && (
        <div className="stage-notice tracking" role="status">
          <strong>Detecting objects in every frame…</strong>
          <span>This runs once. The detections are saved with the video, so styling it afterwards replays them instead of running the model again.</span>
        </div>
      )}
      <div className={`busy ${busy ? 'show' : ''}`} aria-hidden="true" />
    </div>
  );
}

/** Shown instead of the preview for a video longer than Studio will track. */
function TrimPrompt({ name, duration }: { name: string; duration: number }) {
  const limit = useStore((s) => s.info?.max_video_seconds ?? 60);
  const trimming = useStore((s) => s.trimming);
  const trimVideo = useStore((s) => s.trimVideo);
  const imageId = useStore((s) => s.imageId);
  const deleteImage = useStore((s) => s.deleteImage);
  return (
    <div className="stage-notice trim" role="alertdialog" aria-labelledby="trim-title" aria-describedby="trim-body">
      <span className="stage-notice-icon" aria-hidden="true"><Icon name="play" /></span>
      <strong id="trim-title">This video is {formatTime(duration).replace(/\.\d+$/, '')} long</strong>
      <p id="trim-body">
        Studio detects objects once per video and replays them while you style, which works for clips up to {limit / 60 === 1 ? 'one minute' : `${limit} seconds`}.
        Trim <em>{name}</em> to its first minute to continue.
      </p>
      <div className="stage-notice-actions">
        <button type="button" className="btn primary" onClick={() => trimVideo()} disabled={trimming} autoFocus>
          {trimming ? 'Trimming…' : 'Use the first minute'}
        </button>
        <button type="button" className="btn" onClick={() => imageId && deleteImage(imageId)} disabled={trimming}>Remove video</button>
      </div>
      <small>Trimming keeps 00:00–01:00 as a new clip without audio; the long upload is removed.</small>
    </div>
  );
}
