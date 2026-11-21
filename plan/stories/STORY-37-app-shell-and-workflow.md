# STORY-37: Modern app shell with a guided workflow

**Type:** Story · **Epic:** [EPIC-6](../EPIC-6-ux-and-project.md) · **Priority:** Must · **Labels:** `ui`, `ux`

## User story
As a **user who is an orienteer, not a GIS or video expert**, I want **a clear, attractive interface that guides me from map to
finished video**, so that **I get a good result the first time without reading a manual**.

## Acceptance criteria
- [ ] Layout per [EN-16](../enablers/EN-16-ui-framework-design-system.md) / [EN-19](../enablers/EN-19-ux-research-and-design.md):
      top bar, **workflow rail**, central map stage with the exact video frame, contextual inspector panel, bottom timeline.
- [ ] Workflow steps, each with a completion state (✓ / needs attention / optional):
      **1 Map** (background, raster, georeference) → **2 Course** → **3 GPX** (load, match, fix) → **4 Route choices** →
      **5 Style** (animation, arrow, tail, components) → **6 Sync & export**.
      Steps can be visited in any order. Later steps that cannot work yet explain what is missing.
- [ ] Start screen: new project, open recent projects (with thumbnails), open project file, open sample project.
- [ ] Empty states with a clear next action and drag-and-drop hints (drop a map image, a GPX or a course file anywhere –
      the file type is detected).
- [ ] Non-blocking notifications (toasts) for background work (raster processing, matching, export) and a status bar
      (CRS, scale, cursor coordinates, save state).
- [ ] Keyboard shortcuts with a cheat sheet (`?`), consistent tool shortcuts.
- [ ] Contextual help: short inline hints and "learn more" links; first-run tour (skippable).
- [ ] Dark and light theme; respects system preference.
- [ ] Desktop-first (≥ 1280 px). On tablets the layout adapts; on phones the app is view-only with a notice.
- [ ] Meets the usability target of [EN-19](../enablers/EN-19-ux-research-and-design.md) and Lighthouse accessibility ≥ 95.

## Dependencies
[EN-16](../enablers/EN-16-ui-framework-design-system.md), [EN-19](../enablers/EN-19-ux-research-and-design.md)

## Estimate
TBD
