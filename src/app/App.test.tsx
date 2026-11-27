import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MapFocusRequest } from '../components/map/MapView'
import { copy } from '../content/copy'
import type { LatLng } from '../lib/geo/types'
import App from './App'

// Leaflet needs real layout, so the map itself is covered by Playwright.
// Here a stub map lets us drive the "tap" and inspect what App passes in.
vi.mock('../components/map/MapView', () => ({
  MapView: ({
    destination,
    radiusM,
    focus,
    onDestinationChange,
  }: {
    destination: LatLng | null
    radiusM: number
    focus: MapFocusRequest | null
    onDestinationChange: (next: LatLng) => void
  }) => (
    <button
      type="button"
      data-testid="map"
      data-radius={radiusM}
      data-has-destination={destination !== null}
      data-focus={focus ? `${focus.center.lat},${focus.center.lng}` : ''}
      onClick={() => onDestinationChange({ lat: 14.6537, lng: 121.0328 })}
    />
  ),
}))

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('App', () => {
  it('shows the Para Po name and tagline', () => {
    render(<App />)
    expect(
      screen.getByRole('heading', { level: 1, name: 'Para Po' }),
    ).toBeInTheDocument()
    expect(screen.getByText(copy.tagline)).toBeInTheDocument()
  })

  it('starts with no stop and a 300 m radius', () => {
    render(<App />)
    expect(
      screen.getByRole('heading', { name: copy.setup.emptyTitle }),
    ).toBeInTheDocument()
    expect(screen.getByRole('slider')).toHaveValue('300')
    expect(screen.getByTestId('map')).toHaveAttribute('data-radius', '300')
  })

  it('sets a dropped pin from a map tap, then clears it', () => {
    render(<App />)
    fireEvent.click(screen.getByTestId('map'))

    expect(screen.getByText(copy.setup.droppedPin)).toBeInTheDocument()
    expect(screen.getByText('14.6537, 121.0328')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: copy.setup.clear }))
    expect(
      screen.getByRole('heading', { name: copy.setup.emptyTitle }),
    ).toBeInTheDocument()
    expect(screen.getByTestId('map')).toHaveAttribute(
      'data-has-destination',
      'false',
    )
  })

  it('passes radius changes to the map', () => {
    render(<App />)
    fireEvent.change(screen.getByRole('slider'), { target: { value: '800' } })
    expect(screen.getByTestId('map')).toHaveAttribute('data-radius', '800')
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
    render(<App />)

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
    expect(screen.getByTestId('map')).toHaveAttribute(
      'data-focus',
      '14.5547,121.0244',
    )

    // Moving the pin by hand drops the place name.
    fireEvent.click(screen.getByTestId('map'))
    expect(screen.getByText(copy.setup.droppedPin)).toBeInTheDocument()
  })
})
