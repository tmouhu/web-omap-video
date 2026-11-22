import { describe, expect, it } from 'vitest';
import { apply } from '../src/lib/raster/affine';
import { crsFromPrj, formatWorldFile, guessWorldFileCrs, parseWorldFile } from '../src/lib/raster/worldfile';
import { isWorldFileOnly, readWorldFile } from '../src/lib/raster/load';

const JGW = '0.5\n0\n0\n-0.5\n385000.25\n6675999.75\n';

describe('world files', () => {
  it('parses to the corner convention and round-trips', () => {
    const a = parseWorldFile(JGW);
    expect(apply(a, [0, 0])).toEqual([385000, 6676000]);
    expect(apply(a, [0.5, 0.5])).toEqual([385000.25, 6675999.75]);
    const b = parseWorldFile(formatWorldFile(a));
    b.forEach((v, i) => expect(v).toBeCloseTo(a[i], 8));
  });

  it('rejects garbage', () => {
    expect(() => parseWorldFile('1\n2\nx')).toThrow(/six numbers/);
  });

  it('guesses TM35FIN in Finland, UTM elsewhere, WGS84 and Web Mercator by range', () => {
    const a = parseWorldFile(JGW);
    expect(guessWorldFileCrs(a, 4000, 3000, null)).toBe('EPSG:3067');
    expect(guessWorldFileCrs(a, 4000, 3000, { lat: 60.2, lon: 24.9 })).toBe('EPSG:3067');
    expect(guessWorldFileCrs(a, 4000, 3000, { lat: 59.9, lon: 10.7 })).toBe('EPSG:32632');
    expect(guessWorldFileCrs(parseWorldFile('0.00001\n0\n0\n-0.00001\n24.9\n60.2'), 4000, 3000, null)).toBe(
      'EPSG:4326',
    );
    expect(guessWorldFileCrs(parseWorldFile('0.5\n0\n0\n-0.5\n2776000\n8440000'), 4000, 3000, null)).toBe('EPSG:3857');
  });

  it('reads the CRS from .prj files', () => {
    expect(crsFromPrj('PROJCS["ETRS89 / TM35FIN(E,N)",GEOGCS["ETRS89"],PROJECTION["Transverse_Mercator"]]')).toBe(
      'EPSG:3067',
    );
    expect(crsFromPrj('PROJCS["ETRS89_TM35FIN_E_N",GEOGCS["GCS_ETRS_1989"]]')).toBe('EPSG:3067');
    expect(crsFromPrj('PROJCS["WGS_1984_UTM_Zone_33N",GEOGCS["GCS_WGS_1984"]]')).toBe('EPSG:32633');
    expect(crsFromPrj('PROJCS["x",GEOGCS["y"],AUTHORITY["EPSG","3879"]]')).toBe('EPSG:3879');
    expect(crsFromPrj('GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984"]]')).toBe('EPSG:4326');
    expect(crsFromPrj('LOCAL_CS["nothing"]')).toBeNull();
  });
});

describe('world file for a loaded image', () => {
  const file = (name: string, text: string) => new File([text], name);

  it('recognises a world file (+ .prj) without an image', () => {
    expect(isWorldFileOnly([file('map.wld', JGW)])).toBe(true);
    expect(isWorldFileOnly([file('MAP.JGW', JGW), file('map.prj', 'x')])).toBe(true);
    expect(isWorldFileOnly([file('map.prj', 'x')])).toBe(false);
    expect(isWorldFileOnly([file('map.wld', JGW), file('map.png', '')])).toBe(false);
  });

  it('reads the affine and guesses the CRS from the coordinates', async () => {
    const r = await readWorldFile([file('map.wld', JGW)], 1000, 1000, null);
    expect(apply(r.affine, [0, 0])).toEqual([385000, 6676000]);
    expect(r).toMatchObject({ crs: 'EPSG:3067', crsGuessed: true });
  });

  it('prefers the CRS of a .prj', async () => {
    const prj = 'PROJCS["ETRS89 / TM35FIN(E,N)",AUTHORITY["EPSG","3067"]]';
    const r = await readWorldFile([file('map.prj', prj), file('map.wld', JGW)], 1000, 1000, null);
    expect(r).toMatchObject({ crs: 'EPSG:3067', crsGuessed: false });
  });
});
