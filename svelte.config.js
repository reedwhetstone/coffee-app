import { mdsvex } from 'mdsvex';
import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: [vitePreprocess(), mdsvex()],

	kit: {
		// Vercel canonicalizes the apex domain to www. Trust both owned production
		// origins explicitly to cover proxy-origin mismatches without admitting any
		// unrelated form origin. Production still requires a live approval canary.
		csrf: {
			trustedOrigins: ['https://purveyors.io', 'https://www.purveyors.io']
		},

		// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
		// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
		// See https://svelte.dev/docs/kit/adapters for more information about adapters.
		adapter: adapter({
			// Configure function runtime for specific routes
			runtime: 'nodejs22.x',
			regions: ['iad1'], // US East for better latency
			// Increase timeout for chat endpoint (5 minutes max)
			maxDuration: 300
		})
	},

	extensions: ['.svelte', '.svx']
};

export default config;
