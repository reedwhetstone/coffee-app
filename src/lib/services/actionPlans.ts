import type { ActionCardBlock, ActionCardPayload, ActionField } from '$lib/types/genui';

type PlanCard = { id: string; block: ActionCardBlock };

export function actionStatusLabel(status: ActionCardPayload['status']): string {
	switch (status) {
		case 'success':
			return 'Completed';
		case 'proposed':
			return 'Needs confirmation';
		case 'executing':
			return 'Working';
		case 'waiting':
			return 'Waiting on earlier step';
		default:
			return 'Failed';
	}
}

function isBlank(value: unknown): boolean {
	return value === undefined || value === null || (typeof value === 'string' && !value.trim());
}

/** Labels of user-owned fields that are still empty. */
export function missingRequiredFields(fields: ActionField[]): string[] {
	return fields.filter((field) => field.required && isBlank(field.value)).map((f) => f.label);
}

function planCards(cards: Array<{ id: string; block: unknown }>, planId: string): PlanCard[] {
	return cards.filter(
		(entry): entry is PlanCard =>
			(entry.block as ActionCardBlock | undefined)?.type === 'action-card' &&
			(entry.block as ActionCardBlock).data.plan?.planId === planId
	);
}

export type ReadyPlanStep = {
	blockId: string;
	executionId: string | undefined;
	fields: ActionField[];
};

/**
 * Waiting steps whose prerequisites have all succeeded, with their bound fields
 * filled from the prerequisites' confirmed fields or returned resource IDs.
 * Values come from what actually executed, so edits the user made to an
 * earlier card carry forward.
 */
export function resolveReadyPlanSteps(
	cards: Array<{ id: string; block: unknown }>,
	planId: string
): ReadyPlanStep[] {
	const steps = planCards(cards, planId);
	const byStep = new Map(steps.map((entry) => [entry.block.data.plan!.step, entry.block.data]));
	const ready: ReadyPlanStep[] = [];

	for (const entry of steps) {
		const card = entry.block.data;
		if (card.status !== 'waiting' || !card.plan) continue;
		const values = new Map<string, unknown>();
		let resolved = true;
		for (const binding of card.plan.bindings) {
			const source = byStep.get(binding.fromStep);
			if (source?.status !== 'success') {
				resolved = false;
				break;
			}
			const value =
				binding.from === 'result_id'
					? (source.result as { id?: unknown } | undefined)?.id
					: source.fields.find((field) => field.key === binding.from)?.value;
			if (isBlank(value)) {
				resolved = false;
				break;
			}
			values.set(binding.field, value);
		}
		if (!resolved) continue;
		ready.push({
			blockId: entry.id,
			executionId: card.executionId,
			fields: card.fields.map((field) =>
				values.has(field.key) ? { ...field, value: values.get(field.key) } : field
			)
		});
	}
	return ready;
}

/** True while any step of the plan has not completed. */
export function planHasOpenSteps(cards: Array<{ id: string; block: unknown }>, planId: string) {
	return planCards(cards, planId).some((entry) => entry.block.data.status !== 'success');
}
