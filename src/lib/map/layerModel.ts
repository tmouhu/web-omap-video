/**
 * Layer model (EN-13): serialisable layer descriptors (stored in the project later, EN-15) and a
 * factory that turns them into OpenLayers layers for a given view CRS. Used by the preview map and
 * by the export map, so both always show the same stack.
 */
import type BaseLayer from 'ol/layer/Base';
import TileLayer from 'ol/layer/Tile';
import WMTSCapabilities from 'ol/format/WMTSCapabilities';
import { get as getProjection } from 'ol/proj';
import OSM from 'ol/source/OSM';
import TileWMS from 'ol/source/TileWMS';
import WMTS, { optionsFromCapabilities } from 'ol/source/WMTS';
import XYZ from 'ol/source/XYZ';
import TileGrid from 'ol/tilegrid/TileGrid';
import type { RasterMap } from '../raster/rasterMap';
import { createRasterLayer } from './rasterLayer';
import { MAPANT_3857_URL, MAPANT_ATTRIBUTION, MAPANT_TM35_URL, OSM_ATTRIBUTION, registerProjections } from './layers';

interface LayerBase {
  id: string;
  title: string;
  visible: boolean;
  /** 0..1 */
  opacity: number;
}

export type LayerDesc =
  | (LayerBase & { kind: 'mapant' })
  | (LayerBase & { kind: 'osm' })
  | (LayerBase & { kind: 'raster' })
  | (LayerBase & {
      kind: 'wmts';
      capabilitiesUrl: string;
      capabilitiesXml: string;
      layer: string;
      /** Tile matrix sets offered for the layer, with their CRS codes ("EPSG:3067"). */
      matrixSets: { id: string; crs: string }[];
      attribution: string;
    })
  | (LayerBase & {
      kind: 'wms';
      url: string;
      layers: string;
      version: string;
      crsList: string[];
      format: string;
      attribution: string;
    })
  | (LayerBase & { kind: 'xyz'; url: string; maxZoom: number; attribution: string });

export type LayerKind = LayerDesc['kind'];

let seq = 0;
export const newLayerId = (kind: string) => `${kind}-${Date.now().toString(36)}-${seq++}`;

/** Default stack, bottom first: OSM (hidden, fallback outside MapAnt coverage) and MapAnt. */
export function defaultLayers(): LayerDesc[] {
  return [
    { id: 'osm', kind: 'osm', title: 'OpenStreetMap', visible: false, opacity: 1 },
    { id: 'mapant', kind: 'mapant', title: 'MapAnt (Finland)', visible: true, opacity: 1 },
  ];
}

export function attributionOf(d: LayerDesc): string {
  switch (d.kind) {
    case 'mapant':
      return MAPANT_ATTRIBUTION;
    case 'osm':
      return OSM_ATTRIBUTION;
    case 'raster':
      return '';
    default:
      return d.attribution;
  }
}

/** Credits for all visible layers (to be shown in the UI / video description, not in the frame). */
export function creditsText(layers: LayerDesc[]): string {
  return [
    ...new Set(
      layers
        .filter((l) => l.visible)
        .map(attributionOf)
        .filter(Boolean),
    ),
  ].join(' · ');
}

/** CRS the layer's tiles come in for a view CRS (equal → drawn natively, else reprojected by OL). */
export function sourceCrs(d: LayerDesc, viewCrs: string): string {
  switch (d.kind) {
    case 'mapant':
      return viewCrs === 'EPSG:3067' ? 'EPSG:3067' : 'EPSG:3857';
    case 'osm':
    case 'xyz':
      return 'EPSG:3857';
    case 'raster':
      return viewCrs;
    case 'wmts':
      return pickMatrixSet(d, viewCrs)?.crs ?? viewCrs;
    case 'wms':
      return pickWmsCrs(d, viewCrs) ?? viewCrs;
  }
}

export const isReprojected = (d: LayerDesc, viewCrs: string) => sourceCrs(d, viewCrs) !== viewCrs;

const known = (code: string) => {
  registerProjections();
  return !!getProjection(code);
};

