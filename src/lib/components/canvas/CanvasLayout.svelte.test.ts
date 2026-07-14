import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import CanvasLayout from './CanvasLayout.svelte';
import type { CanvasBlock, UIBlock } from '$lib/types/genui';

function canvasBlock(id: string, title: string, block?: UIBlock): CanvasBlock {
	return {
		id,
		messageId: `message-${id}`,
		pinned: false,
		minimized: false,
		addedAt: 1,
		title,
		block: block ?? { type: 'coffee-cards', version: 1, data: [] }
	};
}

describe('CanvasLayout active scene', () => {
	it('mounts only the active scene for ordinary evidence', () => {
		const { container } = render(CanvasLayout, {
			blocks: [canvasBlock('one', 'First result'), canvasBlock('two', 'Second result')],
			focusBlockId: 'two'
		});

		const scenes = Array.from(container.querySelectorAll('section'));
		expect(scenes).toHaveLength(1);
		expect(scenes[0]).toHaveAttribute('aria-label', 'Second result');
		expect(scenes[0]).not.toHaveAttribute('hidden');
	});

	it('keeps edited action-card state mounted across shelf switches', async () => {
		const action: UIBlock = {
			type: 'action-card',
			version: 1,
			data: {
				executionId: 'assistant-1:tool-1',
				actionType: 'record_sale',
				summary: 'Record sale',
				fields: [
					{
						key: 'quantity',
						label: 'Quantity',
						type: 'number',
						value: 1,
						editable: true
					}
				],
				status: 'proposed'
			}
		};
		const blocks = [canvasBlock('action', 'Record sale', action), canvasBlock('coffee', 'Coffee')];
		const { container, rerender } = render(CanvasLayout, {
			blocks,
			focusBlockId: 'action'
		});

		await fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
		const quantity = screen.getByRole('spinbutton');
		await fireEvent.input(quantity, { target: { value: '7' } });
		expect(quantity).toHaveValue(7);

		await rerender({ blocks, focusBlockId: 'coffee' });
		expect(container.querySelector('section[aria-label="Record sale"]')).toHaveAttribute('hidden');

		await rerender({ blocks, focusBlockId: 'action' });
		expect(screen.getByRole('spinbutton')).toHaveValue(7);
	});
});
