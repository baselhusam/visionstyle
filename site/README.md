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

- **Hero board** — a before / after slider over the untouched `night.jpg` (rainy Manhattan) and its real `cinematic` / `neon` renders. Drag anywhere on the frame with a mouse, drag horizontally on touch (vertical swipes still scroll the page), or focus it and use the arrow keys. On load the style wipes in over the raw frame and settles at the midpoint.
- **Preset explorer** — crossfades between `docs/images/presets/<name>.jpg`: one genuine render per preset, produced by `docs/presets.py` on the bundled `street.jpg` (Osaka taxi alley) and its shipped detections. The picker shows a thumbnail per preset (`docs/images/presets/thumbs/`) in a column that scrolls inside the board's height; below 980 px it becomes a swipeable film strip. Frames are fetched on demand (current + next). It auto-advances while on screen until the visitor interacts, pauses on hover / when the tab is hidden, and is navigable with the arrows on the frame, a swipe, or the keyboard (arrows, Home, End).
- **Navigation** — scroll-spy pill nav on desktop, a section sheet behind the menu button below 980 px (closes on Escape, outside tap or navigation), and a reading-progress colour rail under the top bar.
- **Code** — Python / YAML tabs on the Configure example, install tabs, copy buttons (the hero command copies on click) with an `aria-live` confirmation, and a lightbox for the Studio screenshot.
- Everything degrades gracefully with `prefers-reduced-motion`.

## Updating the site

- Edit the page and its interactions in this folder. Keep asset URLs relative (`images/presets/neon.jpg`) so the site works at the project URL and in a local static server.
- Product imagery lives in `docs/images/`, logos in `assets/brand/chroma-press/`, fonts in `src/visionstyle/assets/fonts/`. The workflow copies exactly the files the site needs.
- To refresh the preset renders and picker thumbnails after adding or changing a preset, run the script below. It renders every built-in preset (or just the names you pass) on `street.jpg` with its shipped detections and synthetic trails, like the Studio preview, and writes 1400 px renders plus 288 × 180 thumbnails. A new preset also needs its tab and frame added to the explorer in `index.html`, and the counter's total updated.

  ```bash
  uv run python docs/presets.py
  ```

- `docs/images/studio.jpg` is a 1.5× screenshot (2400 × 1500) of the Studio at 1600 × 1000: the `city-walkthrough.mp4` sample at frame 91 with the cinematic preset and the Design library open. Still images get synthetic preview trails in the Studio, so the video sample shows real tracks instead.

## Local preview

```bash
mkdir -p _site && awk '/run: \|/{f=1;next} /- uses: actions\/configure-pages/{f=0} f' .github/workflows/pages.yml | sed 's/^          //' | bash && python3 -m http.server 8787 --directory _site
```

`_site/` is git-ignored.

## Deploying

`.github/workflows/pages.yml` deploys on every push to `main` and can be run manually from the **Actions** tab. Before the first deployment, open **Settings → Pages** and select **GitHub Actions** as the source.
