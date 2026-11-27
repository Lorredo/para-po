import { offsetM } from '../../lib/geo/distance'
import { measurePolyline, pointAlong } from '../../lib/geo/polyline'
import type { SimRoute } from './simRoutes'
import type { LocationProvider } from './types'

export type SimState = {
  routeName: string
  running: boolean
  playing: boolean
  /** Playback multiplier: 10 means 10× real speed. */
  rate: number
  progressM: number
  totalM: number
}

/** Remote control for a simulated ride, readable with useSyncExternalStore. */
export type SimController = {
  getState(): SimState
  subscribe(onChange: () => void): () => void
  play(): void
  pause(): void
  setRate(rate: number): void
  seek(progressM: number): void
}

export type SimulatedProvider = LocationProvider & { controller: SimController }

export type SimulatedProviderOptions = {
  rate?: number
  /** How often a fix is emitted, in real time. Phones give about 1 per second. */
  intervalMs?: number
  accuracyM?: number
  /** Random wobble added to each fix, like real GPS. 0 for exact positions. */
  jitterM?: number
  random?: () => number
}

/**
 * Replays a route as if a phone were riding it, so the whole app can be
 * tested and demoed without travelling. When the route ends, it keeps
 * reporting the last point, the way a phone keeps reporting while you stand still.
 */
export function createSimulatedProvider(
  route: SimRoute,
  {
    rate = 1,
    intervalMs = 1000,
    accuracyM = 8,
    jitterM = 3,
    random = Math.random,
  }: SimulatedProviderOptions = {},
): SimulatedProvider {
  const line = measurePolyline(route.points)
  const listeners = new Set<() => void>()
  let state: SimState = {
    routeName: route.name,
    running: false,
    playing: true,
    rate: sanitizeRate(rate),
    progressM: 0,
    totalM: line.totalM,
  }
  let emit: (() => void) | null = null

  function update(patch: Partial<SimState>) {
    state = { ...state, ...patch }
    listeners.forEach((listener) => listener())
  }

  const controller: SimController = {
    getState: () => state,
    subscribe(onChange) {
      listeners.add(onChange)
      return () => listeners.delete(onChange)
    },
    play: () => update({ playing: true }),
    pause: () => update({ playing: false }),
    setRate: (next) => update({ rate: sanitizeRate(next) }),
    seek(progressM) {
      update({ progressM: clamp(progressM, 0, line.totalM) })
      emit?.()
    },
  }

  return {
    kind: 'simulated',
    controller,
    start(listener) {
      emit = () => {
        const exact = pointAlong(line, state.progressM)
        const wobble = jitterM > 0
        const point = wobble
          ? offsetM(
              exact,
              (random() * 2 - 1) * jitterM,
              (random() * 2 - 1) * jitterM,
            )
          : exact
        const moving = state.playing && state.progressM < line.totalM
        listener.onFix({
          ...point,
          accuracyM,
          timestamp: Date.now(),
          speedMps: moving ? route.speedMps * state.rate : 0,
        })
      }

      update({ running: true })
      emit()

      const timer = setInterval(() => {
        if (state.playing && state.progressM < line.totalM) {
          const stepM = route.speedMps * state.rate * (intervalMs / 1000)
          update({ progressM: Math.min(line.totalM, state.progressM + stepM) })
        }
        emit?.()
      }, intervalMs)

      return () => {
        clearInterval(timer)
        emit = null
        update({ running: false })
      }
    },
  }
}

function clamp(value: number, min: number, max: number): number {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min
}

function sanitizeRate(rate: number): number {
  return Number.isFinite(rate) && rate > 0 ? Math.min(rate, 200) : 1
}
