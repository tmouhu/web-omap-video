import { test, expect } from './fixtures';
import { hook } from './hook';

/** STORY-44/45/46/47: marker shape, global time base, instant leg change, real-time clips. */
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

test('marker: circle / ring are style settings', async ({ page }) => {
  await setup(page);
  await page.getByTestId('tab-style').click();
  await page.getByTestId('marker-circle').click();
  await expect(page.getByTestId('marker-ring')).toBeVisible();
  await page.getByTestId('marker-ring').check();
  expect(await hook(page, (h) => [h.app.style.track.marker, h.app.style.track.markerRing])).toEqual(['circle', true]);
  expect(await hook(page, (h) => h.app.settings().style.track.marker)).toBe('circle'); // saved with the project
});

test('time base: switching converts the durations so the video stays the same', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: '10×' }).click();
  await page.getByTestId('tab-style').click();
  const before = await hook(page, (h) => ({
    d: h.app.courseCamera.transitionDuration,
    tail: h.app.style.track.tailSeconds,
    hold: h.app.routeDisplay.hold,
  }));
  await expect(page.getByTestId('runner-panel')).toContainText(`Tail length · ${before.tail} s (video)`);
  await page.getByTestId('time-base-real').click();
  await expect(page.getByTestId('toasts')).toContainText('Durations are now in Real seconds');
  const after = await hook(page, (h) => ({
    base: h.app.timeBase,
    d: h.app.courseCamera.transitionDuration,
    tail: h.app.style.track.tailSeconds,
    hold: h.app.routeDisplay.hold,
  }));
  expect(after).toEqual({ base: 'real', d: before.d * 10, tail: before.tail * 10, hold: before.hold * 10 });
  await expect(page.getByTestId('runner-panel')).toContainText(`Tail length · ${before.tail * 10} s (real)`);
  await page.getByTestId('time-base-video').click();
  expect(await hook(page, (h) => h.app.courseCamera.transitionDuration)).toBeCloseTo(before.d, 9);
});

test('instant leg change and real-time transition clips are exported with a clip list', async ({ page }) => {
  await setup(page);
  await page.getByTestId('tab-style').click();
  await page.getByTestId('leg-change-instant').click();
  expect(await hook(page, (h) => h.app.courseCamera.legChange)).toBe('instant');
  await page.getByTestId('tab-export').click();
  await page.getByRole('button', { name: '30×' }).click();
  await page.getByTestId('resolution').selectOption('360');
  await hook(page, (h) => {
    const t = h.app.passings[1].t;
    h.app.exportRange.mode = 'custom';
    h.app.exportRange.in = t - 30;
    h.app.exportRange.out = t + 30; // one leg change inside
  });
  await page.getByTestId('export-clips').check();
  await page.getByTestId('clip-pad').fill('1');
  await expect(page.getByTestId('export-summary')).toContainText('3 files');
  await page.getByTestId('export').click();
  await expect(page.getByTestId('export-files').locator('li')).toHaveCount(3, { timeout: 60_000 });
  const res = await page.evaluate(async () => {
    const app = (
      window as unknown as {
        __omv: { app: { exportResult: { files: { url: string; name: string; kind: string; file: File }[] } } };
      }
    ).__omv.app;
    const out: { name: string; kind: string; d: number | null; text: string | null }[] = [];
    for (const f of app.exportResult.files) {
      if (f.kind === 'csv') {
        out.push({ name: f.name, kind: f.kind, d: null, text: await f.file.text() });
        continue;
      }
      const v = document.createElement('video');
      v.muted = true;
      v.src = f.url;
      await new Promise<void>((r) => (v.onloadedmetadata = () => r()));
      out.push({ name: f.name, kind: f.kind, d: v.duration, text: null });
    }
    return out;
  });
  expect(res.map((r) => r.kind)).toEqual(['map', 'clip', 'csv']);
  expect(res[0].d).toBeCloseTo(2, 1); // 60 track s at 30×
  expect(res[1].name).toMatch(/_map_rt_leg1-2_at00-00-0\d-\d\d_30fps_640x360\.mp4$/);
  // Instant cut + 1.5 s animation + 1 s padding each side ≈ 3.5 s at 1×.
  expect(res[1].d!).toBeGreaterThan(3.3);
  expect(res[1].d!).toBeLessThan(3.7);
  const [head, row] = res[2].text!.trim().split('\n');
  expect(head).toContain('main_in_timecode');
  expect(row).toContain(res[1].name);
});
