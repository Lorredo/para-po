import { copy } from '../../content/copy'
import type { RejectReason } from '../../lib/geo/geofence'
import type { WakeLockStatus } from '../../services/wakeLock'

type TripNoticesProps = {
  wakeLock: WakeLockStatus
  startedNear: boolean
  stopName: string | undefined
  gpsStale: boolean
  rejectReason: RejectReason | undefined
  accuracyM: number | null
}

/** What a rider needs to know while a trip is running, one line each. */
export function TripNotices({
  wakeLock,
  startedNear,
  stopName,
  gpsStale,
  rejectReason,
  accuracyM,
}: TripNoticesProps) {
  const cantKeepAwake = wakeLock === 'unsupported' || wakeLock === 'error'
  const name = stopName ?? copy.trip.yourStop

  return (
    <>
      {cantKeepAwake ? (
        <Warning>{copy.trip.wakeLockUnavailable}</Warning>
      ) : (
        <p
          role="status"
          className="rounded-xl bg-route-teal/10 p-3 text-sm text-ink"
        >
          {copy.trip.screenOn}
        </p>
      )}
      {startedNear && <Info>{copy.trip.startedNear(name)}</Info>}
      {gpsStale && <Warning>{copy.trip.gpsStale}</Warning>}
      {!gpsStale && rejectReason === 'inaccurate' && accuracyM !== null && (
        <Warning>{copy.trip.poorAccuracy(Math.round(accuracyM))}</Warning>
      )}
    </>
  )
}

function Warning({ children }: { children: string }) {
  return (
    <p
      role="status"
      className="rounded-xl bg-jeep-yellow/25 p-3 text-sm text-ink"
    >
      {children}
    </p>
  )
}

function Info({ children }: { children: string }) {
  return (
    <p role="status" className="rounded-xl bg-gps-blue/10 p-3 text-sm text-ink">
      {children}
    </p>
  )
}
