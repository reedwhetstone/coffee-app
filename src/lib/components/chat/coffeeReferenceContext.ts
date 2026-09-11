import type { CoffeeReference } from '$lib/services/coffeeReferences';

export const COFFEE_REFERENCE_CONTEXT = Symbol('coffee-answer-reference');
export interface CoffeeReferenceContext {
	resolve: (id: number) => CoffeeReference | undefined;
	open: (reference: CoffeeReference, trigger: HTMLButtonElement) => void;
}
