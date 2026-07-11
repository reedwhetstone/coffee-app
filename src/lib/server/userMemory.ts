/**
 * User memory: a persistent context document injected into every chat
 * request and maintained by the agent via periodic "dream" compaction.
 *
 * The table is newer than the generated Database types in some
 * environments, so this module uses a narrow runtime row contract
 * (same pattern as priceIndexResource).
 */

export const USER_MEMORY_MAX_CHARS = 8000;
/** Skip agent compaction if the doc was updated more recently than this. */
export const USER_MEMORY_DREAM_COOLDOWN_MS = 10 * 60 * 1000;

export interface UserMemoryRow {
	content: string;
	updated_at: string;
	updated_by: 'user' | 'agent';
}

interface MemoryQueryResult {
	data: Partial<UserMemoryRow> | null;
	error: { message: string; code?: string } | null;
}

interface MemoryClient {
	from(table: 'user_memory'): {
		select(columns: string): {
			eq(
				column: 'user_id',
				value: string
			): {
				maybeSingle(): Promise<MemoryQueryResult>;
			};
		};
		upsert(row: {
			user_id: string;
			content: string;
			updated_at: string;
			updated_by: 'user' | 'agent';
		}): PromiseLike<{ error: { message: string } | null }>;
	};
}

export async function getUserMemory(
	client: unknown,
	userId: string
): Promise<UserMemoryRow | null> {
	const { data, error } = await (client as MemoryClient)
		.from('user_memory')
		.select('content, updated_at, updated_by')
		.eq('user_id', userId)
		.maybeSingle();

	if (error || !data || typeof data.content !== 'string') return null;
	return {
		content: data.content,
		updated_at: String(data.updated_at ?? ''),
		updated_by: data.updated_by === 'agent' ? 'agent' : 'user'
	};
}

export async function saveUserMemory(
	client: unknown,
	userId: string,
	content: string,
	updatedBy: 'user' | 'agent'
): Promise<{ error: string | null }> {
	const { error } = await (client as MemoryClient).from('user_memory').upsert({
		user_id: userId,
		content: content.slice(0, USER_MEMORY_MAX_CHARS),
		updated_at: new Date().toISOString(),
		updated_by: updatedBy
	});
	return { error: error?.message ?? null };
}

export function buildDreamPrompt(
	existingMemory: string,
	conversationText: string,
	userName?: string
): string {
	return `You maintain a persistent memory document for ${userName || 'a user'} of a coffee intelligence platform (sourcing, green coffee catalog, roasting, market analysis). The document is injected into every future conversation, so it must stay compact and durable.

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
