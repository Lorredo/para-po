/**
 * Captures the README screenshots and demo GIF from a real production build.
 *
 *   npm run media
 *
 * - Builds the app and serves it with `vite preview`.
 * - Search results come from a fixture (no Nominatim requests).
 * - The screen wake lock is stubbed: headless Chrome refuses it, which would
 *   show a warning that real phones don't.
 * - Only a handful of real OpenStreetMap tiles are loaded.
 *
 * Writes docs/screenshots/*.png and docs/demo.gif.
 */
import { execSync, spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import gifenc from 'gifenc'
import { chromium } from 'playwright'
import { PNG } from 'pngjs'

const { GIFEncoder, quantize, applyPalette } = gifenc
const ROOT = fileURLToPath(new URL('..', import.meta.url))
const OUT = fileURLToPath(new URL('../docs/', import.meta.url))
const PORT = 4174
const BASE = `http://localhost:${PORT}`

const AYALA_RESULTS = [
  {
    place_id: 1,
    lat: '14.5492',
    lon: '121.0279',
    name: 'Ayala',
    category: 'railway',
    type: 'station',
    display_name: 'Ayala, EDSA, San Lorenzo, Makati, Metro Manila, Philippines',
  },
  {
    place_id: 2,
    lat: '14.5509',
    lon: '121.0258',
    name: 'Ayala Center',
    category: 'shop',
    type: 'mall',
    display_name:
      'Ayala Center, Ayala Avenue, San Lorenzo, Makati, Metro Manila, Philippines',
  },
]

async function preparePage(context) {
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: {
        request: async () =>
          Object.assign(new EventTarget(), {
            released: false,
            type: 'screen',
            release: async () => {},
          }),
      },
    })
  })
  const page = await context.newPage()
  await page.route('https://nominatim.openstreetmap.org/**', (route) =>
    route.fulfill({ json: AYALA_RESULTS }),
  )
  return page
}

async function settle(page, ms = 1500) {
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(ms)
  // The one-time "can now open without internet" notice isn't what these
  // shots are about.
  const ok = page.getByRole('button', { name: 'OK', exact: true })
  if (await ok.isVisible().catch(() => false)) await ok.click()
}

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(BASE)
      if (res.ok) return
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error('preview server did not start')
}

async function screenshots(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'reduce',
  })
  const page = await preparePage(context)
  const shot = (name) =>
    page.screenshot({ path: `${OUT}screenshots/${name}.png` })

  await page.goto(BASE)
  await settle(page)
  await shot('1-plan')

  await page.getByRole('searchbox').fill('Ayala MRT')
  await page.getByRole('searchbox').press('Enter')
  await page.getByRole('button', { name: /Ayala Center/ }).waitFor()
  await settle(page, 500)
  await shot('2-search')

  await page.goto(`${BASE}/?sim=edsa&speed=10`)
  await page.getByRole('button', { name: 'Set stop: Ayala' }).click()
  await page.getByRole('button', { name: 'Start trip' }).click()
  await settle(page, 400)
  await shot('3-first-trip')
  await page.getByRole('button', { name: 'Got it, start trip' }).click()
  await page.getByRole('slider', { name: 'Ride progress' }).fill('12100')
  await page.getByRole('button', { name: 'Pause' }).click()
  await settle(page, 2500)
  await shot('4-on-the-way')

  await page.getByRole('button', { name: 'Play' }).click()
  await page.getByRole('alertdialog').waitFor({ timeout: 30_000 })
  await settle(page, 600)
  await shot('5-para-po')

  await page.getByRole('button', { name: "I'm getting off" }).click()
  await settle(page, 600)
  await shot('6-safe-travels')
  await context.close()
}

async function demoGif(browser) {
  const width = 360
  const height = 720
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  })
  const page = await preparePage(context)
  const gif = GIFEncoder()
  const frames = []
  const capture = async (delayMs, count = 1) => {
    for (let i = 0; i < count; i++) {
      frames.push({ png: await page.screenshot(), delayMs })
      if (count > 1) await page.waitForTimeout(delayMs)
    }
  }

  await page.goto(`${BASE}/?sim=edsa&speed=10`)
  await settle(page)
  await capture(1200)
  await page.getByRole('button', { name: 'Set stop: Ayala' }).click()
  await settle(page, 1200)
  await capture(1200)
  await page.getByRole('button', { name: 'Start trip' }).click()
  await page.waitForTimeout(300)
  await capture(1600)
  await page.getByRole('button', { name: 'Got it, start trip' }).click()
  await page.getByRole('slider', { name: 'Ride progress' }).fill('11700')
  await settle(page, 1500)
  // The ride: one frame every ~0.4 s until the alarm goes off.
  for (let i = 0; i < 40; i++) {
    await capture(400)
    await page.waitForTimeout(400)
    if (await page.getByRole('alertdialog').isVisible()) break
  }
  await page.waitForTimeout(500)
  await capture(2400)
  await page.getByRole('button', { name: "I'm getting off" }).click()
  await page.waitForTimeout(500)
  await capture(2400)
  await context.close()

  for (const { png, delayMs } of frames) {
    const { data } = PNG.sync.read(png)
    const palette = quantize(data, 256)
    gif.writeFrame(applyPalette(data, palette), width, height, {
      palette,
      delay: delayMs,
    })
  }
  gif.finish()
  await writeFile(`${OUT}demo.gif`, gif.bytes())
  return frames.length
}

await mkdir(`${OUT}screenshots`, { recursive: true })
execSync('npm run build', { cwd: ROOT, stdio: 'inherit' })
const server = spawn(
  'npx',
  ['vite', 'preview', '--port', String(PORT), '--strictPort'],
  {
    cwd: ROOT,
    stdio: 'ignore',
  },
)
const browser = await chromium.launch()
try {
  await waitForServer()
  await screenshots(browser)
  console.log('✓ docs/screenshots/*.png')
  const count = await demoGif(browser)
  console.log(`✓ docs/demo.gif (${count} frames)`)
} finally {
  await browser.close()
  server.kill()
}
