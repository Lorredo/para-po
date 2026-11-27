import { Circle, CircleMarker } from 'react-leaflet'
import type { LocationFix } from '../../services/location/types'

const GPS_BLUE = '#1A73E8'

/** The familiar blue dot, with a halo showing how sure the GPS is. */
export function UserLocationLayer({ fix }: { fix: LocationFix }) {
  const center: [number, number] = [fix.lat, fix.lng]
  return (
    <>
      <Circle
        center={center}
        radius={fix.accuracyM}
        interactive={false}
        pathOptions={{
          className: 'para-po-user-accuracy',
          color: GPS_BLUE,
          weight: 1,
          opacity: 0.4,
          fillColor: GPS_BLUE,
          fillOpacity: 0.12,
        }}
      />
      <CircleMarker
        center={center}
        radius={8}
        interactive={false}
        pathOptions={{
          className: 'para-po-user-dot',
          color: '#ffffff',
          weight: 3,
          fillColor: GPS_BLUE,
          fillOpacity: 1,
        }}
      />
    </>
  )
}
