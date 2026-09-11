import type { CoffeeCatalog } from '$lib/types/component.types';
import { isCompletedCoffeeSearch } from './coffeeEvidence';

export interface CoffeeReference {
	coffee: CoffeeCatalog;
	messageId: string;
	partIndex: number;
}
export interface ReferenceMessage {
	id: string;
	role: string;
	parts: unknown[];
}

/** A historical projection of completed assistant reads, never a new data fetch. */
export function coffeeReferencesThroughPart(
	messages: ReferenceMessage[],
	messageIndex: number,
	partIndex: number
): Map<number, CoffeeReference> {
	const references = new Map<number, CoffeeReference>();
	for (let i = 0; i <= messageIndex && i < messages.length; i++) {
		const message = messages[i];
		if (message.role !== 'assistant') continue;
		const end = i === messageIndex ? partIndex : message.parts.length;
		for (let j = 0; j < end; j++) {
			const part = message.parts[j];
			if (!isCompletedCoffeeSearch(part)) continue;
			const { output } = part as { output: { coffees: CoffeeCatalog[] } };
			for (const coffee of output.coffees) {
				references.set(coffee.id, { coffee, messageId: message.id, partIndex: j });
			}
		}
	}
	return references;
}

/** null = ordinary link; invalid/missing IDs remain noninteractive references. */
export function catalogReferenceId(href: string): number | 'unavailable' | null {
	let url: URL;
	try {
		url = new URL(href, 'https://purveyors.io');
	} catch {
		return null;
	}
	if (
		!/^\/(?!\/)|^https:\/\/purveyors\.io\//.test(href) ||
		href.includes('\\') ||
		url.origin !== 'https://purveyors.io' ||
		url.pathname !== '/catalog' ||
		!url.searchParams.has('coffee')
	)
		return null;
	const ids = url.searchParams.getAll('coffee');
	if (ids.length !== 1 || !/^[1-9]\d*$/.test(ids[0])) return 'unavailable';
	const id = Number(ids[0]);
	return Number.isSafeInteger(id) ? id : 'unavailable';
}

export function safeAnswerLink(href: string): string | undefined {
	if (!href) return undefined;
	if (
		href.includes('\\') ||
		Array.from(href).some((char) => char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127)
	)
		return undefined;
	if (/^(?:https?:\/\/|mailto:|\/(?!\/)|#)/i.test(href)) return href;
	if (!href.includes(':') && !href.startsWith('//')) return href;
	return undefined;
}
