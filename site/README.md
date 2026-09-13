# visionstyle GitHub Pages

This folder is the source for <https://baselhusam.github.io/visionstyle/>. It is deliberately dependency-free: `index.html`, `styles.css` and `script.js` are deployed as static files, together with the favicons generated from the Chroma Press watermark V.

## Identity

The site is an application of the **Chroma Press** identity documented in [`docs/brand-guidelines.html`](../docs/brand-guidelines.html) and [`docs/design-system.html`](../docs/design-system.html) — both are published alongside the site at `/docs/`.

- **Tokens** — `styles.css` `:root` mirrors the design-system palette (`--paper`, `--ink`, `--blue`, `--red`, `--yellow`, `--pink`, `--green`, night surfaces), radii (12 / 22 / 28 px, pills) and motion (160 ms controls, 220 ms panels).
- **Type** — Georgia for display headlines, JetBrains Mono (`VS Mono`) for the technical voice, Inter (`VS Sans`) for body. The `.ttf` files come from the package itself.
- **Two atmospheres** — paper for documentation surfaces, night for anything that shows a rendered frame (hero board, preset board, code panels, the Studio section).
- **Detection grammar** — viewfinder corners, the colour rail, the dotted tracking route with confidence dots, and the halftone screen instead of noise.
- **Buttons** — Tomato is the single primary action, ink is secondary, Saffron is only used as the emphasis action on a night surface.

## Interactions (`script.js`)

- Hero board switches between the real `cinematic` and `neon` renders.
- The preset explorer crossfades between `docs/images/presets/<name>.jpg` — one genuine render per preset, produced with `visionstyle render` on the bundled `street.jpg` (Osaka taxi alley) and its shipped detections; the hero uses `night.jpg` (rainy Manhattan). Frames are fetched on demand (current + next). It auto-advances until the visitor interacts, pauses on hover / when the tab is hidden, and is keyboard navigable (arrows, Home, End).
- Install tabs, copy buttons, scroll-spy navigation and scroll reveals. Everything degrades gracefully with `prefers-reduced-motion`.

## Updating the site

- Edit the page and its interactions in this folder. Keep asset URLs relative (`images/presets/neon.jpg`) so the site works at the project URL and in a local static server.
- Product imagery lives in `docs/images/`, logos in `assets/brand/chroma-press/`, fonts in `src/visionstyle/assets/fonts/`. The workflow copies exactly the files the site needs.
- To refresh the preset renders after a preset changes, re-run for each name and re-encode at 1400 px wide (JPEG q80):

  ```bash
  uv run visionstyle render src/visionstyle/assets/samples/street.jpg -s neon -d src/visionstyle/assets/samples/street.detections.json -o /tmp/neon.png
  ```

- `docs/images/studio.jpg` is a 2× screenshot of the Studio at 1600 × 1000 with `night.jpg` loaded and the cinematic preset selected.
- Install copy intentionally says "from source" until the first PyPI release; flip the default tab when `pip install visionstyle` works.

## Local preview

```bash
mkdir -p _site && awk '/run: \|/{f=1;next} /- uses: actions\/configure-pages/{f=0} f' .github/workflows/pages.yml | sed 's/^          //' | bash && python3 -m http.server 8787 --directory _site
```

`_site/` is git-ignored.

## Deploying

`.github/workflows/pages.yml` deploys on every push to `main` and can be run manually from the **Actions** tab. Before the first deployment, open **Settings → Pages** and select **GitHub Actions** as the source.
