import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MapFocusRequest } from '../components/map/MapView'
import { copy } from '../content/copy'
import { offsetM } from '../lib/geo/distance'
import type { LatLng } from '../lib/geo/types'
import { selectLocationSource } from '../services/location/selectSource'
import type { LocationFix } from '../services/location/types'
import { SETTINGS_KEY } from '../services/settings'
import { createMemoryStore } from '../services/storage'
import { createFakeAudio, createFakeVibration } from '../test/fakeAlarm'
import { createFakeProvider } from '../test/fakeLocationProvider'
import { createFakeWakeLock } from '../test/fakeWakeLock'
import App from './App'

// The service worker only exists in a production build.
vi.mock('../features/pwa/useAppUpdate', () => ({
  useAppUpdate: () => ({
    needRefresh: false,
    offlineReady: false,
    update: () => {},
    dismissUpdate: () => {},
    dismissOfflineReady: () => {},
  }),
}))

// Leaflet needs real layout, so the map itself is covered by Playwright.
// Here a stub map lets us drive taps and inspect what App passes in.
vi.mock('../components/map/MapView', () => ({
  MapView: (props: {
    destination: LatLng | null
    radiusM: number
    focus: MapFocusRequest | null
    onDestinationChange: (next: LatLng) => void
    userFix: LocationFix | null
    locateStatus: string
    onLocate: () => void
  }) => (
    <div
      data-testid="map"
      data-radius={props.radiusM}
      data-has-destination={props.destination !== null}
      data-focus={
        props.focus ? `${props.focus.center.lat},${props.focus.center.lng}` : ''
      }
      data-user={
        props.userFix ? `${props.userFix.lat},${props.userFix.lng}` : ''
      }
      data-locate-status={props.locateStatus}
    >
      <button
        type="button"
        onClick={() =>
          props.onDestinationChange({ lat: 14.6537, lng: 121.0328 })
        }
      >
        tap map
      </button>
      <button type="button" onClick={props.onLocate}>
        locate
      </button>
    </div>
  ),
}))

/**
 * Taps Start trip, then the confirming button of whichever sheet appears
 * (first-trip intro, or the location explainer). That second tap is the one
 * that starts the trip.
 */
function tapStartTrip() {
  fireEvent.click(screen.getByRole('button', { name: copy.trip.start }))
  for (const name of [copy.tripIntro.start, copy.location.explainer.allow]) {
    const button = screen.queryByRole('button', { name })
    if (button) fireEvent.click(button)
  }
}

const AYALA = { lat: 14.5492, lng: 121.0279 }
/** Where the stub map's "tap map" button drops the pin. */
const TAPPED = { lat: 14.6537, lng: 121.0328 }
const BUENDIA = { lat: 14.5543, lng: 121.0345 }

function renderApp() {
  const fake = createFakeProvider()
  render(
    <App
      locationSource={{ provider: fake.provider }}
      audio={createFakeAudio().audio}
      vibration={createFakeVibration()}
      wakeLock={createFakeWakeLock()}
      settingsStore={createMemoryStore()}
    />,
  )
  return fake
}

