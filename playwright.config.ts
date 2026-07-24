import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.BASE_URL || 'http://localhost:3000';

export default defineConfig({
    testDir: './e2e',
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: 1,
    reporter: 'list',
    timeout: 60_000,
    use: {
        baseURL,
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
    },
    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    ],
    webServer: process.env.CI
        ? undefined
        : {
            command: 'npm run dev',
            port: 3000,
            reuseExistingServer: true,
            timeout: 120_000,
        },
});
