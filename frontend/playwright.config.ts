import { defineConfig, devices } from '@playwright/test';

// Task 105: end-to-end tests of the key flows in a real browser, against the real backend and the built website.
//
// - The BACKEND is started with the TEST profile (in-memory H2, rate limit off, mail only logged, a throwaway JWT
//   key). Never the default profile: that one reads the owner's real database password and secrets.
// - The WEBSITE is the production build served by `vite preview`, which forwards /api to the backend like the real
//   host does. It is built with fake Cloudinary names and no Google / Sentry / ad settings, so nothing external is
//   contacted (the tests answer the Cloudinary upload themselves).
// - Locally, `PW_CHANNEL=chrome npm run e2e` reuses the installed Chrome; CI installs Playwright's own Chromium.
// - Servers already running are reused outside CI (npm run e2e is quick the second time).

const isWindows = process.platform === 'win32';
// On Windows the command shell does not run a program from the current folder without the ".\\" prefix.
const maven = isWindows ? '.\\mvnw.cmd' : './mvnw';
const channel = process.env.PW_CHANNEL || undefined;

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], channel } }],
  webServer: [
    {
      command: `${maven} -B -ntp spring-boot:run -Dspring-boot.run.useTestClasspath=true -Dspring-boot.run.profiles=test -Dspring-boot.run.arguments=--server.port=8080`,
      cwd: '../backend',
      // The test profile is what keeps the owner's real settings (application-local.properties) from being read.
      // `spring-boot:run` does not load the test profile's own file, so the same settings are given as environment
      // variables: an in-memory H2 database speaking Postgres, no Flyway, no rate limit, mail only logged, and a
      // throwaway signing key (not a secret: it only ever signs tokens of this in-memory database).
      env: {
        JWT_SECRET: 'dGVzdC1vbmx5LWp3dC1zZWNyZXQtbm90LXVzZWQtYW55d2hlcmUtZWxzZS0wMTIzNDU2Nzg5LWFiY2RlZmdoaWo=',
        SPRING_DATASOURCE_URL: 'jdbc:h2:mem:e2e;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1',
        SPRING_DATASOURCE_USERNAME: 'sa',
        SPRING_DATASOURCE_PASSWORD: 'sa',
        SPRING_DATASOURCE_DRIVER_CLASS_NAME: 'org.h2.Driver',
        SPRING_JPA_PROPERTIES_HIBERNATE_DIALECT: 'org.hibernate.dialect.H2Dialect',
        SPRING_JPA_HIBERNATE_DDL_AUTO: 'create-drop',
        SPRING_FLYWAY_ENABLED: 'false',
        APP_MAIL_MODE: 'log',
        APP_RATE_LIMIT_ENABLED: 'false',
        // The browser sends its own address as the origin of API calls; the backend must allow the test site.
        APP_CORS_ALLOWED_ORIGINS: 'http://localhost:4173',
      },
      url: 'http://localhost:8080/actuator/health',
      timeout: 240_000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run build && npx vite preview --port 4173 --strictPort',
      url: 'http://localhost:4173',
      timeout: 300_000,
      reuseExistingServer: !process.env.CI,
      env: {
        VITE_CLOUDINARY_CLOUD_NAME: 'e2e',
        VITE_CLOUDINARY_UPLOAD_PRESET: 'e2e',
        VITE_BG_REMOVER_MODE: 'browser',
        VITE_GOOGLE_CLIENT_ID: '',
        VITE_REMOVE_BG_API_KEY: '',
        VITE_SENTRY_DSN: '',
        VITE_AD_PROVIDER: '',
      },
    },
  ],
});
