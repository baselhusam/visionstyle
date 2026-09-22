import { useEffect, useRef, useState } from "react";
import { Detections } from "./components/Detections";
import { DetectionShelf } from "./components/DetectionShelf";
import { Export, type ExportTab } from "./components/Export";
import { MediaSetup } from "./components/MediaSetup";
import { Icon } from "./components/Icon";
import { PresetPicker } from "./components/PresetPicker";
import { Preview } from "./components/Preview";
import { StyleControls } from "./components/StyleControls";
import { Timeline } from "./components/Timeline";
import { PanelTabs } from "./components/PanelTabs";
import { TopBar, type StudioPanel } from "./components/TopBar";
import { displayName } from "./api";
import { useStore } from "./store";

const PANELS: StudioPanel[] = ["media", "style", "objects", "export"];

function panelFromUrl(): StudioPanel {
  const value = new URLSearchParams(window.location.search).get("panel") as StudioPanel | null;
  return value && PANELS.includes(value) ? value : "style";
}

/** True when the current scene is a video. Selected as a boolean so the root never re-renders per frame. */
const selectIsVideo = (s: ReturnType<typeof useStore.getState>) =>
  s.images.find((i) => i.id === s.imageId)?.kind === "video";

export default function App() {
  const boot = useStore((s) => s.boot);
  const setPlaying = useStore((s) => s.setPlaying);
  const resetStyle = useStore((s) => s.resetStyle);
  const stepFrame = useStore((s) => s.stepFrame);
  const isVideo = useStore(selectIsVideo);
  const [panel, setPanel] = useState<StudioPanel>(panelFromUrl);
  const [exportTab, setExportTab] = useState<ExportTab>("yaml");
  const inspector = useRef<HTMLElement>(null);

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
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // Let native controls and tab/menu navigation retain their expected keyboard behavior.
      // In particular, range inputs own ArrowLeft/ArrowRight for precise style and timeline edits.
      const interactive = Boolean(target.closest?.('input, select, textarea, [contenteditable="true"], button, a, [role="switch"], [role="tab"], [role="menuitem"], [role="radio"]'));
      if (isVideo && !interactive && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        e.preventDefault();
        stepFrame((e.key === "ArrowRight" ? 1 : -1) * (e.shiftKey ? 10 : 1));
        return;
      }
      if (interactive) return;
      if (e.code === "Space" && (isVideo || lineAnimated(useStore.getState().style))) {
        e.preventDefault();
        setPlaying(!useStore.getState().playing);
      }
      if (e.key.toLowerCase() === "r") resetStyle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setPlaying, resetStyle, isVideo, stepFrame]);
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
    if (window.matchMedia("(max-width: 900px)").matches) {
      window.requestAnimationFrame(() => {
        inspector.current?.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth",
          block: "start",
        });
        inspector.current?.focus({ preventScroll: true });
      });
    }
  };
  const openExport = (tab: ExportTab) => {
    setExportTab(tab);
    openPanel("export");
  };
  const deck = DECKS[panel];
  return (
    <div className="app">
      <a className="skip-link" href="#style-controls">Skip to editor</a>
      <TopBar panel={panel} onPanelChange={openPanel} />
      <main className="studio-stage">
        <section
          id="editor-workspace"
          className="editor-workspace"
          tabIndex={-1}
          aria-label="Editing workspace"
        >
          <WorkspaceHeading />
          <div className={`playground panel-${panel}`}>
            <section
              id="live-preview"
              className="cinema playground-preview"
              aria-label="Live preview"
            >
              <CinemaMeta onChangeSource={() => openPanel("media")} />
              <div className="cinema-canvas">
                <Preview onChangeSource={() => openPanel("media")} />
              </div>
              <div className="cinema-footer">
                <Timeline />
                <DetectionShelf />
              </div>
            </section>
            <aside
              id="style-controls"
              ref={inspector}
              className="playground-controls"
              aria-label={`${deck.title} inspector`}
              tabIndex={-1}
            >
              <div className="control-deck">
                <div className="deck-toolbar">
                  {panel === "export" ? (
                    <h2>{deck.title}</h2>
                  ) : (
                    <PanelTabs panel={panel} onChange={openPanel} />
                  )}
                  {panel === "style" && (
                    <div className="editor-actions">
                      <PresetPicker />
                      <button
                        type="button"
                        className="btn quiet reset-button"
                        onClick={resetStyle}
                        title="Reset to preset (R)"
                        aria-label="Reset style to preset"
                      >
                        <Icon name="reset" />
                      </button>
                    </div>
                  )}
                  {panel === "export" && (
                    <button
                      type="button"
                      className="btn inspector-back"
                      onClick={() => openPanel("style")}
                    >
                      <Icon name="back" /> Back to Design
                    </button>
                  )}
                </div>
                <div className="control-deck-body">
                  <div hidden={panel !== "style"} className="design-workspace-host">
                    <StyleControls />
                  </div>
                  {panel === "media" && (
                    <div className="workspace-surface">
                      <MediaSetup />
                    </div>
                  )}
                  {panel === "objects" && <ObjectsWorkspace />}
                  {panel === "export" && (
                    <div className="workspace-surface export-workspace">
                      <Export initialTab={exportTab} />
                    </div>
                  )}
                </div>
                {panel === "style" && (
                  <div className="deck-footer">
                    <strong>Happy with the look?</strong>
                    <div className="deck-footer-actions">
                      <button type="button" className="btn" onClick={() => openExport("python")}>
                        <Icon name="code" /> Code
                      </button>
                      <button type="button" className="btn primary" onClick={() => openExport("prompt")}>
                        <Icon name="design" /> AI prompt
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </aside>
          </div>
        </section>
      </main>
      <Notices />
    </div>
  );
}

const DECKS: Record<StudioPanel, { title: string }> = {
  style: { title: "Design" },
  media: { title: "Source" },
  objects: { title: "Objects" },
  export: { title: "Export" },
};

function lineAnimated(style: ReturnType<typeof useStore.getState>["style"]): boolean {
  return style.line?.animation !== "none" && (style.line?.speed ?? 0) > 0;
}

function WorkspaceHeading() {
  const scene = useStore((s) => s.images.find((image) => image.id === s.imageId));
  return (
    <header className="workspace-heading">
      <h1>{scene ? displayName(scene.name) : "Choose a scene"}</h1>
    </header>
  );
}

function CinemaMeta({ onChangeSource }: { onChangeSource: () => void }) {
  const img = useStore((s) => s.images.find((i) => i.id === s.imageId));
  const renderMs = useStore((s) => s.renderMs);
  const playing = useStore((s) => s.playing);
  const setPlaying = useStore((s) => s.setPlaying);
  const animated = useStore((s) => lineAnimated(s.style));
  const isVideo = img?.kind === "video";
  return (
    <div className="cinema-meta">
      <div className="scene-name">
        <span className="scene-icon" aria-hidden="true">
          <Icon name={isVideo ? "play" : "source"} />
        </span>
        <span>{img ? displayName(img.name) : "Choose a source"}</span>
        <span className="scene-badge">{isVideo ? "Video" : img?.sample ? "Sample" : "Image"}</span>
      </div>
      <div className="cinema-meta-actions">
        <span className="render-status" title="Time to render the last frame">
          <i />
          {renderMs ? `${renderMs.toFixed(0)} ms` : "Ready"}
        </span>
        {/* videos play from the timeline; on stills this only drives an animated line style */}
        {!isVideo && animated && (
          <button
            type="button"
            className={`canvas-link playback ${playing ? "active" : ""}`}
            onClick={() => setPlaying(!playing)}
            title="Play or pause (Space)"
          >
            <Icon name={playing ? "pause" : "play"} /> {playing ? "Pause" : "Play motion"}
          </button>
        )}
        <button type="button" className="canvas-link" onClick={onChangeSource}>
          <Icon name="change" /> Change source
        </button>
      </div>
    </div>
  );
}

function ObjectsWorkspace() {
  return (
    <div className="workspace-surface objects-workspace">
      <Detections />
    </div>
  );
}

function Notices() {
  const toast = useStore((s) => s.toast);
  const error = useStore((s) => s.error);
  const setError = useStore((s) => s.setError);
  return (
    <>
      <div className={`toast ${toast ? "show" : ""}`} role="status">
        {toast}
      </div>
      {error && (
        <div className="error-bar" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss error">
            ×
          </button>
        </div>
      )}
    </>
  );
}
