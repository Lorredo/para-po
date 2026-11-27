import type { LatLng } from '../lib/geo/types'

/** Roughly the middle of Metro Manila, so the whole region fits at zoom 12. */
export const DEFAULT_CENTER: LatLng = { lat: 14.5794, lng: 121.0359 }
export const DEFAULT_ZOOM = 12
export const MIN_ZOOM = 5

export type TileProvider = {
  url: string
  attribution: string
  maxZoom: number
}

/**
 * OpenStreetMap standard tiles. Fine for a low-traffic portfolio app as long
 * as we show attribution and never bulk-download or prefetch tiles.
 * https://operations.osmfoundation.org/policies/tiles/
 */
export const OSM_TILES: TileProvider = {
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 19,
}

/**
 * Fallback if OSM ever blocks us or traffic grows: CARTO Voyager.
 * No API key, attribution required.
 */
export const CARTO_VOYAGER_TILES: TileProvider = {
  url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  maxZoom: 20,
}

export const ACTIVE_TILES: TileProvider = OSM_TILES
