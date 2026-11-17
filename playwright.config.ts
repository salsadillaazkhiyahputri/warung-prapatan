import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.PORT ?? 3100);
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

if (!supabaseUrl || !/^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(supabaseUrl)) {
  throw new Error('E2E hanya boleh dijalankan terhadap Supabase lokal di http://127.0.0.1:54321');
}

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome']
  },
  webServer: {
    command: `npm run dev -- --hostname 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      SESSION_SECRET: 'ci-only-session-secret-with-at-least-32-chars',
      NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
      DATABASE_URL: ''
    }
  }
});
