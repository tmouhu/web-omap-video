/**
 * Map source constants and OpenLayers projection registration (EN-3 / EN-12).
 * Layer construction lives in `layerModel.ts`.
 * MapAnt: TM35 WMTS (best quality) in a TM35FIN view, EPSG:3857 WMTS otherwise. Out-of-coverage tiles
 * redirect to a non-CORS placeholder → load error → drawn empty.
 */
import { get as getProjection } from 'ol/proj';
import { register } from 'ol/proj/proj4';
import { proj4 } from '../geo/crs';

export const MAPANT_ATTRIBUTION =
  '© MapAnt.fi, National Land Survey of Finland laser scanning & topographic database (CC BY 4.0)';
export const OSM_ATTRIBUTION = '© OpenStreetMap contributors (ODbL)';

export const MAPANT_TM35_URL = 'https://www.mapant.fi/wmts/wmts.php?z={z}&y={y}&x={x}';
export const MAPANT_3857_URL = 'https://www.mapant.fi/wmts/wmts_EPSG3857.php?z={z}&y={y}&x={x}';

let extentSet = false;
/** Registers all proj4 CRSs with OpenLayers. Call again after defining new CRSs (e.g. UTM zones). */
export function registerProjections(): void {
  register(proj4);
  if (!extentSet) {
    getProjection('EPSG:3067')?.setExtent([-548576, 6291456, 1548576, 8388608]);
    extentSet = true;
  }
}
