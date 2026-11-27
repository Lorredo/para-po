import type { ReactNode } from 'react'
import { copy } from '../../content/copy'

type PwaNoticesProps = {
  online: boolean
  /** A new version is waiting. */
  needRefresh: boolean
  /** The app shell is cached and can now open without internet. */
  offlineReady: boolean
  /** Never offer a reload mid-trip: it would stop the alarm. */
  tripActive: boolean
  onUpdate: () => void
  onDismissUpdate: () => void
  onDismissOfflineReady: () => void
}

/** Connection and app-version notices for the top of the trip panel. */
export function PwaNotices({
  online,
  needRefresh,
  offlineReady,
  tripActive,
  onUpdate,
  onDismissUpdate,
  onDismissOfflineReady,
}: PwaNoticesProps) {
  return (
    <>
      {!online && (
        <p role="status" className="rounded-xl bg-ink/10 p-3 text-sm text-ink">
          {copy.pwa.offline}
        </p>
      )}
      {needRefresh && !tripActive && (
        <Notice
          text={copy.pwa.updateReady}
          actions={
            <>
              <Action onClick={onDismissUpdate}>{copy.pwa.later}</Action>
              <Action primary onClick={onUpdate}>
                {copy.pwa.update}
              </Action>
            </>
          }
        />
      )}
      {offlineReady && !needRefresh && (
        <Notice
          text={copy.pwa.offlineReady}
          actions={
            <Action onClick={onDismissOfflineReady}>{copy.pwa.ok}</Action>
          }
        />
      )}
    </>
  )
}

function Notice({ text, actions }: { text: string; actions: ReactNode }) {
  return (
    <div
      role="status"
      className="flex items-center gap-2 rounded-xl bg-navy/10 p-3 text-sm text-ink"
    >
      <p className="min-w-0 flex-1">{text}</p>
      <div className="flex shrink-0 gap-1">{actions}</div>
    </div>
  )
}

function Action({
  children,
  onClick,
  primary = false,
}: {
  children: string
  onClick: () => void
  primary?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-1 font-semibold focus-visible:ring-2 focus-visible:ring-navy focus-visible:outline-none ${
        primary ? 'bg-navy text-white' : 'text-navy hover:bg-navy/5'
      }`}
    >
      {children}
    </button>
  )
}
