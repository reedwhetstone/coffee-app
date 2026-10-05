import { mdsvex } from 'mdsvex';
import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import rehypeSlug from 'rehype-slug';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: [vitePreprocess(), mdsvex({ rehypePlugins: [rehypeSlug] })],

	kit: {
		// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
		// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
		// See https://svelte.dev/docs/kit/adapters for more information about adapters.
		adapter: adapter({
			// Configure function runtime for specific routes
			runtime: 'nodejs22.x',
			// Run next to what the functions call: the Parchment API (Render, Oregon)
			// and Supabase (us-west-1). Every page and data request makes one or more
			// round trips to them, so a far region adds its distance to each one.
			regions: ['pdx1'],
			// Increase timeout for chat endpoint (5 minutes max)
			maxDuration: 300
		})
	},

	extensions: ['.svelte', '.svx']
};

export default config;
