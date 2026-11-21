/** WMS / WMTS GetCapabilities fetching and parsing for "Add layer" (STORY-17). */
import { UserError } from '../i18n/core';
import WMSCapabilities from 'ol/format/WMSCapabilities';
import WMTSCapabilities from 'ol/format/WMTSCapabilities';
import { newLayerId, type LayerDesc } from './layerModel';

export interface CapabilityLayer {
  id: string;
  title: string;
  abstract: string;
  desc: LayerDesc;
}

export interface ServiceInfo {
  type: 'WMS' | 'WMTS';
  title: string;
  layers: CapabilityLayer[];
}

/** Normalises "urn:ogc:def:crs:EPSG:6.3:3067", "EPSG:3067", ".../EPSG/0/3857" → "EPSG:3067". */
export function normaliseCrs(s: string): string | null {
  const m = s.match(/EPSG(?::[\d.]*)?:(\d+)$/i) ?? s.match(/EPSG\/\d+\/(\d+)$/i);
  if (m) return m[1] === '900913' || m[1] === '3785' ? 'EPSG:3857' : `EPSG:${m[1]}`;
  if (/CRS:84$/i.test(s)) return 'EPSG:4326';
  return null;
}

function withParams(url: string, service: 'WMS' | 'WMTS'): string {
  if (/request=getcapabilities/i.test(url)) return url;
  const u = new URL(url);
  u.searchParams.set('SERVICE', service);
  u.searchParams.set('REQUEST', 'GetCapabilities');
  return u.toString();
}

/** Parses capabilities XML (detects WMS vs WMTS from the root element). */
export function parseCapabilities(xml: string, url: string): ServiceInfo {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const root = doc.documentElement?.localName ?? '';
  if (doc.getElementsByTagName('parsererror').length) throw new UserError('err.capsNotXml');
  if (root === 'Capabilities') return parseWmts(xml, url);
  if (root === 'WMS_Capabilities' || root === 'WMT_MS_Capabilities') return parseWms(xml, url);
  throw new UserError('err.capsNotService', { root });
}

type Any = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function parseWmts(xml: string, url: string): ServiceInfo {
  const caps = new WMTSCapabilities().read(xml) as Any;
  const sets = new Map<string, string>();
  for (const s of caps.Contents?.TileMatrixSet ?? []) {
    const crs = normaliseCrs(String(s.SupportedCRS ?? ''));
    if (crs) sets.set(s.Identifier, crs);
  }
  const provider = caps.ServiceProvider?.ProviderName ?? caps.ServiceIdentification?.Title ?? '';
  const layers: CapabilityLayer[] = (caps.Contents?.Layer ?? []).map((l: Any) => {
    const matrixSets = (l.TileMatrixSetLink ?? [])
      .map((k: Any) => ({ id: k.TileMatrixSet as string, crs: sets.get(k.TileMatrixSet) ?? '' }))
      .filter((m: { crs: string }) => m.crs);
    return {
      id: l.Identifier,
      title: l.Title || l.Identifier,
      abstract: l.Abstract ?? '',
      desc: {
        id: newLayerId('wmts'),
        kind: 'wmts',
        title: l.Title || l.Identifier,
        visible: true,
        opacity: 1,
        capabilitiesUrl: url,
        capabilitiesXml: xml,
        layer: l.Identifier,
        matrixSets,
        attribution: provider ? `© ${provider}` : '',
      },
    };
  });
  return { type: 'WMTS', title: caps.ServiceIdentification?.Title ?? 'WMTS service', layers };
}

function parseWms(xml: string, url: string): ServiceInfo {
  const caps = new WMSCapabilities().read(xml) as Any;
  const version: string = caps.version ?? '1.3.0';
  const getMap = caps.Capability?.Request?.GetMap;
  const formats: string[] = getMap?.Format ?? [];
  const format = formats.find((f) => f === 'image/png') ?? formats.find((f) => f.startsWith('image/')) ?? 'image/png';
  const base = getMap?.DCPType?.[0]?.HTTP?.Get?.OnlineResource ?? url.replace(/\?.*$/, '');
  const out: CapabilityLayer[] = [];
  const walk = (l: Any, inherited: string[]) => {
    const crs = [...new Set([...(l.CRS ?? l.SRS ?? []), ...inherited])] as string[];
    if (l.Name) {
      const attribution = l.Attribution?.Title
        ? `© ${l.Attribution.Title}`
        : caps.Service?.Title
          ? `© ${caps.Service.Title}`
          : '';
      out.push({
        id: l.Name,
        title: l.Title || l.Name,
        abstract: l.Abstract ?? '',
        desc: {
          id: newLayerId('wms'),
          kind: 'wms',
          title: l.Title || l.Name,
          visible: true,
          opacity: 1,
          url: base,
          layers: l.Name,
          version,
          crsList: crs.map(normaliseCrs).filter((c): c is string => !!c),
          format,
          attribution,
        },
      });
    }
    for (const c of l.Layer ?? []) walk(c, crs);
  };
  if (caps.Capability?.Layer) walk(caps.Capability.Layer, []);
  return { type: 'WMS', title: caps.Service?.Title ?? 'WMS service', layers: out };
}

/** Fetches capabilities: tries the URL as given, then as WMTS, then as WMS. */
export async function fetchCapabilities(url: string): Promise<ServiceInfo> {
  const tries = /request=getcapabilities/i.test(url) ? [url] : [withParams(url, 'WMTS'), withParams(url, 'WMS')];
  let lastError: unknown = null;
  for (const u of tries) {
    try {
      const res = await fetch(u);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return parseCapabilities(await res.text(), u);
    } catch (e) {
      lastError = e;
    }
  }
  const msg = (lastError as Error)?.message ?? 'unknown error';
  throw msg === 'Failed to fetch' ? new UserError('err.capsUnreachable') : new UserError('err.capsRead', { msg });
}
