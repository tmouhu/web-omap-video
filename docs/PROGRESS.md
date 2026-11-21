# Implementation progress

Status per backlog issue (see `plan/`). ✅ done · 🟡 partial · ⬜ not started. Update when ACs change.

## EPIC-1 – GPX replay and video export (in progress)

| Issue | Status | Notes |
| --- | --- | --- |
| EN-7 Setup/CI | 🟡 | Vite 8 + Svelte 5 + TS strict, Vitest, Playwright, Prettier, svelte-check. **Missing:** git repo, ESLint, CI workflow, hosting, env-config for tile URLs |
| EN-8 Tests | 🟡 | 52 unit tests (geo, CRS, GPX, track, timeline, format, video size), 6 E2E (tiles stubbed, export decoded + downloaded). **Missing:** Firefox E2E, visual regression, coverage gate, real-world fixtures |
| EN-1 Geo math | ✅ | Geodesic (geographiclib), fast ellipsoidal segment distance, bearings, scale↔resolution |
| EN-12 CRS (EPIC-2, pulled forward) | 🟡 | TM35FIN/UTM/WebMerc, Finland rule, convergence, point scale. **Missing:** GK zones/KKJ import CRSs, custom proj4 UI, magnetic north |
| EN-2 Renderer (OpenLayers) | 🟡 | OL map + shared `drawScene` overlay; perf gate partly measured (export 1080p ≈ 4–5 ms/frame ✅). **Missing:** formal ADR, preview fps measurement with 20k-pt track, track simplification, snapshot tests |
| EN-3 Tile sources | 🟡 | MapAnt TM35 + 3857, OSM interim fallback. **Missing:** persistent Cache API cache, per-host throttling, config, unavailable-service UI |
| EN-4 Track model | ✅ | Heading smoothed in track time (zero-phase EMA), pace/HR/elevation, channels. Real-world validation pending |
| EN-14 Timeline (EPIC-4, pulled forward) | 🟡 | Free mode `frameStateAt` (follow, heading-up, look-ahead). Course mode not started |
| EN-10 WebCodecs export | ✅ | mediabunny, H.264/MP4 preferred, frame-exact, streamed to file. 1080p30 ≈ 7.7× real time |
| EN-6 Prefetch | 🟡 | Replaced by wait-for-`rendercomplete` per frame. **Missing:** throttling/cap, cancel during tile wait |
| EN-5 MediaRecorder fallback | ⬜ | Not needed in Chromium; decide after EN-9 |
| EN-9 Browser matrix | ⬜ | Only Chromium verified |
| STORY-1 Frame/aspect | 🟡 | Presets + **free resize handle** (Shift keeps ratio) + typed W×H; lock while exporting. **Missing:** safe-area guides, touch handle polish |
| STORY-2 Load GPX | ✅ | Picker, drop, sample, HR/cad, errors, summary + channels, local-only note. Perf for 50k points unmeasured |
| STORY-3 Playback | ✅ | Play/pause/Space, speeds 0.5–30× (default 1×), scrub, ←/→ (Shift ×10), `,`/`.` frame step, Home. Control markers come with EPIC-3 |
| STORY-4 Follow | ✅ | Exact centre (E2E), look-ahead 20 % default, paused pan, seek recentres |
| STORY-5 Heading-up | ✅ | Track-time smoothing, north-up on pause, option off. Tuning settings UI pending |
| STORY-6 Scale | ✅ | 1:N input + presets, via point scale of the view CRS (E2E). Raster print-scale preset waits for EPIC-2 |
| STORY-7 Pan/zoom | 🟡 | OL default interactions incl. Alt+Shift rotate. **Missing:** fit buttons, rotate control |
| STORY-8 Overlays | 🟡 | **Decision: frame = map + route + runner (+ north arrow) only.** Info box, scale bar, attribution removed; credits shown in the app (Copy). **Missing:** magnetic/grid north mode, arrow position |
| STORY-9 Export | 🟡 | Resolution/fps, frame-exact, progress/ETA/cancel, preview, from-start/playhead range. **Missing:** export-time estimate before start, course range (EPIC-5 STORY-35) |
| STORY-10 Quality | 🟡 | Auto bitrate (fps-scaled) / manual. **Missing:** explicit format choice UI |
| STORY-11 Save | ✅ | Native "Save as" before export → streamed to disk; fallback OPFS temp file + download; quota precheck |
| STORY-12 Tech info | ⬜ | Only codec tag in export panel |

## EPIC-2 – Maps and coordinate systems (in progress)

