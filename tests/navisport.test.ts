import { describe, expect, it, vi } from 'vitest';
import {
  fetchResultsFromUrl,
  isNavisportRef,
  parseNavisportRef,
  resolveSlug,
  searchEvents,
} from '../src/lib/results/navisport';

const ID = '04273ade-ae7f-4b51-97d8-3d531e37f39b';
const SLUG = 'stadin-sprintticup-2026-kruunuvuorenranta-11-11';
const ev = { id: ID, name: 'Kruunuvuorenranta', slug: SLUG, begin: '2026-11-11T15:30:00.000Z', state: 'Complete' };

function mockFetch(routes: Record<string, () => Response>) {
  return vi.fn(async (url: string | URL | Request) => {
    const u = String(url);
    const key = Object.keys(routes).find((k) => u.includes(k));
    return key ? routes[key]() : new Response('not found', { status: 404 });
  }) as unknown as typeof fetch;
}
const json = (v: unknown) => () => new Response(JSON.stringify(v), { status: 200 });

describe('Navisport links', () => {
  it('recognises links and ids', () => {
    expect(isNavisportRef(`https://navisport.com/tapahtumat/${SLUG}/tulokset`)).toBe(true);
    expect(isNavisportRef(`navisport.com/events/${ID}`)).toBe(true);
    expect(isNavisportRef(ID)).toBe(true);
    expect(isNavisportRef('https://example.com/results.xml')).toBe(false);
  });

  it('extracts the event id or slug', () => {
    expect(parseNavisportRef(`https://navisport.com/fi/tapahtumat/${SLUG}/tulokset/stydi-a`)).toEqual({ slug: SLUG });
    expect(parseNavisportRef(`https://navisport.com/events/${SLUG}`)).toEqual({ slug: SLUG });
    expect(parseNavisportRef(`https://navisport.com/api/events/${ID.toUpperCase()}/results`)).toEqual({ id: ID });
    expect(parseNavisportRef('https://navisport.com/')).toBeNull();
  });
});

describe('Navisport API', () => {
  it('searches events newest first and maps fields', async () => {
    const f = mockFetch({
      '/api/events?': json({ events: [{ ...ev, parentEvent: { name: 'Cup' }, organisation: { name: 'RaHa' } }] }),
    });
    const list = await searchEvents({ name: 'kruunu', dateFrom: '2026-11-10' }, f);
    expect(list[0]).toMatchObject({ id: ID, parent: 'Cup', organisation: 'RaHa' });
    const url = String((f as unknown as { mock: { calls: string[][] } }).mock.calls[0][0]);
    expect(url).toContain('name=kruunu');
    expect(url).toContain('dateFrom=2026-11-10');
    expect(url).toContain('direction=DESC');
  });

  it('resolves a slug by searching its words', async () => {
    const f = mockFetch({ 'name=kruunuvuorenranta': json({ events: [ev] }), '/api/events?': json({ events: [] }) });
    expect(await resolveSlug(SLUG, f)).toBe(ID);
    await expect(
      resolveSlug('no-such-event-here', mockFetch({ '/api/events?': json({ events: [] }) })),
    ).rejects.toThrow();
  });

  it('fetches IOF XML 3.0 results for a link', async () => {
    const f = mockFetch({
      'name=kruunuvuorenranta': json({ events: [ev] }),
      [`/events/${ID}/results?format=iof-xml-3.0`]: () => new Response('<ResultList/>', { status: 200 }),
    });
    const r = await fetchResultsFromUrl(`https://navisport.com/tapahtumat/${SLUG}/tulokset`, f);
    expect(r).toEqual({ xml: '<ResultList/>', source: `navisport:${ID}` });
  });

  it('reports results that are not public yet', async () => {
    const f = mockFetch({ [`/events/${ID}/results`]: () => new Response('', { status: 403 }) });
    await expect(fetchResultsFromUrl(ID, f)).rejects.toThrow(/not public/);
  });

  it('other URLs are fetched directly; network errors explain CORS', async () => {
    const ok = mockFetch({ 'example.com': () => new Response('<ResultList/>', { status: 200 }) });
    expect((await fetchResultsFromUrl('https://example.com/r.xml', ok)).xml).toBe('<ResultList/>');
    const fail = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    await expect(fetchResultsFromUrl('https://example.com/r.xml', fail)).rejects.toThrow(/CORS/);
    await expect(fetchResultsFromUrl('not a url', ok)).rejects.toThrow(/valid web address/);
  });
});
