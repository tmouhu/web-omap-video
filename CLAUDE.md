# OMap Video – working notes for Claude

Browser-only app that turns an orienteering GPX (+ later: raster map, course, route choices) into
**frame-exact map animation videos** that the user lays over head cam footage in a video editor (DaVinci Resolve).
Backlog: `plan/` (start at `plan/README.md`, decisions table there). Progress: `docs/PROGRESS.md`.
Architecture details: `docs/ARCHITECTURE.md`. POC this grew from: `../web-omap-poc` (reference only).

## Commands
- `npm run dev` – Vite dev server (Browser pane: `.claude/launch.json` → `dev`)
- `npm test` – Vitest unit tests (`tests/`, node env; GPX tests use `// @vitest-environment jsdom`)
- `npm run test:e2e` – Playwright (Chromium, port 5198, tiles stubbed in `e2e/fixtures.ts`)
- `npm run check` – svelte-check (TS strict). `npm run build` = check + vite build
- `npm run format` – Prettier (single quotes, width 120)
Run `npm test && npm run check && npm run test:e2e` before reporting work as done.

## Product decisions (do not re-litigate; see plan/README.md)
- Rendering: **OpenLayers** (performance gate in EN-2). UI: **Svelte 5 runes**. Desktop first.
- View CRS: **Finland → always EPSG:3067 TM35FIN**; outside Finland: raster → UTM, no raster → Web Mercator.
- Background: **MapAnt** WMTS (TM35 service in TM35 view, 3857 service in Web Mercator). No API key. Be polite
  (no bulk hammering); out-of-coverage tiles redirect to a non-CORS PNG → treated as empty.
- Video: **opaque** standard files, MP4/H.264 preferred (WebM fallback). No alpha. No head cam loading/sync in app.
- "Phase" in requirements = **pace (min/km)**. Distances: `< 1 km → "840 m"`, else `"1.24 km"` (`lib/format.ts`).

## Code map
- `src/lib/geo/` – `geo.ts` (geodesy, angles, scale↔resolution), `crs.ts` (proj4 defs, `selectViewCrs`,
  convergence, point scale), `finland.ts` (coarse polygon).
- `src/lib/gpx/gpx.ts` – parser (time, ele, HR/cad extensions). `src/lib/track/track.ts` – Track model.
- `src/lib/anim/timeline.ts` – **`Timeline.frameStateAt(t, frameCssHeight)`: pure, deterministic**. Preview and
  export both use it. Course mode (EPIC-4) goes here.
- `src/lib/render/scene.ts` – `drawScene()` draws track, arrow, overlays on a 2D canvas for preview AND export.
- `src/lib/map/layers.ts` – OL background layers, proj4 registration.
- `src/lib/export/` – `exporter.ts` (off-screen OL map → compose canvases → mediabunny/WebCodecs → streamed file),
  `videoSize.ts` (size, bitrate, frame count). Exporter is lazy-loaded.
- `src/app/` – Svelte UI. `state.svelte.ts` = global `app` state (runes class). Components in `components/`.

## Rules of thumb
- Anything that affects a video frame must be a pure function of (project, t). No wall-clock smoothing,
  no OL `view.animate` in exported paths (only UI niceties like pause → north-up).
- Geometry stored in WGS84; project to the view CRS at draw time (cached per track+CRS).
- OL rotation convention: radians, positive = clockwise map rotation; heading-up ⇒ `rotation = -heading`.
  Grid heading = true heading + `gridConvergence(crs, p)`.
- Sizes in `drawScene` are CSS px × `pixelRatio` so preview and any video resolution look the same.
- Exports always stream to a file (`openExportTarget`): never build whole videos in memory (2 GB Blob limit hit at
  10 min 1080p).
- Dev-only test hook: `window.__omv = { app, map() }` (MapStage). E2E deletes `showSaveFilePicker` → OPFS path.
- Keep `docs/PROGRESS.md` updated when an issue's acceptance criteria change status.
