import { strToU8, zipSync } from 'fflate';
import { checkerPng, expect, test } from './fixtures';

/** Sample track centre in TM35FIN (see public/sample.gpx). */
const CX = 384339.5;
const CY = 6676252.7;
const PNG = checkerPng(512);

type Affine = [number, number, number, number, number, number];
type Win = {
  __omv: {
    app: {
      raster: { georef: { affine: Affine; crs: string; source: string } } | null;
      crs: { code: string };
      frame: { width: number; height: number };
      frameCustom: unknown;
      layers: { id: string; kind: string; visible: boolean }[];
    };
    map(): {
      getPixelFromCoordinate(c: number[]): number[];
      getView(): { setCenter(c: number[]): void; setResolution(r: number): void };
    };
  };
};

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('load-sample')).toBeVisible();
});

test('adds a raster map with a world file in TM35FIN and lists it as a layer', async ({ page }) => {
  await page.getByTestId('load-sample').click();
  // 512 px at 2 m/px, centred on the track.
  const pgw = `2\n0\n0\n-2\n${CX - 512 + 1}\n${CY + 512 - 1}\n`;
  await page.getByTestId('raster-input').setInputFiles([
    { name: 'forest.png', mimeType: 'image/png', buffer: PNG },
    { name: 'forest.pgw', mimeType: 'text/plain', buffer: Buffer.from(pgw) },
  ]);
  await expect(page.getByTestId('raster-info')).toContainText('forest');
  await expect(page.getByTestId('georef-source')).toHaveText('World file');
  await expect(page.getByTestId('crs-tag')).toHaveText('ETRS-TM35FIN');
  await expect(page.getByTestId('layer-list')).toContainText('forest');
  await expect(page.getByTestId('credits')).toContainText('MapAnt');
  const a = await page.evaluate(() => (window as unknown as Win).__omv.app.raster!.georef.affine);
  expect(a[2]).toBeCloseTo(CX - 512, 6);
  expect(a[5]).toBeCloseTo(CY + 512, 6);
});

test('adds a KMZ map (GroundOverlay) and places it in TM35FIN', async ({ page }) => {
  const kml = `<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><GroundOverlay>
    <name>Keskuspuisto</name><Icon><href>files/map.png</href></Icon>
    <LatLonBox><north>60.211</north><south>60.202</south><east>24.925</east><west>24.901</west><rotation>5</rotation></LatLonBox>
    </GroundOverlay></Document></kml>`;
  const kmz = Buffer.from(zipSync({ 'doc.kml': strToU8(kml), 'files/map.png': new Uint8Array(PNG) }));
  await page.getByTestId('file-input').setInputFiles([{ name: 'map.kmz', mimeType: 'application/zip', buffer: kmz }]);
  await expect(page.getByTestId('raster-info')).toContainText('Keskuspuisto');
  await expect(page.getByTestId('georef-source')).toHaveText('KMZ / KML');
  const g = await page.evaluate(() => (window as unknown as Win).__omv.app.raster!.georef);
  expect(g.crs).toBe('EPSG:3067');
});

test('georeferences an unreferenced image with three control points', async ({ page }) => {
  await page.getByTestId('load-sample').click();
  await page.getByTestId('raster-input').setInputFiles([{ name: 'scan.png', mimeType: 'image/png', buffer: PNG }]);
  await expect(page.getByTestId('georef-panel')).toBeVisible();
  await expect(page.getByTestId('georef-source')).toHaveText('Not georeferenced yet');

  // Truth: 1.5 m pixels, rotated 8°, top-left corner at (CX-300, CY+350).
  const t = (8 * Math.PI) / 180;
  const truth: Affine = [
    1.5 * Math.cos(t),
    1.5 * Math.sin(t),
    CX - 300,
    1.5 * Math.sin(t),
    -1.5 * Math.cos(t),
    CY + 350,
  ];
  const apply = (A: Affine, p: number[]) => [A[0] * p[0] + A[1] * p[1] + A[2], A[3] * p[0] + A[4] * p[1] + A[5]];

  // Show the whole area at a comfortable scale.
  await page.evaluate(
    ([cx, cy]) => {
      const v = (window as unknown as Win).__omv.map().getView();
      v.setCenter([cx, cy]);
      v.setResolution(2.5);
    },
    [CX, CY],
  );
  await page.waitForTimeout(300);

  const frame = page.getByTestId('map-frame');
  const box = (await frame.boundingBox())!;
  const clickWorld = async (xy: number[]) => {
    const [px, py] = await page.evaluate((c) => (window as unknown as Win).__omv.map().getPixelFromCoordinate(c), xy);
    await page.mouse.click(box.x + px, box.y + py);
    await page.waitForTimeout(400); // OL singleclick waits for a possible double click
  };
  for (const p of [
    [40, 60],
    [480, 90],
    [260, 470],
  ]) {
    const current = await page.evaluate(() => (window as unknown as Win).__omv.app.raster!.georef.affine);
    await clickWorld(apply(current, p)); // the image feature where it is shown now
    await expect(page.getByTestId('georef-hint')).toContainText('Step 2');
    await clickWorld(apply(truth, p)); // its true position
  }
  await expect(page.getByTestId('georef-pairs').locator('li')).toHaveCount(3);
  await expect(page.getByTestId('georef-rms')).toContainText('RMS error');
  const g = await page.evaluate(() => (window as unknown as Win).__omv.app.raster!.georef);
  expect(g.source).toBe('manual');
  // Clicks are whole CSS pixels at 2.5 m/px → about a metre of error is expected.
  for (const p of [
    [0, 0],
    [512, 512],
  ]) {
    const got = apply(g.affine, p);
    const exp = apply(truth, p);
    expect(Math.hypot(got[0] - exp[0], got[1] - exp[1])).toBeLessThan(5);
  }
  await page.getByTestId('georef-done').click();
  await expect(page.getByTestId('georef-source')).toHaveText('Manual control points');
});

