/**
 * Background layers (EN-3 / EN-13) on OpenLayers. MapAnt is the default:
 * TM35 WMTS in a TM35FIN view (best quality), EPSG:3857 WMTS in a Web Mercator view.
 * Outside MapAnt coverage, tiles redirect to a non-CORS placeholder → load error → drawn empty.
 */
import TileLayer from 'ol/layer/Tile';
import { get as getProjection } from 'ol/proj';
import { register } from 'ol/proj/proj4';
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';
import TileGrid from 'ol/tilegrid/TileGrid';
import { proj4 } from '../geo/crs';

export const MAPANT_ATTRIBUTION = '© MapAnt.fi, MML laser scanning & topographic database (CC BY 4.0)';
export const OSM_ATTRIBUTION = '© OpenStreetMap contributors';

export const MAPANT_TM35_URL = 'https://www.mapant.fi/wmts/wmts.php?z={z}&y={y}&x={x}';
export const MAPANT_3857_URL = 'https://www.mapant.fi/wmts/wmts_EPSG3857.php?z={z}&y={y}&x={x}';

const TM35_EXTENT = [-548576, 6291456, 1548576, 8388608];

let registered = false;
/** Registers proj4 CRSs with OpenLayers. Call again after defining new CRSs (e.g. UTM zones). */
export function registerProjections(): void {
  register(proj4);
  if (!registered) {
    getProjection('EPSG:3067')?.setExtent(TM35_EXTENT);
    registered = true;
  }
}

export interface BackgroundLayer {
  layer: TileLayer;
  attribution: string;
}

function mapantTm35(): BackgroundLayer {
  const resolutions = Array.from({ length: 16 }, (_, z) => 8192 / 2 ** z);
  const source = new XYZ({
    url: MAPANT_TM35_URL,
    projection: 'EPSG:3067',
    tileGrid: new TileGrid({
      origin: [TM35_EXTENT[0], TM35_EXTENT[3]],
      resolutions,
      extent: TM35_EXTENT,
      tileSize: 256,
    }),
    crossOrigin: 'anonymous',
    transition: 0,
  });
  return { layer: new TileLayer({ source, preload: 2, className: 'bg-layer' }), attribution: MAPANT_ATTRIBUTION };
}

function mapant3857(): BackgroundLayer {
  const source = new XYZ({ url: MAPANT_3857_URL, maxZoom: 19, crossOrigin: 'anonymous', transition: 0 });
  return { layer: new TileLayer({ source, preload: 2, className: 'bg-layer' }), attribution: MAPANT_ATTRIBUTION };
}

/** Interim global fallback (light use only, see EN-3 open question on a production provider). */
function osm(): BackgroundLayer {
  const source = new OSM({ crossOrigin: 'anonymous', transition: 0, attributions: [] });
  return { layer: new TileLayer({ source, preload: 1, className: 'bg-layer' }), attribution: OSM_ATTRIBUTION };
}

/** Default background stack for a view CRS (bottom first). */
export function defaultBackground(crsCode: string): BackgroundLayer[] {
  registerProjections();
  if (crsCode === 'EPSG:3067') return [mapantTm35()];
  if (crsCode === 'EPSG:3857') return [osm(), mapant3857()];
  return [osm()]; // UTM views: OSM reprojected by OpenLayers
}
