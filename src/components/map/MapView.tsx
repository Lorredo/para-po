import {
  type Map as LeafletMap,
  type Marker as LeafletMarker,
  latLng,
  latLngBounds,
  type PointTuple,
} from 'leaflet'
import { useEffect, useMemo, useRef } from 'react'
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
import type { TrackingStatus } from '../../features/location/useLocationTracking'
import type { LatLng } from '../../lib/geo/types'
import type { LocationFix } from '../../services/location/types'
import { destinationIcon } from './destinationIcon'
import { LocateButton } from './LocateButton'
import { MapControl } from './MapControl'
import { UserLocationLayer } from './UserLocationLayer'

/** Read once: Leaflet's animation options can't change after creation. */
const prefersReducedMotion =
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)

/** Ask the map to frame a place. A new object triggers a new move. */
export type MapFocusRequest = {
  center: LatLng
  radiusM: number
}

/** During a trip: keep the rider and their stop on screen. */
export type FollowTarget = {
  user: LatLng
  stop: LatLng
  radiusM: number
}

type MapViewProps = {
  destination: LatLng | null
  radiusM: number
  focus: MapFocusRequest | null
  onDestinationChange: (next: LatLng) => void
  userFix: LocationFix | null
  locateStatus: TrackingStatus
  onLocate: () => void
  /** Null when not following (no trip, or the user panned away). */
  follow?: FollowTarget | null
  /** The user dragged the map: stop following until they tap locate. */
  onUserPan?: () => void
  /** Height of whatever floats over the top of the map (search, demo panel). */
  topInsetPx?: number
}

const RADIUS_STYLE = {
  className: 'para-po-radius',
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
  userFix,
  locateStatus,
  onLocate,
  follow = null,
  onUserPan,
  topInsetPx = 80,
}: MapViewProps) {
  return (
    <MapContainer
      center={[DEFAULT_CENTER.lat, DEFAULT_CENTER.lng]}
      zoom={DEFAULT_ZOOM}
      minZoom={MIN_ZOOM}
      zoomControl={false}
      zoomAnimation={!prefersReducedMotion}
      fadeAnimation={!prefersReducedMotion}
      markerZoomAnimation={!prefersReducedMotion}
      className="h-full w-full"
      aria-label={copy.map.label}
    >
      <TileLayer
        url={ACTIVE_TILES.url}
        attribution={ACTIVE_TILES.attribution}
        maxZoom={ACTIVE_TILES.maxZoom}
      />
      {/* Top-left is taken by the search bar. The locate button sits above zoom. */}
      <ZoomControl position="bottomright" />
      <MapControl position="bottomright">
        <LocateButton status={locateStatus} onClick={onLocate} />
      </MapControl>
      <FitContainer />
      <TapToPick onPick={onDestinationChange} onPan={onUserPan} />
      <MapFocus request={focus} topInsetPx={topInsetPx} />
      <KeepInView target={follow} topInsetPx={topInsetPx} />
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
      {userFix && <UserLocationLayer fix={userFix} />}
    </MapContainer>
  )
}

function TapToPick({
  onPick,
  onPan,
}: {
  onPick: (next: LatLng) => void
  onPan?: (() => void) | undefined
}) {
  useMapEvents({
    click(event) {
      onPick({ lat: event.latlng.lat, lng: event.latlng.lng })
    },
    dragstart() {
      onPan?.()
    },
  })
  return null
}

/**
 * Leaflet measures its container once. When the trip panel grows or shrinks,
 * the map's box changes size; tell Leaflet so it fills the new space instead
 * of leaving a grey band.
 */
function FitContainer() {
  const map = useMap()
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(map.getContainer())
    return () => observer.disconnect()
  }, [map])
  return null
}

const reduceMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

/**
 * Padding that keeps framed things clear of the overlays on the map. On a
 * short screen the overlays can be most of the map, so never use more than
 * half its height, or there'd be nothing left to frame into.
 */
function framePadding(map: LeafletMap, topInsetPx: number) {
  const top = Math.min(topInsetPx, map.getSize().y * 0.5)
  return {
    paddingTopLeft: [16, top] as PointTuple,
    paddingBottomRight: [56, 16] as PointTuple, // room for the map buttons
    maxZoom: 17,
  }
}

/** The part of the map not hidden behind the search bar or buttons. */
function visibleBounds(map: LeafletMap, topInsetPx: number) {
  const size = map.getSize()
  const top = Math.min(topInsetPx, size.y * 0.5)
  return latLngBounds(
    map.containerPointToLatLng([16, top]),
    map.containerPointToLatLng([size.x - 56, size.y - 16]),
  )
}

/**
 * Follow mode: when the rider would leave the visible map, re-frame so both
 * they and their stop are on screen. It frames once when following starts,
 * then only moves when needed, so the map isn't constantly sliding.
 */
function KeepInView({
  target,
  topInsetPx,
}: {
  target: FollowTarget | null
  topInsetPx: number
}) {
  const map = useMap()
  const framedRef = useRef(false)

  useEffect(() => {
    if (!target) {
      framedRef.current = false
      return
    }
    const user = latLng(target.user.lat, target.user.lng)
    if (framedRef.current && visibleBounds(map, topInsetPx).contains(user)) {
      return
    }
    framedRef.current = true
    const bounds = latLng(target.stop.lat, target.stop.lng)
      .toBounds(Math.max(target.radiusM * 2.5, 500))
      .extend(user)
    map.fitBounds(bounds, {
      ...framePadding(map, topInsetPx),
      animate: !reduceMotion(),
    })
  }, [map, target, topInsetPx])

  return null
}

/** Frames the stop and its alert circle, leaving room for the search bar. */
function MapFocus({
  request,
  topInsetPx,
}: {
  request: MapFocusRequest | null
  topInsetPx: number
}) {
  const map = useMap()

  useEffect(() => {
    if (!request) return
    const { center, radiusM } = request
    const bounds = latLng(center.lat, center.lng).toBounds(
      Math.max(radiusM * 3, 600),
    )
    const options = framePadding(map, topInsetPx)
    if (reduceMotion()) map.fitBounds(bounds, options)
    else map.flyToBounds(bounds, { ...options, duration: 0.8 })
  }, [map, request, topInsetPx])

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
