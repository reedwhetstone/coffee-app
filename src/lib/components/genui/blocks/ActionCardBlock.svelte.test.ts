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
		expect(onExecute).not.toHaveBeenCalled();
		await fireEvent.click(screen.getByRole('button', { name: 'Execute' }));

		expect(onExecute).toHaveBeenCalledWith(
			'assistant-1:tool-1',
			'add_bean_to_inventory',
			{},
			undefined
		);
		expect(await screen.findByText('Action completed successfully.')).toBeInTheDocument();
	});

	it('submits the exact hidden change set from a confirmed planned-reference card', async () => {
		const onExecute = vi.fn().mockResolvedValue({
			success: true,
			id: 'c43a1d7e-95b2-4e06-8f7c-1d2b3a4e5f68',
			message: 'Planned reference saved'
		});
		const changes = {
			temperatureAdjustments: [
				{ kind: 'bean_temperature', startMilliseconds: 300000, endMilliseconds: 420000, delta: 3 }
			]
		};
		const block = {
			type: 'action-card',
			version: 1,
			data: {
				summary: 'Save planned reference',
				actionType: 'create_generated_reference',
				executionId: 'assistant-plan:save-plan',
				status: 'proposed',
				fields: [
					{ key: 'title', label: 'Title', value: 'Next-batch plan', type: 'text', editable: false },
					{ key: 'changes', label: 'Changes', value: changes, type: 'hidden', editable: false }
				]
			}
		} satisfies ActionCardBlockType;

		render(ActionCardBlock, { block, onExecute });
		await fireEvent.click(screen.getByRole('button', { name: 'Execute' }));

		expect(onExecute).toHaveBeenCalledWith(
			'assistant-plan:save-plan',
			'create_generated_reference',
			{ title: 'Next-batch plan', changes },
			undefined
		);
		expect(await screen.findByText('Action completed successfully.')).toBeInTheDocument();
	});
});
