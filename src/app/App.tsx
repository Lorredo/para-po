import { useCallback, useState } from 'react'
import { Logo } from '../components/brand/Logo'
import { MapView } from '../components/map/MapView'
import { TripPanel } from '../components/trip/TripPanel'
import { RADIUS_DEFAULT_M } from '../config/trip'
import { copy } from '../content/copy'
import type { LatLng } from '../lib/geo/types'

export default function App() {
  const [destination, setDestination] = useState<LatLng | null>(null)
  const [radiusM, setRadiusM] = useState(RADIUS_DEFAULT_M)

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
          onDestinationChange={setDestination}
        />
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
