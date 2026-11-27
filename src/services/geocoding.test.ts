import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildSearchUrl,
  CACHE_MAX_ENTRIES,
  CACHE_STORAGE_KEY,
  CACHE_TTL_MS,
  createGeocoder,
  GeocodeError,
  normalizeQuery,
  parseResults,
  rewriteTransitQuery,
} from './geocoding'
import { createMemoryStore } from './storage'

const CUBAO_RESULTS = [
  {
    place_id: 123,
    lat: '14.6198',
    lon: '121.0537',
    name: 'Araneta City',
    display_name:
      'Araneta City, Cubao, Quezon City, Eastern Manila District, Metro Manila, 1109, Philippines',
  },
  {
    place_id: 456,
    lat: '14.6193',
    lon: '121.0510',
    name: '',
    display_name:
      'Araneta Center-Cubao, Aurora Boulevard, Socorro, Quezon City, Metro Manila, 1109, Philippines',
  },
]

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function setup(options: { minIntervalMs?: number } = {}) {
  const fetch = vi.fn(async (..._args: Parameters<typeof globalThis.fetch>) =>
    jsonResponse(CUBAO_RESULTS),
  )
  const store = createMemoryStore()
  const geocoder = createGeocoder({ fetch, store, ...options })
  return { fetch, store, geocoder }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-27T08:00:00+08:00'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('normalizeQuery', () => {
  it('trims, collapses spaces and lowercases', () => {
    expect(normalizeQuery('  Ayala   MRT ')).toBe('ayala mrt')
  })
})

describe('rewriteTransitQuery', () => {
  it.each([
    ['ayala mrt', 'ayala station'],
    ['cubao lrt 2', 'cubao station'],
    ['cubao lrt-2', 'cubao station'],
    ['buendia mrt station', 'buendia station'],
    ['tutuban pnr', 'tutuban station'],
    ['mrt 3', 'mrt 3'],
    ['sm megamall', 'sm megamall'],
    ['mrt ayala', 'mrt ayala'],
  ])('%s → %s', (input, expected) => {
    expect(rewriteTransitQuery(input)).toBe(expected)
  })

  it('makes "Ayala MRT" and "Ayala Station" share one request', async () => {
    const { fetch, geocoder } = setup()
    await geocoder.search('Ayala MRT')
    await geocoder.search('Ayala Station')
    expect(fetch).toHaveBeenCalledTimes(1)
    const url = new URL(String(fetch.mock.calls[0]![0]))
    expect(url.searchParams.get('q')).toBe('ayala station')
  })
})

describe('buildSearchUrl', () => {
  it('asks Nominatim for Philippine results near Metro Manila', () => {
    const url = new URL(buildSearchUrl('cubao'))
    expect(url.origin + url.pathname).toBe(
      'https://nominatim.openstreetmap.org/search',
    )
    expect(url.searchParams.get('q')).toBe('cubao')
    expect(url.searchParams.get('format')).toBe('jsonv2')
    expect(url.searchParams.get('countrycodes')).toBe('ph')
    expect(url.searchParams.get('viewbox')).toBe('120.90,14.80,121.15,14.35')
    expect(url.searchParams.get('bounded')).toBe('0')
    expect(url.searchParams.get('limit')).toBe('5')
  })
})

describe('parseResults', () => {
  it('maps results and tidies the address', () => {
    expect(parseResults(CUBAO_RESULTS)).toEqual([
      {
        id: '123',
        name: 'Araneta City',
        address: 'Cubao, Quezon City, Eastern Manila District, Metro Manila',
        lat: 14.6198,
        lng: 121.0537,
      },
      {
        id: '456',
        name: 'Araneta Center-Cubao',
        address: 'Aurora Boulevard, Socorro, Quezon City, Metro Manila',
        lat: 14.6193,
        lng: 121.051,
      },
    ])
  })

  it('labels the kinds of place commuters care about', () => {
    const base = { lat: '14.5', lon: '121.0', display_name: 'X, Makati' }
    const kinds = parseResults([
      { ...base, place_id: 1, category: 'railway', type: 'station' },
      { ...base, place_id: 2, category: 'highway', type: 'bus_stop' },
      { ...base, place_id: 3, category: 'shop', type: 'mall' },
      { ...base, place_id: 4, category: 'boundary', type: 'administrative' },
      { ...base, place_id: 5, category: 'amenity', type: 'bank' },
    ]).map((place) => place.kind)
    expect(kinds).toEqual([
      'Train station',
      'Bus stop',
      'Mall',
      'Area',
      undefined,
    ])
  })

  it('skips malformed items', () => {
    expect(
      parseResults([
        null,
        { lat: 'x', lon: '121', display_name: 'Bad' },
        { lat: '14', lon: '121' },
      ]),
    ).toEqual([])
  })

  it('rejects a non-array body', () => {
    expect(() => parseResults({ error: 'nope' })).toThrow(GeocodeError)
  })
})

