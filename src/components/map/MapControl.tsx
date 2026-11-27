import { Control, type ControlPosition, DomEvent, DomUtil } from 'leaflet'
import { type ReactNode, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMap } from 'react-leaflet'

/**
 * Renders React children as a native Leaflet control, so it stacks neatly
 * with the zoom buttons and taps on it never reach the map.
 */
export function MapControl({
  position,
  children,
}: {
  position: ControlPosition
  children: ReactNode
}) {
  const map = useMap()
  const [container] = useState(() => {
    const element = DomUtil.create('div', 'leaflet-control')
    DomEvent.disableClickPropagation(element)
    DomEvent.disableScrollPropagation(element)
    return element
  })

  useEffect(() => {
    const control = new Control({ position })
    control.onAdd = () => container
    control.addTo(map)
    return () => {
      control.remove()
    }
  }, [map, position, container])

  return createPortal(children, container)
}
