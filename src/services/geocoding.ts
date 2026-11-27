import type { LatLng } from '../lib/geo/types'
import { type KeyValueStore, localStore } from './storage'

/**
 * Place search backed by Nominatim (OpenStreetMap).
 *
 * Usage policy (https://operations.osmfoundation.org/policies/nominatim/):
 * - At most 1 request per second. We space requests 1.1 s apart.
 * - No search-as-you-type. The UI only searches on submit.
 * - Cache results. We keep 50 queries for 7 days in memory and localStorage.
 * - Identify the app. Browsers send the Referer header automatically.
 */

export type Place = LatLng & {
  id: string
  name: string
  /** Area context without the country, e.g. "Cubao, Quezon City, Metro Manila". */
  address: string
  /** Friendly kind for commuters, e.g. "Train station". Absent if unknown. */
  kind?: string
}

export type GeocodeErrorKind = 'rate-limited' | 'network' | 'server'

export class GeocodeError extends Error {
  readonly kind: GeocodeErrorKind

  constructor(kind: GeocodeErrorKind) {
    super(`Geocoding failed: ${kind}`)
    this.name = 'GeocodeError'
    this.kind = kind
  }
}

export type Geocoder = {
  search(query: string, options?: { signal?: AbortSignal }): Promise<Place[]>
}

export type GeocoderOptions = {
  fetch: typeof fetch
  store?: KeyValueStore
  minIntervalMs?: number
}

export const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search'
export const MIN_QUERY_LENGTH = 3
export const RESULT_LIMIT = 5
export const CACHE_STORAGE_KEY = 'para-po:geocode-cache:v1'
export const CACHE_MAX_ENTRIES = 50
export const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const DEFAULT_MIN_INTERVAL_MS = 1100
/** After a 429 we stay quiet for a while before trying again. */
const RATE_LIMIT_BACKOFF_MS = 5000
/** Metro Manila (left,top,right,bottom). Ranks nearby places first but doesn't exclude others. */
const METRO_MANILA_VIEWBOX = '120.90,14.80,121.15,14.35'

type CacheEntry = { at: number; places: Place[] }

export function normalizeQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ').toLowerCase()
}

/**
 * Commuters type "Ayala MRT" or "Cubao LRT 2", but Nominatim matches those
 * to the rail line rather than the station. "ayala station" finds the station.
 * A bare line name like "MRT 3" is left alone.
 */
export function rewriteTransitQuery(normalizedQuery: string): string {
  const match = /^(.+?)\s+(?:mrt|lrt|pnr)(?:\s*-?\s*\d+)?(?:\s+station)?$/.exec(
    normalizedQuery,
  )
  return match ? `${match[1]} station` : normalizedQuery
}

/** Cache key and API query for what the user typed. */
function toSearchKey(query: string): string {
  return rewriteTransitQuery(normalizeQuery(query))
}

export function buildSearchUrl(normalizedQuery: string): string {
  const params = new URLSearchParams({
    q: normalizedQuery,
    format: 'jsonv2',
    countrycodes: 'ph',
    viewbox: METRO_MANILA_VIEWBOX,
    bounded: '0',
    limit: String(RESULT_LIMIT),
    'accept-language': 'en',
  })
  return `${NOMINATIM_SEARCH_URL}?${params}`
}

