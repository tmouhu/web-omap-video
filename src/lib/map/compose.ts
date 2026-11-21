/** Composes OpenLayers layer canvases into one 2D canvas (OL "export map" pattern). */
import type OlMap from 'ol/Map';

/** Draws all OpenLayers layer canvases of `map` into ctx at `pixelRatio` (OL "export map" pattern). */
export function composeOlCanvases(map: OlMap, ctx: CanvasRenderingContext2D, pixelRatio: number): void {
  const canvases = map.getViewport()?.querySelectorAll<HTMLCanvasElement>('.ol-layers canvas') ?? [];
  for (const canvas of Array.from(canvases)) {
    if (canvas.width === 0) continue;
    const parent = canvas.parentElement as HTMLElement | null;
    const opacity = parent?.style.opacity || canvas.style.opacity;
    ctx.globalAlpha = opacity === '' || opacity === undefined ? 1 : Number(opacity);
    const m = canvas.style.transform.match(/^matrix\(([^(]*)\)$/)?.[1];
    const matrix = m
      ? m.split(',').map(Number)
      : [parseFloat(canvas.style.width) / canvas.width, 0, 0, parseFloat(canvas.style.height) / canvas.height, 0, 0];
    ctx.setTransform(...(matrix.map((v) => v * pixelRatio) as [number, number, number, number, number, number]));
    ctx.drawImage(canvas, 0, 0);
  }
  ctx.globalAlpha = 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