test('frame can be resized freely and aspect presets still work', async ({ page }) => {
  const handle = page.getByTestId('frame-resize');
  const hb = (await handle.boundingBox())!;
  const before = await page.evaluate(() => ({ ...(window as unknown as Win).__omv.app.frame }));
  await page.mouse.move(hb.x + 9, hb.y + 9);
  await page.mouse.down();
  await page.mouse.move(hb.x - 100, hb.y - 20, { steps: 5 });
  await page.mouse.up();
  const after = await page.evaluate(() => ({ ...(window as unknown as Win).__omv.app.frame }));
  expect(after.width).toBeLessThan(before.width - 150);
  expect(after.height).toBeLessThan(before.height - 20);
  await page.getByTestId('tab-video').click();
  await expect(page.getByRole('button', { name: 'Free' })).toHaveAttribute('aria-pressed', 'true');

  await page.getByTestId('frame-width').fill('800');
  await page.getByTestId('frame-width').press('Enter');
  await page.getByTestId('frame-height').fill('400');
  await page.getByTestId('frame-height').press('Enter');
  await expect
    .poll(() => page.evaluate(() => ({ ...(window as unknown as Win).__omv.app.frame })))
    .toEqual({
      width: 800,
      height: 400,
    });

  await page.getByRole('button', { name: '1:1' }).click();
  const sq = await page.evaluate(() => ({ ...(window as unknown as Win).__omv.app.frame }));
  expect(sq.width).toBe(sq.height);
});

test('video frame has no info box, scale bar or attribution', async ({ page }) => {
  await page.getByTestId('load-sample').click();
  await page.waitForTimeout(300);
  // Overlay canvas corners (where the info box, scale bar and attribution used to be) are empty.
  const alpha = await page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>('[data-testid=overlay]')!;
    const x = c.getContext('2d')!;
    const sum = (sx: number, sy: number, w: number, h: number) =>
      x.getImageData(sx, sy, w, h).data.reduce((s, v, i) => (i % 4 === 3 ? s + v : s), 0);
    const s = c.width / 1000;
    return {
      topLeft: sum(0, 0, Math.round(160 * s), Math.round(90 * s)),
      bottomLeft: sum(0, c.height - Math.round(40 * s), Math.round(200 * s), Math.round(40 * s)),
      bottomRight: sum(
        c.width - Math.round(300 * s),
        c.height - Math.round(18 * s),
        Math.round(300 * s),
        Math.round(18 * s),
      ),
    };
  });
  expect(alpha).toEqual({ topLeft: 0, bottomLeft: 0, bottomRight: 0 });
});

test('adds a WMS layer from capabilities', async ({ page }) => {
  await page.route(/example\.org\/wms/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/xml',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: `<?xml version="1.0"?><WMS_Capabilities version="1.3.0" xmlns="http://www.opengis.net/wms"
        xmlns:xlink="http://www.w3.org/1999/xlink"><Service><Name>WMS</Name><Title>Example maps</Title></Service>
        <Capability><Request><GetMap><Format>image/png</Format><DCPType><HTTP><Get>
        <OnlineResource xlink:href="https://example.org/wms?"/></Get></HTTP></DCPType></GetMap></Request>
        <Layer><Title>Root</Title><CRS>EPSG:3067</CRS><CRS>EPSG:3857</CRS>
        <Layer><Name>orto</Name><Title>Old aerial photos</Title></Layer></Layer></Capability></WMS_Capabilities>`,
    }),
  );
  await page.getByTestId('add-layer').click();
  await page.getByTestId('service-url').fill('https://example.org/wms?SERVICE=WMS&REQUEST=GetCapabilities');
  await page.getByRole('button', { name: 'Fetch' }).click();
  await page.getByTestId('service-layers').getByText('Old aerial photos').click();
  await expect(page.getByTestId('layer-attribution')).toHaveValue('© Example maps');
  await page.getByTestId('add-layer-confirm').click();
  await expect(page.getByTestId('layer-list')).toContainText('Old aerial photos');
  await expect(page.getByTestId('credits')).toContainText('© Example maps');
});
