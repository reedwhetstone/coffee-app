import containerQueries from '@tailwindcss/container-queries';
import forms from '@tailwindcss/forms';
import typography from '@tailwindcss/typography';
import type { Config } from 'tailwindcss';

export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	darkMode: 'media',
	theme: {
		extend: {
			fontFamily: {
				// Editorial serif for public/marketing headings, blog, and docs prose.
				serif: ['Newsreader Variable', 'Newsreader', 'Georgia', 'Cambria', 'serif'],
				display: ['Newsreader Variable', 'Newsreader', 'Georgia', 'Cambria', 'serif']
			},
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
				// Chart series tokens. Keep in sync with src/lib/styles/chartColors.ts.
				chart: {
					rust: '#C05B2E',
					green: '#7FB069',
					teal: '#4E8098',
					gold: '#D9A05B',
					plum: '#6D5BD0',
					olive: '#586048',
					peach: '#F9A57B',
					sage: '#8FA382',
					wine: '#9C4356',
					brown: '#695C4D'
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
			},
			// Brand-themed prose for blog and docs long-form content.
			typography: {
				DEFAULT: {
					css: {
						'--tw-prose-body': '#302f2a',
						'--tw-prose-headings': '#302f2a',
						'--tw-prose-lead': '#695c4d',
						'--tw-prose-links': '#a07d50',
						'--tw-prose-bold': '#302f2a',
						'--tw-prose-counters': '#695c4d',
						'--tw-prose-bullets': '#F9A57B',
						'--tw-prose-hr': '#E4E4E2',
						'--tw-prose-quotes': '#302f2a',
						'--tw-prose-quote-borders': '#F9A57B',
						'--tw-prose-captions': '#695c4d',
						'--tw-prose-code': '#302f2a',
						'--tw-prose-pre-code': '#dfdaca',
						'--tw-prose-pre-bg': '#292522',
						'--tw-prose-th-borders': '#E4E4E2',
						'--tw-prose-td-borders': '#E4E4E2',
						fontFamily: 'Newsreader Variable, Newsreader, Georgia, Cambria, serif',
						fontSize: '1.0625rem',
						h1: { fontWeight: '600' },
						h2: { fontWeight: '600' },
						h3: { fontWeight: '600' },
						'code, kbd, samp, pre': {
							fontFamily:
								'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
						}
					}
				}
			}
		}
	},

	plugins: [typography, forms, containerQueries]
} satisfies Config;
