import { deflateSync } from 'node:zlib';
import { test as base, type Page } from '@playwright/test';

/** 256×256 checkerboard PNG (dark/light 32 px squares) so tests can detect drawn tiles. */
export function checkerPng(size = 256): Buffer {
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const dark = ((x >> 5) + (y >> 5)) % 2 === 0;
      const o = y * (size * 3 + 1) + 1 + x * 3;
      raw[o] = dark ? 30 : 235;
      raw[o + 1] = dark ? 30 : 225;
      raw[o + 2] = dark ? 30 : 200;
    }
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (b: Buffer) => {
    let c = 0xffffffff;
    for (const v of b) c = crcTable[(c ^ v) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const PNG = checkerPng(256);

/** Stubs all map tile hosts with a CORS-enabled PNG: no network, no load on MapAnt/OSM. */
export async function stubTiles(page: Page): Promise<void> {
  await page.route(/(mapant\.fi|tile\.openstreetmap\.org)/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: PNG,
      headers: { 'Access-Control-Allow-Origin': '*' },
    }),
  );
}

export const test = base.extend({
  page: async ({ page }, use) => {
    await stubTiles(page);
    // Force the download fallback: the native save dialog cannot be driven by Playwright.
    await page.addInitScript(() => {
      delete (window as unknown as Record<string, unknown>).showSaveFilePicker;
    });
    await use(page);
  },
});
export { expect } from '@playwright/test';
