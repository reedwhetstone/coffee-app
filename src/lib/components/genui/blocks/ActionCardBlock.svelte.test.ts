import { fireEvent, render, screen } from '@testing-library/svelte';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import ActionCardBlock from './ActionCardBlock.svelte';
import type { ActionCardBlock as ActionCardBlockType } from '$lib/types/genui';

describe('ActionCardBlock execution status', () => {
	it('shows success after an inline action resolves', async () => {
		const onExecute = vi.fn().mockResolvedValue({ success: true });
		const block = {
			type: 'action-card',
			version: 1,
			data: {
				summary: 'Add this bean to inventory',
				actionType: 'add_bean_to_inventory',
				executionId: 'assistant-1:tool-1',
				status: 'proposed',
				fields: []
			}
		} satisfies ActionCardBlockType;

		render(ActionCardBlock, { block, onExecute });
		await fireEvent.click(screen.getByRole('button', { name: 'Execute' }));

		expect(onExecute).toHaveBeenCalledWith(
			'assistant-1:tool-1',
			'add_bean_to_inventory',
			{},
			undefined
		);
		expect(await screen.findByText('Action completed successfully.')).toBeInTheDocument();
	});
});
