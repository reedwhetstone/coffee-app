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
				'background-secondary-light': '#faf8f3',
				'background-tertiary-light': '#f4dbae',
				'growth-green': '#7FB069',
				'background-primary-light': '#f4ece0',
				'harvest-gold': '#7FB069',
				'border-light': '#e0d7c5',
				'text-primary-light': '#3b3024',
				'text-secondary-light': '#695c4d',
				'link-light': '#a07d50'
			}
		}
	},

	plugins: [typography, forms, containerQueries]
} satisfies Config;
