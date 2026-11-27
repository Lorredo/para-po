import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'

/**
 * Automated accessibility audit (axe-core, WCAG 2.1 A and AA) of the main
 * screens, in real Chromium. Automated checks catch roughly a third of
 * issues; the rest needs manual testing with a screen reader.
 */
async function audit(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    // Map tiles are third-party images drawn by Leaflet.
    .exclude('.leaflet-tile-container')
    .analyze()
  return results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    nodes: v.nodes.map((n) => n.target.join(' ')),
  }))
}

test.beforeEach(async ({ page }) => {
  await page.route('https://tile.openstreetmap.org/**', (route) =>
    route.abort(),
  )
})

test('start screen has no detectable accessibility violations', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Start trip' })).toBeVisible()
  expect(await audit(page)).toEqual([])
})

test('trip, intro and alarm screens have none either', async ({ page }) => {
  await page.goto('/?sim=edsa&speed=10')
  await page.getByRole('button', { name: 'Set stop: Ayala' }).click()

  await page.getByRole('button', { name: 'Start trip' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  expect(await audit(page), 'first-trip intro').toEqual([])

  await page.getByRole('button', { name: 'Got it, start trip' }).click()
  await expect(page.getByRole('button', { name: 'End trip' })).toBeVisible()
  expect(await audit(page), 'trip running').toEqual([])

  await page.getByText(/^Alarm settings/).click() // a <summary>, not a button
  await page.getByRole('button', { name: 'Test alarm' }).click()
  await expect(page.getByRole('alertdialog')).toBeVisible()
  expect(await audit(page), 'alarm screen').toEqual([])
})

test.describe('short screens (iPhone SE size)', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test('the map stays usable and Start trip stays reachable', async ({
    page,
  }) => {
    await page.goto('/?sim=edsa&speed=10')
    await page.getByRole('button', { name: 'Set stop: Ayala' }).click()

    const map = await page.locator('.leaflet-container').boundingBox()
    expect(map!.height).toBeGreaterThan(667 * 0.3)

    // Start trip is on screen without scrolling the page.
    const start = page.getByRole('button', { name: 'Start trip' })
    await expect(start).toBeInViewport()
    // And the page itself never scrolls: the panel scrolls inside instead.
    expect(
      await page.evaluate(
        () => document.documentElement.scrollHeight <= window.innerHeight,
      ),
    ).toBe(true)
  })

  test('during a demo trip the rider stays visible, not under the controls', async ({
    page,
  }) => {
    await page.goto('/?sim=edsa&speed=10')
    await page.getByRole('button', { name: 'Set stop: Ayala' }).click()
    await page.getByRole('button', { name: 'Start trip' }).click()
    await page.getByRole('button', { name: 'Got it, start trip' }).click()
    await page.getByRole('slider', { name: 'Ride progress' }).fill('11000')
    await page.getByRole('button', { name: 'Pause' }).click()

    // Search hides mid-trip, leaving the map more room.
    await expect(page.getByRole('searchbox')).toHaveCount(0)

    const dot = page.locator('.para-po-user-dot')
    const controls = page.getByRole('region', {
      name: 'Simulated ride controls',
    })
    const map = page.locator('.leaflet-container')
    await expect
      .poll(async () => {
        const [d, c, m] = await Promise.all([
          dot.boundingBox(),
          controls.boundingBox(),
          map.boundingBox(),
        ])
        if (!d || !c || !m) return 'missing'
        if (d.y < c.y + c.height) return 'under the controls'
        if (d.y + d.height > m.y + m.height) return 'below the map'
        return 'visible'
      })
      .toBe('visible')
  })
})
