import {
	buildSearchDataCacheThroughPart,
	extractBlockFromPart,
	extractCanvasMutationsFromPart,
	extractCompanionBlocks,
	messageHasPresentResults
} from '$lib/services/blockExtractor';
import type { CanvasMutation } from '$lib/types/genui';
import { getInterruptedTurnStatus } from '$lib/components/chat/chatRecovery';

type ChatPersistencePart = {
	type: string;
	[key: string]: unknown;
};

type ChatPersistenceMessage = {
	id: string;
	role: string;
	parts: ChatPersistencePart[];
	createdAt?: unknown;
};

export type PersistedChatMessagePayload = {
	role: string;
	content: string;
	parts: ChatPersistencePart[];
	canvas_mutations: CanvasMutation[];
	client_message_id: string;
	client_created_at?: string;
};

/** Last-resort save shape for an upstream 413, retaining the turn and action receipt. */
export function compactPersistedMessageForRetry(
	message: PersistedChatMessagePayload
): PersistedChatMessagePayload {
	const actions = message.parts.flatMap((part) => {
		const card = (part.output as { action_card?: Record<string, unknown> } | undefined)
			?.action_card;
		if (!card || typeof card.executionId !== 'string') return [];
		return [
			{
				type: part.type,
				...(part.type === 'dynamic-tool' ? { toolName: part.toolName } : {}),
				toolCallId: part.toolCallId,
				input: {},
				state: part.state,
				output: {
					action_card: {
						executionId: card.executionId,
						actionType: card.actionType,
						summary: String(card.summary ?? '').slice(0, 500),
						status: card.status,
						fields: []
					}
				}
			}
		];
	});
	const content = message.content.slice(0, 12_000);
	return {
		...message,
		content,
		parts: [{ type: 'text', text: content }, ...actions.slice(0, 20)],
		canvas_mutations: []
	};
}

// Keep each append below both the message endpoint's structured-data limit and
// the hosting platform's request limit. Full results remain on the canvas.
const MAX_PERSISTED_TEXT = 120_000;
const MAX_PERSISTED_PARTS_JSON = 120_000;
const MAX_PERSISTED_MUTATIONS_JSON = 60_000;

function compactParts(parts: ChatPersistencePart[]): ChatPersistencePart[] {
	if (JSON.stringify(parts).length <= MAX_PERSISTED_PARTS_JSON) return parts;
	const compacted: ChatPersistencePart[] = parts.map((part) => {
		if (part.type === 'text') {
			return { ...part, text: String(part.text ?? '').slice(0, MAX_PERSISTED_TEXT) };
		}
		if (!part.type.startsWith('tool-') && part.type !== 'dynamic-tool') return { type: part.type };
		const output = part.output as Record<string, unknown> | undefined;
		return {
			type: part.type,
			...(part.type === 'dynamic-tool' ? { toolName: part.toolName } : {}),
			toolCallId: part.toolCallId,
			// Tool results remain in model history after reload. Keep the required
			// input field, but shed an oversized argument payload with the result.
			input: JSON.stringify(part.input ?? {}).length <= 10_000 ? (part.input ?? {}) : {},
			state: part.state,
			output: output?.action_card
				? { action_card: output.action_card }
				: { summary: 'Large result is available on the canvas.' }
		};
	});
	if (JSON.stringify(compacted).length <= MAX_PERSISTED_PARTS_JSON) return compacted;
	// Multiple long text parts or a huge proposal can still exceed the cap.
	// Preserve a readable turn and the action receipt with a hard final bound.
	const minimal: ChatPersistencePart[] = compacted.slice(0, 100).map((part) => {
		if (part.type === 'text')
			return { type: 'text', text: String('text' in part ? part.text : '').slice(0, 2000) };
		const card = (part.output as { action_card?: Record<string, unknown> } | undefined)
			?.action_card;
		const minimalTool = {
			type: part.type,
			...(part.type === 'dynamic-tool' ? { toolName: part.toolName } : {}),
			toolCallId: part.toolCallId,
			input: {},
			state: part.state,
			output: card
				? {
						action_card: {
							executionId: card.executionId,
							actionType: card.actionType,
							summary: String(card.summary ?? '').slice(0, 500),
							status: card.status,
							fields: []
						}
					}
				: { summary: 'Large result is available on the canvas.' }
		};
		return minimalTool;
	});
	return JSON.stringify(minimal).length <= MAX_PERSISTED_PARTS_JSON
		? minimal
		: [
				{
					type: 'text',
					text: 'This turn contained a large result. Its working data is on the canvas.'
				}
			];
}

export function buildMessageCanvasMutations(
	messages: ChatPersistenceMessage[],
	message: ChatPersistenceMessage
): CanvasMutation[] {
	if (message.role !== 'assistant' || getInterruptedTurnStatus(message.parts)) return [];

	const mutations: CanvasMutation[] = [];
	const hasPR = messageHasPresentResults(message.parts);
	const messageIndex = messages.findIndex((candidate) => candidate.id === message.id);

	for (const [partIndex, part] of message.parts.entries()) {
		if (!part.type.startsWith('tool-')) continue;

		const searchDataCache =
			hasPR && messageIndex >= 0
				? buildSearchDataCacheThroughPart(messages, messageIndex, partIndex)
				: undefined;
		const extractorOptions = { searchDataCache, hasPresentResults: hasPR };
		const block = extractBlockFromPart(part, extractorOptions);
		const explicitMutations = extractCanvasMutationsFromPart(part, block, message.id);

		if (explicitMutations) {
			mutations.push(...explicitMutations);
			continue;
		}

		if (block && block.type !== 'error') {
			mutations.push({ type: 'add', block, messageId: message.id });
			for (const companion of extractCompanionBlocks(part)) {
				mutations.push({ type: 'add', block: companion, messageId: message.id });
			}
		}
	}

	return mutations;
}

export function buildPersistedChatMessages(
	messages: ChatPersistenceMessage[]
): PersistedChatMessagePayload[] {
	return messages.map((msg) => {
		const textParts = msg.parts.filter((part) => part.type === 'text');
		const content = textParts
			.map((part) => (typeof part.text === 'string' ? part.text : ''))
			.join('\n')
			.slice(0, MAX_PERSISTED_TEXT);
		const mutations = buildMessageCanvasMutations(messages, msg);
		const payload: PersistedChatMessagePayload = {
			role: msg.role,
			content,
			parts: compactParts(msg.parts),
			canvas_mutations:
				JSON.stringify(mutations).length <= MAX_PERSISTED_MUTATIONS_JSON ? mutations : [],
			client_message_id: msg.id
		};

		// AI SDK UI messages do not guarantee a top-level createdAt. Do not synthesize
		// one on the client; omitting it lets the server apply its per-row monotonic
		// fallback for batch saves.
		if (msg.createdAt instanceof Date) {
			payload.client_created_at = msg.createdAt.toISOString();
		}

		return payload;
	});
}
