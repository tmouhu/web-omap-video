# EN-3: Map tile sources, licensing and tile cache

**Type:** Enabler (infrastructure / compliance) · **Epic:** [EPIC-2](../EPIC-2-maps-and-coordinates.md) · **Priority:** Must · **Labels:** `tech`, `map`, `legal`

## Summary
Configure the production background map sources, with **MapAnt as the default**, and harden tile loading and caching.
The generic layer model is in [EN-13](./EN-13-layer-model-and-reprojection.md).

## Decision: MapAnt is the default background map
[MapAnt](https://www.mapant.fi/about.php) is an orienteering-style map of almost all of Finland, generated from National Land Survey of Finland (MML) laser
scanning data. Checked on 21 Nov 2026:

| Service | URL | CRS / tile matrix set | Notes |
| --- | --- | --- | --- |
| **WMTS, TM35** (preferred) | `https://www.mapant.fi/wmts/wmts.php?request=getcapabilities` | EPSG:3067, matrix set `ETRS-TM35FIN`, levels 0–15, 256 px PNG | Layer `MapAnt.fi`. Per MapAnt the fastest service with the best image quality. |
| **WMTS, Web Mercator** | `https://www.mapant.fi/wmts/wmts_EPSG3857.php?request=getcapabilities` | EPSG:3857, matrix set `EPSG3857`, levels 0–19, 256 px PNG | Layer `MapAnt.fi_EPSG3857`. Reprojected on the server, so lower quality and slower. |
| **WMS** | `https://www.mapant.fi/wms/wms.php` | EPSG:3067 only | Layers `MapAntFi`, `MapAntFiWMS`. Max image 4000 × 4000 px. MapAnt asks clients to avoid many large requests. |

- **Licence:** CC BY 4.0. Attribution must name and link MapAnt and the National Land Survey of Finland, e.g.
  "© MapAnt.fi, MML laser scanning and topographic database, CC BY 4.0".
- **No API key.** No numeric rate limit is published, but MapAnt runs on a single low-cost server and asks users to download
  large areas slowly, because its DDoS protection can suspend the service for everyone.
- **No uptime guarantee.** The app must handle MapAnt being slow or unavailable.
- **CORS:** tiles, capabilities and WMS send `Access-Control-Allow-Origin: *`. **Tiles outside the coverage area redirect
  to `notavailable_dim.png`, which has no CORS header.** These loads must be treated as empty tiles, not errors.
- **Coverage:** Finland, with gaps (about 20 % not yet laser-scanned, mostly in the north). Small features (boulders,
  fences, pits) are missing.
- **Useful parameters:** `&dim=0..1` dims the image, which can help the course and tail stand out. `style=contours` gives
  contours only.
- The endpoints changed on 13 Oct 2026. The capabilities documents still list the old `wmts.mapant.fi` host. URLs are
  configuration, so they can be changed without a release.

## Catalogue
| Layer | Region | CRS | Status |
| --- | --- | --- | --- |
| **MapAnt** (WMTS TM35 / WMTS 3857) | Finland | 3067 / 3857 | **Default** |
| OpenStreetMap-based layer (provider TBD) | Global | 3857 | Fallback outside Finland and in MapAnt gaps; provider and licence to decide |
| MML topographic map / background map / aerial imagery | Finland | 3067 / 3857 | Optional, needs an MML API key (later) |
| User-added WMS/WMTS | any | any | [STORY-17](../stories/STORY-17-custom-wms-wmts.md) |

## Scope / acceptance criteria
- [ ] MapAnt WMTS TM35 is used in a TM35 view and MapAnt WMTS 3857 in a Web Mercator view. No client-side reprojection is
      needed for the default map in either view.
- [ ] Tile URLs, levels and attribution are configuration, not hard-coded.
- [ ] Out-of-coverage handling: the `notavailable` redirect is detected (the image fails to load with `crossOrigin`) and
      drawn as empty or as the fallback layer.
- [ ] **Polite loading:** at most 4–6 concurrent requests to MapAnt, retry with exponential backoff, and throttled bulk
      prefetch with a delay between batches ([EN-6](./EN-6-tile-prefetch.md)). A 1080p export should not need more than
      a few thousand tiles.
- [ ] **Persistent tile cache** (Cache API, size limit) so that repeated previews and re-exports do not download the same
      tiles again.
- [ ] If MapAnt is unavailable, the user sees a clear message and can switch to the fallback layer.
- [ ] Attribution is collected from all visible layers and always drawn in the frame (licence requirement).
- [ ] *(POC)* In-memory LRU-ish cache, `get` / `peek` / `load`, `onTileLoaded`. With OpenLayers
      ([EN-2](./EN-2-canvas-map-renderer.md)) the OL tile cache plus a Cache-API-backed `tileLoadFunction` replace this.

## POC reference
`src/tiles.ts` (`TILE_URL`, `ATTRIBUTION`, `TileCache`)

## Open questions / refinement
- Global fallback provider outside Finland: which one, and is there a budget?
- Should we contact MapAnt about expected export traffic? Proposed: yes, before a public release.
- Use `dim` by default under the course overprint?

## Dependencies
None. This decision blocks [EN-13](./EN-13-layer-model-and-reprojection.md), [EN-6](./EN-6-tile-prefetch.md) and
[STORY-16](../stories/STORY-16-background-layers.md).

## Estimate
TBD
