import { readFileSync } from 'node:fs';
import { test, expect } from './fixtures';
import { hook } from './hook';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('load-sample').click();
  await expect.poll(() => hook(page, (h) => !!h.app.track)).toBe(true);
  await page.getByTestId('tab-video').click();
});

test('component previews render when enabled; unavailable data is explained', async ({ page }) => {
  await page.getByTestId('comp-pace').check();
  await page.getByTestId('comp-heartRate').check();
  await page.getByTestId('comp-elevation').check();
  for (const k of ['pace', 'heartRate', 'elevation']) {
    const painted = await page.evaluate((kind) => {
      const c = document.querySelector<HTMLCanvasElement>(`[data-testid=comp-preview-${kind}]`)!;
      const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
      let bright = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 600) bright++;
      return bright;
    }, k);
    expect(painted).toBeGreaterThan(50); // white text / marker drawn
  }
});

test('custom export range from the playhead with I/O keys', async ({ page }) => {
  await hook(page, (h) => h.app.seek(100));
  await page.keyboard.press('i');
  await hook(page, (h) => h.app.seek(160));
  await page.keyboard.press('o');
  const r = await hook(page, (h) => ({ ...h.app.range }));
  expect(r).toMatchObject({ mode: 'custom', start: 100, end: 160, origin: 100 });
  await expect(page.getByTestId('first-frame-clock')).toHaveText('13:01:41'); // sample starts 13:00:01 local
  await page.getByTestId('range-track').click();
  expect(await hook(page, (h) => h.app.range.mode)).toBe('track');
});

test('exports the map and two data videos in one pass, all with the same length', async ({ page }) => {
  await page.getByTestId('comp-time').check();
  await page.getByTestId('comp-pace').check();
  await page.getByRole('button', { name: '30×' }).click();
  await page.getByTestId('resolution').selectOption('360');
  await hook(page, (h) => {
    h.app.exportRange.mode = 'custom';
    h.app.exportRange.in = 300;
    h.app.exportRange.out = 330; // 30 s at 30× and 30 fps → 30 frames
  });
  await expect(page.getByTestId('export')).toHaveText(/Export 3 videos/);
  await page.getByTestId('export').click();
  await expect(page.getByTestId('export-files').locator('li')).toHaveCount(3, { timeout: 60_000 });
  await expect(page.getByTestId('export-result')).toContainText('30 frames');

  const durations = await page.evaluate(async () => {
    const app = (window as unknown as { __omv: { app: { exportResult: { files: { url: string; name: string }[] } } } })
      .__omv.app;
    const out: { name: string; d: number; w: number; h: number }[] = [];
    for (const f of app.exportResult.files) {
      const v = document.createElement('video');
      v.muted = true;
      v.src = f.url;
      await new Promise<void>((r) => (v.onloadedmetadata = () => r()));
      out.push({ name: f.name, d: v.duration, w: v.videoWidth, h: v.videoHeight });
    }
    return out;
  });
  expect(durations).toHaveLength(3);
  durations.forEach((d) => expect(d.d).toBeCloseTo(1, 2));
  expect(durations.map((d) => `${d.w}x${d.h}`)).toEqual(['640x360', '520x180', '520x180']);
  expect(durations.map((d) => d.name)).toEqual([
    'Keskuspuisto_sample_map_30x_30fps_640x360.mp4',
    'Keskuspuisto_sample_pace_30x_30fps_520x180.mp4',
    'Keskuspuisto_sample_time_30x_30fps_520x180.mp4',
  ]);

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download-pace').click()]);
  expect(download.suggestedFilename()).toBe('Keskuspuisto_sample_pace_30x_30fps_520x180.mp4');
  expect(readFileSync(await download.path()).length).toBeGreaterThan(2_000);
});
