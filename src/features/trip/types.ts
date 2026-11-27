import type { LatLng } from '../../lib/geo/types'

/**
 * Where the user wants to get off. `name` and `kind` are set when it came
 * from search, and dropped when the pin is moved by hand.
 */
export type Destination = LatLng & { name?: string; kind?: string }
