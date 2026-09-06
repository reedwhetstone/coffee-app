import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import ExpandablePanelStateHarness from './__test-fixtures__/ExpandablePanelStateHarness.svelte';

afterEach(cleanup);

describe('ExpandablePanel', () => {
	it('preserves child state when switching to the expanded layout', async () => {
		Object.defineProperty(HTMLElement.prototype, 'animate', {
			configurable: true,
			value: vi.fn(() => ({
				finished: Promise.resolve(),
				cancel: vi.fn(),
				play: vi.fn()
			}))
		});
		render(ExpandablePanelStateHarness);

		await fireEvent.click(screen.getByRole('button', { name: 'Count 0' }));
		expect(screen.getByRole('button', { name: 'Count 1' })).toBeInTheDocument();

		await fireEvent.click(screen.getByRole('button', { name: 'Expand' }));
		expect(screen.getByRole('dialog')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Count 1' })).toBeInTheDocument();
	});
});
