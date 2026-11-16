import { defineConfig, devices } from '@playwright/test';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

// Ports de l'application de test (lancer-en-local : 8080 et 5173)
const PORT_BACKEND = 8081;
const PORT_FRONTEND = 5174;

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './e2e-tests',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  // CI (.github/workflows/e2e.yaml) : avancement dans le journal, erreurs affichées sur la
  // PR, et rapport HTML gardé en artifact
  reporter: process.env.CI ? [['list'], ['github'], ['html', { open: 'never' }]] : 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('')`. */
    baseURL: `http://localhost:${PORT_FRONTEND}`,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },

    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /*
   * Application de test démarrée avant les tests, dans l'ordre (chaque ligne attend que la
   * précédente réponde), sur ses propres ports : elle peut tourner à côté de lancer-en-local
   * (8080, 5173) sans le gêner. Déjà démarrée (hors CI) ? Elle est réutilisée.
   */
  webServer: [
    {
      name: 'Backend',
      // 1. Pile de test recréée vide (e2e-tests/compose.yaml), attente qu'elle soit prête.
      // 2. Catalogue de test déposé dans le faux R2 (réessais : S3Mock met ~2 s à démarrer).
      // 3. Backend branché dessus : il importe le catalogue à son démarrage, comme sur le cluster.
      command:
        'docker compose -f e2e-tests/compose.yaml down' +
        ' && docker compose -f e2e-tests/compose.yaml up -d --wait' +
        ' && curl -sS --fail --retry 30 --retry-all-errors --retry-delay 1' +
        ' -T e2e-tests/donnees/scpi_catalogue.csv http://127.0.0.1:9590/scpi-e2e/scpi_catalogue.csv' +
        ' && npm --prefix backend run dev',
      env: {
        PORT: String(PORT_BACKEND),
        DATABASE_URL: 'postgresql://app:app@localhost:55433/scpi_invest',
        // Faux R2 (S3Mock) : adresse IP, pas « localhost », pour que le client S3 mette le
        // bucket dans le chemin. Clés factices : S3Mock ne les vérifie pas.
        S3_URL: 'http://127.0.0.1:9590/scpi-e2e/scpi_catalogue.csv',
        S3_ACCESS_KEY_ID: 'e2e',
        S3_SECRET_ACCESS_KEY: 'e2e',
      },
      // /health interroge la base : répond seulement quand base et backend sont prêts
      url: `http://localhost:${PORT_BACKEND}/health`,
      reuseExistingServer: !process.env.CI,
      // 1er lancement : téléchargement des images Docker et migrations
      timeout: 180_000,
    },
    {
      name: 'Frontend',
      // --strictPort : échoue plutôt que de prendre un autre port que celui de baseURL
      command: `npm --prefix frontend run dev -- --port ${PORT_FRONTEND} --strictPort`,
      // Relais /api vers le backend de test (frontend/vite.config.js)
      env: { BACKEND_URL: `http://localhost:${PORT_BACKEND}` },
      url: `http://localhost:${PORT_FRONTEND}`,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
