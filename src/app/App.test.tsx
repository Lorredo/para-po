import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { copy } from '../content/copy'
import type { LatLng } from '../lib/geo/types'
import App from './App'

// Leaflet needs real layout, so the map itself is covered by Playwright.
// Here a stub map lets us drive the "tap" from the test.
vi.mock('../components/map/MapView', () => ({
  MapView: ({
    destination,
    radiusM,
    onDestinationChange,
  }: {
    destination: LatLng | null
    radiusM: number
    onDestinationChange: (next: LatLng) => void
  }) => (
    <button
      type="button"
      data-testid="map"
      data-radius={radiusM}
      data-has-destination={destination !== null}
      onClick={() => onDestinationChange({ lat: 14.6537, lng: 121.0328 })}
    />
  ),
}))

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

  it('sets, shows and clears the stop', () => {
    render(<App />)
    fireEvent.click(screen.getByTestId('map'))

    expect(
      screen.getByRole('heading', { name: copy.setup.destinationTitle }),
    ).toBeInTheDocument()
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
})
