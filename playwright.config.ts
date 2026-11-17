import { defineConfig, devices } from '@playwright/test';

const PORT = 4183;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    // Ancho de celular chico: así se controla que no haya scroll horizontal.
    viewport: { width: 400, height: 860 },
    locale: 'es-AR',
    timezoneId: 'America/Argentina/Buenos_Aires',
    // El service worker se habilita solo en la prueba de "sin conexión".
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 400, height: 860 } } }],
  webServer: {
    // Build de producción contra un Supabase falso (lo simulan los tests): nunca toca la base real.
    command: `npx vite build --outDir dist-e2e --emptyOutDir && npx vite preview --outDir dist-e2e --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      VITE_SUPABASE_URL: 'https://e2e.supabase.test',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_e2e',
    },
  },
});
