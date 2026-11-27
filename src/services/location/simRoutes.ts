import type { Destination } from '../../features/trip/types'
import type { LatLng } from '../../lib/geo/types'

export type SimRoute = {
  id: string
  name: string
  /** Typical speed for this kind of ride, in m/s. */
  speedMps: number
  points: LatLng[]
  /** A sensible stop for demos, partway along the route. */
  suggestedStop: Destination
}

/**
 * Southbound along EDSA, following the MRT-3 stations from North Avenue to
 * Magallanes. Straight lines between stations are close enough for testing.
 * The route runs past Ayala on purpose, so "passed my stop" can be tested.
 */
const EDSA_SOUTHBOUND: SimRoute = {
  id: 'edsa',
  name: 'EDSA southbound (North Ave → Magallanes)',
  speedMps: 11, // about 40 km/h, a good day on the EDSA Busway
  points: [
    { lat: 14.6522, lng: 121.0323 }, // North Avenue
    { lat: 14.6427, lng: 121.0387 }, // Quezon Avenue
    { lat: 14.6352, lng: 121.0433 }, // GMA-Kamuning
    { lat: 14.6195, lng: 121.0511 }, // Araneta Center-Cubao
    { lat: 14.6077, lng: 121.0565 }, // Santolan-Annapolis
    { lat: 14.5878, lng: 121.0567 }, // Ortigas
    { lat: 14.5812, lng: 121.0536 }, // Shaw Boulevard
    { lat: 14.5737, lng: 121.0482 }, // Boni
    { lat: 14.5668, lng: 121.0456 }, // Guadalupe
    { lat: 14.5543, lng: 121.0345 }, // Buendia
    { lat: 14.5492, lng: 121.0279 }, // Ayala
    { lat: 14.542, lng: 121.0195 }, // Magallanes
  ],
  suggestedStop: {
    lat: 14.5492,
    lng: 121.0279,
    name: 'Ayala',
    kind: 'Train station',
  },
}

export const SIM_ROUTES: Record<string, SimRoute> = {
  [EDSA_SOUTHBOUND.id]: EDSA_SOUTHBOUND,
}

export const DEFAULT_SIM_ROUTE = EDSA_SOUTHBOUND
