import { createBrowserProvider } from './browserProvider'
import { DEFAULT_SIM_ROUTE, SIM_ROUTES, type SimRoute } from './simRoutes'
import {
  createSimulatedProvider,
  type SimController,
} from './simulatedProvider'
import type { LocationProvider } from './types'

export type LocationSource = {
  provider: LocationProvider
  /** Present only for a simulated ride. */
  sim?: { controller: SimController; route: SimRoute }
}

/**
 * Real GPS by default. `?sim` (or `?sim=edsa`) replays a demo ride instead;
 * `&speed=10` sets the starting playback rate.
 */
export function selectLocationSource(search: string): LocationSource {
  const params = new URLSearchParams(search)
  if (!params.has('sim')) return { provider: createBrowserProvider() }

  const route = SIM_ROUTES[params.get('sim') ?? ''] ?? DEFAULT_SIM_ROUTE
  const rate = Number(params.get('speed') ?? '1')
  const provider = createSimulatedProvider(route, { rate })
  return { provider, sim: { controller: provider.controller, route } }
}
