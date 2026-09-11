import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useStore, visibleDetections } from '../store';

const FRAME_MS = 90;

export function Preview() {
  const style = useStore((s) => s.style);
  const imageId = useStore((s) => s.imageId);
  const detections = useStore((s) => s.detections);
  const hidden = useStore((s) => s.hidden);
  const selected = useStore((s) => s.selected);
  const syntheticTrails = useStore((s) => s.syntheticTrails);
  const playing = useStore((s) => s.playing);
  const setRenderMs = useStore((s) => s.setRenderMs);
  const setError = useStore((s) => s.setError);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fit, setFit] = useState(true);
  const tRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const animated = style.line?.animation !== 'none' && (style.line?.speed ?? 0) > 0;

  const dets = selected !== null ? detections.filter((_, i) => i === selected) : visibleDetections(detections, hidden);
  const key = JSON.stringify({ style, imageId, dets, syntheticTrails });

  useEffect(() => {
    if (!imageId) return;
    let cancelled = false;
    const run = async (t: number) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setBusy(true);
      try {
        const res = await api.render({ image_id: imageId, style, detections: dets, t, max_size: 1600, synthetic_trails: syntheticTrails }, ctrl.signal);
        if (cancelled || ctrl.signal.aborted) {
          URL.revokeObjectURL(res.url);
          return;
        }
        setUrl((old) => {
          if (old) URL.revokeObjectURL(old);
          return res.url;
        });
        setRenderMs(res.ms);
        setError(null);
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setError((e as Error).message);
      } finally {
        if (!cancelled) setBusy(false);
      }
    };
    // debounce slider drags
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => run(tRef.current), 60);

    let raf: number | undefined;
    if (playing && animated) {
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
  }, [key, playing, animated]);

  return (
    <div className={`stage-wrap ${fit ? 'fit' : 'actual'}`} onDoubleClick={() => setFit((f) => !f)} title="Double-click to toggle 1:1">
      {url ? <img className="stage" src={url} alt="Annotated preview" draggable={false} /> : <div className="stage placeholder">Select an image to begin.</div>}
      <div className={`busy ${busy ? 'show' : ''}`} aria-hidden="true" />
    </div>
  );
}
