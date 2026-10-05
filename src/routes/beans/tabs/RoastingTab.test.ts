import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { InventoryWithCatalog } from '$lib/types/component.types';
import RoastingTab from './RoastingTab.svelte';

const { goto } = vi.hoisted(() => ({ goto: vi.fn() }));

vi.mock('$app/navigation', () => ({ goto }));

const coffee = {
	id: 101,
	roast_profiles: [
		{
			roast_id: 4531,
			batch_name: 'Wednesday roast',
			roast_date: '2026-10-01',
			oz_in: 16,
			oz_out: 13.7,
			weight_loss_percent: 14.4
		}
	]
} as unknown as InventoryWithCatalog;

describe('portfolio Roasting tab', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('opens a roast inside the app, without reloading the page', async () => {
		const before = window.location.href;
		render(RoastingTab, { selectedBean: coffee, role: 'member', onStartNewRoast: vi.fn() });

		await fireEvent.click(screen.getByRole('button', { name: /Wednesday roast/ }));

		expect(goto).toHaveBeenCalledOnce();
		expect(goto).toHaveBeenCalledWith('/roast?profileId=4531');
		expect(window.location.href).toBe(before);
	});
});
