import { expect, type Page, test } from '@playwright/test'

const RESULTS = [
  {
    place_id: 123,
    lat: '14.6198',
    lon: '121.0537',
    name: 'Araneta City',
    display_name:
      'Araneta City, Cubao, Quezon City, Metro Manila, 1109, Philippines',
  },
  {
    place_id: 456,
    lat: '14.6193',
    lon: '121.0510',
    name: 'Araneta Center-Cubao',
    display_name:
      'Araneta Center-Cubao, Aurora Boulevard, Quezon City, Metro Manila, Philippines',
  },
]

/** Never hit the real Nominatim or tile servers from tests. */
async function mockNetwork(page: Page, nominatimRequests: string[]) {
  await page.route('https://tile.openstreetmap.org/**', (route) =>
    route.abort(),
  )
  await page.route('https://nominatim.openstreetmap.org/**', (route) => {
    nominatimRequests.push(route.request().url())
    return route.fulfill({ json: RESULTS })
  })
}

test('search, pick a result, and the map flies to the stop', async ({
  page,
}) => {
  const requests: string[] = []
  await mockNetwork(page, requests)
  await page.goto('/')

  const searchbox = page.getByRole('searchbox', {
    name: 'Search for your stop',
  })
  await searchbox.fill('Cubao')
  await searchbox.press('Enter')

  await page
    .getByRole('button', { name: /Araneta City/ })
    .first()
    .click()

  const panel = page.getByRole('region', { name: 'Trip setup' })
  await expect(panel.getByText('Araneta City')).toBeVisible()
  await expect(panel.getByText('14.6198, 121.0537')).toBeVisible()

  // At the city-wide default zoom a 300 m circle is only ~16 px wide.
  // After flying in to frame the stop it should take up a good part of the map.
  const circle = page.locator('path[fill="#2A9D8F"]')
  await expect
    .poll(async () => (await circle.boundingBox())?.width ?? 0)
    .toBeGreaterThan(80)

  // Once the flight settles, the pin is centred in the *visible* part of the
  // map: 16 px in from the left edge, and clear of the 56 px button column
  // on the right.
  const pin = page.locator('.para-po-pin')
  const map = page.locator('.leaflet-container')
  await expect
    .poll(async () => {
      const [mapBox, pinBox] = await Promise.all([
        map.boundingBox(),
        pin.boundingBox(),
      ])
      if (!mapBox || !pinBox) return Infinity
      const visibleCentreX = mapBox.x + (16 + (mapBox.width - 56)) / 2
      return Math.abs(pinBox.x + pinBox.width / 2 - visibleCentreX)
    })
    .toBeLessThan(8)

  expect(requests).toHaveLength(1)
  const url = new URL(requests[0]!)
  expect(url.searchParams.get('q')).toBe('cubao')
  expect(url.searchParams.get('countrycodes')).toBe('ph')
})

test('repeat searches are served from the cache', async ({ page }) => {
  const requests: string[] = []
  await mockNetwork(page, requests)
  await page.goto('/')

  const searchbox = page.getByRole('searchbox')
  const submit = page.getByRole('button', { name: 'Search' })

  await searchbox.fill('Cubao')
  await submit.click()
  await expect(
    page.getByRole('button', { name: /Araneta City/ }).first(),
  ).toBeVisible()

  await searchbox.fill('  CUBAO ')
  await submit.click()
  await expect(
    page.getByRole('button', { name: /Araneta City/ }).first(),
  ).toBeVisible()

  expect(requests).toHaveLength(1)
})
