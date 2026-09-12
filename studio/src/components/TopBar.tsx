import { useStore } from "../store";

export type StudioPanel = "media" | "style" | "objects" | "export";
interface TopBarProps {
  panel: StudioPanel;
  onPanelChange: (panel: StudioPanel) => void;
}
export function TopBar({ panel, onPanelChange }: TopBarProps) {
  const info = useStore((s) => s.info);
  const dirty = useStore((s) => s.dirty);
  return (
    <header className="appbar">
      <a
        className="appbar-brand"
        href="#live-preview"
        aria-label="visionstyle Studio home"
      >
        <img
          className="brand-logo"
          src="/chroma-press-light-symbol-transparent.png"
          alt=""
        />
        <span className="brand-context">STUDIO</span>
      </a>
      <span className="appbar-product">Visual annotation workspace</span>
      <div className="appbar-actions">
        <span className="connection-status">
          <i className={info ? "ready" : ""} />
          {info ? (dirty ? "Style modified" : "Local session") : "Connecting…"}
        </span>
        <button
          type="button"
          className={`btn primary export-button ${panel === "export" ? "active" : ""}`}
          onClick={() => onPanelChange("export")}
        >
          Export style <span aria-hidden="true">↗</span>
        </button>
      </div>
    </header>
  );
}