function pickMatrixSet(d: Extract<LayerDesc, { kind: 'wmts' }>, viewCrs: string) {
  return (
    d.matrixSets.find((m) => m.crs === viewCrs) ??
    d.matrixSets.find((m) => m.crs === 'EPSG:3857') ??
    d.matrixSets.find((m) => known(m.crs))
  );
}

function pickWmsCrs(d: Extract<LayerDesc, { kind: 'wms' }>, viewCrs: string): string | null {
  if (d.crsList.includes(viewCrs)) return viewCrs;
  if (d.crsList.includes('EPSG:3857')) return 'EPSG:3857';
  return d.crsList.find(known) ?? null;
}

const capsCache = new Map<string, unknown>();
function parsedCaps(xml: string) {
  let c = capsCache.get(xml);
  if (!c) capsCache.set(xml, (c = new WMTSCapabilities().read(xml)));
  return c;
}

const TM35_EXTENT = [-548576, 6291456, 1548576, 8388608];

/** Creates the OpenLayers layer for a descriptor, or null if it cannot be shown (e.g. no raster). */
export function createOlLayer(d: LayerDesc, viewCrs: string, raster: RasterMap | null): BaseLayer | null {
  registerProjections();
  const common = { visible: d.visible, opacity: d.opacity, preload: 1 } as const;
  let layer: BaseLayer | null = null;
  switch (d.kind) {
    case 'mapant': {
      const tm35 = viewCrs === 'EPSG:3067';
      const source = tm35
        ? new XYZ({
            url: MAPANT_TM35_URL,
            projection: 'EPSG:3067',
            tileGrid: new TileGrid({
              origin: [TM35_EXTENT[0], TM35_EXTENT[3]],
              resolutions: Array.from({ length: 16 }, (_, z) => 8192 / 2 ** z),
              extent: TM35_EXTENT,
              tileSize: 256,
            }),
            crossOrigin: 'anonymous',
            transition: 0,
          })
        : new XYZ({ url: MAPANT_3857_URL, maxZoom: 19, crossOrigin: 'anonymous', transition: 0 });
      layer = new TileLayer({ ...common, source });
      break;
    }
    case 'osm':
      layer = new TileLayer({
        ...common,
        source: new OSM({ crossOrigin: 'anonymous', transition: 0, attributions: [] }),
      });
      break;
    case 'xyz':
      layer = new TileLayer({
        ...common,
        source: new XYZ({ url: d.url, maxZoom: d.maxZoom, crossOrigin: 'anonymous', transition: 0 }),
      });
      break;
    case 'wmts': {
      const set = pickMatrixSet(d, viewCrs);
      if (!set) return null;
      const caps = parsedCaps(d.capabilitiesXml) as {
        Contents?: { Layer?: { Identifier: string; ResourceURL?: { resourceType: string }[] }[] };
      };
      const capLayer = caps.Contents?.Layer?.find((l) => l.Identifier === d.layer);
      // Prefer the REST ResourceURL template when the layer has one: some servers (e.g. MapAnt) only
      // implement that form correctly, while their advertised KVP endpoint does not work.
      const rest = !!capLayer?.ResourceURL?.some((r) => r.resourceType === 'tile');
      const opts = optionsFromCapabilities(caps, {
        layer: d.layer,
        matrixSet: set.id,
        ...(rest ? { requestEncoding: 'REST' as const } : {}),
      });
      if (!opts) return null;
      layer = new TileLayer({ ...common, source: new WMTS({ ...opts, crossOrigin: 'anonymous', transition: 0 }) });
      break;
    }
    case 'wms': {
      const crs = pickWmsCrs(d, viewCrs);
      if (!crs) return null;
      layer = new TileLayer({
        ...common,
        source: new TileWMS({
          url: d.url,
          params: { LAYERS: d.layers, FORMAT: d.format, TRANSPARENT: true, VERSION: d.version },
          projection: crs,
          crossOrigin: 'anonymous',
          transition: 0,
        }),
      });
      break;
    }
    case 'raster':
      if (!raster) return null;
      layer = createRasterLayer(raster, viewCrs);
      layer.setVisible(d.visible);
      layer.setOpacity(d.opacity);
      break;
  }
  layer?.set('descId', d.id);
  return layer;
}
