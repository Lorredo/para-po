import { useCallback, useState } from 'react'
import { Logo } from '../components/brand/Logo'
import { type MapFocusRequest, MapView } from '../components/map/MapView'
import { DestinationSearch } from '../components/search/DestinationSearch'
import { TripPanel } from '../components/trip/TripPanel'
import { RADIUS_DEFAULT_M } from '../config/trip'
import { copy } from '../content/copy'
import type { Destination } from '../features/trip/types'
import type { LatLng } from '../lib/geo/types'
import type { Place } from '../services/geocoding'

export default function App() {
  const [destination, setDestination] = useState<Destination | null>(null)
  const [radiusM, setRadiusM] = useState(RADIUS_DEFAULT_M)
  const [focus, setFocus] = useState<MapFocusRequest | null>(null)

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

  const clearDestination = useCallback(() => setDestination(null), [])

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
        />
        <DestinationSearch onPick={handleSearchPick} />
      </main>

      <TripPanel
        destination={destination}
        radiusM={radiusM}
        onRadiusChange={setRadiusM}
        onClearDestination={clearDestination}
      />
    </div>
  )
}
