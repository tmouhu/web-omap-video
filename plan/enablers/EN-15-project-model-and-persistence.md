# EN-15: Project document model, undo/redo and persistence

**Type:** Enabler (architecture) · **Epic:** [EPIC-6](../EPIC-6-ux-and-project.md) · **Priority:** Must · **Labels:** `tech`, `data`

## Summary

A user now invests real work in a video: georeferencing, course setting, GPX fixes, split adjustments, route choices and
styling. All of it must live in one **versioned project document** with undo/redo and safe local persistence.

## Scope / acceptance criteria

- [ ] Typed, versioned schema (e.g. validated with Zod) containing:
      map layers and settings; raster map (blob reference) and its georeference; view CRS; course; original GPX +
      **edit operations** (non-destructive, [STORY-21](../stories/STORY-21-gpx-editor.md)); control passing times
      (automatic + manual overrides); route choices; animation settings; component settings; export settings
      (range, fps, size).
- [ ] All geometry stored in WGS84 (lon/lat), plus raster pixel coordinates where relevant, so a CRS change never loses
      precision.
- [ ] Command-based state changes → **undo/redo** (Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z) across all editors, with merging of
      continuous drags into one step.
- [ ] Autosave to IndexedDB (debounced); large blobs (raster, pyramid tiles) in IndexedDB/OPFS, not in the JSON.
- [ ] Export / import a single project file (proposal `.omvproj` = zip with `project.json`, GPX, raster image, thumbnails).
- [ ] Schema migrations between versions, with tests for each migration.
- [ ] Storage quota handling: show usage, warn near the quota, call `navigator.storage.persist()`.

## Dependencies

[EN-7](./EN-7-project-setup-ci.md)

## Estimate

TBD
