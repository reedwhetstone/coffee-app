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

describe('ActionCardBlock plan steps', () => {
	const saleFields = [
		{ key: 'batch_name', label: 'Batch Name', value: '', type: 'text', editable: false },
		{ key: 'buyer', label: 'Buyer', value: '', type: 'text', editable: true, required: true }
	] satisfies ActionCardBlockType['data']['fields'];

	it('shows a waiting step without an Execute button', () => {
		const block = {
			type: 'action-card',
			version: 1,
			data: {
				summary: 'Record 20 oz sale',
				actionType: 'record_sale',
				executionId: 'msg-1:call-9:step-2',
				status: 'waiting',
				fields: saleFields,
				plan: {
					planId: 'plan-1',
					step: 2,
					bindings: [{ field: 'batch_name', fromStep: 1, from: 'batch_name' }],
					required: ['buyer']
				}
			}
		} satisfies ActionCardBlockType;

		render(ActionCardBlock, { block, onExecute: vi.fn() });
		expect(screen.getByText('From step 1')).toBeInTheDocument();
		expect(screen.getByText('Unlocks after step 1 completes.')).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Execute' })).not.toBeInTheDocument();
	});

	it('blocks execution until the user fills required values', async () => {
		const onExecute = vi.fn().mockResolvedValue({ success: true });
		const block = {
			type: 'action-card',
			version: 1,
			data: {
				summary: 'Record 20 oz sale',
				actionType: 'record_sale',
				executionId: 'msg-1:call-9:step-2',
				status: 'proposed',
				fields: saleFields.map((field) =>
					field.key === 'batch_name' ? { ...field, value: 'Sample' } : field
				)
			}
		} satisfies ActionCardBlockType;

		render(ActionCardBlock, { block, onExecute });
		const execute = screen.getByRole('button', { name: 'Execute' });
		expect(execute).toBeDisabled();
		expect(screen.getByText('Fill in Buyer to continue.')).toBeInTheDocument();

		await fireEvent.input(screen.getByLabelText('Buyer'), { target: { value: 'Corner Cafe' } });
		expect(execute).toBeEnabled();
		await fireEvent.click(execute);
		expect(onExecute).toHaveBeenCalledWith(
			'msg-1:call-9:step-2',
			'record_sale',
			{ batch_name: 'Sample', buyer: 'Corner Cafe' },
			undefined
		);
	});

	it('keeps a cleared required number blank instead of zero', async () => {
		const onExecute = vi.fn().mockResolvedValue({ success: true });
		const block = {
			type: 'action-card',
			version: 1,
			data: {
				summary: 'Record sale',
				actionType: 'record_sale',
				executionId: 'msg-1:call-9:step-2',
				status: 'proposed',
				fields: [
					{
						key: 'price',
						label: 'Price',
						value: 12,
						type: 'number',
						editable: true,
						required: true
					}
				]
			}
		} satisfies ActionCardBlockType;

		render(ActionCardBlock, { block, onExecute });
		await fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
		await fireEvent.input(screen.getByLabelText('Price'), { target: { value: '' } });
		const execute = screen.getByRole('button', { name: 'Execute' });
		expect(execute).toBeDisabled();
		await fireEvent.click(execute);
		expect(onExecute).not.toHaveBeenCalled();
	});
});
