import { useCallback, useEffect, useRef, useState } from 'react'
import {
  GeocodeError,
  type GeocodeErrorKind,
  type Geocoder,
  isAbortError,
  type Place,
} from '../../services/geocoding'

export type PlaceSearchState =
  | { status: 'idle' }
  | { status: 'loading'; query: string }
  | { status: 'done'; query: string; places: Place[] }
  | { status: 'error'; query: string; kind: GeocodeErrorKind }

/**
 * Runs one search at a time. Starting a new search cancels the previous one,
 * so slow responses can never overwrite newer results.
 */
export function usePlaceSearch(geocoder: Geocoder) {
  const [state, setState] = useState<PlaceSearchState>({ status: 'idle' })
  const controllerRef = useRef<AbortController | null>(null)

  const search = useCallback(
    async (query: string) => {
      controllerRef.current?.abort()
      const controller = new AbortController()
      controllerRef.current = controller
      setState({ status: 'loading', query })

      try {
        const places = await geocoder.search(query, {
          signal: controller.signal,
        })
        if (!controller.signal.aborted) {
          setState({ status: 'done', query, places })
        }
      } catch (error) {
        if (controller.signal.aborted || isAbortError(error)) return
        setState({
          status: 'error',
          query,
          kind: error instanceof GeocodeError ? error.kind : 'server',
        })
      }
    },
    [geocoder],
  )

  const reset = useCallback(() => {
    controllerRef.current?.abort()
    controllerRef.current = null
    setState({ status: 'idle' })
  }, [])

  useEffect(() => () => controllerRef.current?.abort(), [])

  return { state, search, reset }
}
