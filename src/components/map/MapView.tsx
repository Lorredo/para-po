import { type Marker as LeafletMarker, latLng, type PointTuple } from 'leaflet'
import { useEffect, useMemo } from 'react'
import {
  Circle,
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
  ZoomControl,
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

/** Ask the map to frame a place. A new object triggers a new move. */
export type MapFocusRequest = {
  center: LatLng
  radiusM: number
}

type MapViewProps = {
  destination: LatLng | null
  radiusM: number
  focus: MapFocusRequest | null
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
  focus,
  onDestinationChange,
}: MapViewProps) {
  return (
    <MapContainer
      center={[DEFAULT_CENTER.lat, DEFAULT_CENTER.lng]}
      zoom={DEFAULT_ZOOM}
      minZoom={MIN_ZOOM}
      zoomControl={false}
      className="h-full w-full"
      aria-label={copy.map.label}
    >
      <TileLayer
        url={ACTIVE_TILES.url}
        attribution={ACTIVE_TILES.attribution}
        maxZoom={ACTIVE_TILES.maxZoom}
      />
      {/* Top-left is taken by the search bar. */}
      <ZoomControl position="bottomright" />
      <TapToPick onPick={onDestinationChange} />
      <MapFocus request={focus} />
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

/** Frames the stop and its alert circle, leaving room for the search bar. */
function MapFocus({ request }: { request: MapFocusRequest | null }) {
  const map = useMap()

  useEffect(() => {
    if (!request) return
    const { center, radiusM } = request
    const bounds = latLng(center.lat, center.lng).toBounds(
      Math.max(radiusM * 3, 600),
    )
    const options = {
      paddingTopLeft: [16, 80] as PointTuple,
      paddingBottomRight: [16, 16] as PointTuple,
      maxZoom: 17,
    }
    const reduceMotion = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    ).matches
    if (reduceMotion) map.fitBounds(bounds, options)
    else map.flyToBounds(bounds, { ...options, duration: 0.8 })
  }, [map, request])

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
