/**
 * Shimmer-free continuous zoom. OpenLayers rounds every tile's position and size to whole canvas pixels, so when the
 * resolution changes a little on every frame (progressive leg zoom, approach zoom, transitions) each tile jumps by
 * ±1 px on its own and the map shimmers; image layers are also resampled at a new scale on every frame.
 *
 * Instead the map is rendered at a resolution quantised to `STEPS_PER_OCTAVE` steps per doubling, always the next
 * COARSER step (so the rendered area covers the frame), and the remaining factor is applied to the whole rendered map
 * as one uniform scale about the frame centre (CSS transform in the preview, canvas transform in the export).
 * Between steps the tiles do not move relative to each other; vector overlays keep using the exact view.
 */
export const STEPS_PER_OCTAVE = 8;

export interface StableResolution {
  /** Resolution to give the OpenLayers view (≥ the requested one). */
  resolution: number;
  /** Uniform magnification of the rendered map about the frame centre (1 ≤ scale < 2^(1/steps)). */
  scale: number;
}

export function stableResolution(resolution: number, steps = STEPS_PER_OCTAVE): StableResolution {
  if (!(resolution > 0) || !Number.isFinite(resolution)) return { resolution, scale: 1 };
  const k = Math.ceil(Math.log2(resolution) * steps - 1e-9);
  const q = Math.pow(2, k / steps);
  const scale = q / resolution;
  // Rounding noise right at a step: render exactly.
  return scale < 1 + 1e-9 ? { resolution, scale: 1 } : { resolution: q, scale };
}
