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
				//ian's color pallet
				//  #f0ead6, egshell.. lighter option
				// #292522, dark brown
				// #f78c58 and orange creamsicle sort of color
				// text on dark background - #dfdaca
				// text on light background - #302f2a

				// do a burnt orange? #CC5500
				'background-primary-light': '#f0ead6', //faf8f3
				'background-secondary-light': '#f0ead6',
				'background-tertiary-light': '#f78c58',

				'border-light': '#292522',

				//text colors
				'text-primary-light': '#302f2a', //dark brown
				'text-secondary-light': '#695c4d', //light brown
				'link-light': '#a07d50',

				//accent colors
				'growth-green': '#7FB069',
				'harvest-gold': '#7FB069'
			}
		}
	},

	plugins: [typography, forms, containerQueries]
} satisfies Config;
