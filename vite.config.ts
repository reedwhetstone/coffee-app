import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [sveltekit()],

	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		// Use happy-dom for component tests (faster than jsdom)
		environment: 'happy-dom',
		// Setup file for @testing-library/jest-dom matchers
		setupFiles: ['./src/test-setup.ts']
	},

	build: {
		rollupOptions: {
			output: {
				// Let SvelteKit handle automatic chunking for better reliability
				// Remove manual chunking to prevent variable initialization errors during cold starts
			}
		}
	}
});
