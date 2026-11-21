// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { parseGroundOverlay, readKmz } from '../src/lib/raster/kml';

const kml = (inner: string) => `<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2"
  xmlns:gx="http://www.google.com/kml/ext/2.2"><Document><GroundOverlay><name>Forest</name>
  <Icon><href>files/map.jpg</href></Icon>${inner}</GroundOverlay></Document></kml>`;

describe('KML GroundOverlay', () => {
  it('LatLonBox without rotation gives the box corners (TL, TR, BR, BL)', () => {
    const g = parseGroundOverlay(
      kml('<LatLonBox><north>60.3</north><south>60.2</south><east>25.1</east><west>24.9</west></LatLonBox>'),
    );
    expect(g.name).toBe('Forest');
    expect(g.href).toBe('files/map.jpg');
    expect(g.corners).toEqual([
      [24.9, 60.3],
      [25.1, 60.3],
      [25.1, 60.2],
      [24.9, 60.2],
    ]);
  });

  it('rotation turns the box counter-clockwise about its centre (ground-conformal)', () => {
    const g = parseGroundOverlay(
      kml(
        '<LatLonBox><north>60.3</north><south>60.2</south><east>25.1</east><west>24.9</west><rotation>90</rotation></LatLonBox>',
      ),
    );
    const k = Math.cos((60.25 * Math.PI) / 180);
    // Top-left corner (west, north) rotates 90° CCW → bottom-left side in ground metres.
    const [lon, lat] = g.corners[0];
    expect(lon).toBeCloseTo(25 - 0.05 / k, 6);
    expect(lat).toBeCloseTo(60.25 - 0.1 * k, 6);
  });

  it('gx:LatLonQuad is reordered to TL, TR, BR, BL', () => {
    const g = parseGroundOverlay(
      kml('<gx:LatLonQuad><coordinates>24.9,60.2 25.1,60.2 25.1,60.3 24.9,60.3</coordinates></gx:LatLonQuad>'),
    );
    expect(g.corners).toEqual([
      [24.9, 60.3],
      [25.1, 60.3],
      [25.1, 60.2],
      [24.9, 60.2],
    ]);
  });

  it('reads KMZ archives with the image', () => {
    const zip = zipSync({
      'doc.kml': strToU8(kml('<LatLonBox><north>1</north><south>0</south><east>1</east><west>0</west></LatLonBox>')),
      'files/map.jpg': new Uint8Array([0xff, 0xd8, 0xff]),
    });
    const r = readKmz(zip);
    expect(r.image.type).toBe('image/jpeg');
    expect(r.image.size).toBe(3);
    expect(r.overlay.corners[2]).toEqual([1, 0]);
  });

  it('errors clearly', () => {
    expect(() => parseGroundOverlay('<kml><Document/></kml>')).toThrow(/no GroundOverlay/);
    expect(() => readKmz(zipSync({ 'a.txt': strToU8('x') }))).toThrow(/no KML/);
  });
});
