import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { AlarmOverlay } from '../components/alarm/AlarmOverlay'
import { SnoozeNotice } from '../components/alarm/SnoozeNotice'
import { Logo } from '../components/brand/Logo'
import {
  type FollowTarget,
  type MapFocusRequest,
  MapView,
} from '../components/map/MapView'
import { DestinationSearch } from '../components/search/DestinationSearch'
import { SimPanel } from '../components/sim/SimPanel'
import { InstallButton } from '../components/pwa/InstallButton'
import { PwaNotices } from '../components/pwa/PwaNotices'
import { LocationExplainer } from '../components/system/LocationExplainer'
import { LocationNotice } from '../components/system/LocationNotice'
import { SoundSettings } from '../components/trip/SoundSettings'
import { TripControls } from '../components/trip/TripControls'
import { TripEndedCard } from '../components/trip/TripEndedCard'
import { TripNotices } from '../components/trip/TripNotices'
import { TripPanel } from '../components/trip/TripPanel'
import { copy } from '../content/copy'
import { useAlarm } from '../features/alarm/useAlarm'
import { useGeolocationPermission } from '../features/location/useGeolocationPermission'
import { useLocationTracking } from '../features/location/useLocationTracking'
import {
  type InstallPromptStore,
  installPrompt as defaultInstallPrompt,
} from '../features/pwa/installPrompt'
import { useAppUpdate } from '../features/pwa/useAppUpdate'
import { useOnlineStatus } from '../features/pwa/useOnlineStatus'
import { useSettings } from '../features/settings/useSettings'
import type { Destination } from '../features/trip/types'
import { useTrip } from '../features/trip/useTrip'
import { haversineM } from '../lib/geo/distance'
import { formatDistance } from '../lib/geo/format'
import type { LatLng } from '../lib/geo/types'
import {
  type AlarmAudio,
  alarmAudio as defaultAlarmAudio,
} from '../services/audio/alarmAudio'
import type { Place } from '../services/geocoding'
import {
  type LocationSource,
  selectLocationSource,
} from '../services/location/selectSource'
import type { KeyValueStore } from '../services/storage'
import {
  vibration as defaultVibration,
  type Vibration,
} from '../services/vibration'
import {
  type ScreenWakeLock,
  screenWakeLock as defaultWakeLock,
} from '../services/wakeLock'

/** Frames about 900 m around the user: street level, with some context. */
const USER_FOCUS_RADIUS_M = 300

type AppProps = {
  /** Injected in tests; defaults to real GPS, or a demo ride with ?sim. */
  locationSource?: LocationSource
  /** Injected in tests; default to the real browser APIs. */
  audio?: AlarmAudio
  vibration?: Vibration
  wakeLock?: ScreenWakeLock
  settingsStore?: KeyValueStore
  installPrompt?: InstallPromptStore
}

