import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useStore, visibleDetections } from '../store';

const FRAME_MS = 90;

export function Preview({ onChangeSource }: { onChangeSource?: () => void }) {
  const style = useStore((s) => s.style);
  const imageId = useStore((s) => s.imageId);
  const detections = useStore((s) => s.detections);
  const hidden = useStore((s) => s.hidden);
  const selected = useStore((s) => s.selected);
  const selectedClass = useStore((s) => s.selectedClass);
  const syntheticTrails = useStore((s) => s.syntheticTrails);
  const playing = useStore((s) => s.playing);
  const setRenderMs = useStore((s) => s.setRenderMs);
  const setError = useStore((s) => s.setError);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fit, setFit] = useState(true);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const tRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const animated = style.line?.animation !== 'none' && (style.line?.speed ?? 0) > 0;
  const media = useStore((s) => s.images.find((item) => item.id === s.imageId));
  const isVideo = media?.kind === 'video';

  const dets = selected !== null
    ? detections.filter((_, i) => i === selected)
    : selectedClass
      ? detections.filter((detection, i) => !hidden.has(i) && (detection.class_name ?? `class ${detection.class_id ?? '—'}`) === selectedClass)
      : visibleDetections(detections, hidden);
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
        const mediaTime = isVideo && media?.duration ? t % media.duration : isVideo ? t : 0;
        const res = await api.render({ image_id: imageId, style, detections: dets, t, media_time: mediaTime, max_size: 1600, synthetic_trails: syntheticTrails }, ctrl.signal);
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
    if (playing && (animated || isVideo)) {
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
  }, [key, playing, animated, isVideo, media?.duration]);

  useEffect(() => {
    if (!menu) return;
    const close = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenu(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenu(null);
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

  const downloadFrame = () => {
    if (!url) return;
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${media?.name?.replace(/\.[^.]+$/, '') ?? 'visionstyle'}-frame.jpg`;
    anchor.click();
    setMenu(null);
  };

  return (
    <div className={`stage-wrap ${fit ? 'fit' : 'actual'}`} onDoubleClick={() => setFit((f) => !f)}>
      {url ? <img className="stage" src={url} alt="Annotated preview" draggable={false} onClick={openMenu} onContextMenu={openMenu} aria-haspopup="menu" /> : <div className="stage placeholder">Select a source to begin.</div>}
      {menu && <div ref={menuRef} className="stage-menu" role="menu" aria-label="Preview options" style={{ left: menu.x, top: menu.y }}>
        <span className="stage-menu-label">Preview</span>
        <button type="button" role="menuitem" className={fit ? 'active' : ''} onClick={() => { setFit(true); setMenu(null); }}><span>⊙</span> Fit to canvas</button>
        <button type="button" role="menuitem" className={!fit ? 'active' : ''} onClick={() => { setFit(false); setMenu(null); }}><span>1:1</span> Actual size</button>
        <div className="stage-menu-rule" />
        <button type="button" role="menuitem" onClick={() => { setMenu(null); onChangeSource?.(); }}><span>⇄</span> Change source</button>
        <button type="button" role="menuitem" onClick={downloadFrame}><span>↓</span> Save frame</button>
      </div>}
      <div className={`busy ${busy ? 'show' : ''}`} aria-hidden="true" />
    </div>
  );
}
