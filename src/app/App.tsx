import { useCallback, useEffect, useRef, useState } from 'react'
import { Logo } from '../components/brand/Logo'
import { type MapFocusRequest, MapView } from '../components/map/MapView'
import { DestinationSearch } from '../components/search/DestinationSearch'
import { SimPanel } from '../components/sim/SimPanel'
import { LocationExplainer } from '../components/system/LocationExplainer'
import { LocationNotice } from '../components/system/LocationNotice'
import { TripPanel } from '../components/trip/TripPanel'
import { RADIUS_DEFAULT_M } from '../config/trip'
import { copy } from '../content/copy'
import { useGeolocationPermission } from '../features/location/useGeolocationPermission'
import { useLocationTracking } from '../features/location/useLocationTracking'
import type { Destination } from '../features/trip/types'
import { haversineM } from '../lib/geo/distance'
import type { LatLng } from '../lib/geo/types'
import type { Place } from '../services/geocoding'
import {
  type LocationSource,
  selectLocationSource,
} from '../services/location/selectSource'

/** Frames about 900 m around the user: street level, with some context. */
const USER_FOCUS_RADIUS_M = 300

type AppProps = {
  /** Injected in tests; defaults to real GPS, or a demo ride with ?sim. */
  locationSource?: LocationSource
}

export default function App({ locationSource }: AppProps) {
  const [source] = useState<LocationSource>(
    () => locationSource ?? selectLocationSource(window.location.search),
  )
  const isSim = source.sim !== undefined

  const [destination, setDestination] = useState<Destination | null>(null)
  const [radiusM, setRadiusM] = useState(RADIUS_DEFAULT_M)
  const [focus, setFocus] = useState<MapFocusRequest | null>(null)
  const [explainerOpen, setExplainerOpen] = useState(false)

  const location = useLocationTracking(source.provider)
  const permission = useGeolocationPermission(!isSim)
  const { fix, start: startLocation } = location

  // Centre on the user once per tracking session, on the first fix.
  const centeredRef = useRef(false)
  useEffect(() => {
    if (!fix || centeredRef.current) return
    centeredRef.current = true
    setFocus({
      center: { lat: fix.lat, lng: fix.lng },
      radiusM: USER_FOCUS_RADIUS_M,
    })
  }, [fix])

  const startTracking = useCallback(() => {
    centeredRef.current = false
    startLocation()
  }, [startLocation])

  const handleLocate = useCallback(() => {
    if (fix) {
      setFocus({
        center: { lat: fix.lat, lng: fix.lng },
        radiusM: USER_FOCUS_RADIUS_M,
      })
      return
    }
    if (location.status === 'locating') return
    // Explain first when the browser is about to ask. If it already decided,
    // start straight away: denied shows the "blocked" help.
    if (isSim || permission === 'granted' || permission === 'denied') {
      startTracking()
    } else {
      setExplainerOpen(true)
    }
  }, [fix, isSim, location.status, permission, startTracking])

  // A tapped or dragged pin is no longer the named place from search.
  const handleMapPick = useCallback((point: LatLng) => {
    setDestination({ lat: point.lat, lng: point.lng })
  }, [])

  const handleSearchPick = useCallback(
    (place: Place) => {
      const center = { lat: place.lat, lng: place.lng }
      setDestination({ ...center, name: place.name, kind: place.kind })
      setFocus({ center, radiusM })
    },
    [radiusM],
  )

  const handleUseSimStop = useCallback(
    (stop: Destination) => {
      setDestination(stop)
      setFocus({ center: { lat: stop.lat, lng: stop.lng }, radiusM })
    },
    [radiusM],
  )

  const clearDestination = useCallback(() => setDestination(null), [])

  const distanceM = destination && fix ? haversineM(fix, destination) : null

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 bg-navy px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 text-white">
        <Logo size={32} />
        <div>
          <h1 className="text-base leading-tight font-bold">{copy.appName}</h1>
          <p className="text-xs text-white/80">{copy.tagline}</p>
        </div>
      </header>

      <main className="relative min-h-0 flex-1">
        <MapView
          destination={destination}
          radiusM={radiusM}
          focus={focus}
          onDestinationChange={handleMapPick}
          userFix={fix}
          locateStatus={location.status}
          onLocate={handleLocate}
        />
        <DestinationSearch onPick={handleSearchPick} />
        {source.sim && (
          <SimPanel
            controller={source.sim.controller}
            suggestedStop={source.sim.route.suggestedStop}
            onStart={startTracking}
            onUseStop={handleUseSimStop}
          />
        )}
      </main>

      <TripPanel
        destination={destination}
        radiusM={radiusM}
        onRadiusChange={setRadiusM}
        onClearDestination={clearDestination}
        distanceM={distanceM}
        accuracyM={fix?.accuracyM ?? null}
        notice={
          <LocationNotice
            status={location.status}
            error={location.error}
            onDismiss={location.stop}
          />
        }
      />

      {explainerOpen && (
        <LocationExplainer
          onAllow={() => {
            setExplainerOpen(false)
            startTracking()
          }}
          onCancel={() => setExplainerOpen(false)}
        />
      )}
    </div>
  )
}
