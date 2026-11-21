import { readFileSync } from 'node:fs';
import { test, expect } from './fixtures';
import { hook, pixelOf } from './hook';

/** The sample GPX with one GPS spike (point 300 moved ~250 m east). */
function gpxWithSpike(): Buffer {
  const xml = readFileSync('public/sample.gpx', 'utf8');
  let k = 0;
  const out = xml.replace(/<trkpt lat="([\d.]+)" lon="([\d.]+)"/g, (m, lat, lon) =>
    k++ === 300 ? `<trkpt lat="${lat}" lon="${(+lon + 0.0045).toFixed(7)}"` : m,
  );
  return Buffer.from(out);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('load-sample')).toBeVisible();
});

test('finds and removes a GPS spike; undo brings it back', async ({ page }) => {
  await page
    .getByTestId('file-input')
    .setInputFiles({ name: 'spike.gpx', mimeType: 'application/gpx+xml', buffer: gpxWithSpike() });
  await page.getByTestId('tab-gpx').click();
  await expect(page.getByTestId('gpx-editor')).toContainText('1 GPS spike found');
  const len0 = await hook(page, (h) => h.app.track.length);
  await page.getByTestId('remove-outliers').click();
  await expect(page.getByTestId('edit-count')).toHaveText('1 edits');
  await expect(page.getByTestId('gpx-editor')).toContainText('No GPS spikes found');
  const len1 = await hook(page, (h) => h.app.track.length);
  expect(len0 - len1).toBeGreaterThan(400);
  await page.keyboard.press('ControlOrMeta+z');
  await expect(page.getByTestId('edit-count')).toHaveText('0 edits');
});

test('drags a track point with the brush; times stay unchanged', async ({ page }) => {
  await page.getByTestId('load-sample').click();
  await page.getByTestId('tab-gpx').click();
  await page.getByTestId('gpx-edit').click();
  // Zoom in on point 200 so points are draggable.
  const p = await hook(page, (h) => {
    const q = h.app.track.points[200];
    const v = h.map().getView();
    v.setCenter(h.forward(h.app.crs.code, q));
    v.setResolution(1);
    return { lat: q.lat, lon: q.lon, t: q.t, n: h.app.track.points.length };
  });
  await page.waitForTimeout(200);
  const [x, y] = await pixelOf(page, p);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 30, y, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByTestId('edit-count')).toHaveText('1 edits');
  const q = await hook(page, (h) => {
    const r = h.app.track.points[200];
    return {
      lon: r.lon,
      t: r.t,
      n: h.app.track.points.length,
      nb: h.app.track.points[203].lon,
      nbOrig: h.app.gpx.points[203].lon,
    };
  });
  expect(q.lon).toBeGreaterThan(p.lon);
  expect(q.t).toBe(p.t);
  expect(q.n).toBe(p.n);
  expect(q.nb).toBeGreaterThan(q.nbOrig); // neighbour followed (brush 15 m)
});

test('trims to a time range and redraws a section', async ({ page }) => {
  await page.getByTestId('load-sample').click();
  await page.getByTestId('tab-gpx').click();
  const dur0 = await hook(page, (h) => h.app.track.duration);
  await hook(page, (h) => h.app.seek(100));
  await page.getByTestId('range-a').click();
  await hook(page, (h) => h.app.seek(700));
  await page.getByTestId('range-b').click();
  await page.getByTestId('range-trim').click();
  const dur1 = await hook(page, (h) => h.app.track.duration);
  expect(dur1).toBeLessThan(dur0 - 250);
  expect(Math.abs(dur1 - 600)).toBeLessThan(3);

  // Redraw between 200 s and 300 s of the trimmed track via two clicked points.
  await hook(page, (h) => h.app.seek(200));
  await page.getByTestId('range-a').click();
  await hook(page, (h) => h.app.seek(300));
  await page.getByTestId('range-b').click();
  await page.getByTestId('range-redraw').click();
  const pts = await hook(page, (h) => [h.app.track.positionAt(230), h.app.track.positionAt(270)]);
  for (const q of pts) {
    const [x, y] = await pixelOf(page, q);
    await page.mouse.click(x + 8, y + 8);
    await page.waitForTimeout(350);
  }
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('edit-count')).toHaveText('2 edits');
  expect(Math.abs((await hook(page, (h) => h.app.track.duration)) - dur1)).toBeLessThan(0.01);
});

test('exports the edited GPX', async ({ page }) => {
  await page.getByTestId('load-sample').click();
  await page.getByTestId('tab-gpx').click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('gpx-export').click()]);
  expect(download.suggestedFilename()).toBe('Keskuspuisto_sample_edited.gpx');
  const text = readFileSync(await download.path(), 'utf8');
  expect(text.match(/<trkpt /g)?.length).toBe(898);
});
