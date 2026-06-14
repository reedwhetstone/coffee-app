import {
	buildSearchDataCacheThroughPart,
	extractBlockFromPart,
	extractCanvasMutationsFromPart,
	extractCompanionBlocks,
	messageHasPresentResults
} from '$lib/services/blockExtractor';
import type { CanvasMutation } from '$lib/types/genui';

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

export function buildMessageCanvasMutations(
	messages: ChatPersistenceMessage[],
	message: ChatPersistenceMessage
): CanvasMutation[] {
	if (message.role !== 'assistant') return [];

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
			.join('\n');
		const payload: PersistedChatMessagePayload = {
			role: msg.role,
			content,
			parts: msg.parts,
			canvas_mutations: buildMessageCanvasMutations(messages, msg),
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
