import { expect, type Page, test } from '@playwright/test'

/** Runs against the production build (`vite preview`), where the service worker exists. */

async function blockMapServers(page: Page) {
  await page.route('https://tile.openstreetmap.org/**', (route) =>
    route.abort(),
  )
}

/** Natural size of an image, decoded by the browser. */
function imageSize(page: Page, src: string) {
  return page.evaluate(
    (url) =>
      new Promise<{ width: number; height: number }>((resolve, reject) => {
        const img = new Image()
        img.onload = () =>
          resolve({ width: img.naturalWidth, height: img.naturalHeight })
        img.onerror = () => reject(new Error(`Could not load ${url}`))
        img.src = url
      }),
    src,
  )
}

test('manifest makes Para Po installable, with icons that load', async ({
  page,
}) => {
  await blockMapServers(page)
  await page.goto('/')

  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  expect(href).toBeTruthy()
  const response = await page.request.get(href!)
  expect(response.ok()).toBe(true)
  const manifest = await response.json()

  expect(manifest).toMatchObject({
    name: 'Para Po',
    short_name: 'Para Po',
    start_url: '/',
    display: 'standalone',
    theme_color: '#0B3C5D',
  })

  type Icon = { src: string; sizes: string; purpose?: string }
  const icons = manifest.icons as Icon[]
  expect(icons.map((i) => i.sizes)).toEqual(
    expect.arrayContaining(['192x192', '512x512']),
  )
  expect(icons.some((i) => i.purpose === 'maskable')).toBe(true)
  for (const icon of icons) {
    const [w, h] = icon.sizes.split('x').map(Number)
    expect(await imageSize(page, icon.src), icon.src).toEqual({
      width: w,
      height: h,
    })
  }

  // Ask Chrome itself (the check Lighthouse's old PWA audit used).
  const cdp = await page.context().newCDPSession(page)
  await expect
    .poll(async () => {
      const { installabilityErrors } = await cdp.send(
        'Page.getInstallabilityErrors',
      )
      return installabilityErrors.map((e) => e.errorId)
    })
    .toEqual([])

  const appleIcon = await page
    .locator('link[rel="apple-touch-icon"]')
    .getAttribute('href')
  expect(await imageSize(page, appleIcon!)).toEqual({ width: 180, height: 180 })
})

test('opens with no internet once it has been visited', async ({
  page,
  context,
}) => {
  await blockMapServers(page)
  await page.goto('/')

  // Wait for the service worker to install and take over.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload()
  await expect
    .poll(() =>
      page.evaluate(() => navigator.serviceWorker.controller !== null),
    )
    .toBe(true)

  await context.setOffline(true)
  await page.reload()

  await expect(
    page.getByRole('heading', { level: 1, name: 'Para Po' }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start trip' })).toBeVisible()
  await expect(
    page.getByText(
      "You're offline. GPS and the alarm still work; the map and search need a connection.",
    ),
  ).toBeVisible()
  // The bundled font is cached too.
  await expect
    .poll(() =>
      page.evaluate(() =>
        document.fonts.check('16px "Plus Jakarta Sans Variable"'),
      ),
    )
    .toBe(true)

  await context.setOffline(false)
})

test('the offline notice goes away when the connection returns', async ({
  page,
  context,
}) => {
  await blockMapServers(page)
  await page.goto('/')
  const notice = page.getByText(/^You're offline\./)
  await context.setOffline(true)
  await expect(notice).toBeVisible()
  await context.setOffline(false)
  await expect(notice).toHaveCount(0)
})
