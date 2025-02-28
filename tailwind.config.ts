import containerQueries from '@tailwindcss/container-queries';
import forms from '@tailwindcss/forms';
import typography from '@tailwindcss/typography';
import type { Config } from 'tailwindcss';

export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	darkMode: 'media',
	theme: {
		extend: {
			colors: {
				'coffee-brown': '#faf8f3',
				'growth-green': '#7FB069',
				'light-cream': '#f4ece0',
				'harvest-gold': '#7FB069'
			}
		}
	},

	plugins: [typography, forms, containerQueries]
} satisfies Config;
