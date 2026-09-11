import { blockIdentityKey, extractBlockFromPart, type MessagePartsLike } from './blockExtractor';
import {
	coffeeEvidenceCacheThroughPart,
	isCompletedCoffeeSearch,
	validCoffeeEvidence
} from './coffeeEvidence';
import type { CoffeeCardsBlock } from '$lib/types/genui';

export interface InlineCoffeeResult {
	key: string;
	partIndex: number;
	block: CoffeeCardsBlock;
}

/**
 * One latest completed view per coffee source in this answer. A pending or
 * failed presentation cannot hide a completed search. Completed presentations
 * replace their source's raw view atomically using only causally available data.
 * This is transcript selection, not an instruction to mutate the evidence shelf.
 */
export function inlineCoffeeResults(
	messages: MessagePartsLike[],
	messageIndex: number
): InlineCoffeeResult[] {
	const views = new Map<string, InlineCoffeeResult>();
	for (const [partIndex, raw] of (messages[messageIndex]?.parts ?? []).entries()) {
		if (!raw || typeof raw !== 'object') continue;
		const part = raw as Record<string, unknown>;
		if (typeof part.type !== 'string' || !part.type.startsWith('tool-')) continue;
		if (part.state !== 'output-available') continue;
		const toolName = part.toolName ?? part.type.slice(5);
		let source: unknown = toolName;
		const cache = coffeeEvidenceCacheThroughPart(messages, messageIndex, partIndex);
		if (toolName === 'present_results') {
			const output = part.output as {
				presentation?: { source_tool?: unknown };
				success?: boolean;
				error?: unknown;
				action_card?: unknown;
			} | null;
			if (!output || output.success === false || output.error || output.action_card) continue;
			source = output?.presentation?.source_tool;
			const presentation = output?.presentation as
				| { source_tool?: unknown; items?: { id?: unknown }[]; canvas_action?: string }
				| undefined;
			if (
				!presentation ||
				presentation.canvas_action === 'clear' ||
				!Array.isArray(presentation.items) ||
				!presentation.items.length ||
				typeof source !== 'string' ||
				!presentation.items.every(
					(item) =>
						item &&
						typeof item.id === 'number' &&
						validCoffeeEvidence(cache.get(source as string)?.get(item.id))
				)
			)
				continue;
		}
		if (source !== 'coffee_catalog_search' && source !== 'catalog_rank') continue;
		if (toolName !== 'present_results' && !isCompletedCoffeeSearch(part)) continue;
		const block = extractBlockFromPart(part, { searchDataCache: cache });
		if (block?.type !== 'coffee-cards') continue;
		const seen = new Set<number>();
		const data = block.data.filter((coffee) => {
			if (
				!coffee ||
				!Number.isSafeInteger(coffee.id) ||
				coffee.id <= 0 ||
				typeof coffee.name !== 'string' ||
				!coffee.name.trim() ||
				seen.has(coffee.id)
			)
				return false;
			seen.add(coffee.id);
			return true;
		});
		if (data.length === 0) continue;
		views.set(source, { key: source, partIndex, block: { ...block, data } });
	}
	// Ranking and search can return the same list. Keep its most recent view,
	// including the latest annotations, rather than repeat an identical shortlist.
	const byIdentity = new Map<string, InlineCoffeeResult>();
	for (const view of [...views.values()].sort((a, b) => a.partIndex - b.partIndex)) {
		const identity = blockIdentityKey(view.block);
		const previous = byIdentity.get(identity);
		byIdentity.set(identity, { ...view, key: previous?.key ?? view.key });
	}
	return [...byIdentity.values()];
}
