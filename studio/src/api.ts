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
  savePreset: (name: string, style: Style, directory?: string) =>
    fetch(`/api/presets/${encodeURIComponent(name)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ style, directory: directory || null }),
    }).then((r) => json<{ name: string; path: string }>(r)),
  deletePreset: (name: string) =>
    fetch(`/api/presets/${encodeURIComponent(name)}`, { method: 'DELETE' }).then((r) => json<{ deleted: string }>(r)),
  images: () => fetch('/api/images').then((r) => json<ImageInfo[]>(r)),
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
    body: { image_id: string; style: Style; detections: DetectionItem[]; t: number; max_size: number; synthetic_trails: boolean },
    signal?: AbortSignal,
  ): Promise<{ url: string; ms: number }> => {
    const res = await post('/api/render', body, signal);
    if (!res.ok) throw new Error(await res.text());
    const blob = await res.blob();
    return { url: URL.createObjectURL(blob), ms: parseFloat(res.headers.get('X-Render-Ms') ?? '0') };
  },
};
