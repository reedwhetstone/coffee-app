import { sanitizeTree } from './catalog';
import type { UITreeBlock } from '$lib/types/genui';

/**
 * Coffee-focused roast plan: a checklist for the roast session plus the
 * numbers worth recording before the drum is charged. State is shared with
 * Cherry through the canvas, so the assistant sees what is done and what the
 * roaster entered on the next turn.
 */
export function buildRoastPlanBlock(coffeeName?: string): UITreeBlock {
	const name = coffeeName?.trim().slice(0, 60) || undefined;
	const { root } = sanitizeTree({
		type: 'stack',
		id: 'roast-plan-root',
		props: { gap: 'md' },
		children: [
			{
				type: 'card',
				id: 'roast-plan-setup',
				props: { title: 'Before you charge', subtitle: name },
				children: [
					{
						type: 'grid',
						id: 'roast-plan-inputs',
						props: { columns: 3, gap: 'sm' },
						children: [
							{
								type: 'number-field',
								id: 'batch-weight',
								props: { label: 'Batch size', unit: 'lb', min: 0, step: 0.1 }
							},
							{
								type: 'number-field',
								id: 'charge-temp',
								props: { label: 'Charge temp', unit: '°F', min: 0, step: 1 }
							},
							{
								type: 'number-field',
								id: 'target-drop',
								props: { label: 'Target drop temp', unit: '°F', min: 0, step: 1 }
							}
						]
					},
					{
						type: 'text-field',
						id: 'plan-notes',
						props: {
							label: 'Plan notes',
							placeholder: 'Airflow, development target, what to change from last roast',
							multiline: true
						}
					}
				]
			},
			{
				type: 'checklist',
				id: 'roast-plan-steps',
				props: {
					title: 'Roast plan',
					items: [
						{ id: 'weigh', label: 'Weigh green coffee', detail: 'Match the batch size above.' },
						{ id: 'preheat', label: 'Preheat the drum to charge temperature' },
						{ id: 'profile', label: 'Load the profile and start logging' },
						{ id: 'charge', label: 'Charge and note turning point' },
						{ id: 'first-crack', label: 'Mark first crack' },
						{ id: 'drop', label: 'Drop at target and start cooling' },
						{ id: 'weigh-out', label: 'Weigh roasted coffee and record loss' },
						{ id: 'cup', label: 'Rest, then cup and log tasting notes' }
					]
				}
			}
		]
	});
	return {
		type: 'ui-tree',
		version: 1,
		data: { title: name ? `Roast plan: ${name}` : 'Roast plan', root: root! }
	};
}
