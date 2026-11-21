// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { creditsText, defaultLayers, isReprojected, sourceCrs, type LayerDesc } from '../src/lib/map/layerModel';
import { normaliseCrs, parseCapabilities } from '../src/lib/map/capabilities';

describe('layer model', () => {
  it('MapAnt is native in TM35 and Web Mercator; OSM is reprojected in TM35', () => {
    const [osm, mapant] = defaultLayers();
    expect(mapant.visible).toBe(true);
    expect(osm.visible).toBe(false);
    expect(isReprojected(mapant, 'EPSG:3067')).toBe(false);
    expect(isReprojected(mapant, 'EPSG:3857')).toBe(false);
    expect(isReprojected(osm, 'EPSG:3067')).toBe(true);
    expect(sourceCrs(mapant, 'EPSG:32632')).toBe('EPSG:3857');
  });

  it('credits list visible layers once', () => {
    const l = defaultLayers();
    expect(creditsText(l)).toMatch(/MapAnt/);
    expect(creditsText(l)).not.toMatch(/OpenStreetMap/);
    l[0].visible = true;
    expect(creditsText(l)).toMatch(/OpenStreetMap.*·|·.*OpenStreetMap/);
  });

  it('WMS picks the view CRS, else Web Mercator', () => {
    const wms: LayerDesc = {
      id: 'w',
      kind: 'wms',
      title: 'W',
      visible: true,
      opacity: 1,
      url: 'u',
      layers: 'a',
      version: '1.3.0',
      crsList: ['EPSG:3857', 'EPSG:3067'],
      format: 'image/png',
      attribution: '© x',
    };
    expect(sourceCrs(wms, 'EPSG:3067')).toBe('EPSG:3067');
    expect(sourceCrs({ ...wms, crsList: ['EPSG:3857'] }, 'EPSG:3067')).toBe('EPSG:3857');
  });
});

describe('capabilities', () => {
  it('normalises CRS identifiers', () => {
    expect(normaliseCrs('urn:ogc:def:crs:EPSG:6.3:3067')).toBe('EPSG:3067');
    expect(normaliseCrs('EPSG:900913')).toBe('EPSG:3857');
    expect(normaliseCrs('http://www.opengis.net/def/crs/EPSG/0/3857')).toBe('EPSG:3857');
    expect(normaliseCrs('CRS:84')).toBe('EPSG:4326');
  });

  it('parses WMS 1.3.0 layers with inherited CRS', () => {
    const xml = `<?xml version="1.0"?><WMS_Capabilities version="1.3.0" xmlns="http://www.opengis.net/wms">
      <Service><Name>WMS</Name><Title>Test WMS</Title></Service>
      <Capability><Request><GetMap><Format>image/jpeg</Format><Format>image/png</Format>
      <DCPType><HTTP><Get><OnlineResource xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="https://x.org/wms?"/></Get></HTTP></DCPType></GetMap></Request>
      <Layer><Title>Root</Title><CRS>EPSG:3067</CRS>
        <Layer queryable="0"><Name>maps</Name><Title>Maps</Title><CRS>EPSG:3857</CRS></Layer>
      </Layer></Capability></WMS_Capabilities>`;
    const s = parseCapabilities(xml, 'https://x.org/wms?request=GetCapabilities');
    expect(s.type).toBe('WMS');
    expect(s.layers).toHaveLength(1);
    const d = s.layers[0].desc;
    expect(d.kind).toBe('wms');
    if (d.kind === 'wms') {
      expect(d.crsList.sort()).toEqual(['EPSG:3067', 'EPSG:3857']);
      expect(d.format).toBe('image/png');
      expect(d.url).toBe('https://x.org/wms?');
    }
  });

  it('rejects non-capabilities documents', () => {
    expect(() => parseCapabilities('<html/>', 'u')).toThrow(/Not a WMS or WMTS/);
  });
});
