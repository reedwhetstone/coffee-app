import { mdsvex } from 'mdsvex';
import vercelAdapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: [vitePreprocess(), mdsvex()],

	kit: {
		// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
		// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
		// See https://svelte.dev/docs/kit/adapters for more information about adapters.
		adapter: vercelAdapter({
			runtime: 'nodejs22.x',
			split: true,
			regions: ['iad1'],
			memory: 1024,
			maxDuration: 60,
			isr: {
				expiration: 60,
				allowQuery: []
			}
		})
	},

	extensions: ['.svelte', '.svx']
};

export default config;
