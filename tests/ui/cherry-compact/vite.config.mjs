import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';
const here = fileURLToPath(new URL('.', import.meta.url));
const repo = fileURLToPath(new URL('../../../', import.meta.url));
export default defineConfig({
	root: here,
	publicDir: repo + 'static',
	plugins: [svelte({ configFile: false })],
	resolve: {
		alias: {
			'$app/state': here + 'state.ts',
			'$app/stores': here + 'stores.ts',
			'$app/navigation': here + 'navigation.ts',
			'$app/environment': here + 'environment.ts',
			'$env/static/public': here + 'environment.ts',
			'$lib/supabase': here + 'supabase.ts',
			'@vercel/speed-insights/sveltekit': here + 'telemetry.ts',
			'@vercel/analytics/sveltekit': here + 'telemetry.ts',
			$lib: repo + 'src/lib'
		}
	},
	css: { postcss: repo },
	server: { host: '127.0.0.1', port: 5198, strictPort: true, fs: { allow: [repo] } }
});
