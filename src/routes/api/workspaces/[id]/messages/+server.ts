import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { requireChatAccess } from '$lib/server/auth';
import type { RequestHandler } from './$types';
import type { Json } from '$lib/types/database.types';

const MAX_BATCH_MESSAGES = 50;
const MAX_DUPLICATE_CONTENT_CHARS = 12000;
const MAX_MESSAGE_TEXT_CHARS = 200000;
const MAX_PARTS_JSON_CHARS = 200000;

const boundedJsonArraySchema = z.array(z.unknown()).max(100);

const persistedMessageSchema = z.object({
	role: z.enum(['user', 'assistant']),
	content: z.string().max(MAX_MESSAGE_TEXT_CHARS),
	parts: boundedJsonArraySchema.optional(),
	canvas_mutations: boundedJsonArraySchema.optional()
});

const messageBodySchema = z.union([
	z.object({ messages: z.array(persistedMessageSchema).min(1).max(MAX_BATCH_MESSAGES) }),
	persistedMessageSchema
]);

function jsonSize(value: unknown): number {
	return JSON.stringify(value ?? null).length;
}

function validateJsonSize(label: string, value: unknown) {
	if (jsonSize(value) > MAX_PARTS_JSON_CHARS) {
		throw new Error(`${label} exceeds ${MAX_PARTS_JSON_CHARS} serialized characters`);
	}
}

function truncateDuplicatedContent(content: string): string {
	return content.length > MAX_DUPLICATE_CONTENT_CHARS
		? content.slice(0, MAX_DUPLICATE_CONTENT_CHARS)
		: content;
}

function persistedPartsFor(msg: z.infer<typeof persistedMessageSchema>): unknown[] {
	if (msg.parts && msg.parts.length > 0) return msg.parts;

	// If an older caller posts an oversized text-only message, keep the full
	// text in structured parts and truncate only the duplicate content column.
	if (msg.content.length > MAX_DUPLICATE_CONTENT_CHARS) {
		return [{ type: 'text', text: msg.content }];
	}

	return msg.parts ?? [];
}

function canonicalJson(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map(canonicalJson);
	}

	if (value && typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>)
				.sort(([left], [right]) => left.localeCompare(right))
				.map(([key, child]) => [key, canonicalJson(child)])
		);
	}

	return value;
}

function messageSignature(message: { role: string; content: string; parts?: unknown }): string {
	return JSON.stringify({
		role: message.role,
		content: message.content,
		parts: canonicalJson(message.parts ?? [])
	});
}

function findPersistedPrefixOverlap(
	existingMessages: Array<{ role: string; content: string; parts?: unknown }>,
	incomingMessages: Array<{ role: string; content: string; parts?: unknown }>
): number {
	const existingSignatures = existingMessages.map(messageSignature);
	const incomingSignatures = incomingMessages.map(messageSignature);
	const maxOverlap = Math.min(existingSignatures.length, incomingSignatures.length);

	for (let overlap = maxOverlap; overlap > 0; overlap--) {
		const existingSuffix = existingSignatures.slice(existingSignatures.length - overlap);
		const incomingPrefix = incomingSignatures.slice(0, overlap);
		if (existingSuffix.every((signature, index) => signature === incomingPrefix[index])) {
			return overlap;
		}
	}

	return 0;
}

// POST /api/workspaces/[id]/messages - Save messages for a workspace
export const POST: RequestHandler = async (event) => {
	try {
		const { user } = await requireChatAccess(event);
		const workspaceId = event.params.id;
		const body = await event.request.json().catch(() => null);

		if (!body) {
			return json({ error: 'Invalid JSON payload' }, { status: 400 });
		}

		const parsed = messageBodySchema.safeParse(body);

		if (!parsed.success) {
			return json({ error: 'Invalid message payload' }, { status: 400 });
		}

		// Verify workspace ownership
		const { data: workspace } = await event.locals.supabase
			.from('workspaces')
			.select('id')
			.eq('id', workspaceId)
			.eq('user_id', user.id)
			.single();

		if (!workspace) {
			return json({ error: 'Workspace not found' }, { status: 404 });
		}

		const messages = 'messages' in parsed.data ? parsed.data.messages : [parsed.data];

		try {
			for (const msg of messages) {
				validateJsonSize('parts', persistedPartsFor(msg));
				validateJsonSize('canvas_mutations', msg.canvas_mutations ?? []);
			}
		} catch (err) {
			return json({ error: (err as Error).message }, { status: 413 });
		}

		const { data: recentMessages } = await event.locals.supabase
			.from('workspace_messages')
			.select('id, role, content, parts')
			.eq('workspace_id', workspaceId)
			.order('created_at', { ascending: false })
			.order('id', { ascending: false })
			.limit(messages.length);

		const persistedIncoming = messages.map((msg) => ({
			role: msg.role,
			content: truncateDuplicatedContent(msg.content),
			parts: persistedPartsFor(msg)
		}));
		const overlap = findPersistedPrefixOverlap(
			[
				...((recentMessages ?? []) as Array<{ role: string; content: string; parts?: unknown }>)
			].reverse(),
			persistedIncoming
		);
		const messagesToInsert = messages.slice(overlap);

		if (messagesToInsert.length === 0) {
			return json({ messages: [] }, { status: 201 });
		}

		const rows = messagesToInsert.map((msg) => ({
			workspace_id: workspaceId,
			role: msg.role,
			content: truncateDuplicatedContent(msg.content),
			parts: persistedPartsFor(msg) as Json,
			canvas_mutations: (msg.canvas_mutations ?? []) as Json
		}));

		const { data, error } = await event.locals.supabase
			.from('workspace_messages')
			.insert(rows)
			.select();

		if (error) {
			return json({ error: error.message }, { status: 500 });
		}

		// Update last_accessed_at
		await event.locals.supabase
			.from('workspaces')
			.update({ last_accessed_at: new Date().toISOString() })
			.eq('id', workspaceId);

		return json({ messages: data }, { status: 201 });
	} catch (err) {
		const status = (err as { status?: number }).status || 500;
		return json({ error: (err as Error).message }, { status });
	}
};

// DELETE /api/workspaces/[id]/messages - Clear all messages in workspace
export const DELETE: RequestHandler = async (event) => {
	try {
		const { user } = await requireChatAccess(event);
		const workspaceId = event.params.id;

		// Verify workspace ownership
		const { data: workspace } = await event.locals.supabase
			.from('workspaces')
			.select('id')
			.eq('id', workspaceId)
			.eq('user_id', user.id)
			.single();

		if (!workspace) {
			return json({ error: 'Workspace not found' }, { status: 404 });
		}

		const { error } = await event.locals.supabase
			.from('workspace_messages')
			.delete()
			.eq('workspace_id', workspaceId);

		if (error) {
			return json({ error: error.message }, { status: 500 });
		}

		return json({ success: true });
	} catch (err) {
		const status = (err as { status?: number }).status || 500;
		return json({ error: (err as Error).message }, { status });
	}
};
