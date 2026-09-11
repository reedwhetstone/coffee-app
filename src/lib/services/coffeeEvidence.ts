import { buildSearchDataCacheThroughPart, type MessagePartsLike } from './blockExtractor';

function record(value: unknown): Record<string, unknown> | null {
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

export function validCoffeeEvidence(value: unknown): boolean {
	const coffee = record(value);
	return Boolean(
		coffee &&
			typeof coffee.id === 'number' &&
			Number.isSafeInteger(coffee.id) &&
			coffee.id > 0 &&
			typeof coffee.name === 'string' &&
			coffee.name.trim()
	);
}

/** Shared admission for progressive display and terminal recovery of the same read. */
export function isCompletedCoffeeSearch(value: unknown): boolean {
	const part = record(value);
	if (
		typeof part?.type !== 'string' ||
		!part.type.startsWith('tool-') ||
		part.state !== 'output-available'
	)
		return false;
	const tool = part.toolName ?? part.type.slice(5);
	if (tool !== 'coffee_catalog_search' && tool !== 'catalog_rank') return false;
	const output = record(part.output);
	return Boolean(
		output &&
			output.success !== false &&
			!output.error &&
			!output.action_card &&
			Array.isArray(output.coffees) &&
			output.coffees.length > 0 &&
			output.coffees.every(validCoffeeEvidence)
	);
}

export function coffeeEvidenceCacheThroughPart(
	messages: MessagePartsLike[],
	messageIndex: number,
	partIndex: number
) {
	return buildSearchDataCacheThroughPart(
		messages.map((message) => ({
			parts: (message.parts ?? []).map((part) =>
				isCompletedCoffeeSearch(part) ? part : { type: 'text', text: '' }
			)
		})),
		messageIndex,
		partIndex
	);
}