export default function App({
  locationSource,
  audio = defaultAlarmAudio,
  vibration = defaultVibration,
  wakeLock = defaultWakeLock,
  settingsStore,
  installPrompt = defaultInstallPrompt,
}: AppProps) {
  const [source] = useState<LocationSource>(
    () => locationSource ?? selectLocationSource(window.location.search),
  )
  const isSim = source.sim !== undefined

  const settings = useSettings(settingsStore)
  const online = useOnlineStatus()
  const appUpdate = useAppUpdate()
  const { radiusM, ringtoneId } = settings
  const [destination, setDestination] = useState<Destination | null>(null)
  const [focus, setFocus] = useState<MapFocusRequest | null>(null)
  const [explainerFor, setExplainerFor] = useState<'locate' | 'trip' | null>(
    null,
  )
  /** Follow mode during a trip; off once the user pans, on again via locate. */
  const [following, setFollowing] = useState(true)

  const location = useLocationTracking(source.provider)
  const permission = useGeolocationPermission(!isSim)
  const { fix, start: startLocation, stop: stopLocation } = location
  const wakeStatus = useSyncExternalStore(
    wakeLock.subscribe,
    wakeLock.getStatus,
  )

  // The alarm and the trip need each other: the trip rings the alarm, and a
  // snoozed alarm only rings again while the trip is still on.
  const tripActiveRef = useRef<() => boolean>(() => false)
  const shouldRingAgain = useCallback(() => tripActiveRef.current(), [])
  const alarm = useAlarm({ audio, vibration, ringtoneId, shouldRingAgain })

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

  const trip = useTrip({
    destination,
    radiusM,
    fix,
    startLocation,
    stopLocation,
    audio,
    wakeLock,
    onAlarm: alarm.ring,
  })
  useEffect(() => {
    tripActiveRef.current = trip.isActive
  }, [trip.isActive])

  /** Explain before the browser asks for location, unless it already decided. */
  const needsExplainer =
    !isSim && permission !== 'granted' && permission !== 'denied'

  const handleLocate = useCallback(() => {
    setFollowing(true)
    if (fix) {
      setFocus({
        center: { lat: fix.lat, lng: fix.lng },
        radiusM: USER_FOCUS_RADIUS_M,
      })
      return
    }
    if (location.status === 'locating') return
    if (needsExplainer) setExplainerFor('locate')
    else startTracking()
  }, [fix, location.status, needsExplainer, startTracking])

  const handleStartTrip = useCallback(() => {
    setFollowing(true)
    // Skip the explainer if location is already running.
    if (needsExplainer && location.status === 'off') setExplainerFor('trip')
    else trip.start()
  }, [needsExplainer, location.status, trip])

  const handleEndTrip = useCallback(() => {
    alarm.stop()
    trip.end()
  }, [alarm, trip])

  /** "I'm getting off": silence the alarm and finish the trip. */
  const handleGettingOff = useCallback(() => {
    alarm.stop()
    trip.finish()
  }, [alarm, trip])

  const handleTestAlarm = useCallback(() => {
    // Unlock inside this tap so the browser lets the sound play.
    void audio.unlock()
    alarm.ring('test')
  }, [audio, alarm])

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

  const handlePlanAnother = useCallback(() => {
    trip.dismiss()
    setDestination(null)
  }, [trip])

  const distanceM = destination && fix ? haversineM(fix, destination) : null
  const follow: FollowTarget | null =
    trip.phase === 'active' && following && fix && destination
      ? { user: fix, stop: destination, radiusM }
      : null
  const ringing = alarm.state.status === 'ringing' ? alarm.state : null

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 bg-navy px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 text-white">
        <Logo size={32} />
        <div>
          <h1 className="text-base leading-tight font-bold">{copy.appName}</h1>
          <p className="text-xs text-white/80">{copy.tagline}</p>
        </div>
        <InstallButton store={installPrompt} />
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
          follow={follow}
          onUserPan={() => setFollowing(false)}
          topInsetPx={isSim ? 210 : 80}
        />
        <DestinationSearch onPick={handleSearchPick} />
        {source.sim && (
          <SimPanel
            controller={source.sim.controller}
            suggestedStop={source.sim.route.suggestedStop}
            onUseStop={handleUseSimStop}
          />
        )}
      </main>

      <TripPanel
        destination={destination}
        radiusM={radiusM}
        onRadiusChange={settings.setRadiusM}
        onClearDestination={clearDestination}
        clearDisabled={trip.phase === 'active'}
        settingsSummary={
          trip.phase === 'active'
            ? copy.trip.settingsSummary(
                formatDistance(radiusM),
                copy.sound.ringtones[ringtoneId],
              )
            : undefined
        }
        distanceM={distanceM}
        accuracyM={fix?.accuracyM ?? null}
        notice={
          <>
            <PwaNotices
              online={online}
              needRefresh={appUpdate.needRefresh}
              offlineReady={appUpdate.offlineReady}
              tripActive={trip.phase === 'active'}
              onUpdate={appUpdate.update}
              onDismissUpdate={appUpdate.dismissUpdate}
              onDismissOfflineReady={appUpdate.dismissOfflineReady}
            />
            {trip.phase === 'ended' && (
              <TripEndedCard onDone={handlePlanAnother} />
            )}
            {alarm.state.status === 'snoozed' && (
              <SnoozeNotice
                until={alarm.state.until}
                onTurnOff={handleGettingOff}
              />
            )}
            {trip.phase === 'active' && (
              <TripNotices
                wakeLock={wakeStatus}
                startedNear={trip.startedNear}
                stopName={destination?.name}
                gpsStale={trip.gpsStale}
                rejectReason={trip.result?.rejectReason}
                accuracyM={fix?.accuracyM ?? null}
              />
            )}
            <LocationNotice
              status={location.status}
              error={location.error}
              onDismiss={location.stop}
            />
          </>
        }
        footer={
          <SoundSettings
            audio={audio}
            ringtoneId={ringtoneId}
            onRingtoneChange={settings.setRingtoneId}
            onTestAlarm={handleTestAlarm}
          />
        }
        actions={
          <TripControls
            phase={trip.phase}
            canStart={destination !== null}
            onStart={handleStartTrip}
            onEnd={handleEndTrip}
          />
        }
      />

      {ringing && (
        <AlarmOverlay
          reason={ringing.reason}
          stopName={destination?.name}
          distanceM={distanceM}
          onStop={ringing.reason === 'test' ? alarm.stop : handleGettingOff}
          onSnooze={ringing.reason === 'test' ? undefined : alarm.snooze}
        />
      )}

      {explainerFor && (
        <LocationExplainer
          onAllow={() => {
            const intent = explainerFor
            setExplainerFor(null)
            // Still inside the tap, so the trip can unlock sound.
            if (intent === 'trip') trip.start()
            else startTracking()
          }}
          onCancel={() => setExplainerFor(null)}
        />
      )}
    </div>
  )
}
