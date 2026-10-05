import { parseCompareSide, type CompareSide } from './compare-sides';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type PlanLink =
	| { kind: 'from'; side: CompareSide }
	| { kind: 'plan'; id: string }
	| { kind: 'new' };

export function readPlanLink(params: URLSearchParams): PlanLink {
	const plan = params.get('plan');
	if (plan && UUID.test(plan)) return { kind: 'plan', id: plan.toLowerCase() };
	const side = parseCompareSide(params.get('from'));
	return side ? { kind: 'from', side } : { kind: 'new' };
}

export function planHref(side?: CompareSide): string {
	return side ? `/roast/plan?from=${side.type}:${side.id}` : '/roast/plan';
}

export function savedPlanHref(id: string): string {
	return `/roast/plan?plan=${id}`;
}