const map = () => screen.getByTestId('map')
const panel = () =>
  screen.getByRole('region', { name: copy.setup.sectionLabel })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('App', () => {
  it('shows the Para Po name and tagline', () => {
    renderApp()
    expect(
      screen.getByRole('heading', { level: 1, name: 'Para Po' }),
    ).toBeInTheDocument()
    expect(screen.getByText(copy.tagline)).toBeInTheDocument()
  })

  it('starts with no stop and a 300 m radius', () => {
    renderApp()
    expect(
      screen.getByRole('heading', { name: copy.setup.emptyTitle }),
    ).toBeInTheDocument()
    expect(screen.getByRole('slider')).toHaveValue('300')
    expect(map()).toHaveAttribute('data-radius', '300')
  })

  it('sets a dropped pin from a map tap, then clears it', () => {
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'tap map' }))

    expect(screen.getByText(copy.setup.droppedPin)).toBeInTheDocument()
    expect(screen.getByText('14.6537, 121.0328')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: copy.setup.clear }))
    expect(
      screen.getByRole('heading', { name: copy.setup.emptyTitle }),
    ).toBeInTheDocument()
    expect(map()).toHaveAttribute('data-has-destination', 'false')
  })

  it('passes radius changes to the map', () => {
    renderApp()
    fireEvent.change(screen.getByRole('slider'), { target: { value: '800' } })
    expect(map()).toHaveAttribute('data-radius', '800')
  })

  it('sets a named stop from search and frames it on the map', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify([
              {
                place_id: 9,
                lat: '14.5547',
                lon: '121.0244',
                name: 'Ayala Station',
                category: 'railway',
                type: 'station',
                display_name:
                  'Ayala Station, EDSA, Makati, Metro Manila, Philippines',
              },
            ]),
          ),
      ),
    )
    renderApp()

    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'Ayala MRT' },
    })
    fireEvent.click(screen.getByRole('button', { name: copy.search.submit }))
    fireEvent.click(
      await screen.findByRole('button', { name: /Ayala Station/ }),
    )

    expect(screen.getByText('Ayala Station', { selector: 'p' })).toBeVisible()
    expect(
      screen.getByText('Train station · 14.5547, 121.0244'),
    ).toBeInTheDocument()
    expect(map()).toHaveAttribute('data-focus', '14.5547,121.0244')

    // Moving the pin by hand drops the place name.
    fireEvent.click(screen.getByRole('button', { name: 'tap map' }))
    expect(screen.getByText(copy.setup.droppedPin)).toBeInTheDocument()
  })

  describe('location', () => {
    it('explains before asking, then tracks and centres on the first fix', () => {
      const fake = renderApp()
      fireEvent.click(screen.getByRole('button', { name: 'locate' }))

      const dialog = screen.getByRole('dialog', {
        name: copy.location.explainer.title,
      })
      expect(fake.provider.start).not.toHaveBeenCalled()

      fireEvent.click(
        within(dialog).getByRole('button', {
          name: copy.location.explainer.allow,
        }),
      )
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(fake.provider.start).toHaveBeenCalledTimes(1)
      expect(screen.getByText(copy.location.locating)).toBeInTheDocument()

      fake.emit(BUENDIA)
      expect(map()).toHaveAttribute('data-user', '14.5543,121.0345')
      expect(map()).toHaveAttribute('data-focus', '14.5543,121.0345')
      expect(map()).toHaveAttribute('data-locate-status', 'tracking')
      expect(screen.queryByText(copy.location.locating)).toBeNull()
    })

    it('"Not now" closes the explainer without asking', () => {
      const fake = renderApp()
      fireEvent.click(screen.getByRole('button', { name: 'locate' }))
      fireEvent.click(
        screen.getByRole('button', { name: copy.location.explainer.notNow }),
      )
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(fake.provider.start).not.toHaveBeenCalled()
    })

    it('shows the live distance to the stop with GPS accuracy', () => {
      const fake = renderApp()
      fireEvent.click(screen.getByRole('button', { name: 'locate' }))
      fireEvent.click(
        screen.getByRole('button', { name: copy.location.explainer.allow }),
      )
      fake.emit(BUENDIA, { accuracyM: 14 })

      // No stop yet: nothing to measure.
      expect(screen.queryByTestId('distance-readout')).toBeNull()

      fireEvent.click(screen.getByRole('button', { name: 'tap map' }))
      fake.emit(AYALA, { accuracyM: 9 })
      const readout = within(panel()).getByTestId('distance-readout')
      // Ayala → the tapped pin (14.6537, 121.0328) is about 11.6 km.
      expect(readout).toHaveTextContent(/^12 km to your stop/)
      expect(readout).toHaveTextContent(copy.location.accuracy(9))
    })

    it('re-centres on the user when tapped while tracking', () => {
      const fake = renderApp()
      fireEvent.click(screen.getByRole('button', { name: 'locate' }))
      fireEvent.click(
        screen.getByRole('button', { name: copy.location.explainer.allow }),
      )
      fake.emit(BUENDIA)
      fireEvent.click(screen.getByRole('button', { name: 'tap map' }))
      expect(map()).toHaveAttribute('data-focus', '14.5543,121.0345')

      fake.emit(AYALA)
      fireEvent.click(screen.getByRole('button', { name: 'locate' }))
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(map()).toHaveAttribute('data-focus', '14.5492,121.0279')
    })

    it('explains how to unblock location, and OK resets', () => {
      const fake = renderApp()
      fireEvent.click(screen.getByRole('button', { name: 'locate' }))
      fireEvent.click(
        screen.getByRole('button', { name: copy.location.explainer.allow }),
      )
      fake.fail('permission-denied')

      const alert = screen.getByRole('alert')
      expect(alert).toHaveTextContent(
        copy.location.errors['permission-denied'].title,
      )
      expect(map()).toHaveAttribute('data-locate-status', 'error')

      fireEvent.click(
        within(alert).getByRole('button', { name: copy.location.dismiss }),
      )
      expect(screen.queryByRole('alert')).toBeNull()
      expect(map()).toHaveAttribute('data-locate-status', 'off')
    })

    it('warns about a weak signal without stopping', () => {
      const fake = renderApp()
      fireEvent.click(screen.getByRole('button', { name: 'locate' }))
      fireEvent.click(
        screen.getByRole('button', { name: copy.location.explainer.allow }),
      )
      fake.emit(AYALA)
      fake.fail('timeout')
      expect(screen.getByText(copy.location.weakSignal)).toBeInTheDocument()
      expect(fake.running).toBe(true)
    })

    it('says when the signal drops, and recovers without any tap', () => {
      const fake = renderApp()
      fireEvent.click(screen.getByRole('button', { name: 'locate' }))
      fireEvent.click(
        screen.getByRole('button', { name: copy.location.explainer.allow }),
      )
      fake.emit(AYALA)
      fake.fail('unavailable')
      expect(screen.getByText(copy.location.signalLost)).toBeInTheDocument()
      expect(screen.queryByRole('alert')).toBeNull()
      expect(map()).toHaveAttribute('data-user', '14.5492,121.0279')

      fake.emit(BUENDIA)
      expect(screen.queryByText(copy.location.signalLost)).toBeNull()
      expect(map()).toHaveAttribute('data-user', '14.5543,121.0345')
    })
  })

  describe('demo ride (?sim)', () => {
    it('skips the explainer and offers ride controls', () => {
      vi.useFakeTimers()
      try {
        render(
          <App
            locationSource={selectLocationSource('?sim')}
            audio={createFakeAudio().audio}
            vibration={createFakeVibration()}
            wakeLock={createFakeWakeLock()}
            settingsStore={createMemoryStore()}
          />,
        )
        fireEvent.click(
          screen.getByRole('button', { name: copy.sim.useStop('Ayala') }),
        )
        expect(within(panel()).getByText('Ayala')).toBeInTheDocument()

        tapStartTrip()
        expect(screen.queryByRole('dialog')).toBeNull()
        expect(map().dataset.user).not.toBe('')
        // North Avenue to Ayala is roughly 12 km by straight line.
        expect(
          within(panel()).getByTestId('distance-readout'),
        ).toHaveTextContent(/km to your stop/)
      } finally {
        vi.useRealTimers()
      }
    })
  })

  describe('alarm', () => {
    it('test alarm: unlocks sound, rings, and "Done" stops it', () => {
      const { audio } = createFakeAudio()
      const vibration = createFakeVibration()
      render(
        <App
          locationSource={{ provider: createFakeProvider().provider }}
          audio={audio}
          vibration={vibration}
          wakeLock={createFakeWakeLock()}
          settingsStore={createMemoryStore()}
        />,
      )

      fireEvent.click(screen.getByRole('button', { name: copy.sound.test }))
      const dialog = screen.getByRole('alertdialog', { name: 'Para po!' })
      expect(dialog).toHaveAccessibleDescription(copy.alarm.body.test)
      expect(audio.unlock).toHaveBeenCalled()
      expect(audio.play).toHaveBeenCalledWith('jeepney', {
        loop: true,
        crescendo: false,
      })
      expect(vibration.start).toHaveBeenCalled()
      // No snooze on a test.
      expect(
        within(dialog).queryByRole('button', { name: copy.alarm.snooze }),
      ).toBeNull()

      fireEvent.click(
        within(dialog).getByRole('button', { name: copy.alarm.done }),
      )
      expect(screen.queryByRole('alertdialog')).toBeNull()
      expect(audio.stop).toHaveBeenCalled()
      expect(vibration.stop).toHaveBeenCalled()
    })

    it('rings with the chosen ringtone', () => {
      const { audio } = createFakeAudio()
      render(
        <App
          locationSource={{ provider: createFakeProvider().provider }}
          audio={audio}
          vibration={createFakeVibration()}
          wakeLock={createFakeWakeLock()}
          settingsStore={createMemoryStore()}
        />,
      )
      fireEvent.change(
        screen.getByRole('combobox', { name: copy.sound.label }),
        {
          target: { value: 'beeps' },
        },
      )
      fireEvent.click(screen.getByRole('button', { name: copy.sound.test }))
      expect(audio.play).toHaveBeenLastCalledWith('beeps', expect.anything())
    })

    it('a dropped pin has no name, so the alarm shows no "where" line', () => {
      renderApp()
      fireEvent.click(screen.getByRole('button', { name: 'tap map' }))
      fireEvent.click(screen.getByRole('button', { name: copy.sound.test }))
      expect(
        within(screen.getByRole('alertdialog')).queryByText(/away/),
      ).toBeNull()
    })

    it('shows the stop name and live distance on the alarm screen', () => {
      vi.useFakeTimers()
      try {
        render(
          <App
            locationSource={selectLocationSource('?sim')}
            audio={createFakeAudio().audio}
            vibration={createFakeVibration()}
            wakeLock={createFakeWakeLock()}
            settingsStore={createMemoryStore()}
          />,
        )
        fireEvent.click(
          screen.getByRole('button', { name: copy.sim.useStop('Ayala') }),
        )
        tapStartTrip()
        fireEvent.click(screen.getByRole('button', { name: copy.sound.test }))
        // The demo ride starts at North Avenue, about 12 km from Ayala.
        expect(
          within(screen.getByRole('alertdialog')).getByText(
            /^Ayala · 1\d km away$/,
          ),
        ).toBeInTheDocument()
      } finally {
        vi.useRealTimers()
      }
    })
  })

  describe('trip', () => {
    /** Everything the trip touches, faked, with its own settings store. */
    function renderTrip({
      wakeLockResult = 'active' as const,
      settingsStore = createMemoryStore(),
    }: {
      wakeLockResult?: 'active' | 'unsupported'
      settingsStore?: ReturnType<typeof createMemoryStore>
    } = {}) {
      const gps = createFakeProvider()
      const { audio } = createFakeAudio()
      const vibration = createFakeVibration()
      const wakeLock = createFakeWakeLock(wakeLockResult)
      const view = render(
        <App
          locationSource={{ provider: gps.provider }}
          audio={audio}
          vibration={vibration}
          wakeLock={wakeLock}
          settingsStore={settingsStore}
        />,
      )
      let t = Date.now()
      /** A GPS reading `northM` m north of the tapped stop, `gapS` after the last. */
      const ride = (northM: number, gapS = 10) => {
        t += gapS * 1000
        gps.emit(offsetM(TAPPED, northM, 0), { timestamp: t, accuracyM: 10 })
      }
      const setStop = () =>
        fireEvent.click(screen.getByRole('button', { name: 'tap map' }))
      const startTrip = tapStartTrip
      return {
        gps,
        audio,
        vibration,
        wakeLock,
        settingsStore,
        ride,
        setStop,
        startTrip,
        ...view,
      }
    }

    it('needs a stop before it can start', () => {
      renderTrip()
      expect(
        screen.getByRole('button', { name: copy.trip.start }),
      ).toBeDisabled()
      expect(screen.getByText(copy.trip.needStop)).toBeInTheDocument()
    })

    it('first trip: explains keeping the app open, then one tap starts everything', () => {
      const { gps, audio, wakeLock, setStop } = renderTrip()
      setStop()
      fireEvent.click(screen.getByRole('button', { name: copy.trip.start }))

      // The first trip explains itself; its button is the starting tap.
      const intro = screen.getByRole('dialog', { name: copy.tripIntro.title })
      expect(intro).toHaveTextContent(copy.tripIntro.keepOpen)
      expect(intro).toHaveTextContent(copy.tripIntro.location)
      expect(gps.provider.start).not.toHaveBeenCalled()
      fireEvent.click(
        within(intro).getByRole('button', { name: copy.tripIntro.start }),
      )
      // The intro covered location, so no second sheet.
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(audio.unlock).toHaveBeenCalled()
      expect(wakeLock.request).toHaveBeenCalled()
      expect(gps.provider.start).toHaveBeenCalled()
      expect(screen.getByText(copy.trip.screenOn)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: copy.trip.end })).toBeVisible()
      expect(
        screen.getByRole('button', { name: copy.setup.clear }),
      ).toBeDisabled()
    })

    it('rings by itself on arrival, and "I\'m getting off" ends the trip', () => {
      const { gps, audio, vibration, wakeLock, ride, setStop, startTrip } =
        renderTrip()
      setStop()
      startTrip()
      for (const n of [900, 800, 700, 600, 500, 400]) ride(n)
      expect(screen.queryByRole('alertdialog')).toBeNull()

      ride(290)
      ride(280)
      const dialog = screen.getByRole('alertdialog', { name: 'Para po!' })
      expect(dialog).toHaveAccessibleDescription(copy.alarm.body.arrived)
      expect(audio.play).toHaveBeenLastCalledWith('jeepney', {
        loop: true,
        crescendo: true,
      })
      expect(vibration.start).toHaveBeenCalled()

      fireEvent.click(
        within(dialog).getByRole('button', { name: copy.alarm.stop }),
      )
      expect(screen.queryByRole('alertdialog')).toBeNull()
      expect(screen.getByText(copy.trip.ended.title)).toBeInTheDocument()
      expect(audio.stop).toHaveBeenCalled()
      expect(wakeLock.release).toHaveBeenCalled()
      expect(gps.running).toBe(false)

      fireEvent.click(
        screen.getByRole('button', { name: copy.trip.ended.done }),
      )
      expect(screen.queryByText(copy.trip.ended.title)).toBeNull()
      expect(
        screen.getByRole('heading', { name: copy.setup.emptyTitle }),
      ).toBeInTheDocument()
    })

    it('says so honestly when the stop was passed between readings', () => {
      const { ride, setStop, startTrip } = renderTrip()
      setStop()
      startTrip()
      // A train with readings 30 s apart (25–37 m/s): none lands inside.
      for (const n of [2250, 1500, 750, -350, -1100]) ride(n, 30)
      expect(screen.getByRole('alertdialog')).toHaveAccessibleDescription(
        copy.alarm.body.passed,
      )
    })

    it('snooze rings again while the trip is on, but not after it ends', () => {
      vi.useFakeTimers()
      try {
        const { audio, ride, setStop, startTrip } = renderTrip()
        setStop()
        startTrip()
        for (const n of [900, 290, 280]) ride(n)
        fireEvent.click(screen.getByRole('button', { name: copy.alarm.snooze }))
        expect(screen.queryByRole('alertdialog')).toBeNull()
        expect(
          screen.getByText(/^Snoozed\. Ringing again in 60 s\.$/),
        ).toBeVisible()

        act(() => vi.advanceTimersByTime(60_000))
        expect(screen.getByRole('alertdialog')).toBeVisible()
        expect(audio.play).toHaveBeenCalledTimes(2)

        // Snooze again, then end the trip: it must stay quiet.
        fireEvent.click(screen.getByRole('button', { name: copy.alarm.snooze }))
        fireEvent.click(screen.getByRole('button', { name: copy.trip.end }))
        act(() => vi.advanceTimersByTime(120_000))
        expect(screen.queryByRole('alertdialog')).toBeNull()
        expect(audio.play).toHaveBeenCalledTimes(2)
      } finally {
        vi.useRealTimers()
      }
    })

    it('"End trip" stops everything without the "Safe travels" screen', () => {
      const { gps, wakeLock, setStop, startTrip } = renderTrip()
      setStop()
      startTrip()
      fireEvent.click(screen.getByRole('button', { name: copy.trip.end }))
      expect(gps.running).toBe(false)
      expect(wakeLock.release).toHaveBeenCalled()
      expect(screen.queryByText(copy.trip.ended.title)).toBeNull()
      expect(
        screen.getByRole('button', { name: copy.trip.start }),
      ).toBeEnabled()
    })

    it('warns when the screen cannot be kept on', async () => {
      const { setStop, startTrip } = renderTrip({
        wakeLockResult: 'unsupported',
      })
      setStop()
      startTrip()
      expect(
        await screen.findByText(copy.trip.wakeLockUnavailable),
      ).toBeInTheDocument()
    })

    it('tells you when the trip starts at the stop', () => {
      const { ride, setStop, startTrip } = renderTrip()
      setStop()
      startTrip()
      ride(50)
      expect(
        screen.getByText(copy.trip.startedNear(copy.trip.yourStop)),
      ).toBeInTheDocument()
      expect(screen.queryByRole('alertdialog')).toBeNull()
    })

    it('shows the intro only once, ever', () => {
      const settingsStore = createMemoryStore()
      const first = renderTrip({ settingsStore })
      first.setStop()
      first.startTrip()
      fireEvent.click(screen.getByRole('button', { name: copy.trip.end }))
      first.unmount()

      const again = renderTrip({ settingsStore })
      again.setStop()
      fireEvent.click(screen.getByRole('button', { name: copy.trip.start }))
      expect(
        screen.queryByRole('dialog', { name: copy.tripIntro.title }),
      ).toBeNull()
    })

    it('"Not now" on the intro starts nothing and asks again next time', () => {
      const { gps, setStop } = renderTrip()
      setStop()
      fireEvent.click(screen.getByRole('button', { name: copy.trip.start }))
      fireEvent.click(
        screen.getByRole('button', { name: copy.tripIntro.cancel }),
      )
      expect(gps.provider.start).not.toHaveBeenCalled()
      fireEvent.click(screen.getByRole('button', { name: copy.trip.start }))
      expect(
        screen.getByRole('dialog', { name: copy.tripIntro.title }),
      ).toBeVisible()
    })

    it('makes the app behind a dialog unreachable (inert)', () => {
      const { setStop } = renderTrip()
      setStop()
      fireEvent.click(screen.getByRole('button', { name: copy.trip.start }))
      expect(
        screen
          .getByRole('heading', { level: 1, name: 'Para Po' })
          .closest('[inert]'),
      ).not.toBeNull()
      fireEvent.click(
        screen.getByRole('button', { name: copy.tripIntro.cancel }),
      )
      expect(document.querySelector('[inert]')).toBeNull()
    })

    it('announces milestones for screen readers on the way in', () => {
      const { ride, setStop, startTrip } = renderTrip()
      setStop()
      startTrip()
      const live = () => screen.getByTestId('trip-announcer').textContent
      ride(1200)
      expect(live()).toBe('')
      ride(950)
      expect(live()).toBe('1 km to your stop')
      ride(600)
      ride(480)
      expect(live()).toBe('500 m to your stop')
    })

    it('offers a demo ride on the start screen', () => {
      renderTrip()
      expect(screen.getByRole('link', { name: copy.demo.try })).toHaveAttribute(
        'href',
        '/?sim=edsa&speed=10',
      )
    })

    it('remembers the radius and ringtone for next time', () => {
      const settingsStore = createMemoryStore()
      const first = renderTrip({ settingsStore })
      fireEvent.change(
        screen.getByRole('slider', { name: copy.radius.label }),
        {
          target: { value: '650' },
        },
      )
      fireEvent.change(
        screen.getByRole('combobox', { name: copy.sound.label }),
        {
          target: { value: 'bell' },
        },
      )
      expect(settingsStore.read(SETTINGS_KEY)).toEqual({
        radiusM: 650,
        ringtoneId: 'bell',
        introSeen: false,
      })
      first.unmount()

      renderTrip({ settingsStore })
      expect(
        screen.getByRole('slider', { name: copy.radius.label }),
      ).toHaveValue('650')
      expect(
        screen.getByRole('combobox', { name: copy.sound.label }),
      ).toHaveValue('bell')
    })
  })
})
