import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import RoastLocked from './RoastLocked.svelte';

describe('RoastLocked', () => {
	it('says what Mallard Studio adds and offers one way to unlock it', () => {
		const { container } = render(RoastLocked);

		expect(
			screen.getByRole('heading', { level: 1, name: 'Log, compare, and plan your roasts' })
		).toBeTruthy();
		expect(
			screen.getByText(
				"Roasts are part of Mallard Studio. Keep every roast's curve, compare any two, plan the next one, and take the plan into Artisan."
			)
		).toBeTruthy();

		const actions = container.querySelectorAll('a, button, input, select, textarea');
		expect(actions).toHaveLength(1);
		expect(actions[0].textContent?.trim()).toBe('Unlock Mallard Studio');
		expect(actions[0].getAttribute('href')).toBe('/subscription?plan=studio-monthly');
	});
});
