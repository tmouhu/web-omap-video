# Architecture

## Frame pipeline (one source of truth)

```
GPX ─parseGpx→ GpxData ─new Track→ Track ─┐
                                          ├─ Timeline(track, crs, settings).frameStateAt(t, frameH)
settings (scale, headingUp, lookAhead) ───┘        │  → { view{center,resolution,rotation}, position, gridHeading }
                                                   ▼
          ┌──────────── preview (MapStage) ─────────────┐   ┌──────────── export (exporter.ts) ───────────────┐
          │ playing: view ← frameState; map.renderSync() │   │ off-screen OL map (same CSS size, pixelRatio =  │
          │ paused: free pan/zoom, north-up              │   │ videoW/cssW) ← frameState; await rendercomplete │
          │ postrender → drawScene(overlay canvas)       │   │ compose layer canvases + drawScene → CanvasSource│
          └──────────────────────────────────────────────┘   │ → mediabunny (WebCodecs) → StreamTarget → file   │
                                                             └──────────────────────────────────────────────────┘
```

- Frame `n` shows track time `t = start + n·speed/fps`; frame count `round(range·fps/speed)`.
- Ground area of the video = ground area of the preview frame (resolution is per CSS px; pixelRatio scales).
- Tiles: export waits for OL `rendercomplete` per frame (15 s timeout), replacing bulk prefetch (EN-6).

## Layers (EPIC-2)
- `app.layers: LayerDesc[]` (bottom first) is the single source; `createOlLayer(desc, viewCrs, raster)` builds OL layers
  for both the preview (`MapStage.syncLayers`, cached per id, rebuilt on CRS/raster change) and the export map.
- Raster maps: pixel→CRS affine (corner convention). Drawn by an `ImageCanvas` source: canvas transform =
  affine × (extent, resolution, pixelRatio); pyramid level chosen so one image pixel ≈ ≥1 canvas pixel.
- Manual georeferencing: clicks in the same map view; pixel from `viewToPixel`, true point stored as lon/lat;
  `fitTransform` in the current view CRS.

## Course and GPX (EPIC-3)
- `app.gpx` (original) + `app.gpxEdits` → `applyEdits` → `app.track` (derived). Geometry edits keep point times.
- `app.passings = matchCourse(track, course, { radius, overrides })`: per course point, candidates are the closest
  points of each visit inside the radius; a DP chooses strictly increasing times minimising Σ distance + penalty per
  missing point; manual overrides are fixed candidates.
- Course overprint is part of `drawScene` (between map and track) so it is in exports; editor marks are not.

## Course-mode camera (EPIC-4)
- `CourseCamera` precomputes a `LegPlan` per leg: rotation = −grid bearing (start→target), content box in leg
  coordinates (r = right, f = forward) of the GPX segment, both controls and route choices, fitted resolution clamped
  to the scale limits (`pans` when it does not fit at the zoom-out limit).
- Schedule: transition into leg i starts at passing_i + delay·speed and lasts duration·speed (track s), shortened to
  avoid overlaps. `viewAt(t)` = leg view (pan / approach zoom) or a blend (eased rotation, log-resolution, centre).
- `FrameState.routeAlpha` drives route-choice visibility; `legStartT` drives "current leg" tails.

## Export package (EPIC-5)
- `exportPackage` renders frames n = 0…N−1 once: `fs = frameStateAt(t)`; the map lane renders the OL map + scene,
  component lanes call `drawComponent(cfg, {track, t, range, origin, passings})`; every lane's `CanvasSource.add` uses
  the same timestamp, so all files are frame-identical in time.
- Range: `resolveRange` (course start→finish / track / custom + padding); `origin` = start passing for elapsed values.

## Coordinate systems
- proj4 definitions in `lib/geo/crs.ts`, registered with OL in `lib/map/layers.ts` (`registerProjections`).
- TM35 extent set to the MapAnt tile matrix extent `[-548576, 6291456, 1548576, 8388608]`.
- MapAnt TM35 tile grid: origin top-left, resolutions `8192 / 2^z`, z = 0..15, 256 px.
- Scale 1:N → ground m per CSS px `N·0.0254/96` → CRS units via `pointScale(crs, trackCentre)`.

## Measured (Nov 2026, M-series Mac, Chromium, MapAnt live)
- Export 1080p @30 fps, 1×: ~5 ms/frame ≈ 6–7× real time (tiles cached after first pass).
- 360p @30 fps: ~15 ms/frame incl. first tile loads.

## Known gaps / next
- Course mode camera (EPIC-4) plugs into `Timeline`.
- Persistent tile cache + per-host throttling (EN-3), fallback global provider outside Finland (OSM is interim).
- MediaRecorder fallback (EN-5) not implemented: export needs WebCodecs (Chrome/Edge/recent Firefox).
