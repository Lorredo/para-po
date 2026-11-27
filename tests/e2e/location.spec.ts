import { expect, type Page, test } from '@playwright/test'

const BUENDIA = { latitude: 14.5543, longitude: 121.0345 }
const NEAR_AYALA = { latitude: 14.5502, longitude: 121.029 }

const AYALA_RESULT = [
  {
    place_id: 1,
    lat: '14.5492',
    lon: '121.0279',
    name: 'Ayala',
    category: 'railway',
    type: 'station',
    display_name: 'Ayala, EDSA, San Lorenzo, Makati, Metro Manila, Philippines',
  },
]

/** Never hit real tile or search servers from tests. */
async function mockNetwork(page: Page) {
  await page.route('https://tile.openstreetmap.org/**', (route) =>
    route.abort(),
  )
  await page.route('https://nominatim.openstreetmap.org/**', (route) =>
    route.fulfill({ json: AYALA_RESULT }),
  )
}

/** The distance readout as meters, e.g. "850 m" → 850, "1.2 km" → 1200. */
async function readDistanceM(page: Page): Promise<number> {
  const text = await page.getByTestId('distance-readout').innerText()
  const match = /([\d.]+)\s*(km|m)\b/.exec(text)
  if (!match) throw new Error(`No distance in "${text}"`)
  return Number(match[1]) * (match[2] === 'km' ? 1000 : 1)
}

test.describe('with location allowed', () => {
  test.use({ permissions: ['geolocation'], geolocation: BUENDIA })

  test('shows the blue dot and a live distance that updates as you move', async ({
    page,
    context,
  }) => {
    await mockNetwork(page)
    await page.goto('/')

    // Permission is already granted, so no explainer: straight to tracking.
    await page.getByRole('button', { name: 'Show my location' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.locator('.para-po-user-dot')).toBeVisible()
    await expect(page.locator('.para-po-user-accuracy')).toHaveCount(1)
    await expect(
      page.getByRole('button', { name: 'Center on my location' }),
    ).toBeVisible()

    const search = page.getByRole('searchbox')
    await search.fill('Ayala')
    await search.press('Enter')
    await page.getByRole('button', { name: /Ayala/ }).first().click()

    // Buendia → Ayala station is about 900 m.
    await expect(page.getByTestId('distance-readout')).toBeVisible()
    const before = await readDistanceM(page)
    expect(before).toBeGreaterThan(800)
    expect(before).toBeLessThan(1000)

    // "Ride" closer: the watch picks up the new position.
    await context.setGeolocation(NEAR_AYALA)
    await expect.poll(() => readDistanceM(page)).toBeLessThan(200)
  })
})

test('demo ride moves the dot towards the stop', async ({ page }) => {
  await mockNetwork(page)
  await page.goto('/?sim=edsa&speed=50')

  await page.getByRole('button', { name: 'Set stop: Ayala' }).click()
  await page.getByRole('button', { name: 'Start trip' }).click()
  await page.getByRole('button', { name: 'Got it, start trip' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('.para-po-user-dot')).toBeVisible()

  const start = await readDistanceM(page)
  expect(start).toBeGreaterThan(10_000) // North Avenue is ~12 km from Ayala

  // At 50× (550 m per second) the gap closes quickly.
  await expect
    .poll(() => readDistanceM(page), { timeout: 8000 })
    .toBeLessThan(start - 1500)

  await page.getByRole('button', { name: 'Pause' }).click()
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible()
})

test('explains first, then helps when location is blocked', async ({
  page,
  context,
}) => {
  await context.clearPermissions()
  await mockNetwork(page)
  await page.goto('/')

  await page.getByRole('button', { name: 'Show my location' }).click()
  const dialog = page.getByRole('dialog', { name: 'Allow location?' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Allow location' }).click()

  // Headless Chromium answers an ungranted prompt with "denied".
  await expect(page.getByRole('alert')).toContainText('Location is blocked')
  await page.getByRole('alert').getByRole('button', { name: 'OK' }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
})
