import { defineConfig, devices } from '@playwright/test';

const port = process.env.PLAYWRIGHT_PORT ?? '3100';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  expect: { timeout: 15_000 },
  use: { baseURL: `http://127.0.0.1:${port}`, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run dev -- --hostname 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}/pl`,
    reuseExistingServer: !process.env.CI,
    env: {
      // PLAYWRIGHT_API_MODE=live uruchamia e2e na prawdziwym backendzie (API_INTERNAL_URL)
      NEXT_PUBLIC_API_MODE: process.env.PLAYWRIGHT_API_MODE ?? 'mock',
      NEXT_TELEMETRY_DISABLED: '1',
    },
  },
});
