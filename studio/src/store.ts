/* Application state (zustand). */
import { create } from 'zustand';
import { api, displayName, type DetectionItem, type ImageInfo, type Info, type JobStatus, type ModelInfo, type PresetInfo, type VideoFrame } from './api';
import { defaultStyle } from './schema';
import type { Style } from './types/style';

export type PanelId = 'presets' | 'box' | 'stroke' | 'fill' | 'line' | 'label' | 'effects' | 'trail' | 'global';

interface State {
  info: Info | null;
  style: Style;
  activePreset: string | null;
  dirty: boolean;
  presets: PresetInfo[];
  images: ImageInfo[];
  imageId: string | null;
  models: ModelInfo[];
  modelId: string | null;
  yoloAvailable: boolean;
  conf: number;
  detections: DetectionItem[];
  /** Per-frame detections for a tracked video; null for stills and untracked videos. */
  frames: VideoFrame[] | null;
  fps: number;
  /** Position in `frames` (or the raw frame number for an untracked video). */
  frameIndex: number;
  /** Hidden objects — keyed by track id for a tracked video, by index otherwise (see detectionKey). */
  hidden: Set<number>;
  selected: number | null;
  selectedClass: string | null;
  detecting: boolean;
  job: JobStatus | null;
  playing: boolean;
  openPanels: Set<PanelId>;
  toast: string | null;
  error: string | null;
  renderMs: number;

  boot: () => Promise<void>;
  setStyle: (style: Style, opts?: { preset?: string | null }) => void;
  setPath: (path: string, value: unknown) => void;
  resetStyle: () => void;
  applyPreset: (name: string) => void;
  refreshPresets: () => Promise<void>;
  savePreset: (name: string, directory?: string) => Promise<string>;
  deletePreset: (name: string) => Promise<void>;
  selectImage: (id: string) => Promise<void>;
  uploadImage: (file: File) => Promise<void>;
  deleteImage: (id: string) => Promise<void>;
  loadTracks: (id: string, request?: { scene?: number; detection?: number }) => Promise<void>;
  detectVideo: () => Promise<void>;
  cancelDetection: () => Promise<void>;
  setFrame: (index: number) => void;
  stepFrame: (delta: number) => void;
  uploadModel: (file: File) => Promise<void>;
  setModel: (id: string | null) => void;
  setConf: (v: number) => void;
  detect: () => Promise<void>;
  toggleHidden: (i: number) => void;
  setHidden: (indices: Set<number>) => void;
  select: (i: number | null) => void;
  selectClass: (className: string | null) => void;
  setPlaying: (v: boolean) => void;
  togglePanel: (id: PanelId) => void;
  notify: (msg: string) => void;
  setError: (msg: string | null) => void;
  setRenderMs: (ms: number) => void;
}

export function setDeep<T extends object>(obj: T, path: string, value: unknown): T {
  const keys = path.split('.');
  const clone: any = structuredClone(obj);
  let node = clone;
  for (const k of keys.slice(0, -1)) {
    node[k] = node[k] == null ? {} : { ...node[k] };
    node = node[k];
  }
  node[keys[keys.length - 1]] = value;
  return clone;
}

export function getDeep(obj: any, path: string): any {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
}

let toastTimer: number | undefined;

