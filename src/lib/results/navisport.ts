/**
 * Navisport public result API (STORY-41): https://navisport.com/api/docs. No key; CORS open. Used to
 * import results by event link / id or by searching events, as IOF XML 3.0 (same parser as files).
 * Only completed events are public. Requests are made on user action only (no polling).
 */
import { UserError } from '../i18n/core';

export const NAVISPORT_API = 'https://navisport.com/api';

export interface NavisportEvent {
  id: string;
  name: string;
  slug: string;
  begin: string;
  /** Parent series/event name, if any (e.g. "Stadin Sprintticup 2026"). */
  parent: string | null;
  organisation: string | null;
  state: string;
}

type Fetch = typeof fetch;

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
/** "events" in the languages of navisport.com routes. */
const EVENTS_WORDS = /^(events|tapahtumat|evenemang|arrangementer)$/i;

/** True if the text is a Navisport link or a bare event id. */
export function isNavisportRef(input: string): boolean {
  const s = input.trim();
  return /(^|\/\/|\.)navisport\.(com|fi)\b/i.test(s) || new RegExp(`^${UUID.source}$`, 'i').test(s);
}

/** Event id or slug from a Navisport event link (`/tapahtumat/<slug>/tulokset/…`) or a bare id. */
export function parseNavisportRef(input: string): { id: string } | { slug: string } | null {
  const s = input.trim();
  const uuid = UUID.exec(s);
  if (uuid) return { id: uuid[0].toLowerCase() };
  let path: string[];
  try {
    path = new URL(/^https?:/i.test(s) ? s : `https://${s}`).pathname.split('/').filter(Boolean);
  } catch {
    return null;
  }
  const i = path.findIndex((p) => EVENTS_WORDS.test(decodeURIComponent(p)));
  const slug = i >= 0 ? path[i + 1] : undefined;
  return slug ? { slug: decodeURIComponent(slug) } : null;
}

const toEvent = (e: Record<string, unknown>): NavisportEvent => ({
  id: String(e.id),
  name: String(e.name ?? ''),
  slug: String(e.slug ?? ''),
  begin: String(e.begin ?? ''),
  parent: ((e.parentEvent as Record<string, unknown> | null)?.name as string) ?? null,
  organisation: ((e.organisation as Record<string, unknown> | null)?.name as string) ?? null,
  state: String(e.state ?? ''),
});

async function getJson(url: string, f: Fetch): Promise<unknown> {
  let res: Response;
  try {
    res = await f(url, { headers: { Accept: 'application/json' } });
  } catch {
    throw new UserError('err.network');
  }
  if (!res.ok) throw new UserError('err.httpStatus', { status: res.status });
  return res.json();
}

/** Public events by (partial) name, optionally within dates (`YYYY-MM-DD`), newest first. */
export async function searchEvents(
  q: { name?: string; dateFrom?: string; dateTo?: string; take?: number },
  f: Fetch = fetch,
): Promise<NavisportEvent[]> {
  const p = new URLSearchParams({ take: String(q.take ?? 50), orderBy: 'begin', direction: 'DESC' });
  if (q.name?.trim()) p.set('name', q.name.trim());
  if (q.dateFrom) p.set('dateFrom', q.dateFrom);
  if (q.dateTo) p.set('dateTo', q.dateTo);
  const data = (await getJson(`${NAVISPORT_API}/events?${p}`, f)) as { events?: Record<string, unknown>[] };
  return (data.events ?? []).map(toEvent);
}

/**
 * Event id for a slug: the API takes ids only, so search by the slug's longest words (at most three
 * requests) and pick the event whose slug matches exactly.
 */
export async function resolveSlug(slug: string, f: Fetch = fetch): Promise<string> {
  const words = [...new Set(slug.split('-').filter((w) => w.length >= 4 && !/^\d+$/.test(w)))]
    .sort((a, b) => b.length - a.length)
    .slice(0, 3);
  for (const w of words) {
    const hit = (await searchEvents({ name: w, take: 200 }, f)).find((e) => e.slug === slug);
    if (hit) return hit.id;
  }
  throw new UserError('err.navisportNotFound');
}

/** Results of an event as IOF XML (3.0 by default). */
export async function fetchEventResultsXml(
  id: string,
  f: Fetch = fetch,
  format: 'iof-xml-3.0' | 'iof-xml-2.0.3' = 'iof-xml-3.0',
): Promise<string> {
  let res: Response;
  try {
    res = await f(`${NAVISPORT_API}/events/${encodeURIComponent(id)}/results?format=${format}`);
  } catch {
    throw new UserError('err.network');
  }
  if (res.status === 403) throw new UserError('err.navisportNotPublic');
  if (res.status === 404) throw new UserError('err.navisportNotFound');
  if (!res.ok) throw new UserError('err.httpStatus', { status: res.status });
  return res.text();
}

/** Results XML from a Navisport link / id, or from any URL serving IOF XML (the server must allow CORS). */
export async function fetchResultsFromUrl(input: string, f: Fetch = fetch): Promise<{ xml: string; source: string }> {
  const s = input.trim();
  if (isNavisportRef(s)) {
    const ref = parseNavisportRef(s);
    if (!ref) throw new UserError('err.navisportLink');
    const id = 'id' in ref ? ref.id : await resolveSlug(ref.slug, f);
    return { xml: await fetchEventResultsXml(id, f), source: `navisport:${id}` };
  }
  let url: URL;
  try {
    url = new URL(s);
  } catch {
    throw new UserError('err.badUrl');
  }
  let res: Response;
  try {
    res = await f(url.href);
  } catch {
    throw new UserError('err.corsOrNetwork');
  }
  if (!res.ok) throw new UserError('err.httpStatus', { status: res.status });
  return { xml: await res.text(), source: url.href };
}
