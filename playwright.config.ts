import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env first (Supabase vars), then .env.test (test credentials override)
// In CI, env vars come from GitHub Secrets
if (!process.env.CI) {
	dotenv.config({ path: path.resolve(__dirname, '.env') });
	dotenv.config({ path: path.resolve(__dirname, '.env.test') });
}

const authFile = 'tests/e2e/.auth/user.json';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
	testDir: './tests/e2e',
	/* Run tests in files in parallel */
	fullyParallel: true,
	/* Fail the build on CI if you accidentally left test.only in the source code. */
	forbidOnly: !!process.env.CI,
	/* Retry on CI only */
	retries: process.env.CI ? 2 : 0,
	/* Opt out of parallel tests on CI. */
	workers: process.env.CI ? 1 : undefined,
	/* Reporter to use. See https://playwright.dev/docs/test-reporters */
	reporter: process.env.CI ? 'github' : 'html',

	globalSetup: './tests/e2e/global-setup.ts',

	/* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
	use: {
		/* Base URL to use in actions like `await page.goto('/')`. */
		baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173',

		/* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
		trace: 'on-first-retry',

		/* Capture screenshot on failure */
		screenshot: 'only-on-failure',

		/* Record video on failure */
		video: 'on-first-retry'
	},

	/* Configure projects for major browsers */
	projects: [
		// Setup project: authenticates and saves session state
		{
			name: 'setup',
			testMatch: /auth\.setup\.ts/
		},

		{
			name: 'chromium',
			use: {
				...devices['Desktop Chrome'],
				storageState: authFile
			},
			dependencies: ['setup']
		},

		// Skip Firefox and WebKit in CI for speed
		...(process.env.CI
			? []
			: [
					{
						name: 'firefox',
						use: {
							...devices['Desktop Firefox'],
							storageState: authFile
						},
						dependencies: ['setup']
					},
					{
						name: 'webkit',
						use: {
							...devices['Desktop Safari'],
							storageState: authFile
						},
						dependencies: ['setup']
					}
				])
	],

	/* Run your local dev server before starting the tests */
	webServer: {
		command: 'pnpm run dev',
		url: 'http://localhost:5173',
		reuseExistingServer: !process.env.CI,
		timeout: 120 * 1000
	}
});
