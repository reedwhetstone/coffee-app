import type { ParchmentClient } from '@purveyors/sdk';
import { getConversationMemory, updateConversationMemory } from '$lib/server/parchmentConversation';

export const USER_MEMORY_MAX_CHARS = 8000;
export const USER_MEMORY_DREAM_COOLDOWN_MS = 10 * 60 * 1000;

export interface UserMemoryRow {
	content: string;
	version: number;
	updated_at: string;
	updated_by: 'user' | 'agent' | null;
}

export async function getUserMemory(client: ParchmentClient): Promise<UserMemoryRow> {
	const memory = await getConversationMemory(client);
	return {
		content: memory.content,
		version: memory.version,
		updated_at: memory.updatedAt ?? '',
		updated_by: memory.updatedBy
	};
}

export async function saveUserMemory(
	client: ParchmentClient,
	content: string,
	updatedBy: 'user' | 'agent',
	expectedVersion: number
): Promise<UserMemoryRow> {
	const memory = await updateConversationMemory(client, {
		content: content.slice(0, USER_MEMORY_MAX_CHARS),
		updatedBy,
		expectedVersion
	});
	return {
		content: memory.content,
		version: memory.version,
		updated_at: memory.updatedAt ?? '',
		updated_by: memory.updatedBy
	};
}

export function buildDreamPrompt(
	existingMemory: string,
	conversationText: string,
	userName?: string
): string {
	return `CHERRY RUNTIME MEMORY COMPACTION
Maintain the persistent memory document for ${userName || 'a user'} of a coffee intelligence platform (sourcing, green coffee catalog, roasting, market analysis). The document is injected into every future conversation, so it must stay compact and durable.

CURRENT MEMORY DOCUMENT:
${existingMemory || '(empty)'}

RECENT CONVERSATION:
${conversationText}

Rewrite the full memory document, merging in anything durable from the recent conversation. Rules:
- Keep it under 500 words of plain markdown with short sections (e.g. Preferences, Equipment & setup, Ongoing work, Key facts)
- Keep only durable information: stable preferences, equipment, suppliers they work with, recurring goals, decisions, constraints
- Drop transient details: individual search results, one-off questions, pleasantries, anything fully resolved
- Preserve existing entries unless the conversation contradicts or updates them — the user may have written some lines by hand, treat those with extra care
- Never invent facts that are not in the current document or the conversation
- Output ONLY the updated document, no preamble or commentary`;
}
