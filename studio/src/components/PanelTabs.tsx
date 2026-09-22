import type { StudioPanel } from "./TopBar";

const STEPS: { id: StudioPanel; label: string; step: string }[] = [
  { id: "media", label: "Source", step: "01" },
  { id: "style", label: "Design", step: "02" },
  { id: "objects", label: "Objects", step: "03" },
];

/** The Source → Design → Objects steps, shown at the top of the inspector they switch. */
export function PanelTabs({ panel, onChange }: { panel: StudioPanel; onChange: (panel: StudioPanel) => void }) {
  return (
    <nav className="panel-tabs" aria-label="Studio workspace">
      {STEPS.map((item) => (
        <button
          type="button"
          key={item.id}
          className={panel === item.id ? "active" : ""}
          aria-current={panel === item.id ? "page" : undefined}
          onClick={() => onChange(item.id)}
        >
          <span className="panel-step" aria-hidden="true">{item.step}</span>
          {item.label}
        </button>
      ))}
    </nav>
  );
}