| Issue | Status | Notes |
| --- | --- | --- |
| EN-13 Layer model | 🟡 | `LayerDesc` (mapant, osm, raster, wmts, wms, xyz) → OL layer factory shared by preview and export; native vs reprojected per view CRS; tile-health counters. **Missing:** blend modes (multiply), persistence (EN-15) |
| EN-18 Large raster | 🟡 | ImageBitmap pyramid (halving to ≤ 512 px) drawn with an affine via `ImageCanvas`. **Missing:** Worker tiling to IndexedDB, memory ceiling, GeoTIFF/PDF decoding, perf on 70 MP |
| EN-3 Tile sources | 🟡 | + credits text with Copy. **Missing:** persistent cache, throttling, global provider |
| STORY-13 Raster map | 🟡 | Image + world file (+ .prj, CRS guess), KMZ/KML GroundOverlay (LatLonBox+rotation, gx:LatLonQuad), plain image → manual; opacity slider for alignment; print-scale field; world-file download. **Missing:** GeoTIFF, PDF, crop margins, multiple maps |
| STORY-14 Manual georef | 🟡 | Point pairs by clicking image point then true point on the same map; 1 = shift, 2 = similarity, ≥3 = affine (or similarity); residuals + RMS warning > 5 m; cancel restores. **Missing:** split view, loupe, GPX-assisted points, drag/rotate rough placement, 2nd-order polynomial |
| STORY-15 View CRS | 🟡 | Automatic: Finland → TM35FIN; outside → UTM with raster, Web Mercator without; view kept across switches. **Missing:** manual override UI, custom proj4/WKT |
| STORY-16 Layers panel | 🟡 | MapAnt default, OSM (hidden fallback), visibility, opacity, order ↑↓, remove, "reprojected" + "tiles not loading" badges. **Missing:** drag reorder, quick presets, thumbnails, coverage greying |
| STORY-17 Custom WMS/WMTS | 🟡 | Capabilities fetch + parse (WMS 1.1/1.3, WMTS), layer picker with filter, attribution required, XYZ template; prefers WMTS REST templates. **Missing:** CORS probe before adding, API-key params, personal layer library |
| EN-11 OMAP/OCD spike | ⬜ | |

## EPIC-3 – Course and GPX alignment (in progress)

| Issue | Status | Notes |
| --- | --- | --- |
| STORY-18 Set course | 🟡 | Course tool: click start/controls, double-click (or Enter) finish, drag to move, click a leg to insert, Delete removes; list with codes, ↑↓ reorder, leg lengths; validation; undo/redo. **Missing:** descriptions UI, snapping to raster features, multiple courses per project |
| STORY-19 IOF overprint | 🟡 | ISOM 2017-2 symbol set (triangle towards control 1, circles, double finish, leg lines with gaps, upright numbers in the widest free sector), show/hide, fixed vs map-scale size, size factor, highlight-leg support for EPIC-4. **Missing:** verify exact dimensions/colour against the standard, ISSprOM sizes, manual line breaks |
| STORY-20 IOF XML | ✅ | CourseData 3.0 import (several courses → choose; map scale → raster print scale; MapPosition-only controls skipped with a message) and export |
| STORY-21 GPX editor | 🟡 | Non-destructive edit list (`move` with brush falloff, `delete`, `trim`, `shift`, `redraw`), drag points, delete point, GPS-spike detection + removal, time range from playhead (delete inside / trim / redraw by clicking), snap track to found controls, show original, reset, undo/redo, export edited GPX. **Missing:** linked time/pace chart, shift-range UI, soft-brush preview radius in metres on screen polish |
| STORY-22 Auto-match | ✅ | Candidates = closest point of each visit inside the radius; DP picks increasing times (butterfly, passed-twice, crossing legs); not-found → closest approach between neighbours; start/finish fall back to track ends; radius slider; < 500 ms for 2 h / 40 controls (unit test) |
| STORY-23 Manual passings | 🟡 | ±1 s, "now", pick on track (⌖), drag timeline markers, reset per control; stored as absolute GPX-clock ms so trimming does not move them; order validation. **Missing:** typed time entry, ±0.1 s, official split import |

## EPIC-4 – Course-aware animation (in progress)

