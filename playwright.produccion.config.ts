import { defineConfig, devices } from '@playwright/test';

// Suite contra el despliegue publicado (sin servidor local). No crea cuentas ni escribe PIN:
// revisa lo que se puede comprobar sin sesion. URL configurable con E2E_URL_BASE.
const URL_BASE = process.env.E2E_URL_BASE ?? 'https://vozvial-production.up.railway.app';

export default defineConfig({
  testDir: './e2e/produccion',
  outputDir: './test-results-produccion',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'test-results-produccion/resultados.json' }]],
  timeout: 60_000,
  use: {
    baseURL: URL_BASE,
    locale: 'es-CO',
    timezoneId: 'America/Bogota',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'pixel7', use: { ...devices['Pixel 7'], browserName: 'chromium' } }],
});
