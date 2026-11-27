import type { Marker as LeafletMarker } from 'leaflet'
import { useMemo } from 'react'
import {
  Circle,
  MapContainer,
  Marker,
  TileLayer,
  useMapEvents,
} from 'react-leaflet'
import {
  ACTIVE_TILES,
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  MIN_ZOOM,
} from '../../config/map'
import { copy } from '../../content/copy'
import type { LatLng } from '../../lib/geo/types'
import { destinationIcon } from './destinationIcon'

type MapViewProps = {
  destination: LatLng | null
  radiusM: number
  onDestinationChange: (next: LatLng) => void
}

const RADIUS_STYLE = {
  color: '#2A9D8F',
  weight: 2,
  fillColor: '#2A9D8F',
  fillOpacity: 0.15,
}

export function MapView({
  destination,
  radiusM,
  onDestinationChange,
}: MapViewProps) {
  return (
    <MapContainer
      center={[DEFAULT_CENTER.lat, DEFAULT_CENTER.lng]}
      zoom={DEFAULT_ZOOM}
      minZoom={MIN_ZOOM}
      className="h-full w-full"
      aria-label={copy.map.label}
    >
      <TileLayer
        url={ACTIVE_TILES.url}
        attribution={ACTIVE_TILES.attribution}
        maxZoom={ACTIVE_TILES.maxZoom}
      />
      <TapToPick onPick={onDestinationChange} />
      {destination && (
        <>
          <Circle
            center={[destination.lat, destination.lng]}
            radius={radiusM}
            pathOptions={RADIUS_STYLE}
            interactive={false}
          />
          <DestinationMarker
            position={destination}
            onMove={onDestinationChange}
          />
        </>
      )}
    </MapContainer>
  )
}

function TapToPick({ onPick }: { onPick: (next: LatLng) => void }) {
  useMapEvents({
    click(event) {
      onPick({ lat: event.latlng.lat, lng: event.latlng.lng })
    },
  })
  return null
}

function DestinationMarker({
  position,
  onMove,
}: {
  position: LatLng
  onMove: (next: LatLng) => void
}) {
  const eventHandlers = useMemo(
    () => ({
      dragend(event: { target: LeafletMarker }) {
        const { lat, lng } = event.target.getLatLng()
        onMove({ lat, lng })
      },
    }),
    [onMove],
  )

  return (
    <Marker
      position={[position.lat, position.lng]}
      icon={destinationIcon}
      draggable
      autoPan
      title={copy.map.destinationMarker}
      alt={copy.map.destinationMarker}
      eventHandlers={eventHandlers}
    />
  )
}
