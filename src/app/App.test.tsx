import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MapFocusRequest } from '../components/map/MapView'
import { copy } from '../content/copy'
import type { LatLng } from '../lib/geo/types'
import { selectLocationSource } from '../services/location/selectSource'
import type { LocationFix } from '../services/location/types'
import { createFakeAudio, createFakeVibration } from '../test/fakeAlarm'
import { createFakeProvider } from '../test/fakeLocationProvider'
import App from './App'

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

const AYALA = { lat: 14.5492, lng: 121.0279 }
const BUENDIA = { lat: 14.5543, lng: 121.0345 }

function renderApp() {
  const fake = createFakeProvider()
  render(
    <App
      locationSource={{ provider: fake.provider }}
      audio={createFakeAudio().audio}
      vibration={createFakeVibration()}
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
          />,
        )
        fireEvent.click(
          screen.getByRole('button', { name: copy.sim.useStop('Ayala') }),
        )
        expect(within(panel()).getByText('Ayala')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: copy.sim.start }))
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
          />,
        )
        fireEvent.click(
          screen.getByRole('button', { name: copy.sim.useStop('Ayala') }),
        )
        fireEvent.click(screen.getByRole('button', { name: copy.sim.start }))
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
})
