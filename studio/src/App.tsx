import { useEffect, useRef, useState } from "react";
import { Detections } from "./components/Detections";
import { DetectionShelf } from "./components/DetectionShelf";
import { Export } from "./components/Export";
import { MediaSetup } from "./components/MediaSetup";
import { Icon, type IconName } from "./components/Icon";
import { PresetPicker } from "./components/PresetPicker";
import { Preview } from "./components/Preview";
import { StyleControls } from "./components/StyleControls";
import { TopBar, type StudioPanel } from "./components/TopBar";
import { useStore } from "./store";

const WORKSPACES = [
  { id: "media", label: "Source", hint: "Scene", icon: "source" },
  { id: "style", label: "Design", hint: "Style", icon: "design" },
  { id: "objects", label: "Objects", hint: "Inspect", icon: "objects" },
] as const;

const PANELS: StudioPanel[] = ["media", "style", "objects", "export"];

function panelFromUrl(): StudioPanel {
  const value = new URLSearchParams(window.location.search).get("panel") as StudioPanel | null;
  return value && PANELS.includes(value) ? value : "style";
}

export default function App() {
  const boot = useStore((s) => s.boot);
  const toast = useStore((s) => s.toast);
  const error = useStore((s) => s.error);
  const setError = useStore((s) => s.setError);
  const playing = useStore((s) => s.playing);
  const setPlaying = useStore((s) => s.setPlaying);
  const style = useStore((s) => s.style);
  const renderMs = useStore((s) => s.renderMs);
  const resetStyle = useStore((s) => s.resetStyle);
  const synthetic = useStore((s) => s.syntheticTrails);
  const setSynthetic = useStore((s) => s.setSyntheticTrails);
  const images = useStore((s) => s.images);
  const imageId = useStore((s) => s.imageId);
  const detections = useStore((s) => s.detections);
  const detect = useStore((s) => s.detect);
  const detecting = useStore((s) => s.detecting);
  const img = images.find((i) => i.id === imageId);
  const isVideo = img?.kind === "video";
  const animated =
    isVideo ||
    (style.line?.animation !== "none" && (style.line?.speed ?? 0) > 0);
  const [panel, setPanel] = useState<StudioPanel>(panelFromUrl);
  const editor = useRef<HTMLElement>(null);

  useEffect(() => {
    boot();
  }, [boot]);
  useEffect(() => {
    const warnUnsaved = (event: BeforeUnloadEvent) => {
      if (!useStore.getState().dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnUnsaved);
    return () => window.removeEventListener("beforeunload", warnUnsaved);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.closest(
          'input, select, textarea, button, a, [contenteditable="true"], [role="switch"]',
        ) ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey
      )
        return;
      if (e.code === "Space" && animated) {
        e.preventDefault();
        setPlaying(!useStore.getState().playing);
      }
      if (e.key.toLowerCase() === "r") resetStyle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setPlaying, resetStyle, animated]);
  useEffect(() => {
    const restorePanel = () => setPanel(panelFromUrl());
    window.addEventListener("popstate", restorePanel);
    return () => window.removeEventListener("popstate", restorePanel);
  }, []);

  const openPanel = (next: StudioPanel) => {
    if (next !== panel) {
      const url = new URL(window.location.href);
      url.searchParams.set("panel", next);
      window.history.pushState({}, "", url);
    }
    setPanel(next);
    editor.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });
    editor.current?.focus({ preventScroll: true });
  };
  return (
    <div className="app">
      <a className="skip-link" href="#style-controls">Skip to editor</a>
      <TopBar panel={panel} onPanelChange={openPanel} />
      <main className="studio-stage">
        <section
          ref={editor}
          id="style-controls"
          className="editor-workspace"
          tabIndex={-1}
          aria-label="Editing workspace"
        >
          <div className="editor-heading">
            <div>
              <p className="eyebrow">
                {panel === "style"
                  ? "Annotation design"
                  : panel === "media"
                    ? "Scene setup"
                    : panel === "objects"
                      ? "Detected objects"
                      : "Export"}
              </p>
              <h2>
                {panel === "style"
                  ? "Style the annotation."
                  : panel === "media"
                    ? "Choose a video source."
                    : panel === "objects"
                      ? "Review the frame."
                      : "Use this style elsewhere."}
              </h2>
            </div>
            {panel === "style" && (
              <div className="editor-actions">
                <PresetPicker />
                <button
                  type="button"
                  className="reset-style"
                  onClick={resetStyle}
                  title="Reset to preset (R)"
                >
                  <Icon name="reset" /> Reset
                </button>
              </div>
            )}
            {panel === "export" && (
              <button
                type="button"
                className="btn"
                onClick={() => openPanel("style")}
              >
                <Icon name="back" /> Back to design
              </button>
            )}
          </div>
          <div className={`playground panel-${panel}`}>
            <aside
              className="playground-controls"
              aria-label="Configuration controls"
            >
              <div className="control-deck">
                <nav
                  className="workspace-switcher"
                  aria-label="Studio workspace"
                >
                  {WORKSPACES.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className={panel === item.id ? "active" : ""}
                      aria-current={panel === item.id ? "page" : undefined}
                      onClick={() => openPanel(item.id)}
                    >
                      <span className="workspace-icon"><Icon name={item.icon as IconName} /></span>
                      <span>
                        <strong>{item.label}</strong>
                        <small>{item.hint}</small>
                      </span>
                    </button>
                  ))}
                </nav>
                <div className="control-deck-body">
                  <div hidden={panel !== "style"}>
                    <StyleControls />
                  </div>
                  {panel === "media" && (
                    <div className="workspace-surface">
                      <MediaSetup />
                    </div>
                  )}
                  {panel === "objects" && (
                    <div className="workspace-surface objects-workspace">
                      <p className="section-description">
                        {detections.length} objects in this scene. Toggle
                        visibility or select an object to isolate it.
                      </p>
                      <Detections />
                    </div>
                  )}
                  {panel === "export" && (
                    <div className="workspace-surface export-workspace">
                      <p className="section-description">
                        Save a reusable preset or bring the style straight into
                        your Python project.
                      </p>
                      <Export />
                    </div>
                  )}
                </div>
              </div>
            </aside>
            <section
              id="live-preview"
              className="cinema playground-preview"
              aria-label="Live preview"
            >
              <div className="cinema-meta">
                <div className="scene-name">
                  <span className="scene-icon" aria-hidden="true">
                    {isVideo ? "▶" : "▧"}
                  </span>
                  <span>{img?.name ?? "Choose a source"}</span>
                  <span className="scene-badge">{isVideo ? "Video" : img?.sample ? "Sample image" : "Image"}</span>
                </div>
                <button
                  type="button"
                  className="canvas-link"
                  onClick={() => openPanel("media")}
                >
                  <Icon name="change" /> Change source
                </button>
              </div>
              <div className="cinema-canvas">
                <Preview onChangeSource={() => openPanel("media")} />
                <span className="canvas-label">LIVE PREVIEW</span>
              </div>
              <div className="cinema-controls">
                <button
                  type="button"
                  className={`playback ${playing ? "active" : ""}`}
                  onClick={() => setPlaying(!playing)}
                  disabled={!animated && !isVideo}
                  title={
                    animated
                      ? "Play or pause (Space)"
                      : "Choose an animation in Line"
                  }
                >
                  <Icon name={playing ? "pause" : "play"} />
                  {playing ? "Pause" : isVideo ? "Play video" : "Play motion"}
                </button>
                <label className={`stage-toggle ${synthetic ? "on" : ""}`}>
                  <input
                    type="checkbox"
                    checked={synthetic}
                    onChange={(e) => setSynthetic(e.target.checked)}
                  />
                  <span />
                  Trail preview
                </label>
                <span className="render-status">
                  <i />
                  {renderMs ? `${renderMs.toFixed(0)} ms` : "Ready"}
                  <span> · rendered locally</span>
                </span>
                <button
                  type="button"
                  className="canvas-link"
                  onClick={() => detect()}
                  disabled={detecting || !imageId}
                >
                  <Icon name="detect" /> {detecting ? "Detecting…" : "Run detection"}
                </button>
              </div>
              <DetectionShelf />
            </section>
          </div>
        </section>
        <footer className="studio-footer">
          <div className="footer-brand">
            <img
              src="/chroma-press-light-lockup-transparent.png"
              alt="visionstyle"
              width="252"
              height="75"
            />
            <span>Chroma Press / Studio</span>
          </div>
          <a href="#live-preview">Back to the scene ↑</a>
        </footer>
      </main>
      <div className={`toast ${toast ? "show" : ""}`} role="status">
        {toast}
      </div>
      {error && (
        <div className="error-bar" role="alert">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
