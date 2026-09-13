import { useStore } from "../store";
import { Icon, type IconName } from "./Icon";

export type StudioPanel = "media" | "style" | "objects" | "export";

const WORKSPACES: { id: StudioPanel; label: string; icon: IconName }[] = [
  { id: "media", label: "Source", icon: "source" },
  { id: "style", label: "Design", icon: "design" },
  { id: "objects", label: "Objects", icon: "objects" },
];

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
          width="32"
          height="32"
        />
        <span className="brand-context">
          visionstyle<small>Studio</small>
        </span>
      </a>
      <nav className="workspace-nav" aria-label="Studio workspace">
        {WORKSPACES.map((item) => (
          <button
            type="button"
            key={item.id}
            className={panel === item.id ? "active" : ""}
            aria-current={panel === item.id ? "page" : undefined}
            onClick={() => onPanelChange(item.id)}
          >
            <Icon name={item.icon} />
            {item.label}
          </button>
        ))}
      </nav>
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
