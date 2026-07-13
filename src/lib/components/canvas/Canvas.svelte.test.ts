import { fireEvent, render, screen } from '@testing-library/svelte';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Canvas from './Canvas.svelte';
import { canvasStore } from '$lib/stores/canvasStore.svelte';

vi.mock('./CanvasLayout.svelte', () => ({ default: vi.fn() }));
vi.mock('./CanvasBlockDetail.svelte', () => ({ default: vi.fn() }));

describe('Canvas layout disclosure', () => {
	beforeEach(() => {
		canvasStore.resetAll();
		canvasStore.dispatch({ type: 'layout', layout: 'focus' });
		for (const messageId of ['one', 'two']) {
			canvasStore.dispatch({
				type: 'add',
				messageId,
				block: { type: 'coffee-cards', version: 1, data: [] }
			});
		}
	});

	it('places multi-layout controls behind a labeled secondary menu', async () => {
		render(Canvas);
		const summary = screen.getByText('Layout: focus');
		const disclosure = summary.closest('details');
		expect(disclosure).not.toHaveAttribute('open');
		await fireEvent.click(summary);
		await fireEvent.click(screen.getByRole('button', { name: 'comparison' }));
		expect(canvasStore.layout).toBe('comparison');
	});
});
