import { useEffect, useRef, useState } from "react";
import { SECTIONS, type ControlDef } from "../controls/registry";
import { getDeep, useStore } from "../store";
import { HighlightContext, Hl, revealer, searchSettings, searchTerms, type SearchResult } from "../search";
import { Control } from "./Control";
import { Icon } from "./Icon";
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
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={CATEGORY_PATHS[id]} />
    </svg>
  );
}
export function StyleControls() {
  const categories = [
    { id: "presets", title: "Library" },
    ...SECTIONS.map((s) => ({ id: s.id, title: s.title })),
  ];
  const [category, setCategory] = useState(() => {
    const requested = new URLSearchParams(window.location.search).get("category");
    return categories.some((item) => item.id === requested) ? requested! : "presets";
  });
  const style = useStore((s) => s.style);
  const setPath = useStore((s) => s.setPath);
  const presets = useStore((s) => s.presets);
  const [query, setQuery] = useState("");
  const searchInput = useRef<HTMLInputElement>(null);
  const section = SECTIONS.find((s) => s.id === category);
  const searching = query.trim().length > 0;
  const results = searchSettings(query, style, presets);
  const selectCategory = (next: string) => {
    setCategory(next);
    const url = new URL(window.location.href);
    url.searchParams.set("category", next);
    window.history.replaceState({}, "", url);
  };
  // leave the search, open the setting's section, and flash it so the eye lands on it
  const reveal = (sectionId: string, path?: string, fallback?: string) => {
    setQuery("");
    selectCategory(sectionId);
    window.requestAnimationFrame(() => {
      const root = document.getElementById("category-content");
      const find = (p?: string) => (p ? root?.querySelector<HTMLElement>(`[data-path="${CSS.escape(p)}"]`) : null);
      const target = find(path) ?? find(fallback);
      if (!root) return;
      if (!target) { root.scrollTop = 0; return; }
      target.scrollIntoView({ block: "center", behavior: "smooth" });
      target.classList.remove("search-flash");
      void target.offsetWidth; // restart the animation when the same row is revealed twice
      target.classList.add("search-flash");
      window.setTimeout(() => target.classList.remove("search-flash"), 1800);
    });
  };
  const openFirst = () => {
    const group = results.groups[0];
    const hit = group?.hits[0];
    if (group && hit) reveal(group.section.id, hit.def.path, hit.def.dependsOn);
    else if (results.presets.length) reveal("presets");
  };
  // "/" jumps to the search from anywhere in the Studio, like most editors
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      if (target.closest?.('input, select, textarea, [contenteditable="true"]')) return;
      if (!searchInput.current?.offsetParent) return; // Design panel not showing
      event.preventDefault();
      searchInput.current.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <div className={`design-workspace ${searching ? "searching" : ""}`}>
      <div className="style-search" role="search">
        <Icon name="search" />
        <input
          ref={searchInput}
          type="search"
          name="settings-search"
          autoComplete="off"
          spellCheck={false}
          aria-label="Search settings"
          aria-controls="category-content"
          placeholder="Search settings…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              if (query) setQuery("");
              else event.currentTarget.blur();
            }
            if (event.key === "Enter") {
              event.preventDefault();
              openFirst();
            }
          }}
        />
        {searching ? (
          <>
            <span className="style-search-count" aria-live="polite">
              {results.count} {results.count === 1 ? "result" : "results"}
            </span>
            <button type="button" className="style-search-clear" aria-label="Clear search" onClick={() => { setQuery(""); searchInput.current?.focus(); }}>
              ×
            </button>
          </>
        ) : (
          <kbd aria-hidden="true">/</kbd>
        )}
      </div>
      <div
        hidden={searching}
        className="category-tabs"
        role="tablist"
        aria-orientation="horizontal"
        aria-label="Style categories"
      >
        {categories.map((item, index) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={category === item.id}
            aria-controls="category-content"
            id={`tab-${item.id}`}
            tabIndex={category === item.id ? 0 : -1}
            className={`${category === item.id ? "active" : ""} ${item.id === "presets" ? "library" : ""}`}
            onClick={() => selectCategory(item.id)}
            onKeyDown={(event) => {
              let next = index;
              if (event.key === "ArrowRight" || event.key === "ArrowDown")
                next = (index + 1) % categories.length;
              else if (event.key === "ArrowLeft" || event.key === "ArrowUp")
                next = (index + categories.length - 1) % categories.length;
              else if (event.key === "Home") next = 0;
              else if (event.key === "End") next = categories.length - 1;
              else return;
              event.preventDefault();
              selectCategory(categories[next].id);
              document.getElementById(`tab-${categories[next].id}`)?.focus();
            }}
          >
            <CategoryIcon id={item.id} />
            <span className="category-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
            <span className="category-title">{item.title}</span>
          </button>
        ))}
      </div>
      <section
        className={`category-content ${section?.master && !getDeep(style, section.master) ? "off" : ""}`}
        role="tabpanel"
        id="category-content"
        aria-labelledby={searching ? undefined : `tab-${category}`}
        aria-label={searching ? "Search results" : undefined}
        tabIndex={0}
      >
        {searching ? (
          <SearchResults query={query} results={results} onOpen={reveal} />
        ) : (
        <>
        <div className="category-heading">
          <div>
            <h3>{section?.title ?? "Style library"}</h3>
          </div>
          {section?.master && (
            <div className="category-enable">
              <span>{getDeep(style, section.master) ? "On" : "Off"}</span>
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
          <div className="parameter-list">
            {groupControls(section.controls).map((item) =>
              "children" in item ? (
                <div
                  key={item.head.path}
                  className={`field-group ${getDeep(style, item.head.path) ? "on" : ""}`}
                >
                  <Control def={item.head} />
                  {Boolean(getDeep(style, item.head.path)) && (
                    <div className="group-body">
                      {item.children.map((child) => (
                        <Control key={child.path} def={shortLabel(child, item.head)} />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <Control key={item.path} def={item} />
              ),
            )}
          </div>
        ) : (
          <PresetList />
        )}
        </>
        )}
      </section>
    </div>
  );
}

function SearchResults({ query, results, onOpen }: { query: string; results: SearchResult; onOpen: (section: string, path?: string, fallback?: string) => void }) {
  const apply = useStore((s) => s.applyPreset);
  if (!results.count) {
    return (
      <div className="search-empty">
        <strong>No settings match “{query.trim()}”</strong>
        <span>Try a word like glow, font, dash or trail.</span>
      </div>
    );
  }
  return (
    <HighlightContext.Provider value={searchTerms(query)}>
      <div className="search-results">
        {results.presets.length > 0 && (
          <section className="search-group">
            <header>
              <h3>Library</h3>
              <button type="button" className="search-open" onClick={() => onOpen("presets")}>Open <Icon name="next" /></button>
            </header>
            <div className="search-presets">
              {results.presets.map((preset) => (
                <button type="button" key={preset.name} className="search-preset" onClick={() => apply(preset.name)}>
                  <strong className={preset.origin === "builtin" ? "builtin" : undefined}><Hl text={preset.name} /></strong>
                  {preset.description && <small><Hl text={preset.description} /></small>}
                </button>
              ))}
            </div>
          </section>
        )}
        {results.groups.map((group) => {
          const shown = new Set<string>();
          return (
            <section className="search-group" key={group.section.id}>
              <header>
                <h3><Hl text={group.section.title} /></h3>
                <button type="button" className="search-open" onClick={() => onOpen(group.section.id, group.hits[0].def.path, group.hits[0].def.dependsOn)}>
                  Open <Icon name="next" />
                </button>
              </header>
              <div className="parameter-list">
                {group.hits.map((hit) => {
                  if (hit.visible) return <Control key={hit.def.path} def={hit.def} />;
                  // a hidden match comes with the setting that reveals it, so it can be turned on right here
                  const gate = revealer(hit, group);
                  const showGate = gate && !shown.has(gate.path);
                  if (gate) shown.add(gate.path);
                  return (
                    <div key={hit.def.path} className="search-hidden-pair">
                      {showGate && <Control def={gate} />}
                      <div className="field search-locked" data-path={hit.def.path}>
                        <span className="field-label"><Hl text={hit.def.label} /></span>
                        <span className="search-locked-why">Shown when {hit.def.whenText ?? "another option is set"}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </HighlightContext.Provider>
  );
}

/** "Glow radius" under a "Glow" switch reads as "Radius". */
function shortLabel(child: ControlDef, head: ControlDef): ControlDef {
  const prefix = `${head.label} `;
  return child.label.startsWith(prefix) && child.label.length > prefix.length
    ? { ...child, label: child.label.slice(prefix.length).replace(/^./, (c) => c.toUpperCase()) }
    : child;
}

type Grouped = ControlDef | { head: ControlDef; children: ControlDef[] };

/** Nest `effects.glow.radius`-style controls under their `effects.glow.enabled` switch so a
 *  toggled-off effect collapses to a single row instead of scattering loose fields. */
function groupControls(controls: ControlDef[]): Grouped[] {
  const out: Grouped[] = [];
  for (const control of controls) {
    const parts = control.path.split(".");
    const prefix = parts.length >= 3 ? parts.slice(0, -1).join(".") : null;
    const last = out[out.length - 1];
    if (prefix && last && "children" in last && last.head.path === `${prefix}.enabled`) {
      last.children.push(control);
    } else if (prefix && parts[parts.length - 1] === "enabled" && control.kind === "toggle") {
      out.push({ head: control, children: [] });
    } else {
      out.push(control);
    }
  }
  // a switch with nothing under it is just a plain toggle row
  return out.map((item) => ("children" in item && item.children.length === 0 ? item.head : item));
}
