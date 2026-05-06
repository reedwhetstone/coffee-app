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
				'surface-canvas': '#FCFAF8',
				'surface-panel': '#F7F3ED',
				'surface-raised': '#FFFFFF',
				ink: '#302f2a',
				muted: '#695c4d',
				line: '#E4E4E2',
				accent: '#F9A57B',
				'accent-subtle': 'rgb(249 165 123 / <alpha-value>)',
				'on-dark': '#dfdaca',
				link: '#a07d50',
				success: {
					DEFAULT: '#7FB069',
					subtle: '#EEF6EA',
					strong: '#4F7E3B'
				},
				warning: {
					DEFAULT: '#D58A32',
					subtle: '#FFF4E6',
					strong: '#8A4F12'
				},
				danger: {
					DEFAULT: '#DC2626',
					subtle: '#FEF2F2',
					strong: '#991B1B'
				},
				info: {
					DEFAULT: '#2563EB',
					subtle: '#EFF6FF',
					strong: '#1E3A8A'
				},
				intelligence: {
					DEFAULT: '#6D5BD0',
					subtle: '#F2EFFE',
					strong: '#46368F'
				},
				chart: {
					orange: '#F9A57B',
					green: '#7FB069',
					blue: '#3B82F6',
					purple: '#8B5CF6',
					red: '#EF4444',
					amber: '#F59E0B'
				},

				// Compatibility aliases. Prefer role-based tokens for new UI.
				'background-primary-light': '#FCFAF8',
				'background-secondary-light': '#FCFAF8',
				'background-tertiary-light': '#F9A57B',
				'background-primary-dark': '#292522',

				'border-light': '#E4E4E2',

				'text-primary-light': '#302f2a',
				'text-secondary-light': '#695c4d',
				'text-primary-dark': '#dfdaca',

				'link-light': '#a07d50',

				'growth-green': '#7FB069'
			}
		}
	},

	plugins: [typography, forms, containerQueries]
} satisfies Config;
