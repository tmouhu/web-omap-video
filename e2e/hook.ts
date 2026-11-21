import type { Page } from '@playwright/test';

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Dev-only `window.__omv` hook (MapStage.svelte). */
export type Hook = { app: any; map(): any; forward(code: string, p: { lat: number; lon: number }): number[] };

/** Runs `fn(hook, arg)` in the page. `fn` must be self-contained (it is serialised). */
export function hook<T, A = null>(page: Page, fn: (h: Hook, arg: A) => T, arg: A = null as A): Promise<T> {
  return page.evaluate(
    ({ src, a }) => {
      const h = (window as any).__omv;
      return new Function('h', 'a', `return (${src})(h, a)`)(h, a);
    },
    { src: fn.toString(), a: arg },
  ) as Promise<T>;
}

/** Viewport pixel of a lon/lat on the preview map. */
export async function pixelOf(page: Page, p: { lat: number; lon: number }): Promise<[number, number]> {
  const box = (await page.getByTestId('map-frame').boundingBox())!;
  const [x, y] = await hook(page, (h, q) => h.map().getPixelFromCoordinate(h.forward(h.app.crs.code, q)), p);
  return [box.x + x, box.y + y];
}

/** Track position at time t, optionally offset by [north, east] metres. */
export function trackPos(page: Page, t: number, off: [number, number] = [0, 0]) {
  return hook(
    page,
    (h, a) => {
      const p = h.app.track.positionAt(a.t);
      return {
        lat: p.lat + a.off[0] / 111320,
        lon: p.lon + a.off[1] / (111320 * Math.cos((p.lat * Math.PI) / 180)),
      };
    },
    { t, off },
  );
}
