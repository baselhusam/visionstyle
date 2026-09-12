import { useState } from "react";
import { SECTIONS } from "../controls/registry";
import { getDeep, useStore } from "../store";
import { Control } from "./Control";
import { PresetList } from "./PresetList";

const CATEGORY_PATHS: Record<string, string> = {
  presets: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  box: "M3 9V3h6 M15 3h6v6 M21 15v6h-6 M9 21H3v-6",
  stroke: "M4 5h16 M4 12h16 M4 18h16 M4 20h16",
  fill: "M4 4h16v16H4z M4 16l12-12 M8 20L20 8 M14 20l6-6",
  line: "M3 6h5 M12 6h3 M19 6h2 M3 12h18 M3 18h2 M9 18h2 M17 18h4",
  label: "M4 7V4h16v3 M12 4v16 M8 20h8",
  effects: "M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z",
  trail: "M3 20h2 M7 18h2 M11 14h2 M15 10l6-6 M15 4h6v6",
  global: "M3 12h4 M17 12h4 M12 3v4 M12 17v4 M8 8h8v8H8z",
};
function CategoryIcon({ id }: { id: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
    >
      <path d={CATEGORY_PATHS[id]} />
    </svg>
  );
}
export function StyleControls() {
  const [category, setCategory] = useState("presets");
  const style = useStore((s) => s.style);
  const setPath = useStore((s) => s.setPath);
  const section = SECTIONS.find((s) => s.id === category);
  const categories = [
    { id: "presets", title: "Style library" },
    ...SECTIONS.map((s) => ({ id: s.id, title: s.title })),
  ];
  return (
    <div className="design-workspace">
      <div
        className="category-tabs"
        role="tablist"
        aria-label="Style categories"
      >
        {categories.map((item, index) => (
          <button
            type="button"
            role="tab"
            aria-selected={category === item.id}
            aria-controls="category-content"
            id={`tab-${item.id}`}
            tabIndex={category === item.id ? 0 : -1}
            className={category === item.id ? "active" : ""}
            key={item.id}
            onClick={() => setCategory(item.id)}
            onKeyDown={(event) => {
              let next = index;
              if (event.key === "ArrowRight")
                next = (index + 1) % categories.length;
              else if (event.key === "ArrowLeft")
                next = (index + categories.length - 1) % categories.length;
              else if (event.key === "Home") next = 0;
              else if (event.key === "End") next = categories.length - 1;
              else return;
              event.preventDefault();
              setCategory(categories[next].id);
              document.getElementById(`tab-${categories[next].id}`)?.focus();
            }}
          >
            <span className="category-index">
              {String(index + 1).padStart(2, "0")}
            </span>
            <CategoryIcon id={item.id} />
            <span className="category-title">{item.title}</span>
          </button>
        ))}
      </div>
      <section
        className="category-content"
        role="tabpanel"
        id="category-content"
        aria-labelledby={`tab-${category}`}
        tabIndex={0}
      >
        <div className="category-heading">
          <div>
            <h3>
              {section?.title ?? "A starting point for every perspective."}
            </h3>
            <p>
              {section?.intro ??
                "Choose a look, then make it your own. Every detail is yours to change."}
            </p>
          </div>
          {section?.master && (
            <div className="category-enable">
              <span>Enable {section.title.toLowerCase()}</span>
              <button
                type="button"
                className={`mini-toggle ${getDeep(style, section.master) ? "on" : ""}`}
                role="switch"
                aria-checked={Boolean(getDeep(style, section.master))}
                aria-label={`Enable ${section.title}`}
                onClick={() =>
                  setPath(section.master!, !getDeep(style, section.master!))
                }
              />
            </div>
          )}
        </div>
        {section ? (
          <div className="parameter-grid">
            {section.controls.map((control) => (
              <Control key={control.path} def={control} />
            ))}
          </div>
        ) : (
          <PresetList />
        )}
      </section>
    </div>
  );
}
