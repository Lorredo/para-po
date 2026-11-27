import { defineConfig, devices } from '@playwright/test'

const DEV_PORT = 5173
/** The service worker only exists in a production build, served by `vite preview`. */
const PREVIEW_PORT = 4173

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'mobile-chrome',
      testIgnore: /pwa\.spec\.ts/,
      use: {
        ...devices['Pixel 7'],
        baseURL: `http://localhost:${DEV_PORT}`,
      },
    },
    {
      name: 'pwa-build',
      testMatch: /pwa\.spec\.ts/,
      use: {
        ...devices['Pixel 7'],
        baseURL: `http://localhost:${PREVIEW_PORT}`,
      },
    },
  ],
  webServer: [
    {
      command: `npm run dev -- --port ${DEV_PORT} --strictPort`,
      url: `http://localhost:${DEV_PORT}`,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `npm run build && npx vite preview --port ${PREVIEW_PORT} --strictPort`,
      url: `http://localhost:${PREVIEW_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
})
