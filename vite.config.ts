import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [sveltekit()],

	test: {
		include: ['src/**/*.{test,spec}.{js,ts}']
	},

	build: {
		rollupOptions: {
			output: {
				manualChunks: (id) => {
					// Automatically chunk node_modules dependencies
					if (id.includes('node_modules')) {
						if (id.includes('d3')) return 'd3';
						if (id.includes('@supabase')) return 'supabase';
						if (id.includes('generative-ai') || id.includes('openai')) return 'ai';
						return 'vendor';
					}
				}
			}
		}
	}
});
