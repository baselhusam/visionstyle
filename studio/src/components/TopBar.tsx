import { useStore } from "../store";
import { Icon } from "./Icon";

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
          width="48"
          height="48"
        />
        <span className="brand-context">STUDIO</span>
      </a>
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
          <Icon name="export" /> Export style
        </button>
      </div>
    </header>
  );
}