| Issue | Status | Notes |
| --- | --- | --- |
| EN-14 Timeline/camera | ✅ | `CourseCamera` (pure function of t, cached per frame size) inside `Timeline`; `sceneForFrame` shared by preview and export; durations in video seconds × speed |
| STORY-24 Leg view | ✅ | Rotation = grid bearing start→target; fit of the leg's GPX segment, both controls and its route choices with px + % margins; deterministic (unit + E2E: target straight above start) |
| STORY-25 Transitions | ✅ | Delay (may be negative) + duration, sine/cubic/linear easing (sine default: cubic turned 90° at ~180°/s), short-way rotation, log-zoom with a small zoom-out bump for far-apart views, time keeps running, overlapping transitions shortened; continuity test at 60 fps |
| STORY-26 Scale limits & panning | ✅ | Zoom-in/out limits in 1:N; short legs stop at the zoom-in limit; long legs pan with the runner (±8 s smoothed) inside a 60 % box, clamped to the leg box. Transitions may briefly zoom out ≤ 1.6× the zoom-out limit (bump) – review with users |
| STORY-27 Approach zoom | ✅ | Track-seconds trigger, target scale (clamped by the zoom-in limit), video-seconds zoom, centre between control and runner; skipped for very short legs. **Missing:** per-control off switch |
| STORY-28 Arrow | 🟡 | Navigation arrow along the smoothed heading, size + colour settings. **Missing:** dot after standing still, accuracy circle |
| STORY-29 Tail | ✅ | Seconds / current leg / whole route; single colour or pace gradient vs median pace (green→yellow→red); fade; dark edge + white halo; travelled (faint) and future (off by default) lines. **Missing:** HR-zone colours, legend overlay |
| STORY-30 Draw routes | ✅ | Per-leg route tool: click points, double-click/Enter, snap ends to controls, drag vertices, label + colour (colour-blind-safe palette), geodesic length (5 m / 0.01 km), runner's leg distance, orphan cleanup, undo |
| STORY-31 Route display | ✅ | Appear with/after the turn, fade-in, visible time, fade-out or whole leg; upright labels "A · 640 m" with simple collision avoidance; included in the leg fit; exported (E2E checks route colour in video). **Missing:** per-leg display override, "shortest route" marker |
| Preview | ✅ | "🎥 Video view" (default on): paused preview shows the exact video frame; data loads keep the fitted overview; editing tools switch to north-up |

## EPIC-5 – Data component videos (in progress)

| Issue | Status | Notes |
| --- | --- | --- |
| STORY-32 Component framework | ✅ | `drawComponent(ctx, cfg, data)` pure per frame; enable/size/style (background, text, accent, label, icon); live previews at the playhead in the Video tab; opaque output; unavailable data explained |
| STORY-33 Elevation profile | ✅ | Smoothed profile over the export range by distance or time, completed part highlighted, position marker, control ticks, current elevation + total ascent. **Missing:** DEM elevation, current-leg-only profile |
| STORY-34 Numeric components | ✅ | Pace (window), heart rate (zones → colour, deterministic heartbeat pulse), elapsed time (countdown or zero before start, optional leg time), elapsed distance (m < 1 km, km ≥ 1 km, optional leg distance); fixed-width digits so values do not jitter. **Missing:** pace sparkline, combined "dashboard" layout |
| STORY-35 Export range | ✅ | Start → finish (default with a course), whole track, custom (typed times, ⇤/⇥ playhead, I / O keys), lead-in/out; green range bar on the timeline; GPX clock time of the first frame shown and saved |
| STORY-36 Export package | ✅ | One pass, one frame state per frame drawn to every output; folder picked once (File System Access) with export.json, else OPFS temp files + per-file downloads; same range/fps/frame count for all (E2E checks durations). **Missing:** ZIP download, "re-export changed only" |

## Known issues
- The bundled sample GPX has SYNTHETIC elevation and heart rate (for demos/tests).
- MapAnt's own WMTS capabilities document points to the old `wmts.mapant.fi` host, whose redirect has no CORS header:
  a layer added from those capabilities shows "tiles not loading". The built-in MapAnt layer uses the correct URLs.
- KML `LatLonBox` rotation is applied ground-conformally (lon scaled by cos φ). Verify against real OCAD/OOM KMZ exports.
- OPFS fallback (browsers without "Save as" picker): in the Claude desktop browser pane a single temp file fails at
  ~2 GB ("exceeds storage quota", reproducible at ~16 900 frames of 1080p @30 Mbit/s) although `storage.estimate()`
  reports 10 GB. Chrome/Edge use the Save-as path (direct to disk, no limit). Options: split long exports into parts,
  or lower default bitrate for the fallback. Verify in Firefox (EN-9).
- MapAnt out-of-coverage tiles log CORS errors in the console (expected; drawn empty).
