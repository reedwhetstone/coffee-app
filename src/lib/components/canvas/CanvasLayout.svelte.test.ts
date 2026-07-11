import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import CanvasLayout from './CanvasLayout.svelte';
import type { CanvasBlock, UIBlock } from '$lib/types/genui';

vi.mock('$lib/components/genui/GenUIBlockRenderer.svelte', () => ({ default: vi.fn() }));

function canvasBlock(
	id: string,
	messageId: string,
	block: UIBlock = { type: 'coffee-cards', version: 1, data: [] }
): CanvasBlock {
	return {
		id,
		messageId,
		pinned: false,
		minimized: false,
		addedAt: 1,
		title: messageId,
		block
	};
}

describe('CanvasLayout tab controls', () => {
	it('removes a sub-tab instead of minimizing it', async () => {
		const onRemove = vi.fn();
		const onMinimize = vi.fn();

		render(CanvasLayout, {
			blocks: [canvasBlock('block-1', 'First'), canvasBlock('block-2', 'Second')],
			layout: 'comparison',
			focusBlockId: 'block-2',
			onRemove,
			onMinimize,
			onToggleLock: vi.fn()
		});

		await fireEvent.click(screen.getByRole('button', { name: 'Close First' }));

		expect(onRemove).toHaveBeenCalledWith('block-1');
		expect(onMinimize).not.toHaveBeenCalled();
	});

	it('offers granular removal when a window contains only one tab', async () => {
		const onRemove = vi.fn();

		render(CanvasLayout, {
			blocks: [canvasBlock('block-1', 'Only result')],
			layout: 'focus',
			focusBlockId: 'block-1',
			onRemove,
			onMinimize: vi.fn(),
			onToggleLock: vi.fn()
		});

		await fireEvent.click(screen.getByRole('button', { name: 'Remove active Coffee cards tab' }));

		expect(onRemove).toHaveBeenCalledWith('block-1');
	});

	it('identifies each window in active-tab removal controls', () => {
		render(CanvasLayout, {
			blocks: [
				canvasBlock('block-1', 'Coffee'),
				canvasBlock('block-2', 'Inventory', { type: 'inventory-table', version: 1, data: [] })
			],
			layout: 'comparison',
			focusBlockId: 'block-1',
			onRemove: vi.fn(),
			onMinimize: vi.fn(),
			onToggleLock: vi.fn()
		});

		expect(screen.getByRole('button', { name: 'Remove active Coffee cards tab' })).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Remove active Inventory tab' })).toBeTruthy();
	});
});
