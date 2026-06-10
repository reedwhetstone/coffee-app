/**
 * Page chat context: a per-route description of what the user is currently
 * looking at, published by app surfaces and attached to outgoing chat
 * messages (A-PR2 of the AI integration plan).
 *
 * The context is descriptive only — it never grants the model access to
 * anything; tools still enforce all entitlements. It is snapshotted at
 * message-send time and only sent when it changed since the last message,
 * keeping the token cost bounded.
 */

export const PAGE_CHAT_SURFACES = [
	'catalog',
	'analytics',
	'dashboard',
	'beans',
	'roast',
	'profit'
] as const;

export type PageChatSurface = (typeof PAGE_CHAT_SURFACES)[number];

export const PAGE_CHAT_ENTITY_TYPES = ['coffee', 'inventory_bean', 'roast', 'supplier'] as const;

export type PageChatEntityType = (typeof PAGE_CHAT_ENTITY_TYPES)[number];

export interface PageChatEntity {
	type: PageChatEntityType;
	id: number | string;
	label: string;
}

export interface PageChatContext {
	surface: PageChatSurface;
	/** Human-readable scope line, e.g. "Catalog filtered to Ethiopia, washed (23 results)" */
	summary: string;
	/** Specific items in view the model can reference by exact ID */
	entities?: PageChatEntity[];
}

export const PAGE_CONTEXT_MAX_SUMMARY_CHARS = 600;
export const PAGE_CONTEXT_MAX_ENTITIES = 8;
export const PAGE_CONTEXT_MAX_LABEL_CHARS = 120;

/** Clamp a context to its token budget before storing/sending. */
export function clampPageChatContext(context: PageChatContext): PageChatContext {
	return {
		surface: context.surface,
		summary: context.summary.slice(0, PAGE_CONTEXT_MAX_SUMMARY_CHARS).trim(),
		entities: context.entities?.slice(0, PAGE_CONTEXT_MAX_ENTITIES).map((entity) => ({
			type: entity.type,
			id: entity.id,
			label: entity.label.slice(0, PAGE_CONTEXT_MAX_LABEL_CHARS).trim()
		}))
	};
}

let current = $state<PageChatContext | null>(null);

export const pageChatContext = {
	get current(): PageChatContext | null {
		return current;
	},
	set(context: PageChatContext): void {
		current = clampPageChatContext(context);
	},
	clear(): void {
		current = null;
	}
};
