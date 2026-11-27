/**
 * Renders the Para Po bell-pin logo to the PNG icons a PWA needs.
 * Uses Playwright's Chromium (already a dev dependency), so no image library.
 *
 *   npm run icons
 *
 * Outputs to public/icons/. The PNGs are committed; re-run only when the
 * logo changes.
 */
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const YELLOW = '#FFB703'
const NAVY = '#0B3C5D'

/** The logo artwork on a 64×64 canvas (same paths as src/components/brand/Logo.tsx). */
const ARTWORK = `
  <path d="M32 8c-9.9 0-18 8-18 17.8C14 39 32 56 32 56s18-17 18-30.2C50 16 41.9 8 32 8z" fill="${NAVY}"/>
  <path d="M32 15.2c-1 0-1.8.8-1.8 1.8v.6c-3.7.8-6.2 4-6.2 7.8v4.3l-2 2.5v1.2h20v-1.2l-2-2.5v-4.3c0-3.8-2.5-7-6.2-7.8V17c0-1-.8-1.8-1.8-1.8z" fill="${YELLOW}"/>
  <circle cx="32" cy="35.6" r="2.2" fill="${YELLOW}"/>
  <path d="M10.5 19.5q-4 6.5 0 13M53.5 19.5q4 6.5 0 13" stroke="${NAVY}" stroke-width="3" stroke-linecap="round" fill="none"/>`

/**
 * @param {object} o
 * @param {boolean} o.rounded  Rounded tile with transparent corners ("any" icons).
 * @param {number} o.scale     Artwork scale around the centre.
 */
function iconSvg({ rounded, scale }) {
  const background = rounded
    ? `<rect width="64" height="64" rx="14" fill="${YELLOW}"/>`
    : `<rect width="64" height="64" fill="${YELLOW}"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    ${background}
    <g transform="translate(32 32) scale(${scale}) translate(-32 -32)">${ARTWORK}</g>
  </svg>`
}

const ICONS = [
  // Regular icons: the logo as-is, transparent rounded corners.
  { file: 'icon-192.png', size: 192, rounded: true, scale: 1 },
  { file: 'icon-512.png', size: 512, rounded: true, scale: 1 },
  // Maskable: full bleed; Android may crop to a circle of 80% diameter,
  // so the artwork is shrunk to sit inside that safe zone.
  { file: 'maskable-512.png', size: 512, rounded: false, scale: 0.78 },
  // Apple touch icon: no transparency (iOS rounds the corners itself).
  { file: 'apple-touch-icon-180.png', size: 180, rounded: false, scale: 0.86 },
]

const outDir = new URL('../public/icons/', import.meta.url)
await mkdir(outDir, { recursive: true })

const browser = await chromium.launch()
try {
  for (const icon of ICONS) {
    const page = await browser.newPage({
      viewport: { width: icon.size, height: icon.size },
    })
    await page.setContent(
      `<html><body style="margin:0;background:transparent">
        <div style="width:${icon.size}px;height:${icon.size}px">${iconSvg(
          icon,
        ).replace(
          '<svg ',
          `<svg width="${icon.size}" height="${icon.size}" `,
        )}</div>
      </body></html>`,
    )
    await page.screenshot({
      // fileURLToPath, not .pathname: the folder name has a space in it.
      path: fileURLToPath(new URL(icon.file, outDir)),
      omitBackground: true,
    })
    await page.close()
    console.log(`✓ public/icons/${icon.file} (${icon.size}×${icon.size})`)
  }
} finally {
  await browser.close()
}
