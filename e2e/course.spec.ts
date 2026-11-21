import { test, expect } from './fixtures';
import { hook, pixelOf, trackPos } from './hook';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('load-sample').click();
  await expect(page.getByTestId('tab-course')).toBeVisible();
  await page.getByTestId('tab-course').click();
});

/** Draws S → 1 → 2 → F on the track by clicking the map (double-click places the finish). */
async function drawCourse(page: import('@playwright/test').Page) {
  await page.getByTestId('course-edit').click();
  const times = [3, 250, 520];
  for (const t of times) {
    const [x, y] = await pixelOf(page, await trackPos(page, t, [6, 0]));
    await page.mouse.click(x, y);
    await page.waitForTimeout(350); // OL singleclick delay
  }
  const end = await hook(page, (h) => h.app.track.duration - 2);
  const [fx, fy] = await pixelOf(page, await trackPos(page, end));
  await page.mouse.dblclick(fx, fy);
  await page.waitForTimeout(150);
}

test('draws a course by clicking and matches the GPX to it', async ({ page }) => {
  await drawCourse(page);
  const kinds = await hook(page, (h) => h.app.course.points.map((p: { kind: string }) => p.kind));
  expect(kinds).toEqual(['start', 'control', 'control', 'finish']);
  await expect(page.getByTestId('course-status')).toContainText('3 legs');
  const splits = page.getByTestId('splits');
  await expect(splits.locator('tbody tr')).toHaveCount(4);
  const ps: [number, string][] = await hook(page, (h) =>
    h.app.passings.map((p: { t: number; status: string }) => [Math.round(p.t), p.status]),
  );
  expect(ps.map((p: [number, string]) => p[1])).toEqual(['auto', 'auto', 'auto', 'auto']);
  expect(Math.abs(ps[1][0] - 250)).toBeLessThan(15);
  expect(Math.abs(ps[2][0] - 520)).toBeLessThan(15);
  await expect(page.getByTestId('timeline-marks').locator('button')).toHaveCount(4);
});

test('drag moves a control; undo restores it; Delete removes the selected control', async ({ page }) => {
  await drawCourse(page);
  const before = await hook(page, (h) => ({ ...h.app.course.points[1] }));
  const [x, y] = await pixelOf(page, before);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 40, y + 25, { steps: 6 });
  await page.mouse.up();
  const after = await hook(page, (h) => ({ ...h.app.course.points[1] }));
  expect(after.id).toBe(before.id);
  expect(after.lon).toBeGreaterThan(before.lon);
  await page.keyboard.press('ControlOrMeta+z');
  const undone = await hook(page, (h) => ({ ...h.app.course.points[1] }));
  expect(undone.lon).toBeCloseTo(before.lon, 9);

  await page.mouse.click(x, y);
  await page.waitForTimeout(350);
  await page.keyboard.press('Delete');
  await expect(page.getByTestId('course-points').locator('li')).toHaveCount(3);
});

test('manual passing times: nudge, marker drag, reset', async ({ page }) => {
  await drawCourse(page);
  const t0 = await hook(page, (h) => h.app.passings[1].t);
  const row = page.getByTestId('splits').locator('tbody tr').nth(1);
  await row.getByTitle('1 s later').click();
  const t1 = await hook(page, (h) => ({ t: h.app.passings[1].t, s: h.app.passings[1].status }));
  expect(t1.s).toBe('manual');
  expect(t1.t).toBeCloseTo(t0 + 1, 3);

  // Drag the timeline marker of control 2 to the left.
  const mark = page.getByTestId('mark-2');
  const mb = (await mark.boundingBox())!;
  await page.mouse.move(mb.x + mb.width / 2, mb.y + mb.height / 2);
  await page.mouse.down();
  await page.mouse.move(mb.x + mb.width / 2 - 25, mb.y + mb.height / 2, { steps: 4 });
  await page.mouse.up();
  const t2 = await hook(page, (h) => ({ t: h.app.passings[2].t, s: h.app.passings[2].status }));
  expect(t2.s).toBe('manual');

  await page.getByTestId('splits').locator('tbody tr').nth(1).getByTitle('Back to automatic').click();
  expect(await hook(page, (h) => h.app.passings[1].status)).toBe('auto');
});

test('imports an IOF XML file with two courses and lets the user choose', async ({ page }) => {
  const pts = await Promise.all([3, 250, 520, 880].map((t) => trackPos(page, t)));
  const ctrl = (id: string, p: { lat: number; lon: number }, type = 'Control') =>
    `<Control type="${type}"><Id>${id}</Id><Position lng="${p.lon}" lat="${p.lat}"/></Control>`;
  const cc = (id: string, type = 'Control') => `<CourseControl type="${type}"><Control>${id}</Control></CourseControl>`;
  const xml = `<?xml version="1.0"?><CourseData xmlns="http://www.orienteering.org/datastandard/3.0" iofVersion="3.0">
    <RaceCourseData><Map><Scale>10000</Scale></Map>
    ${ctrl('S1', pts[0], 'Start')}${ctrl('31', pts[1])}${ctrl('32', pts[2])}${ctrl('F1', pts[3], 'Finish')}
    <Course><Name>Long</Name>${cc('S1', 'Start')}${cc('31')}${cc('32')}${cc('F1', 'Finish')}</Course>
    <Course><Name>Short</Name>${cc('S1', 'Start')}${cc('32')}${cc('F1', 'Finish')}</Course>
    </RaceCourseData></CourseData>`;
  await page
    .getByTestId('course-import')
    .setInputFiles({ name: 'courses.xml', mimeType: 'application/xml', buffer: Buffer.from(xml) });
  await expect(page.getByTestId('course-choices')).toContainText('Long');
  await page.getByTestId('course-choices').getByRole('button', { name: /Long/ }).click();
  await expect(page.getByTestId('course-status')).toContainText('3 legs');
  const codes = await hook(page, (h) => h.app.course.points.map((p: { code?: string }) => p.code ?? ''));
  expect(codes).toEqual(['', '31', '32', '']);
  expect(await hook(page, (h) => h.app.passings.filter((p: { status: string }) => p.status === 'auto').length)).toBe(4);
});

test('the course is drawn into exported video frames', async ({ page }) => {
  await drawCourse(page);
  await page.getByTestId('course-edit').click(); // done editing
  await page.getByTestId('tab-video').click();
  await page.getByRole('button', { name: '30×' }).click();
  await page.getByTestId('resolution').selectOption('360');
  await hook(page, (h) => {
    h.app.free.headingUp = false;
    h.app.free.scale = 25000;
    h.app.exportFromStart = false;
    h.app.seek(240);
  });
  await page.getByTestId('export').click();
  await expect(page.getByTestId('export-result')).toBeVisible({ timeout: 60_000 });
  const purple = await page.evaluate(async () => {
    const v = document.querySelector<HTMLVideoElement>('[data-testid=export-result] video')!;
    await new Promise<void>((r) => (v.readyState >= 2 ? r() : (v.onloadeddata = () => r())));
    v.currentTime = 0.1;
    await new Promise<void>((r) => (v.onseeked = () => r()));
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const x = c.getContext('2d')!;
    x.drawImage(v, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] > 140 && d[i + 1] < 90 && d[i + 2] > 140) n++;
    return n;
  });
  expect(purple).toBeGreaterThan(30);
});
