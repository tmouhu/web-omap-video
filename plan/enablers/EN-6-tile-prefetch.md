# EN-6: Tile prefetch for gap-free exports

**Type:** Enabler · **Epic:** [EPIC-1](../EPIC-1-gpx-replay.md) · **Priority:** Must · **Labels:** `tech`, `map`, `video`

## Summary

Before or during export, make sure every tile a frame needs is loaded, so the video has no blank or blurry areas.

## Scope / acceptance criteria

- [ ] _(POC)_ `tilesForPlayback(track, zoom, pixelRatio, w, h)`: samples the track at steps of half the view radius and
      collects the tiles within the rotation-safe radius (half diagonal + ¼ tile) at the recording tile zoom.
      **Change:** in course mode the camera no longer follows the track. The camera does leg framing, transitions, approach
      zoom and panning ([EPIC-4](../EPIC-4-course-animation.md)). Tiles must be computed from the **camera path**:
      sample `cameraAt(t)` from [EN-14](./EN-14-animation-timeline-camera.md) and collect tiles per layer and tile matrix set.
- [ ] _(POC)_ `prefetchTiles(cache, list, onProgress, concurrency = 6)` with a progress display.
- [ ] Only the export time range is prefetched.
- [ ] With offline export ([EN-10](./EN-10-spike-offline-rendering.md)) a "wait for tiles before rendering frame N"
      strategy replaces bulk prefetch. Both strategies share the tile-list calculation.
- [ ] Hard cap / confirmation dialog for large prefetches (e.g. > 1 000 tiles) to respect provider limits.
- [ ] The tile cache must hold the needed set during export (no eviction of tiles still needed).
- [ ] Cancel button for the prefetch.
- [ ] Locally added raster maps ([STORY-13](../stories/STORY-13-add-raster-map.md)) need no network prefetch, but their
      pyramid levels must be decoded before export.

## POC reference

`src/prefetch.ts`

## Open questions / refinement

- Depends on the provider limits chosen in [EN-3](./EN-3-tile-source-and-cache.md).
- Persist prefetched tiles (Cache API) so they can be reused for re-exports? (proposed: yes, see EN-3)

## Dependencies

[EN-3](./EN-3-tile-source-and-cache.md), [EN-4](./EN-4-track-model-and-heading.md), [EN-14](./EN-14-animation-timeline-camera.md)

## Estimate

TBD
