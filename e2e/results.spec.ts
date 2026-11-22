import { test, expect } from './fixtures';
import { hook } from './hook';

/**
 * STORY-41: import a result list, pick the runner, sync passing times from the punches and show the
 * splits component. The IOF XML 3.0 file is built from the sample project's own passings: the runner
 * punched 2 s later on the punching clock than the GPS saw (clock offset −2 s), and a faster leader.
 */
test('imports results, syncs passing times and shows the splits component', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await page.goto('/');
  await page.getByTestId('load-sample-project').click();
  await page.getByTestId('tab-course').click();
  await expect(page.getByTestId('course-status')).toBeVisible();

  const xml = await hook(page, (h) => {
    const ps = h.app.passings as { t: number }[];
    const t0 = ps[0].t;
    const start = new Date(h.app.track.startTime + t0 * 1000).toISOString();
    const n = ps.length - 2;
    const codes = Array.from({ length: n }, (_, i) => String(31 + i));
    const mine = ps.slice(1).map((p) => Math.round(p.t - t0 + 2));
    const fast = mine.map((s) => Math.round(s * 0.9));
    const person = (given: string, family: string, e: number[], pos: number) =>
      `<PersonResult><Person><Name><Family>${family}</Family><Given>${given}</Given></Name></Person>` +
      `<Organisation><Name>Club</Name></Organisation><Result><StartTime>${start}</StartTime>` +
      `<Time>${e[n]}</Time><Position>${pos}</Position><Status>OK</Status>` +
      e
        .slice(0, n)
        .map((s, i) => `<SplitTime><ControlCode>${codes[i]}</ControlCode><Time>${s}</Time></SplitTime>`)
        .join('') +
      `<SplitTime><ControlCode>M</ControlCode><Time>${e[n]}</Time></SplitTime></Result></PersonResult>`;
    return (
      '<?xml version="1.0"?><ResultList xmlns="http://www.orienteering.org/datastandard/3.0" iofVersion="3.0">' +
      '<Event><Name>Test Event</Name></Event><ClassResult><Class><Name>H21</Name></Class>' +
      person('Fast', 'Leader', fast, 1) +
      person('Test', 'Runner', mine, 2) +
      '</ClassResult></ResultList>'
    );
  });

  await page
    .getByTestId('results-file')
    .setInputFiles({ name: 'results.xml', mimeType: 'application/xml', buffer: Buffer.from(xml) });
  await page.getByTestId('results-runner').selectOption({ label: '2. Test Runner (Club) 14:51' });
  await expect(page.getByTestId('results-matched')).toContainText('5 of 5 controls');
  // Auto clock offset ≈ −2 s (punches were rounded to whole seconds).
  await expect.poll(async () => +(await page.getByTestId('results-offset').inputValue())).toBeLessThan(-1.4);
  expect(+(await page.getByTestId('results-offset').inputValue())).toBeGreaterThan(-2.6);
  await expect(page.getByTestId('results-splits')).toContainText('Finish');

  await page.getByTestId('results-apply').click();
  const statuses = await hook(page, (h) => h.app.passings.map((p: { status: string }) => p.status));
  expect(statuses.every((s: string) => s === 'manual')).toBe(true);

  // Splits component: card at a control passing, key colour some seconds later.
  await page.getByTestId('tab-export').click();
  await page.getByTestId('comp-splits').check();
  const pixel = (dt: number) =>
    hook(
      page,
      async (h, d) => {
        h.app.seek(h.app.passings[2].t + d);
        await new Promise((r) => setTimeout(r, 200));
        const c = document.querySelector('[data-testid="comp-preview-splits"]') as HTMLCanvasElement;
        return Array.from(c.getContext('2d')!.getImageData(3, 3, 1, 1).data.slice(0, 3));
      },
      dt,
    );
  expect(await pixel(2)).toEqual([0x14, 0x18, 0x1f]); // component background
  expect(await pixel(30)).toEqual([0x00, 0xb1, 0x40]); // key colour

  // Results survive save + reopen of the project.
  const saved = await hook(page, (h) => h.app.toDoc().results);
  expect(saved.cls.competitors).toHaveLength(2);
  expect(saved.runner).toBe(1);
});
