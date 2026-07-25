import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import BotPage from './+page.svelte';

describe('PurveyorsBot operator disclosures', () => {
	it('publishes the crawler identity, request boundary, and operator contact', () => {
		render(BotPage);

		expect(screen.getByText('PurveyorsBot/1.0 (+https://www.purveyors.io)')).toBeVisible();
		expect(screen.getByText('https://api.purveyors.io')).toBeVisible();
		expect(
			screen.getByRole('link', {
				name: 'api.purveyors.io/.well-known/http-message-signatures-directory'
			})
		).toHaveAttribute(
			'href',
			'https://api.purveyors.io/.well-known/http-message-signatures-directory'
		);
		expect(screen.getByText(/Within each scraper process/)).toBeVisible();
		expect(screen.getByText(/Durable fleet state carries a rate-limit hold/)).toBeVisible();
		expect(screen.getByRole('link', { name: 'hello@purveyors.io' })).toHaveAttribute(
			'href',
			'mailto:hello@purveyors.io?subject=PurveyorsBot%20operator%20request'
		);
	});
});