describe('createGeocoder', () => {
  it('returns no results for short queries without calling the API', async () => {
    const { fetch, geocoder } = setup()
    await expect(geocoder.search(' ab ')).resolves.toEqual([])
    expect(fetch).not.toHaveBeenCalled()
  })

  it('serves repeat queries from the cache, ignoring case and spacing', async () => {
    const { fetch, geocoder } = setup()
    const first = await geocoder.search('Cubao')
    const second = await geocoder.search('  cubao ')
    expect(second).toEqual(first)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('persists the cache so a new session can reuse it', async () => {
    const { fetch, store, geocoder } = setup()
    await geocoder.search('cubao')
    expect(store.data.has(CACHE_STORAGE_KEY)).toBe(true)

    const nextSession = createGeocoder({ fetch, store })
    await nextSession.search('Cubao')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('ignores corrupted cache data', async () => {
    const { fetch, store } = setup()
    store.write(CACHE_STORAGE_KEY, [['cubao', { at: 'soon' }], 'junk'])
    const geocoder = createGeocoder({ fetch, store })
    await geocoder.search('cubao')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('refetches after the cache entry expires', async () => {
    const { fetch, geocoder } = setup()
    await geocoder.search('cubao')
    vi.advanceTimersByTime(CACHE_TTL_MS + 1)
    await geocoder.search('cubao')
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('evicts the least recently used query when full', async () => {
    const { fetch, geocoder } = setup({ minIntervalMs: 0 })
    for (let i = 0; i < CACHE_MAX_ENTRIES; i++) {
      await geocoder.search(`place ${i}`)
    }
    await geocoder.search('place 0') // touch: now most recent
    await geocoder.search('one more') // evicts "place 1"
    fetch.mockClear()

    await geocoder.search('place 0')
    expect(fetch).not.toHaveBeenCalled()
    await geocoder.search('place 1')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('waits at least 1.1 s between API requests', async () => {
    const { fetch, geocoder } = setup()
    await geocoder.search('cubao')
    const second = geocoder.search('ayala')
    await vi.advanceTimersByTimeAsync(1099)
    expect(fetch).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    await second
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('can be cancelled while waiting for its turn', async () => {
    const { fetch, geocoder } = setup()
    await geocoder.search('cubao')
    const controller = new AbortController()
    const pending = geocoder.search('ayala', { signal: controller.signal })
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('reports rate limiting and backs off', async () => {
    const { fetch, geocoder } = setup()
    fetch.mockResolvedValueOnce(jsonResponse({}, 429))
    await expect(geocoder.search('cubao')).rejects.toMatchObject({
      kind: 'rate-limited',
    })

    const retry = geocoder.search('cubao')
    await vi.advanceTimersByTimeAsync(4999)
    expect(fetch).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    await retry
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('reports network and server failures', async () => {
    const { fetch, geocoder } = setup({ minIntervalMs: 0 })
    fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await expect(geocoder.search('cubao')).rejects.toMatchObject({
      kind: 'network',
    })
    fetch.mockResolvedValueOnce(jsonResponse({}, 503))
    await expect(geocoder.search('cubao')).rejects.toMatchObject({
      kind: 'server',
    })
  })

  it('does not cache failures', async () => {
    const { fetch, geocoder } = setup({ minIntervalMs: 0 })
    fetch.mockResolvedValueOnce(jsonResponse({}, 503))
    await expect(geocoder.search('cubao')).rejects.toThrow()
    await expect(geocoder.search('cubao')).resolves.toHaveLength(2)
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})
