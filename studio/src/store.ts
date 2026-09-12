/* Application state (zustand). */
import { create } from 'zustand';
import { api, type DetectionItem, type ImageInfo, type Info, type ModelInfo, type PresetInfo } from './api';
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
  hidden: Set<number>;
  selected: number | null;
  selectedClass: string | null;
  detecting: boolean;
  syntheticTrails: boolean;
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
  uploadModel: (file: File) => Promise<void>;
  setModel: (id: string | null) => void;
  setConf: (v: number) => void;
  detect: () => Promise<void>;
  toggleHidden: (i: number) => void;
  setHidden: (indices: Set<number>) => void;
  select: (i: number | null) => void;
  selectClass: (className: string | null) => void;
  setSyntheticTrails: (v: boolean) => void;
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

export const useStore = create<State>((set, get) => ({
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
  hidden: new Set(),
  selected: null,
  selectedClass: null,
  detecting: false,
  syntheticTrails: true,
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
    const img = get().images.find((i) => i.id === id);
    set({
      imageId: id,
      modelId: img?.kind === 'video' && get().yoloAvailable ? 'yolov8n.pt' : null,
      detections: [], hidden: new Set(), selected: null, selectedClass: null,
    });
    if (img?.has_detections && !get().modelId) {
      await get().detect();
    } else if (get().modelId || get().yoloAvailable) {
      await get().detect();
    }
  },
  uploadImage: async (file) => {
    const info = await api.uploadImage(file);
    set({ images: [...get().images.filter((i) => i.id !== info.id), info] });
    await get().selectImage(info.id);
    get().notify(`Loaded ${info.name}`);
  },
  uploadModel: async (file) => {
    const info = await api.uploadModel(file);
    set({ models: [...get().models.filter((m) => m.id !== info.id), info], modelId: info.id });
    get().notify(`Model ${info.name} ready`);
    await get().detect();
  },
  setModel: (id) => set({ modelId: id }),
  setConf: (v) => set({ conf: v }),
  detect: async () => {
    const { imageId, modelId, conf, yoloAvailable, images } = get();
    if (!imageId) return;
    const img = images.find((i) => i.id === imageId);
    let model = modelId;
    if (!model && !img?.has_detections) model = yoloAvailable ? 'yolov8n.pt' : null;
    if (!model && !img?.has_detections) {
      set({ error: 'No detections available: upload a model or install visionstyle[yolo].' });
      return;
    }
    set({ detecting: true, error: null });
    try {
      const res = await api.detect(imageId, model, conf);
      set({ detections: res.detections, hidden: new Set(), selected: null, selectedClass: null, detecting: false });
      if (res.ms !== undefined) get().notify(`${res.detections.length} objects · ${res.ms.toFixed(0)} ms`);
    } catch (e) {
      set({ detecting: false, error: (e as Error).message });
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
  setSyntheticTrails: (v) => set({ syntheticTrails: v }),
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
}));

/** Detections currently visible (respecting hidden set / selection isolate). */
export function visibleDetections(dets: DetectionItem[], hidden: Set<number>): DetectionItem[] {
  return dets.filter((_, i) => !hidden.has(i));
}
