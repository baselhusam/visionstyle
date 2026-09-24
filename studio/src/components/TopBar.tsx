import brandSymbol from "../assets/chroma-press-light-symbol-transparent-96.png";
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
          src={brandSymbol}
          alt=""
          width="32"
          height="32"
        />
        <span className="brand-context">
          visionstyle<small>Studio</small>
        </span>
      </a>
      <div className="appbar-actions">
        <span className={`connection-status ${dirty ? "dirty" : ""}`}>
          <i className={info ? "ready" : ""} />
          {info ? (dirty ? "Unsaved changes" : "Connected") : "Connecting…"}
        </span>
        <button
          type="button"
          className={`btn primary export-button ${panel === "export" ? "active" : ""}`}
          aria-current={panel === "export" ? "page" : undefined}
          onClick={() => onPanelChange("export")}
        >
          <Icon name="export" /> Export
        </button>
      </div>
    </header>
  );
}
