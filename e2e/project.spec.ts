import { readFileSync } from 'node:fs';
import { checkerPng, expect, test } from './fixtures';
import { hook } from './hook';

test('autosaves to the browser and reopens after a reload from the start screen', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('load-sample-project').click();
  await expect(page.getByTestId('save-state')).toHaveText(/^Saved /, { timeout: 10_000 });
  await page.getByTestId('project-name').fill('Race day');
  await page.getByTestId('project-name').press('Enter');
  await expect(page.getByTestId('save-state')).toHaveText(/^Saved /, { timeout: 10_000 });
  const before = await hook(page, (h) => ({
    controls: h.app.course.points.length,
    routes: h.app.routes.length,
    passings: h.app.passings.map((p: { t: number }) => Math.round(p.t)),
  }));

  await page.reload();
  await expect(page.getByTestId('projects-dialog')).toBeVisible();
  const list = page.getByTestId('project-list');
  await expect(list).toContainText(`${before.controls - 2} controls`);
  await expect(list.locator('input').first()).toHaveValue('Race day');
  await list.getByRole('button', { name: 'Open', exact: true }).first().click();
  await expect(page.getByTestId('projects-dialog')).toBeHidden();
  const after = await hook(page, (h) => ({
    name: h.app.projectName,
    controls: h.app.course.points.length,
    routes: h.app.routes.length,
    passings: h.app.passings.map((p: { t: number }) => Math.round(p.t)),
  }));
  expect(after).toEqual({ name: 'Race day', ...before });
});

test('saves a project file with its map image and opens it in a fresh browser', async ({ page, browser }) => {
  await page.goto('/');
  await page.getByTestId('load-sample-project').click();
  // A raster map (world file) so the file also carries an image.
  await page.getByTestId('tab-map').click();
  await page.getByTestId('raster-input').setInputFiles([
    { name: 'forest.png', mimeType: 'image/png', buffer: checkerPng(256) },
    { name: 'forest.pgw', mimeType: 'text/plain', buffer: Buffer.from('2\n0\n0\n-2\n384100\n6676500\n') },
  ]);
  await expect(page.getByTestId('raster-info')).toContainText('forest');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('save-project-file').click()]);
  expect(download.suggestedFilename()).toMatch(/\.omvproj$/);
  const file = readFileSync(await download.path());

  const ctx = await browser.newContext({ timezoneId: 'Europe/Helsinki', viewport: { width: 1440, height: 900 } });
  const p2 = await ctx.newPage();
  await p2.route(/(mapant\.fi|tile\.openstreetmap\.org)/, (r) =>
    r.fulfill({
      status: 200,
      contentType: 'image/png',
      body: checkerPng(256),
      headers: { 'Access-Control-Allow-Origin': '*' },
    }),
  );
  await p2.goto(page.url());
  await p2
    .getByTestId('file-input')
    .setInputFiles({ name: download.suggestedFilename(), mimeType: 'application/zip', buffer: file });
  await expect(p2.getByTestId('toasts')).toContainText('Opened');
  const s = await hook(p2, (h) => ({
    name: h.app.projectName,
    raster: h.app.raster && { w: h.app.raster.width, levels: h.app.raster.levels.length },
    controls: h.app.course.points.length,
    track: h.app.track.points.length,
  }));
  expect(s).toEqual({ name: 'Sample – Keskuspuisto', raster: { w: 256, levels: 1 }, controls: 7, track: 898 });
  await ctx.close();
});

test('presets: built-in applies; own preset is saved and survives a reload', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('load-sample-project').click();
  await page.getByTestId('tab-style').click();
  await page.getByTestId('preset-sprint').click();
  await expect(page.getByTestId('zoom-in-limit')).toHaveValue('2000');
  await expect(page.getByTestId('zoom-out-limit')).toHaveValue('6000');
  await page.getByTestId('zoom-in-limit').fill('3000');
  await page.getByTestId('zoom-in-limit').press('Enter');
  await page.getByTestId('preset-name').fill('Mine');
  await page.getByTestId('preset-save').click();
  await page.getByTestId('preset-classic-forest').click();
  await expect(page.getByTestId('zoom-in-limit')).toHaveValue('4000');

  await page.reload();
  await page.keyboard.press('Escape'); // close the start screen
  await page.getByTestId('load-sample-project').click();
  await page.getByTestId('tab-style').click();
  await page.getByRole('button', { name: /^Mine/ }).click();
  await expect(page.getByTestId('zoom-in-limit')).toHaveValue('3000');
});

test('shortcuts dialog, theme switching and undo from the top bar', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('load-sample-project').click();
  await page.keyboard.press('?');
  await expect(page.getByTestId('shortcuts-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('shortcuts-dialog')).toBeHidden();

  const theme = () => page.evaluate(() => document.documentElement.dataset.theme);
  await page.getByTestId('theme').click(); // system → dark
  expect(await theme()).toBe('dark');
  await page.getByTestId('theme').click(); // dark → light
  expect(await theme()).toBe('light');

  await page.getByTestId('tab-routes').click();
  const routes = () => hook(page, (h) => h.app.routes.length);
  expect(await routes()).toBe(1);
  await page.getByRole('button', { name: /Delete route A/ }).click();
  expect(await routes()).toBe(0);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect(await routes()).toBe(1);
});
