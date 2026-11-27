import { type FormEvent, useEffect, useId, useRef, useState } from 'react'
import { copy } from '../../content/copy'
import {
  geocoder as defaultGeocoder,
  type Geocoder,
  MIN_QUERY_LENGTH,
  normalizeQuery,
  type Place,
} from '../../services/geocoding'
import { type PlaceSearchState, usePlaceSearch } from './usePlaceSearch'

type DestinationSearchProps = {
  onPick: (place: Place) => void
  geocoder?: Geocoder
}

export function DestinationSearch({
  onPick,
  geocoder = defaultGeocoder,
}: DestinationSearchProps) {
  const id = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [tooShort, setTooShort] = useState(false)
  const { state, search, reset } = usePlaceSearch(geocoder)
  const loading = state.status === 'loading'

  // Close the results when the user taps outside (for example, on the map).
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setOpen(true)
    if (normalizeQuery(query).length < MIN_QUERY_LENGTH) {
      setTooShort(true)
      reset()
      return
    }
    setTooShort(false)
    void search(query)
  }

  function handlePick(place: Place) {
    setQuery(place.name)
    setOpen(false)
    reset()
    inputRef.current?.blur() // hides the on-screen keyboard
    onPick(place)
  }

  const message = tooShort ? copy.search.tooShort : statusMessage(state)

  return (
    <div
      ref={rootRef}
      className="pointer-events-auto relative"
      onKeyDown={(event) => {
        if (event.key === 'Escape') setOpen(false)
      }}
    >
      <form
        role="search"
        onSubmit={handleSubmit}
        className="flex gap-2 rounded-2xl bg-white p-1.5 shadow-lg"
      >
        <label htmlFor={id} className="sr-only">
          {copy.search.label}
        </label>
        <input
          ref={inputRef}
          id={id}
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => {
            if (state.status !== 'idle' || tooShort) setOpen(true)
          }}
          placeholder={copy.search.placeholder}
          className="min-w-0 flex-1 rounded-xl px-3 py-2 text-base text-ink placeholder:text-ink/50 focus-visible:ring-2 focus-visible:ring-navy focus-visible:outline-none"
        />
        <button
          type="submit"
          disabled={loading}
          className="shrink-0 rounded-xl bg-jeep-yellow px-4 py-2 font-semibold text-navy hover:brightness-95 focus-visible:ring-2 focus-visible:ring-navy focus-visible:outline-none disabled:opacity-60"
        >
          {loading ? copy.search.searching : copy.search.submit}
        </button>
      </form>

      <p role="status" aria-live="polite" className="sr-only">
        {message}
      </p>

      {open && (tooShort || state.status !== 'idle') && (
        // Floats over whatever is below (e.g. the demo panel).
        <div className="absolute inset-x-0 top-full z-10 mt-2 overflow-hidden rounded-2xl bg-white shadow-lg">
          {state.status === 'done' && state.places.length > 0 && !tooShort ? (
            <>
              <ul
                aria-label={copy.search.resultsFound(state.places.length)}
                className="max-h-[45vh] divide-y divide-ink/10 overflow-y-auto"
              >
                {state.places.map((place) => (
                  <li key={place.id}>
                    <button
                      type="button"
                      onClick={() => handlePick(place)}
                      className="block w-full px-4 py-3 text-left hover:bg-paper focus-visible:bg-paper focus-visible:outline-none"
                    >
                      <span className="flex items-center gap-2">
                        <span className="truncate font-semibold text-navy">
                          {place.name}
                        </span>
                        {place.kind && (
                          <span className="shrink-0 rounded-full bg-route-teal/15 px-2 py-0.5 text-[11px] font-semibold text-route-teal">
                            {place.kind}
                          </span>
                        )}
                      </span>
                      {place.address && (
                        <span className="block truncate text-xs text-ink/70">
                          {place.address}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
              <p className="border-t border-ink/10 px-4 py-2 text-[11px] text-ink/70">
                {copy.search.credit}
              </p>
            </>
          ) : (
            message && (
              <p
                className={`px-4 py-3 text-sm ${state.status === 'error' && !tooShort ? 'text-signal-red' : 'text-ink/80'}`}
              >
                {message}
              </p>
            )
          )}
        </div>
      )}
    </div>
  )
}

function statusMessage(state: PlaceSearchState): string {
  switch (state.status) {
    case 'idle':
      return ''
    case 'loading':
      return copy.search.searching
    case 'done':
      return state.places.length === 0
        ? copy.search.noResults
        : copy.search.resultsFound(state.places.length)
    case 'error':
      return copy.search.errors[state.kind]
  }
}
