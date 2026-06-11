import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { requireChatAccess } from '$lib/server/auth';
import type { RequestHandler } from './$types';
import type { Json } from '$lib/types/database.types';

const MAX_BATCH_MESSAGES = 50;
const MAX_CONTENT_CHARS = 12000;
const MAX_PARTS_JSON_CHARS = 200000;

const boundedJsonArraySchema = z.array(z.unknown()).max(100);

const persistedMessageSchema = z.object({
	role: z.enum(['user', 'assistant']),
	content: z.string().max(MAX_CONTENT_CHARS),
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
				validateJsonSize('parts', msg.parts ?? []);
				validateJsonSize('canvas_mutations', msg.canvas_mutations ?? []);
			}
		} catch (err) {
			return json({ error: (err as Error).message }, { status: 413 });
		}

		const rows = messages.map((msg) => ({
			workspace_id: workspaceId,
			role: msg.role,
			content: msg.content,
			parts: (msg.parts ?? []) as Json,
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
