import { test, expect } from './fixtures';
import { hook, pixelOf } from './hook';

/** Loads the sample and builds a course + one route choice through the app API (UI covered elsewhere). */
async function setup(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByTestId('load-sample').click();
  await expect.poll(() => hook(page, (h) => !!h.app.track)).toBe(true);
  await hook(page, (h) => {
    const a = h.app;
    const tr = a.track;
    for (const t of [5, 140, 300, 470]) {
      const p = tr.positionAt(t);
      a.courseClick({ lat: p.lat + 0.00006, lon: p.lon });
    }
    const e = tr.positionAt(620);
    a.courseFinish({ lat: e.lat, lon: e.lon });
  });
  await expect.poll(() => hook(page, (h) => h.app.courseMode)).toBe(true);
}

test('course mode: leg target straight above the leg start, preview = video frame', async ({ page }) => {
  await setup(page);
  await page.getByTestId('tab-style').click();
  await expect(page.getByTestId('camera-mode')).toHaveText('Leg by leg');
  for (const leg of [0, 1, 2]) {
    await hook(
      page,
      (h, l) => {
        const ps = h.app.passings;
        h.app.seek((ps[l].t + ps[l + 1].t) / 2);
      },
      leg,
    );
    await page.waitForTimeout(200);
    const pts = await hook(page, (h, l) => [h.app.course.points[l], h.app.course.points[l + 1]], leg);
    const a = await pixelOf(page, pts[0]);
    const b = await pixelOf(page, pts[1]);
    expect(Math.abs(a[0] - b[0])).toBeLessThan(1.5);
    expect(b[1]).toBeLessThan(a[1]);
    const same = await hook(page, (h) => {
      const fs = h.app.timeline.frameStateAt(h.app.time, h.app.frame);
      const v = h.map().getView();
      return (
        Math.abs(v.getRotation() - fs.view.rotation) < 1e-9 && Math.abs(v.getResolution() - fs.view.resolution) < 1e-9
      );
    });
    expect(same).toBe(true);
  }
});

test('zoom limits are respected over the whole run', async ({ page }) => {
  await setup(page);
  await page.getByTestId('tab-style').click();
  await page.getByTestId('zoom-in-limit').fill('6000');
  await page.getByTestId('zoom-in-limit').press('Enter');
  await page.getByTestId('zoom-out-limit').fill('9000');
  await page.getByTestId('zoom-out-limit').press('Enter');
  const r = await hook(page, (h) => {
    const tl = h.app.timeline;
    let min = Infinity;
    let max = 0;
    for (let t = 0; t < h.app.track.duration; t += 0.5) {
      const res = tl.frameStateAt(t, h.app.frame).view.resolution;
      min = Math.min(min, res);
      max = Math.max(max, res);
    }
    return { min, max };
  });
  // 1:6000 ≈ 1.587, 1:9000 ≈ 2.381 m/px (× TM35 scale factor ≈ 0.9997); transitions may zoom out ≤ 1.6× briefly.
  expect(r.min).toBeGreaterThan(1.58);
  expect(r.max).toBeLessThan(2.381 * 1.6);
});

test('draws a route choice by clicking and shows its length', async ({ page }) => {
  await setup(page);
  await page.getByTestId('tab-routes').click();
  await page.getByTestId('route-leg').selectOption('1');
  await page.getByTestId('route-draw').click();
  const mid = await hook(page, (h) => {
    const p = h.app.track.positionAt(220);
    const q = { lat: p.lat + 0.0006, lon: p.lon + 0.0004 };
    const v = h.map().getView();
    v.setCenter(h.forward(h.app.crs.code, q));
    v.setResolution(2);
    return q;
  });
  const [x, y] = await pixelOf(page, mid);
  await page.mouse.click(x, y);
  await page.waitForTimeout(350);
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('route-list').locator('li')).toHaveCount(1);
  await expect(page.getByTestId('route-length')).toHaveText(/^\d+ m$|^\d\.\d\d km$/);
  const pts = await hook(page, (h) => h.app.routes[0].points.length);
  expect(pts).toBe(3); // snapped to both controls
  await page.keyboard.press('ControlOrMeta+z');
  await expect(page.getByTestId('route-list')).toHaveCount(0);
});

test('route choices appear in the exported video while they are shown', async ({ page }) => {
  await setup(page);
  await hook(page, (h) => {
    const a = h.app;
    const tr = a.track;
    a.routeLeg = 1;
    const p = tr.positionAt(220);
    a.routeDraft = [{ lat: p.lat + 0.0008, lon: p.lon + 0.0008 }];
    a.finishRoute();
    a.routeDisplay.hold = 20;
    a.style.track.tailMode = 'seconds';
    // Durations are video seconds: at 30× the turn into leg 1 settles (0.5 + 1.5) × 30 = 60 s after the
    // passing, and the 0.3 s fade-in takes another 9 s of track time.
    a.exportRange.mode = 'custom';
    a.exportRange.in = a.passings[1].t + 72;
    a.exportRange.out = a.passings[1].t + 102;
  });
  await page.getByRole('button', { name: '30×' }).click();
  await page.getByTestId('tab-export').click();
  await page.getByTestId('resolution').selectOption('360');
  await page.getByTestId('export').click();
  await expect(page.getByTestId('export-result')).toBeVisible({ timeout: 90_000 });
  const blue = await page.evaluate(async () => {
    const v = document.querySelector<HTMLVideoElement>('[data-testid=export-result] video')!;
    await new Promise<void>((r) => (v.readyState >= 2 ? r() : (v.onloadeddata = () => r())));
    v.currentTime = 0.02;
    await new Promise<void>((r) => (v.onseeked = () => r()));
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const x = c.getContext('2d')!;
    x.drawImage(v, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    // Route colour #0072B2 (0,114,178) after encoding.
    for (let i = 0; i < d.length; i += 4)
      if (d[i] < 60 && Math.abs(d[i + 1] - 114) < 35 && Math.abs(d[i + 2] - 178) < 40) n++;
    return n;
  });
  expect(blue).toBeGreaterThan(40);
});
