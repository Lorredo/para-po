import { expect, type Page, test } from '@playwright/test'

declare global {
  interface Window {
    __audio: { contexts: AudioContext[]; oscillators: number }
    __vibrations: Array<number | number[]>
  }
}

/**
 * Record real Web Audio and vibration use, without replacing either:
 * the browser still runs its actual audio engine.
 */
async function instrument(page: Page) {
  await page.addInitScript(() => {
    window.__audio = { contexts: [], oscillators: 0 }
    window.__vibrations = []

    const Original = window.AudioContext
    window.AudioContext = class extends Original {
      constructor(options?: AudioContextOptions) {
        super(options)
        window.__audio.contexts.push(this)
      }
      override createOscillator() {
        window.__audio.oscillators++
        return super.createOscillator()
      }
    }

    // Desktop Chromium has no vibration motor; record the calls instead.
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: (pattern: number | number[]) => {
        window.__vibrations.push(pattern)
        return true
      },
    })
  })
  await page.route('https://tile.openstreetmap.org/**', (route) =>
    route.abort(),
  )
}

const audioState = (page: Page) =>
  page.evaluate(() => ({
    contexts: window.__audio.contexts.length,
    state: window.__audio.contexts[0]?.state ?? 'none',
    oscillators: window.__audio.oscillators,
  }))

test('no audio context is created until the user taps', async ({ page }) => {
  await instrument(page)
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Test alarm' })).toBeVisible()
  expect((await audioState(page)).contexts).toBe(0)
})

test('test alarm plays real Web Audio, vibrates, and stops', async ({
  page,
}) => {
  await instrument(page)
  await page.goto('/')

  await page.getByRole('button', { name: 'Test alarm' }).click()
  const dialog = page.getByRole('alertdialog', { name: 'Para po!' })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('This is how your alarm will sound.')
  await expect(dialog.getByRole('button', { name: 'Done' })).toBeFocused()

  // The browser accepted the tap as permission to play.
  await expect.poll(async () => (await audioState(page)).state).toBe('running')
  // The loop keeps scheduling notes (jeepney beep: 6 oscillators per cycle).
  const first = (await audioState(page)).oscillators
  expect(first).toBeGreaterThan(0)
  await expect
    .poll(async () => (await audioState(page)).oscillators, { timeout: 4000 })
    .toBeGreaterThan(first)

  expect(await page.evaluate(() => window.__vibrations[0])).toEqual([
    700, 300, 700, 300,
  ])

  await dialog.getByRole('button', { name: 'Done' }).click()
  await expect(dialog).toHaveCount(0)
  expect(await page.evaluate(() => window.__vibrations.at(-1))).toBe(0)

  // Nothing more is scheduled once stopped.
  await page.waitForTimeout(500)
  const afterStop = (await audioState(page)).oscillators
  await page.waitForTimeout(1500)
  expect((await audioState(page)).oscillators).toBe(afterStop)
})

test('preview plays one cycle of the chosen sound', async ({ page }) => {
  await instrument(page)
  await page.goto('/')

  await page.getByLabel('Alarm sound').selectOption('chime')
  await page.getByRole('button', { name: 'Preview' }).click()
  await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible()

  // Chime is 4 notes, then the button resets on its own.
  await expect(page.getByRole('button', { name: 'Preview' })).toBeVisible({
    timeout: 4000,
  })
  expect((await audioState(page)).oscillators).toBe(4)
})
