import type { UIMessage } from 'ai';

/**
 * Opaque request context travels beside the visible user text. The conversation
 * stores it for later turns, but only the request projection turns it into text
 * the model can read; message bubbles and exports never render it.
 */
export const REQUEST_CONTEXT_PART = 'data-cherry-request-context';

export interface ChatRequestContext {
	/** Model-facing context, such as opaque reference or selection identities. */
	text: string;
	/** Optional customer-safe label shown with the user message. */
	label?: string;
}

export function buildChatRequestParts(
	text: string,
	context: ChatRequestContext | null
): UIMessage['parts'] {
	const parts: UIMessage['parts'] = [{ type: 'text', text }];
	if (context) parts.push({ type: REQUEST_CONTEXT_PART, data: { version: 1, ...context } });
	return parts;
}

/** Plain requests stay ordinary text messages; context rides in its own part. */
export function buildChatRequestMessage(
	text: string,
	context: ChatRequestContext | null
): { text: string } | { parts: UIMessage['parts'] } {
	return context ? { parts: buildChatRequestParts(text, context) } : { text };
}

export function readChatRequestContext(part: unknown): ChatRequestContext | null {
	if (!part || typeof part !== 'object') return null;
	const candidate = part as { type?: unknown; data?: unknown };
	if (candidate.type !== REQUEST_CONTEXT_PART) return null;
	const data =
		candidate.data && typeof candidate.data === 'object'
			? (candidate.data as { text?: unknown; label?: unknown })
			: null;
	if (!data || typeof data.text !== 'string' || !data.text.trim()) return null;
	return typeof data.label === 'string' && data.label.trim()
		? { text: data.text, label: data.label }
		: { text: data.text };
}
