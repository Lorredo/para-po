import { divIcon } from 'leaflet'

/**
 * Branded pin as an inline SVG. Using a divIcon also avoids Leaflet's default
 * marker images, whose paths break under bundlers like Vite.
 */
const pinSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="36" height="48" viewBox="0 0 36 48" aria-hidden="true">
  <path d="M18 1C8.6 1 1 8.5 1 17.8 1 30.4 18 47 18 47s17-16.6 17-29.2C35 8.5 27.4 1 18 1z"
        fill="#0B3C5D" stroke="#ffffff" stroke-width="2"/>
  <path d="M18 8.6c-.9 0-1.6.7-1.6 1.6v.5c-3.2.7-5.4 3.5-5.4 6.8v3.8l-1.8 2.2v1h17.6v-1L25 21.3v-3.8c0-3.3-2.2-6.1-5.4-6.8v-.5c0-.9-.7-1.6-1.6-1.6z"
        fill="#FFB703"/>
  <circle cx="18" cy="26.6" r="1.9" fill="#FFB703"/>
</svg>`

export const destinationIcon = divIcon({
  className: 'para-po-pin',
  html: pinSvg,
  iconSize: [36, 48],
  iconAnchor: [18, 47],
})
