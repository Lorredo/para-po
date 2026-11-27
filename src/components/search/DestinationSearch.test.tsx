import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { copy } from '../../content/copy'
import {
  GeocodeError,
  type Geocoder,
  type Place,
} from '../../services/geocoding'
import { DestinationSearch } from './DestinationSearch'

const ARANETA: Place = {
  id: '123',
  name: 'Araneta City',
  address: 'Cubao, Quezon City, Metro Manila',
  lat: 14.6198,
  lng: 121.0537,
  kind: 'Mall',
}

function fakeGeocoder(impl: Geocoder['search']): Geocoder {
  return { search: vi.fn(impl) }
}

function submit(query: string) {
  fireEvent.change(screen.getByRole('searchbox', { name: copy.search.label }), {
    target: { value: query },
  })
  fireEvent.click(screen.getByRole('button', { name: copy.search.submit }))
}

describe('DestinationSearch', () => {
  it('lists results and picks one', async () => {
    const onPick = vi.fn()
    const geocoder = fakeGeocoder(async () => [ARANETA])
    render(<DestinationSearch geocoder={geocoder} onPick={onPick} />)

    submit('Cubao')
    const result = await screen.findByRole('button', { name: /Araneta City/ })
    expect(result).toHaveTextContent('Mall')
    expect(screen.getByText(copy.search.credit)).toBeInTheDocument()

    fireEvent.click(result)
    expect(onPick).toHaveBeenCalledWith(ARANETA)
    expect(screen.getByRole('searchbox')).toHaveValue('Araneta City')
    expect(screen.queryByRole('button', { name: /Araneta City/ })).toBeNull()
  })

  it('does not call the API for very short queries', () => {
    const geocoder = fakeGeocoder(async () => [])
    render(<DestinationSearch geocoder={geocoder} onPick={() => {}} />)

    submit('ab')
    expect(screen.getAllByText(copy.search.tooShort).length).toBeGreaterThan(0)
    expect(geocoder.search).not.toHaveBeenCalled()
  })

  it('shows a friendly message when nothing matches', async () => {
    render(
      <DestinationSearch
        geocoder={fakeGeocoder(async () => [])}
        onPick={() => {}}
      />,
    )
    submit('zzzzzz')
    expect(
      (await screen.findAllByText(copy.search.noResults)).length,
    ).toBeGreaterThan(0)
  })

  it('explains errors', async () => {
    render(
      <DestinationSearch
        geocoder={fakeGeocoder(async () => {
          throw new GeocodeError('network')
        })}
        onPick={() => {}}
      />,
    )
    submit('Cubao')
    expect(
      (await screen.findAllByText(copy.search.errors.network)).length,
    ).toBeGreaterThan(0)
  })

  it('disables the button while searching', async () => {
    let finish: (places: Place[]) => void = () => {}
    const geocoder = fakeGeocoder(
      () => new Promise<Place[]>((resolve) => (finish = resolve)),
    )
    render(<DestinationSearch geocoder={geocoder} onPick={() => {}} />)

    submit('Cubao')
    expect(
      screen.getByRole('button', { name: copy.search.searching }),
    ).toBeDisabled()

    finish([ARANETA])
    expect(
      await screen.findByRole('button', { name: /Araneta City/ }),
    ).toBeInTheDocument()
  })

  it('closes the results with Escape', async () => {
    render(
      <DestinationSearch
        geocoder={fakeGeocoder(async () => [ARANETA])}
        onPick={() => {}}
      />,
    )
    submit('Cubao')
    await screen.findByRole('button', { name: /Araneta City/ })
    fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Escape' })
    expect(screen.queryByRole('button', { name: /Araneta City/ })).toBeNull()
  })
})
