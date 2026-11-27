import { copy } from '../../content/copy'
import type { RideLog } from '../../lib/geo/rideLog'

type RideLogCardProps = {
  log: RideLog
  onDownload: () => void
  onDiscard: () => void
}

/** After a recorded trip: save the log, or throw it away. */
export function RideLogCard({ log, onDownload, onDiscard }: RideLogCardProps) {
  const alarms = log.events.filter((e) => e.type === 'alarm').length
  return (
    <div
      role="status"
      className="space-y-2 rounded-xl bg-navy/10 p-3 text-sm text-ink"
    >
      <p>{copy.record.ready(log.readings.length, alarms)}</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onDownload}
          className="rounded-lg bg-navy px-3 py-1.5 font-semibold text-white focus-visible:ring-2 focus-visible:ring-jeep-yellow focus-visible:outline-none"
        >
          {copy.record.download}
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="rounded-lg px-3 py-1.5 font-semibold text-navy hover:bg-navy/5 focus-visible:ring-2 focus-visible:ring-navy focus-visible:outline-none"
        >
          {copy.record.discard}
        </button>
      </div>
    </div>
  )
}
