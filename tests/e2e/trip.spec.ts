import { expect, type Page, test } from '@playwright/test'

declare global {
  interface Window {
    __wakeLock: { requests: number; releases: number }
  }
}

/**
 * Headless Chromium's real Wake Lock is unpredictable (it may be refused),
 * so record requests with a stand-in. Audio and GPS stay real.
 */
async function prepare(page: Page) {
  await page.addInitScript(() => {
    window.__wakeLock = { requests: 0, releases: 0 }
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: {
        request: async () => {
          window.__wakeLock.requests++
          const sentinel = new EventTarget() as WakeLockSentinel
          Object.assign(sentinel, {
            released: false,
            type: 'screen',
            release: async () => {
              window.__wakeLock.releases++
            },
          })
          return sentinel
        },
      },
    })
  })
  await page.route('https://tile.openstreetmap.org/**', (route) =>
    route.abort(),
  )
  await page.route('https://nominatim.openstreetmap.org/**', (route) =>
    route.fulfill({
      json: [
        {
          place_id: 1,
          lat: '14.5492',
          lon: '121.0279',
          name: 'Ayala',
          category: 'railway',
          type: 'station',
          display_name: 'Ayala, EDSA, Makati, Metro Manila, Philippines',
        },
      ],
    }),
  )
}

const wakeLockCalls = (page: Page) => page.evaluate(() => window.__wakeLock)

test('demo ride: the alarm rings by itself at Ayala', async ({ page }) => {
  await prepare(page)
  await page.goto('/?sim=edsa&speed=10')

  await page.getByRole('button', { name: 'Set stop: Ayala' }).click()
  await page.getByRole('button', { name: 'Start trip' }).click()
  await page.getByRole('button', { name: 'Got it, start trip' }).click()
  await expect(page.getByText('Screen will stay on')).toBeVisible()
  expect((await wakeLockCalls(page)).requests).toBe(1)

  // Jump to about 1 km before Ayala, then ride in at 10× (110 m per second).
  await page.getByRole('slider', { name: 'Ride progress' }).fill('12000')

  // Follow mode: the map moves with the ride, so the dot stays on screen.
  const map = page.locator('.leaflet-container')
  const dot = page.locator('.para-po-user-dot')
  await expect
    .poll(async () => {
      const [m, d] = await Promise.all([map.boundingBox(), dot.boundingBox()])
      if (!m || !d) return false
      return (
        d.x >= m.x &&
        d.x + d.width <= m.x + m.width &&
        d.y >= m.y &&
        d.y + d.height <= m.y + m.height
      )
    })
    .toBe(true)
  // During a trip the settings fold away to give the map room.
  await expect(
    page.getByText(/^Alarm settings · 300 m · Jeepney beep$/),
  ).toBeVisible()
  await expect(
    page.getByRole('slider', { name: 'Alert me within' }),
  ).toBeHidden()

  const alarm = page.getByRole('alertdialog', { name: 'Para po!' })
  await expect(alarm).toBeVisible({ timeout: 20_000 })
  await expect(alarm).toContainText("You're near your stop.")
  await expect(alarm).toContainText(/Ayala · \d+ m away/)

  await alarm.getByRole('button', { name: "I'm getting off" }).click()
  await expect(alarm).toHaveCount(0)
  await expect(page.getByText('Ingat! Safe travels.')).toBeVisible()
  expect((await wakeLockCalls(page)).releases).toBe(1)

  await page.getByRole('button', { name: 'Plan another trip' }).click()
  await expect(page.getByRole('button', { name: 'Start trip' })).toBeDisabled()
})

test.describe('with real GPS (emulated)', () => {
  const STOP = { latitude: 14.5492, longitude: 121.0279 }
  /** A point `northM` meters north of the stop. */
  const north = (northM: number) => ({
    latitude: STOP.latitude + northM / 111_195,
    longitude: STOP.longitude,
  })

  test.use({ permissions: ['geolocation'], geolocation: north(380) })

  test('walking into the radius rings the alarm', async ({ page, context }) => {
    await prepare(page)
    await page.goto('/')

    const search = page.getByRole('searchbox')
    await search.fill('Ayala')
    await search.press('Enter')
    await page.getByRole('button', { name: /Ayala/ }).first().click()

    // Location is already allowed, so no explainer: the tap starts the trip.
    await page.getByRole('button', { name: 'Start trip' }).click()
    await page.getByRole('button', { name: 'Got it, start trip' }).click()
    await expect(page.getByRole('button', { name: 'End trip' })).toBeVisible()
    await expect(page.locator('.para-po-user-dot')).toBeVisible()

    // About 15 m/s: realistic, so no reading is thrown out as a glitch.
    for (const northM of [360, 340, 320, 305, 290, 275, 260]) {
      await page.waitForTimeout(1100)
      await context.setGeolocation(north(northM))
      if (await page.getByRole('alertdialog').isVisible()) break
    }

    const alarm = page.getByRole('alertdialog', { name: 'Para po!' })
    await expect(alarm).toBeVisible({ timeout: 5000 })
    await expect(alarm).toContainText("You're near your stop.")

    // Snooze, then end the trip: it must stay quiet.
    await alarm.getByRole('button', { name: 'Snooze 1 min' }).click()
    await expect(
      page.getByText(/Snoozed\. Ringing again in \d+ s\./),
    ).toBeVisible()
    await page.getByRole('button', { name: 'End trip' }).click()
    await expect(page.getByText(/Snoozed/)).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Start trip' })).toBeEnabled()
  })
})
