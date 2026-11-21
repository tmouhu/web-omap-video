import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  use: {
    baseURL: 'http://localhost:5198',
    acceptDownloads: true,
    viewport: { width: 1440, height: 900 },
    // GPX clock times are shown in local time; pin it so tests do not depend on the machine.
    timezoneId: 'Europe/Helsinki',
  },
  webServer: {
    command: 'npx vite --port 5198 --strictPort',
    url: 'http://localhost:5198',
    reuseExistingServer: true,
  },
});
