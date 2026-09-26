/* Thin wrappers over the Studio HTTP API. */
import type { Style } from './types/style';

export interface DetectionItem {
  xyxy: [number, number, number, number];
  class_id: number | null;
  class_name: string | null;
  confidence: number | null;
  track_id: number | null;
}

export interface ImageInfo {
  id: string;
  name: string;
  sample: boolean;
  has_detections: boolean;
  width?: number;
  height?: number;
  kind?: 'image' | 'video';
  duration?: number | null;
  fps?: number | null;
  frame_count?: number;
  tracked?: boolean;
}

export interface VideoFrame {
  index: number;
  time: number;
  detections: DetectionItem[];
}

export interface VideoTracks {
  image: string;
  model: string;
  conf: number;
  fps: number;
  frame_count: number;
  width: number;
  height: number;
  frames: VideoFrame[];
}

export interface JobStatus {
  id: string;
  image_id: string;
  model_id: string;
  status: 'running' | 'done' | 'error' | 'cancelled';
  done: number;
  total: number;
  ms: number;
  error: string | null;
}

export interface ModelInfo {
  id: string;
  name: string;
  size: number | null;
}

export interface PresetInfo {
  name: string;
  origin: 'builtin' | 'user' | 'env';
  description: string;
  path: string;
  style: Style;
}

export interface Info {
  version: string;
  yolo_available: boolean;
  presets_dir: string;
  user_presets_dir: string;
}

/** Uploads are stored as `<stem>-<sha1[:10]>.<ext>`; show the name the user actually chose. */
export function displayName(name: string | undefined): string {
  return (name ?? '').replace(/-[0-9a-f]{10}(?=\.[^.]+$)/, '');
}

// Built-in preset names are title-cased by CSS; these need more than a capital first letter.
const PRESET_TITLES: Record<string, string> = { cctv: 'CCTV', 'high-contrast': 'High contrast' };

/** Display title for a built-in preset name (saved presets are shown exactly as typed). */
export function presetTitle(name: string): string {
  return PRESET_TITLES[name] ?? name;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail ?? body);
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

const post = (url: string, body: unknown, signal?: AbortSignal) =>
  fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });

export const api = {
  info: () => fetch('/api/info').then((r) => json<Info>(r)),
  presets: () => fetch('/api/presets').then((r) => json<PresetInfo[]>(r)),
  savePreset: (name: string, style: Style) =>
    fetch(`/api/presets/${encodeURIComponent(name)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ style }),
    }).then((r) => json<{ name: string; path: string }>(r)),
  deletePreset: (name: string) =>
    fetch(`/api/presets/${encodeURIComponent(name)}`, { method: 'DELETE' }).then((r) => json<{ deleted: string }>(r)),
  images: () => fetch('/api/images').then((r) => json<ImageInfo[]>(r)),
  thumbnailUrl: (image_id: string) => `/api/images/${encodeURIComponent(image_id)}/thumbnail`,
  deleteImage: (image_id: string) =>
    fetch(`/api/images/${encodeURIComponent(image_id)}`, { method: 'DELETE' }).then((r) => json<{ deleted: string }>(r)),
  tracks: (image_id: string) => fetch(`/api/images/${encodeURIComponent(image_id)}/tracks`).then((r) => json<VideoTracks>(r)),
  detectVideo: (image_id: string, model_id: string, conf: number) =>
    post('/api/detect/video', { image_id, model_id, conf }).then((r) => json<JobStatus>(r)),
  job: (id: string) => fetch(`/api/jobs/${id}`).then((r) => json<JobStatus>(r)),
  cancelJob: (id: string) => fetch(`/api/jobs/${id}`, { method: 'DELETE' }).then((r) => json<JobStatus>(r)),
  uploadImage: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return fetch('/api/images', { method: 'POST', body: fd }).then((r) => json<ImageInfo>(r));
  },
  models: () => fetch('/api/models').then((r) => json<{ models: ModelInfo[]; yolo_available: boolean; default: string | null }>(r)),
  uploadModel: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return fetch('/api/models', { method: 'POST', body: fd }).then((r) => json<ModelInfo>(r));
  },
  detect: (image_id: string, model_id: string | null, conf: number) =>
    post('/api/detect', { image_id, model_id, conf }).then((r) => json<{ detections: DetectionItem[]; ms?: number; source?: string }>(r)),
  yaml: (style: Style, excludeDefaults = false) =>
    post(`/api/style/yaml?exclude_defaults=${excludeDefaults}`, style).then(async (r) => {
      if (!r.ok) throw new Error(await r.text());
      return r.text();
    }),
  render: async (
    body: { image_id: string; style: Style; detections: DetectionItem[]; t: number; media_time?: number; frame_index?: number; max_size: number; synthetic_trails: boolean },
    signal?: AbortSignal,
  ): Promise<{ url: string; ms: number }> => {
    const res = await post('/api/render', body, signal);
    if (!res.ok) throw new Error(await res.text());
    const blob = await res.blob();
    return { url: URL.createObjectURL(blob), ms: parseFloat(res.headers.get('X-Render-Ms') ?? '0') };
  },
};
