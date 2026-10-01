import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '*.spec.ts',
  timeout: 35_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, args: ['--no-sandbox', '--no-zygote'] } : undefined,
  },
  webServer: [
    { command: 'npm run start', url: 'http://127.0.0.1:3000/ar/watch', reuseExistingServer: !process.env.CI, timeout: 120_000, env: { NEXT_PUBLIC_LIVE_ENABLED: 'true' } },
    { command: 'npx next dev tests/e2e/fixture-app -H 0.0.0.0 -p 3101', url: 'http://127.0.0.1:3101', reuseExistingServer: !process.env.CI, timeout: 120_000, env: { NEXT_PUBLIC_LIVE_ENABLED: 'true', NEXT_PUBLIC_LIVE_SUPABASE_URL: '', NEXT_PUBLIC_LIVE_SUPABASE_ANON_KEY: '' } },
  ],
});
