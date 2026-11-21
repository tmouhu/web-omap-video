import { test, expect } from './fixtures';
import { hook } from './hook';

test('switches the UI to Finnish, remembers it, and keeps video language separate', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('tab-map')).toContainText('Map');
  await page.getByTestId('language').selectOption('fi');
  await expect(page.getByTestId('tab-map')).toContainText('Kartta');
  await expect(page.getByTestId('load-sample')).toHaveText('Lataa esimerkki-GPX');
  expect(await page.evaluate(() => document.documentElement.lang)).toBe('fi');

  await page.reload();
  await expect(page.getByTestId('tab-course')).toContainText('Rata');

  await page.getByTestId('load-sample-project').click();
  await expect(page.getByTestId('project-name')).toHaveValue('Esimerkki – Keskuspuisto');
  // New projects take the UI language for video texts; it can be changed independently.
  expect(await hook(page, (h) => h.app.videoLocale)).toBe('fi');
  await page.getByTestId('tab-export').click();
  await page.getByTestId('video-language').selectOption('en');
  expect(await hook(page, (h) => h.app.projectScene.videoLocale)).toBe('en');
  await expect(page.getByTestId('tab-export')).toContainText('Vienti');
});

test('error messages from file parsing are translated', async ({ page }) => {
  await page.goto('/?lang=fi');
  await page.getByTestId('file-input').setInputFiles({
    name: 'rikki.gpx',
    mimeType: 'application/gpx+xml',
    buffer: Buffer.from('<gpx><trk>'),
  });
  await expect(page.getByRole('alert')).toContainText('Tiedosto ei ole kelvollista XML:ää.');
});
