import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  // Be a good OSM citizen: tests never download real tiles.
  await page.route('https://tile.openstreetmap.org/**', (route) =>
    route.abort(),
  )
  await page.goto('/')
})

test('shows the map with OpenStreetMap attribution', async ({ page }) => {
  await expect(page.locator('.leaflet-container')).toBeVisible()
  await expect(page.getByRole('link', { name: 'OpenStreetMap' })).toBeVisible()
})

test('tap sets the stop, slider resizes the circle, clear removes it', async ({
  page,
}) => {
  const map = page.locator('.leaflet-container')
  const pin = page.locator('.para-po-pin')
  const circle = page.locator('path[fill="#2A9D8F"]')

  await expect(pin).toHaveCount(0)
  await map.click({ position: { x: 150, y: 150 } })

  await expect(pin).toBeVisible()
  await expect(circle).toHaveCount(1)
  await expect(page.getByRole('heading', { name: 'Your stop' })).toBeVisible()

  const before = await circle.boundingBox()
  await page.getByRole('slider', { name: 'Alert me within' }).fill('1500')
  await expect(page.locator('output')).toHaveText('1.5 km')
  await expect
    .poll(async () => (await circle.boundingBox())?.width ?? 0)
    .toBeGreaterThan((before?.width ?? 0) * 3)

  // Tapping somewhere else moves the pin rather than adding a second one.
  await map.click({ position: { x: 250, y: 300 } })
  await expect(pin).toHaveCount(1)

  await page.getByRole('button', { name: 'Clear' }).click()
  await expect(pin).toHaveCount(0)
  await expect(circle).toHaveCount(0)
})