export function createGeocoder({
  fetch: fetchFn,
  store,
  minIntervalMs = DEFAULT_MIN_INTERVAL_MS,
}: GeocoderOptions): Geocoder {
  let cache: Map<string, CacheEntry> | null = null
  let nextSlotAt = 0

  function loadCache(): Map<string, CacheEntry> {
    if (cache) return cache
    cache = new Map()
    const raw = store?.read(CACHE_STORAGE_KEY)
    if (Array.isArray(raw)) {
      for (const record of raw) {
        if (isCacheRecord(record)) cache.set(record[0], record[1])
      }
    }
    return cache
  }

  function getCached(key: string): Place[] | null {
    const entries = loadCache()
    const entry = entries.get(key)
    if (!entry) return null
    entries.delete(key)
    if (Date.now() - entry.at > CACHE_TTL_MS) return null
    entries.set(key, entry) // move to the end: most recently used
    return entry.places
  }

  function setCached(key: string, places: Place[]): void {
    const entries = loadCache()
    entries.delete(key)
    entries.set(key, { at: Date.now(), places })
    while (entries.size > CACHE_MAX_ENTRIES) {
      const oldest = entries.keys().next().value
      if (oldest === undefined) break
      entries.delete(oldest)
    }
    store?.write(CACHE_STORAGE_KEY, [...entries])
  }

  async function waitForSlot(signal?: AbortSignal): Promise<void> {
    const now = Date.now()
    const wait = Math.max(0, nextSlotAt - now)
    nextSlotAt = Math.max(now, nextSlotAt) + minIntervalMs
    if (wait > 0) await delay(wait, signal)
  }

  return {
    async search(query, { signal } = {}) {
      if (normalizeQuery(query).length < MIN_QUERY_LENGTH) return []
      const key = toSearchKey(query)

      const cached = getCached(key)
      if (cached) return cached

      signal?.throwIfAborted()
      await waitForSlot(signal)

      let response: Response
      try {
        response = await fetchFn(buildSearchUrl(key), {
          signal,
          headers: { Accept: 'application/json' },
        })
      } catch (error) {
        if (isAbortError(error)) throw error
        throw new GeocodeError('network')
      }

      if (response.status === 429) {
        nextSlotAt = Math.max(nextSlotAt, Date.now() + RATE_LIMIT_BACKOFF_MS)
        throw new GeocodeError('rate-limited')
      }
      if (!response.ok) throw new GeocodeError('server')

      let body: unknown
      try {
        body = await response.json()
      } catch (error) {
        if (isAbortError(error)) throw error
        throw new GeocodeError('server')
      }

      const places = parseResults(body)
      setCached(key, places)
      return places
    },
  }
}

/** Turn Nominatim jsonv2 results into Places, skipping anything malformed. */
export function parseResults(body: unknown): Place[] {
  if (!Array.isArray(body)) throw new GeocodeError('server')
  const places: Place[] = []
  for (const item of body) {
    if (typeof item !== 'object' || item === null) continue
    const raw = item as Record<string, unknown>
    const lat = Number(raw.lat)
    const lng = Number(raw.lon)
    const displayName =
      typeof raw.display_name === 'string' ? raw.display_name : ''
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !displayName) {
      continue
    }
    const parts = displayName.split(',').map((part) => part.trim())
    const name =
      typeof raw.name === 'string' && raw.name.trim()
        ? raw.name.trim()
        : (parts[0] ?? displayName)
    const kind = kindLabel(raw.category, raw.type)
    places.push({
      id: String(raw.place_id ?? `${lat},${lng}`),
      name,
      address: formatAddress(parts, name),
      lat,
      lng,
      ...(kind ? { kind } : {}),
    })
  }
  return places
}

/** OSM category/type pairs that matter to commuters. */
const KIND_LABELS: Record<string, string> = {
  'railway/station': 'Train station',
  'railway/halt': 'Train station',
  'railway/stop': 'Train station',
  'public_transport/station': 'Station',
  'building/transportation': 'Transport hub',
  'highway/bus_stop': 'Bus stop',
  'amenity/bus_station': 'Bus terminal',
  'amenity/ferry_terminal': 'Ferry terminal',
  'aeroway/aerodrome': 'Airport',
  'shop/mall': 'Mall',
  'amenity/hospital': 'Hospital',
  'amenity/university': 'School',
  'amenity/college': 'School',
  'amenity/school': 'School',
}

function kindLabel(category: unknown, type: unknown): string | undefined {
  if (typeof category !== 'string' || typeof type !== 'string') return
  const label = KIND_LABELS[`${category}/${type}`]
  if (label) return label
  if (category === 'boundary' || category === 'place') return 'Area'
  return undefined
}

function formatAddress(parts: string[], name: string): string {
  const rest = parts[0] === name ? parts.slice(1) : parts
  return rest
    .filter((part) => !/^(philippines|pilipinas)$/i.test(part))
    .filter((part) => !/^\d{4}$/.test(part)) // postal codes add noise
    .join(', ')
}

function isCacheRecord(value: unknown): value is [string, CacheEntry] {
  if (!Array.isArray(value) || value.length !== 2) return false
  const [key, entry] = value as [unknown, unknown]
  if (typeof key !== 'string' || typeof entry !== 'object' || !entry) {
    return false
  }
  const { at, places } = entry as Record<string, unknown>
  return typeof at === 'number' && Array.isArray(places)
}

export function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: unknown }).name === 'AbortError'
  )
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason)
      return
    }
    const onAbort = () => {
      clearTimeout(timer)
      reject(signal?.reason)
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

/** App-wide instance. One shared instance means one shared rate limit. */
export const geocoder: Geocoder = createGeocoder({
  fetch: (...args) => globalThis.fetch(...args),
  store: localStore,
})
