import { defineConfig, devices } from '@playwright/test';

// E2E_PUERTO y E2E_DIST permiten correr varias suites en paralelo sin pisarse el build ni el puerto.
const PUERTO = Number(process.env.E2E_PUERTO ?? 4173);
const DIST = process.env.E2E_DIST ?? 'dist';

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }], ['./e2e/reporter-matriz.ts']],
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${PUERTO}`,
    locale: 'es-CO',
    timezoneId: 'America/Bogota',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'pixel7',
      use: {
        ...devices['Pixel 7'],
        browserName: 'chromium',
        launchOptions: {
          args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
        },
      },
    },
  ],
  webServer: {
    // El build e2e inyecta tiempos cortos de bloqueo e inactividad y menos iteraciones PBKDF2.
    command: `bash scripts/build-e2e.sh ${DIST} && PORT=${PUERTO} E2E_DIST=${DIST} tsx scripts/servidor-e2e.ts`,
    url: `http://localhost:${PUERTO}`,
    reuseExistingServer: !process.env.CI && !process.env.E2E_DIST,
    timeout: 300_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
