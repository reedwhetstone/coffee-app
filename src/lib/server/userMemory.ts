import type { ParchmentClient } from '@purveyors/sdk';
import { getConversationMemory, updateConversationMemory } from '$lib/server/parchmentConversation';

export const USER_MEMORY_MAX_CHARS = 8000;

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
