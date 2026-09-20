import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, type DetectionItem, type ImageInfo, type JobStatus, type VideoTracks } from '../api';
import { useStore } from '../store';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const image = (id: string, overrides: Partial<ImageInfo> = {}): ImageInfo => ({
  id,
  name: id,
  sample: false,
  has_detections: false,
  kind: 'image',
  ...overrides,
});

const detection = (className: string): DetectionItem => ({
  xyxy: [0, 0, 10, 10],
  class_id: 0,
  class_name: className,
  confidence: 0.9,
  track_id: null,
});

const job = (id: string, status: JobStatus['status']): JobStatus => ({
  id,
  image_id: id,
  model_id: 'model.pt',
  status,
  done: 0,
  total: 1,
  ms: 10,
  error: null,
});

const tracks = (id: string): VideoTracks => ({
  image: id,
  model: 'model.pt',
  conf: 0.3,
  fps: 24,
  frame_count: 1,
  width: 10,
  height: 10,
  frames: [{ index: 0, time: 0, detections: [detection('tracked')] }],
});

beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubGlobal('window', {
    clearTimeout: vi.fn(),
    setTimeout: vi.fn(() => 0),
  });
  useStore.setState({
    images: [],
    imageId: null,
    modelId: null,
    yoloAvailable: false,
    detections: [],
    frames: null,
    frameIndex: 0,
    hidden: new Set(),
    selected: null,
    selectedClass: null,
    detecting: false,
    job: null,
    error: null,
    playing: false,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('scene request generations', () => {
  it('ignores a stale detection success after switching scenes', async () => {
    const response = deferred<{ detections: DetectionItem[]; ms?: number }>();
    vi.spyOn(api, 'detect').mockReturnValue(response.promise);
    useStore.setState({
      images: [image('a'), image('b')],
      imageId: 'a',
      modelId: 'model.pt',
    });

    const stale = useStore.getState().detect();
    await useStore.getState().selectImage('b');
    useStore.setState({ detections: [detection('current')], error: 'current scene' });

    response.resolve({ detections: [detection('stale')] });
    await stale;

    expect(useStore.getState().detections[0].class_name).toBe('current');
    expect(useStore.getState().error).toBe('current scene');
    expect(useStore.getState().detecting).toBe(false);
  });

  it('ignores a stale detection error after switching scenes', async () => {
    const response = deferred<{ detections: DetectionItem[]; ms?: number }>();
    vi.spyOn(api, 'detect').mockReturnValue(response.promise);
    useStore.setState({
      images: [image('a'), image('b')],
      imageId: 'a',
      modelId: 'model.pt',
    });

    const stale = useStore.getState().detect();
    await useStore.getState().selectImage('b');
    useStore.setState({ error: 'current scene' });

    response.reject(new Error('stale failure'));
    await stale;

    expect(useStore.getState().error).toBe('current scene');
    expect(useStore.getState().detecting).toBe(false);
  });

  it('does not leak a stale track loading error into the next scene', async () => {
    const response = deferred<VideoTracks>();
    vi.spyOn(api, 'tracks').mockReturnValue(response.promise);
    useStore.setState({
      images: [image('a', { kind: 'video', tracked: true }), image('b')],
      imageId: 'a',
    });

    const stale = useStore.getState().loadTracks('a');
    await useStore.getState().selectImage('b');
    useStore.setState({ error: 'current scene' });

    response.reject(new Error('stale track failure'));
    await stale;

    expect(useStore.getState().error).toBe('current scene');
  });

  it('keeps the current video job when an older job completes', async () => {
    const oldStart = deferred<JobStatus>();
    const currentStart = deferred<JobStatus>();
    const currentTracks = deferred<VideoTracks>();
    vi.spyOn(api, 'detectVideo').mockImplementation((id) => (id === 'a' ? oldStart.promise : currentStart.promise));
    vi.spyOn(api, 'tracks').mockReturnValue(currentTracks.promise);
    useStore.setState({
      images: [image('a', { kind: 'video' }), image('b', { kind: 'video' })],
      imageId: 'a',
    });

    const old = useStore.getState().detectVideo();
    await useStore.getState().selectImage('b');
    const current = useStore.getState().detectVideo();

    currentStart.resolve(job('current', 'done'));
    await Promise.resolve();
    await Promise.resolve();
    expect(useStore.getState().job?.id).toBe('current');

    oldStart.resolve(job('old', 'done'));
    await old;
    expect(useStore.getState().job?.id).toBe('current');
    expect(useStore.getState().detecting).toBe(true);

    currentTracks.resolve(tracks('b'));
    await current;
    expect(useStore.getState().job).toBeNull();
    expect(useStore.getState().detecting).toBe(false);
    expect(useStore.getState().error).toBeNull();
  });

  it('does not let an initial track load overwrite a newer detection in the same scene', async () => {
    const initialTracks = deferred<VideoTracks>();
    const currentStart = deferred<JobStatus>();
    const currentTracks = deferred<VideoTracks>();
    let trackCalls = 0;
    vi.spyOn(api, 'tracks').mockImplementation(() => {
      trackCalls += 1;
      return trackCalls === 1 ? initialTracks.promise : currentTracks.promise;
    });
    vi.spyOn(api, 'detectVideo').mockReturnValue(currentStart.promise);
    useStore.setState({
      images: [image('a', { kind: 'video', tracked: true })],
      imageId: null,
      yoloAvailable: true,
    });

    const initial = useStore.getState().selectImage('a');
    const current = useStore.getState().detectVideo();
    currentStart.resolve(job('current', 'done'));
    await Promise.resolve();
    await Promise.resolve();
    expect(trackCalls).toBe(2);

    initialTracks.resolve(tracks('initial'));
    await initial;
    expect(useStore.getState().frames).toBeNull();

    currentTracks.resolve(tracks('current'));
    await current;
    expect(useStore.getState().frames?.[0].detections[0].class_name).toBe('tracked');
    expect(useStore.getState().error).toBeNull();
  });

  it('does not start a duplicate still-image detection while one is pending', async () => {
    const response = deferred<{ detections: DetectionItem[]; ms?: number }>();
    const detect = vi.spyOn(api, 'detect').mockReturnValue(response.promise);
    useStore.setState({
      images: [image('a')],
      imageId: 'a',
      modelId: 'model.pt',
    });

    const first = useStore.getState().detect();
    const second = useStore.getState().detect();
    expect(detect).toHaveBeenCalledTimes(1);

    response.resolve({ detections: [detection('current')] });
    await first;
    await second;
    expect(useStore.getState().detections[0].class_name).toBe('current');
  });
});
