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
- Map frame content: **map + route + runner (+ optional north arrow) only.** No info box, scale bar or attribution in the
  video; layer credits are shown in the app (Copy button) for the video description.
- Frame: freely resizable (corner handle, Shift keeps ratio) + aspect presets + typed W×H.
- "Phase" in requirements = **pace (min/km)**. Distances: `< 1 km → "840 m"`, else `"1.24 km"` (`lib/format.ts`).

## Code map
- `src/lib/geo/` – `geo.ts` (geodesy, angles, scale↔resolution), `crs.ts` (proj4 defs, `selectViewCrs`,
  convergence, point scale), `finland.ts` (coarse polygon).
- `src/lib/gpx/gpx.ts` – parser (time, ele, HR/cad extensions). `src/lib/track/track.ts` – Track model.
- `src/lib/anim/timeline.ts` – **`Timeline.frameStateAt(t, { width, height })`: pure, deterministic** (free mode or
  course mode). `courseCamera.ts` – leg views, transitions, limits/panning, approach zoom.
- `src/lib/render/frameScene.ts` – `sceneForFrame(fs, projectScene)`: the ONE place a frame's scene is assembled
  (preview + export). `scene.ts` draws course, routes, tail, arrow; `overprint.ts` the IOF course.
- `src/lib/render/scene.ts` – `drawScene()` draws track, arrow, overlays on a 2D canvas for preview AND export.
- `src/lib/map/` – `layers.ts` (MapAnt/OSM constants, `registerProjections()` – call before creating any OL View),
  `layerModel.ts` (`LayerDesc` → `createOlLayer`, credits, native/reprojected), `rasterLayer.ts` (affine raster via
  ImageCanvas), `capabilities.ts` (WMS/WMTS GetCapabilities).
- `src/lib/raster/` – `affine.ts` (pixel→map affine, `fitTransform` 1/2/3+ points), `worldfile.ts` (+ .prj, CRS guess),
  `kml.ts` (KMZ/KML GroundOverlay), `rasterMap.ts` (pyramid, georef, `viewAffine`), `load.ts` (file set → source).
- `src/lib/export/` – `exporter.ts` (`exportPackage`: one pass, one frame state per frame drawn to every output –
  map via off-screen OL map, components via `drawComponent`; WebCodecs/mediabunny; streamed to files;
  `openPackageTargets` = folder picker or OPFS), `range.ts` (export range), `videoSize.ts`. Lazy-loaded.
- `src/lib/components/components.ts` – data component videos (elevation, pace, HR, time, distance).
- `src/lib/course/` – `course.ts` (model, legs, labels, edit helpers), `match.ts` (GPX↔course DP matching),
  `iofxml.ts` (IOF XML 3.0 CourseData), `routes.ts` (route choices per leg, by point ids). `src/lib/render/overprint.ts` – IOF course symbols (ISOM mm × px/mm).
- `src/lib/gpx/edits.ts` (non-destructive `GpxEdit` list, spikes), `write.ts` (GPX writer).
- `src/app/mapTools.ts` – course / GPX / pick-passing tools (OL Pointer interaction + clicks) and preview-only marks.
- `src/lib/project/` – `project.ts` (versioned ProjectDoc, `migrate`, `.omvproj` zip), `storage.ts` (IndexedDB library),
  `presets.ts` (style presets).
- `src/app/projects.svelte.ts` – autosave (`startAutosave`), open/new/rename/delete, project files.
- `src/lib/i18n/` – `core.ts` (translate, pseudo-locale, `UserError`, decimal separator), `en.ts`, `fi.ts`.
  `src/app/i18n.svelte.ts` – reactive UI locale, `t()`, `errorText()`, `dist()`, `int()`.
- `src/app/` – Svelte UI. `state.svelte.ts` = global `app` state (runes class: track, layers, raster, georef, frame,
  export, course, passings, GPX edits, tools, undo, project, toasts, theme). `WorkflowRail` steps (test ids `tab-*`):
  map (`MapPanel`), gpx (`GpxPanel`), course (`CoursePanel`), routes (`RoutePanel`), style (`PresetsPanel`,
  `AnimationPanel`, frame, overlays), export (`ComponentsPanel`, `ExportPanel`). Dialogs: `ProjectsDialog`,
  `ShortcutsDialog`, `AddLayerDialog`; `Toaster`. `TimelineBar` has
  draggable control markers and the edit range. `App.svelte` holds edit shortcuts (undo/redo, Delete, Enter, Esc).

## Rules of thumb
- Anything that affects a video frame must be a pure function of (project, t). No wall-clock smoothing,
  no OL `view.animate` in exported paths (only UI niceties like pause → north-up).
- Geometry stored in WGS84; project to the view CRS at draw time (cached per track+CRS). Raster georefs carry their own
  CRS; `viewAffine()` converts. Georef pairs store the true point as lon/lat.
- The preview and the export build OL layers from the same `app.layers` via `createOlLayer` – never add a layer
  to only one of them.
- OL rotation convention: radians, positive = clockwise map rotation; heading-up ⇒ `rotation = -heading`.
  Grid heading = true heading + `gridConvergence(crs, p)`.
- Sizes in `drawScene` are CSS px × `pixelRatio` so preview and any video resolution look the same.
- Exports always stream to a file (`openExportTarget`): never build whole videos in memory (2 GB Blob limit hit at
  10 min 1080p).
- Dev-only test hook: `window.__omv = { app, map(), forward }` (MapStage). E2E deletes `showSaveFilePicker` and
  `showDirectoryPicker` → OPFS + download path; Playwright runs in Europe/Helsinki time.
- `app.track` is DERIVED from `app.gpx` (original, never modified) + `app.gpxEdits` (+ `dragEdit` while dragging).
  Never assign `app.track`. Anything keyed to "a new GPX was loaded" must compare `app.gpx`, not `app.track`.
- Undoable changes call `app.pushHistory()` first (snapshot of course, GPX edits, passing overrides).
- Manual passing times are absolute GPX-clock ms (`passingOverrides`); `passings` is derived (matchCourse).
- User-facing animation durations are VIDEO seconds; convert with `speed` (track s = video s × speed).
- Paused "video view" (`app.followFrame`) applies the frame only on seeks/settings changes, never on data load.
- Editor-only drawing (selection, track points, ranges) goes in `drawEditorMarks`, never in `drawScene`.
- New persistent state must go into `ProjectDoc` (`toDoc`/`applyDoc`, `settings()`/`applySettings`) AND the autosave
  effect's dependency list in `projects.svelte.ts`; add defaults so `migrate()` fills it for old projects.
- Panels must not cache `app.<settingsObject>` in a plain const (presets/projects replace the objects): use `$derived`.
- `tests/resources/` holds real user data (GPX, map) – used by `tests/realworld.test.ts`; do not modify.
- **No hard-coded user-visible text**: use `t('key')` (add the key to BOTH `en.ts` and `fi.ts`); library code throws
  `UserError('err.key', params)` and returns message keys; show errors with `errorText(e)`. Video texts use the
  project's `videoLocale` (not the UI locale). Check with `?lang=xx` (unbracketed text = hard-coded).
  Don't name a local variable `t` where you call `t()` (Svelte templates/arrow params shadow it).
- E2E tests run in English (browser default); keep English strings stable or update the tests.
- Keep `docs/PROGRESS.md` updated when an issue's acceptance criteria change status.
