import { readFileSync } from 'node:fs';
import { test, expect } from './fixtures';

// Dev-only test hook exposed by MapStage.svelte.
type Hook = {
  app: {
    track: { duration: number; name: string } | null;
    time: number;
    playing: boolean;
    speed: number;
    free: { scale: number };
    frame: { width: number; height: number };
    timeline: {
      frameStateAt(
        t: number,
        f: { width: number; height: number },
      ): { view: { center: number[]; rotation: number; resolution: number } };
    };
    exportShortSide: number;
    exportRange: { mode: string; in: number; out: number };
    seek(t: number): void;
  };
  map(): { getView(): { getCenter(): number[]; getRotation(): number; getResolution(): number } };
};
declare global {
  interface Window {
    __omv: Hook;
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('load-sample')).toBeVisible();
});

test('loads the sample GPX and picks TM35FIN for a Finnish track', async ({ page }) => {
  await page.getByTestId('load-sample').click();
  await page.getByTestId('tab-gpx').click();
  const info = page.getByTestId('track-info');
  await expect(info).toContainText('Keskuspuisto sample');
  await expect(info).toContainText('2.99 km');
  await expect(info).toContainText('14:57');
  await page.getByTestId('tab-map').click();
  await expect(page.getByTestId('crs-tag')).toHaveText('ETRS-TM35FIN');
});

test('shows a clear error for an invalid GPX file', async ({ page }) => {
  await page.getByTestId('file-input').setInputFiles({
    name: 'broken.gpx',
    mimeType: 'application/gpx+xml',
    buffer: Buffer.from('<gpx><trk>'),
  });
  await expect(page.getByRole('alert')).toContainText('not valid XML');
});

test('loads a GPX via file input', async ({ page }) => {
  await page.getByTestId('file-input').setInputFiles({
    name: 'run.gpx',
    mimeType: 'application/gpx+xml',
    buffer: readFileSync('public/sample.gpx'),
  });
  await page.getByTestId('tab-gpx').click();
  await expect(page.getByTestId('track-info')).toBeVisible();
});

test('playback follows the timeline exactly, heading-up; pause returns north-up', async ({ page }) => {
  await page.getByTestId('load-sample').click();
  await expect.poll(() => page.evaluate(() => !!window.__omv.app.track)).toBe(true);
  await page.getByRole('button', { name: '30×' }).click();
  await page.getByTestId('play').click();
  await page.waitForTimeout(1500);

  const s = await page.evaluate(() => {
    const { app, map } = window.__omv;
    const v = map().getView();
    const fs = app.timeline.frameStateAt(app.time, app.frame);
    return { time: app.time, playing: app.playing, center: v.getCenter(), rot: v.getRotation(), exp: fs.view };
  });
  expect(s.playing).toBe(true);
  expect(s.time).toBeGreaterThan(20);
  expect(s.center[0]).toBeCloseTo(s.exp.center[0], 3);
  expect(s.center[1]).toBeCloseTo(s.exp.center[1], 3);
  expect(s.rot).toBeCloseTo(s.exp.rotation, 6);
  expect(Math.abs(s.rot)).toBeGreaterThan(0.01);

  await page.getByTestId('video-view').click(); // off: paused preview returns to free north-up navigation
  await page.keyboard.press('Space');
  await page.waitForTimeout(600);
  const p = await page.evaluate(() => ({
    playing: window.__omv.app.playing,
    rot: window.__omv.map().getView().getRotation(),
  }));
  expect(p.playing).toBe(false);
  expect(p.rot).toBeCloseTo(0, 6);
});

test('scale input sets the map resolution (1:5 000 = half of 1:10 000)', async ({ page }) => {
  await page.getByTestId('load-sample').click();
  await expect.poll(() => page.evaluate(() => !!window.__omv.app.track)).toBe(true);
  const res = () => page.evaluate(() => window.__omv.map().getView().getResolution());
  await page.getByTestId('tab-style').click();
  await page.getByTestId('scale').fill('10000');
  await page.getByTestId('scale').press('Enter');
  await page.getByTestId('scale').fill('5000');
  await page.getByTestId('scale').press('Enter');
  const r5 = await res();
  await page.getByTestId('scale').fill('10000');
  await page.getByTestId('scale').press('Enter');
  const r10 = await res();
  expect(r10 / r5).toBeCloseTo(2, 6);
  expect(r10).toBeGreaterThan(2.6); // ≈ 2.645 ground m/px × TM35 scale factor
  expect(r10).toBeLessThan(2.66);
});

test('exports a frame-exact MP4 with map tiles and downloads it', async ({ page }) => {
  await page.getByTestId('load-sample').click();
  await expect.poll(() => page.evaluate(() => !!window.__omv.app.track)).toBe(true);
  await page.getByRole('button', { name: '30×' }).click();
  await page.getByTestId('tab-export').click();
  await page.getByTestId('resolution').selectOption('360');
  await page.evaluate(() => {
    const a = window.__omv.app;
    a.exportRange.mode = 'custom';
    a.exportRange.in = a.track!.duration - 20; // 20 s of track at 30× and 30 fps → exactly 20 frames
    a.exportRange.out = a.track!.duration;
  });
  await expect(page.getByTestId('export-summary')).toContainText('640 × 360');
  await expect(page.getByTestId('export-summary')).toContainText('20 frames');
  await page.getByTestId('export').click();
  const result = page.getByTestId('export-result');
  await expect(result).toBeVisible({ timeout: 60_000 });
  await expect(result).toContainText('20 frames');

  // Decode the result in the page: size, duration and that tiles (checkerboard) were drawn.
  const probe = await page.evaluate(async () => {
    const v = document.querySelector<HTMLVideoElement>('[data-testid=export-result] video')!;
    await new Promise<void>((r) => (v.readyState >= 2 ? r() : (v.onloadeddata = () => r())));
    v.currentTime = 0.3;
    await new Promise<void>((r) => (v.onseeked = () => r()));
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const x = c.getContext('2d')!;
    x.drawImage(v, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    let dark = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] < 150) dark++;
    return { w: v.videoWidth, h: v.videoHeight, duration: v.duration, dark: dark / (d.length / 4) };
  });
  expect(probe.w).toBe(640);
  expect(probe.h).toBe(360);
  expect(probe.duration).toBeCloseTo(20 / 30, 1);
  expect(probe.dark).toBeGreaterThan(0.2); // ~half of the checkerboard is dark

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('save').click()]);
  expect(download.suggestedFilename()).toMatch(/^Keskuspuisto_sample_map_30x_30fps_640x360\.(mp4|webm)$/);
  const path = await download.path();
  expect(readFileSync(path).length).toBeGreaterThan(10_000);
});