export const useStore = create<State>((set, get) => {
  let sceneGeneration = 0;
  let detectionGeneration = 0;

  const isCurrentScene = (id: string, generation: number) => sceneGeneration === generation && get().imageId === id;
  const isCurrentDetection = (id: string, scene: number, detection: number) =>
    isCurrentScene(id, scene) && detectionGeneration === detection;

  return {
  info: null,
  style: defaultStyle() as Style,
  activePreset: 'default',
  dirty: false,
  presets: [],
  images: [],
  imageId: null,
  models: [],
  modelId: null,
  yoloAvailable: false,
  conf: 0.3,
  detections: [],
  frames: null,
  fps: 24,
  frameIndex: 0,
  hidden: new Set(),
  selected: null,
  selectedClass: null,
  detecting: false,
  job: null,
  playing: false,
  openPanels: new Set<PanelId>(['presets', 'box']),
  toast: null,
  error: null,
  renderMs: 0,

  boot: async () => {
    try {
      const [info, presets, images, models] = await Promise.all([api.info(), api.presets(), api.images(), api.models()]);
      const def = presets.find((p) => p.name === 'default');
      set({
        info,
        presets,
        images,
        models: models.models,
        yoloAvailable: models.yolo_available,
        style: def ? def.style : (defaultStyle() as Style),
      });
      const first = images.find((i) => i.id === 'sample:city-walkthrough') ?? images[0];
      if (first) await get().selectImage(first.id);
    } catch (e) {
      set({ error: `Could not reach the studio server: ${(e as Error).message}` });
    }
  },

  setStyle: (style, opts) => set({ style, activePreset: opts?.preset ?? null, dirty: opts?.preset ? false : true }),
  setPath: (path, value) => {
    const style = setDeep(get().style, path, value);
    set({ style, dirty: true });
  },
  resetStyle: () => {
    const { presets, activePreset } = get();
    const p = presets.find((x) => x.name === (activePreset ?? 'default'));
    set({ style: p ? structuredClone(p.style) : (defaultStyle() as Style), dirty: false });
    get().notify('Style reset');
  },
  applyPreset: (name) => {
    const p = get().presets.find((x) => x.name === name);
    if (!p) return;
    set({ style: structuredClone(p.style), activePreset: name, dirty: false });
  },
  refreshPresets: async () => set({ presets: await api.presets() }),
  savePreset: async (name, directory) => {
    const { style, presets, activePreset } = get();
    const source = presets.find((p) => p.name === activePreset);
    // a derivative of a built-in should not carry the original's description
    const description = source && source.name !== name && source.description === style.description ? '' : style.description;
    const res = await api.savePreset(name, { ...style, name, description }, directory);
    await get().refreshPresets();
    set({ activePreset: name, dirty: false, style: { ...get().style, name } });
    get().notify(`Saved ${res.path}`);
    return res.path;
  },
  deletePreset: async (name) => {
    await api.deletePreset(name);
    await get().refreshPresets();
    if (get().activePreset === name) set({ activePreset: null });
    get().notify(`Deleted preset ${name}`);
  },

  selectImage: async (id) => {
    const scene = ++sceneGeneration;
    // A source switch invalidates every in-flight detection, including a request
    // for the same source that was selected again before the response arrived.
    detectionGeneration += 1;
    const img = get().images.find((i) => i.id === id);
    const isVideo = img?.kind === 'video';
    set({
      imageId: id,
      modelId: isVideo && get().yoloAvailable ? 'yolov8n.pt' : null,
      detections: [], frames: null, frameIndex: 0, fps: img?.fps ?? 24,
      hidden: new Set(), selected: null, selectedClass: null, playing: false,
      detecting: false, job: null, error: null,
    });
    if (isVideo && img?.tracked) {
      await get().loadTracks(id, { scene });
    } else if (img?.has_detections && !get().modelId) {
      await get().detect();
    } else if (get().modelId || get().yoloAvailable) {
      await get().detect();
    }
  },
  deleteImage: async (id) => {
    const img = get().images.find((i) => i.id === id);
    await api.deleteImage(id);
    const images = get().images.filter((i) => i.id !== id);
    set({ images });
    if (get().imageId === id) {
      const next = images.find((i) => i.id === 'sample:city-walkthrough') ?? images[0];
      if (next) await get().selectImage(next.id);
      else set({ imageId: null, detections: [], frames: null });
    }
    get().notify(`Removed ${displayName(img?.name) || id}`);
  },
  loadTracks: async (id, request) => {
    const scene = request?.scene ?? sceneGeneration;
    const detection = request?.detection ?? detectionGeneration;
    const isCurrent = () => isCurrentScene(id, scene) && detectionGeneration === detection;
    try {
      const tracks = await api.tracks(id);
      if (!isCurrent()) return;
      const fps = tracks.fps || get().fps;
      set({
        // the decoder's real frame count beats the container's estimate
        images: get().images.map((i) => (i.id === id ? { ...i, fps, frame_count: tracks.frame_count, duration: tracks.frame_count / fps } : i)),
        frames: tracks.frames, fps, frameIndex: 0,
        detections: tracks.frames[0]?.detections ?? [],
        hidden: new Set(), selected: null, selectedClass: null,
      });
    } catch (e) {
      if (isCurrent()) set({ error: (e as Error).message });
    }
  },
  detectVideo: async () => {
    const { imageId, modelId, conf } = get();
    if (!imageId || get().detecting) return;
    const scene = sceneGeneration;
    const detection = ++detectionGeneration;
    set({ detecting: true, error: null, playing: false });
    try {
      let job = await api.detectVideo(imageId, modelId ?? 'yolov8n.pt', conf);
      if (!isCurrentDetection(imageId, scene, detection)) return;
      set({ job });
      while (job.status === 'running') {
        await new Promise((resolve) => setTimeout(resolve, 400));
        job = await api.job(job.id);
        if (!isCurrentDetection(imageId, scene, detection)) return; // the user moved on; the job finishes server-side
        set({ job });
      }
      if (!isCurrentDetection(imageId, scene, detection)) return;
      if (job.status === 'done') {
        set({ images: get().images.map((i) => (i.id === imageId ? { ...i, tracked: true, has_detections: true } : i)) });
        await get().loadTracks(imageId, { scene, detection });
        if (!isCurrentDetection(imageId, scene, detection)) return;
        get().notify(`Tracked ${job.total} frames · ${(job.ms / 1000).toFixed(1)} s`);
      } else if (job.status === 'error') {
        set({ error: job.error ?? 'Video detection failed' });
      } else {
        get().notify('Detection cancelled');
      }
    } catch (e) {
      if (isCurrentDetection(imageId, scene, detection)) set({ error: (e as Error).message });
    } finally {
      if (isCurrentDetection(imageId, scene, detection)) set({ detecting: false, job: null });
    }
  },
  cancelDetection: async () => {
    const job = get().job;
    if (job) await api.cancelJob(job.id).catch(() => undefined);
  },
  setFrame: (index) => {
    const { frames, images, imageId } = get();
    const count = frames ? frames.length : (images.find((i) => i.id === imageId)?.frame_count ?? 0);
    if (count <= 0) return;
    const next = ((index % count) + count) % count;
    set(frames ? { frameIndex: next, detections: frames[next].detections } : { frameIndex: next });
  },
  stepFrame: (delta) => get().setFrame(get().frameIndex + delta),
  uploadImage: async (file) => {
    set({ error: null });
    try {
      const info = await api.uploadImage(file);
      set({ images: [...get().images.filter((i) => i.id !== info.id), info] });
      await get().selectImage(info.id);
      get().notify(`Loaded ${displayName(info.name)}`);
    } catch (e) {
      set({ error: `Could not load ${file.name}: ${(e as Error).message}` });
    }
  },
  uploadModel: async (file) => {
    set({ error: null });
    try {
      const info = await api.uploadModel(file);
      set({ models: [...get().models.filter((m) => m.id !== info.id), info], modelId: info.id });
      get().notify(`Model ${info.name} ready`);
      await get().detect();
    } catch (e) {
      set({ error: `Could not load ${file.name}: ${(e as Error).message}` });
    }
  },
  setModel: (id) => set({ modelId: id }),
  setConf: (v) => set({ conf: v }),
  detect: async () => {
    const { imageId, modelId, conf, yoloAvailable, images } = get();
    if (!imageId || get().detecting) return;
    const img = images.find((i) => i.id === imageId);
    if (img?.kind === 'video' && yoloAvailable) {
      await get().detectVideo();
      return;
    }
    let model = modelId;
    if (!model && !img?.has_detections) model = yoloAvailable ? 'yolov8n.pt' : null;
    if (!model && !img?.has_detections) {
      set({ error: 'No detections available: upload a model or install visionstyle[yolo].' });
      return;
    }
    const scene = sceneGeneration;
    const detection = ++detectionGeneration;
    set({ detecting: true, error: null });
    try {
      const res = await api.detect(imageId, model, conf);
      if (!isCurrentDetection(imageId, scene, detection)) return;
      set({ detections: res.detections, hidden: new Set(), selected: null, selectedClass: null, detecting: false });
      if (res.ms !== undefined) get().notify(`${res.detections.length} objects · ${res.ms.toFixed(0)} ms`);
    } catch (e) {
      if (isCurrentDetection(imageId, scene, detection)) set({ detecting: false, error: (e as Error).message });
    }
  },
  toggleHidden: (i) => {
    const hidden = new Set(get().hidden);
    if (hidden.has(i)) hidden.delete(i);
    else hidden.add(i);
    set({ hidden });
  },
  setHidden: (indices) => set({ hidden: new Set(indices), selected: null }),
  select: (i) => set({ selected: get().selected === i ? null : i, selectedClass: null }),
  selectClass: (className) => set({ selectedClass: get().selectedClass === className ? null : className, selected: null }),
  setPlaying: (v) => set({ playing: v }),
  togglePanel: (id) => {
    const open = new Set(get().openPanels);
    if (open.has(id)) open.delete(id);
    else open.add(id);
    set({ openPanels: open });
  },
  notify: (msg) => {
    set({ toast: msg });
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => set({ toast: null }), 2600);
  },
  setError: (msg) => set({ error: msg }),
  setRenderMs: (ms) => set({ renderMs: ms }),
  };
});

/** Detections currently visible (respecting hidden set / selection isolate). */
/** Identity used for hide/isolate: the track id when the scene is tracked, else the index in the frame. */
export function detectionKey(det: DetectionItem, index: number, tracked: boolean): number {
  return tracked && det.track_id !== null ? det.track_id : index;
}

export function visibleDetections(dets: DetectionItem[], hidden: Set<number>, tracked = false): DetectionItem[] {
  return dets.filter((det, i) => !hidden.has(detectionKey(det, i, tracked)));
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`;
}
