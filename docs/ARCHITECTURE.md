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
