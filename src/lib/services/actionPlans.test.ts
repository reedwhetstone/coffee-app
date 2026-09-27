import { describe, expect, it } from 'vitest';
import type { ActionCardBlock } from '$lib/types/genui';
import { extractBlockFromPart, extractCompanionBlocks } from './blockExtractor';
import {
	missingRequiredFields,
	planHasActionableSteps,
	resolveReadyPlanSteps
} from './actionPlans';

const planPart = {
	type: 'tool-propose_action_plan',
	toolCallId: 'call-9',
	state: 'output-available',
	output: {
		action_plan: {
			planId: 'plan-1',
			summary: 'Roast, then sell',
			steps: [
				{
					actionType: 'create_roast_session',
					summary: 'Create roast session',
					status: 'proposed',
					fields: [
						{ key: 'coffee_id', label: 'Coffee ID', value: 812, type: 'number', editable: false },
						{
							key: 'batch_name',
							label: 'Batch Name',
							value: 'Sample',
							type: 'text',
							editable: true
						}
					],
					plan: { step: 1, bindings: [], required: [] }
				},
				{
					actionType: 'record_sale',
					summary: 'Record 20 oz sale',
					status: 'waiting',
					fields: [
						{
							key: 'green_coffee_inv_id',
							label: 'Inventory ID',
							value: '',
							type: 'number',
							editable: false
						},
						{ key: 'batch_name', label: 'Batch Name', value: '', type: 'text', editable: false },
						{ key: 'oz_sold', label: 'Oz Sold', value: 20, type: 'number', editable: true },
						{
							key: 'buyer',
							label: 'Buyer',
							value: '',
							type: 'text',
							editable: true,
							required: true
						}
					],
					plan: {
						step: 2,
						bindings: [
							{ field: 'green_coffee_inv_id', fromStep: 1, from: 'coffee_id' },
							{ field: 'batch_name', fromStep: 1, from: 'batch_name' }
						],
						required: ['buyer']
					}
				}
			]
		}
	}
};

function planCards() {
	const options = { messageId: 'msg-1' };
	const first = extractBlockFromPart(planPart, options) as ActionCardBlock;
	const rest = extractCompanionBlocks(planPart, options) as ActionCardBlock[];
	return [first, ...rest].map((block, index) => ({ id: `block-${index + 1}`, block }));
}

describe('action plans', () => {
	it('extracts one card per step with durable step execution IDs', () => {
		const cards = planCards();
		expect(cards.map((card) => card.block.data.executionId)).toEqual([
			'msg-1:call-9:step-1',
			'msg-1:call-9:step-2'
		]);
		expect(cards[1]!.block.data.status).toBe('waiting');
		expect(cards[1]!.block.data.plan).toMatchObject({ planId: 'plan-1', step: 2 });
	});

	it('keeps a step waiting until its prerequisite succeeds', () => {
		const cards = planCards();
		expect(resolveReadyPlanSteps(cards, 'plan-1')).toEqual([]);
		expect(planHasActionableSteps(cards, 'plan-1')).toBe(true);
	});

	it('fills bound fields from the values that actually executed', () => {
		const cards = planCards();
		const roast = cards[0]!.block.data;
		roast.status = 'success';
		roast.result = { success: true, id: 4498, message: 'Roast session created' };
		// The user renamed the batch before executing step 1.
		roast.fields = roast.fields.map((field) =>
			field.key === 'batch_name' ? { ...field, value: 'Dambi Uddo Sample - 2 lb' } : field
		);

		const [ready] = resolveReadyPlanSteps(cards, 'plan-1');
		expect(ready!.blockId).toBe('block-2');
		const value = (key: string) => ready!.fields.find((field) => field.key === key)!.value;
		expect(value('green_coffee_inv_id')).toBe(812);
		expect(value('batch_name')).toBe('Dambi Uddo Sample - 2 lb');
		expect(missingRequiredFields(ready!.fields)).toEqual(['Buyer']);
	});

	it('resolves result_id bindings from the returned resource ID', () => {
		const cards = planCards();
		cards[1]!.block.data.plan!.bindings = [{ field: 'roast_id', fromStep: 1, from: 'result_id' }];
		cards[1]!.block.data.fields.push({
			key: 'roast_id',
			label: 'Roast ID',
			value: '',
			type: 'number',
			editable: false
		});
		cards[0]!.block.data.status = 'success';
		cards[0]!.block.data.result = { success: true, id: 4498 };
		const [ready] = resolveReadyPlanSteps(cards, 'plan-1');
		expect(ready!.fields.find((field) => field.key === 'roast_id')!.value).toBe(4498);
	});

	it('reports the plan closed once every step succeeded', () => {
		const cards = planCards();
		for (const card of cards) card.block.data.status = 'success';
		expect(planHasActionableSteps(cards, 'plan-1')).toBe(false);
	});

	it('reports no actionable step when a waiting binding cannot resolve', () => {
		const cards = planCards();
		cards[1]!.block.data.plan!.bindings = [{ field: 'roast_id', fromStep: 1, from: 'result_id' }];
		cards[0]!.block.data.status = 'success';
		cards[0]!.block.data.result = { success: true };
		expect(resolveReadyPlanSteps(cards, 'plan-1')).toEqual([]);
		expect(planHasActionableSteps(cards, 'plan-1')).toBe(false);
	});

	it('keeps a failed step actionable so the user can retry it', () => {
		const cards = planCards();
		cards[0]!.block.data.status = 'failed';
		expect(planHasActionableSteps(cards, 'plan-1')).toBe(true);
	});

	it('applies the plan-level required list without per-field flags', () => {
		const part = structuredClone(planPart);
		const buyer = part.output.action_plan.steps[1]!.fields.find((f) => f.key === 'buyer')!;
		delete (buyer as { required?: boolean }).required;
		const [, sale] = [
			extractBlockFromPart(part, { messageId: 'msg-1' }),
			...extractCompanionBlocks(part, { messageId: 'msg-1' })
		] as ActionCardBlock[];
		expect(sale!.data.fields.find((field) => field.key === 'buyer')!.required).toBe(true);
		expect(missingRequiredFields(sale!.data.fields)).toEqual(['Buyer']);
	});

	it('treats a cleared number as missing', () => {
		expect(
			missingRequiredFields([
				{ key: 'price', label: 'Price', value: '', type: 'number', editable: true, required: true },
				{
					key: 'oz',
					label: 'Oz',
					value: Number.NaN,
					type: 'number',
					editable: true,
					required: true
				}
			])
		).toEqual(['Price', 'Oz']);
	});
});
