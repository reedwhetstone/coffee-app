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
						if (id.includes('d3')) return 'd3-charts';
						if (id.includes('@supabase')) return 'supabase';
						if (id.includes('generative-ai') || id.includes('openai') || id.includes('langchain')) return 'ai-services';
						if (id.includes('stripe')) return 'stripe';
						if (id.includes('xlsx') || id.includes('papaparse')) return 'file-processing';
						return 'vendor';
					}

					// Chunk roasting components that are heavy
					if (id.includes('RoastChart') || id.includes('RoastInterface')) return 'roast-charts';

					// Chunk marketing components separately
					if (id.includes('/marketing/')) return 'marketing';

					// Chunk visualization components
					if (id.includes('TastingNotesRadar') || id.includes('Chart') || id.includes('chart')) return 'visualization';
					
					// Chunk admin and API dashboard separately
					if (id.includes('/api-dashboard/') || id.includes('/admin/')) return 'admin';
				}
			}
		}
	}
});
