import { createHash } from 'node:crypto';
import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { requireChatAccess } from '$lib/server/auth';
import { createParchmentServerClient, ParchmentConfigError } from '$lib/server/parchmentClient';
import {
	appendConversationMessages,
	clearConversationMessages,
	legacyConversationError,
	ParchmentConversationError
} from '$lib/server/parchmentConversation';
import type { RequestHandler } from './$types';
import type { ConversationMessageAppendRequest } from '@purveyors/sdk';

const MAX_BATCH_MESSAGES = 50;
const MAX_DUPLICATE_CONTENT_CHARS = 12000;
const MAX_MESSAGE_TEXT_CHARS = 200000;
const MAX_PARTS_JSON_CHARS = 200000;
const boundedJsonArraySchema = z.array(z.unknown()).max(100);

const persistedMessageSchema = z
	.object({
		role: z.enum(['user', 'assistant']),
		content: z.string().max(MAX_MESSAGE_TEXT_CHARS),
		parts: boundedJsonArraySchema.optional(),
		canvas_mutations: boundedJsonArraySchema.optional(),
		client_message_id: z.string().min(1).max(200).optional(),
		client_created_at: z.string().datetime().optional()
	})
	.strict();

const appendBodySchema = z
	.object({
		expected_reset_epoch: z.number().int().min(0),
		messages: z.array(persistedMessageSchema).min(1).max(MAX_BATCH_MESSAGES)
	})
	.strict();

const clearBodySchema = z.object({ expected_reset_epoch: z.number().int().min(0) }).strict();

function failure(error: unknown) {
	if (error instanceof ParchmentConversationError) {
		return json(legacyConversationError(error.body), { status: error.status });
	}
	if (error instanceof ParchmentConfigError) {
		return json({ error: 'Conversation state is temporarily unavailable' }, { status: 503 });
	}
	const status = (error as { status?: number }).status || 500;
	return json({ error: (error as Error).message }, { status });
}

function derivedClientMessageId(workspaceId: string, message: unknown): string {
	return `legacy-${createHash('sha256')
		.update(JSON.stringify({ workspaceId, message }))
		.digest('hex')}`;
}

export const POST: RequestHandler = async (event) => {
	try {
		await requireChatAccess(event);
		const parsed = appendBodySchema.safeParse(await event.request.json().catch(() => null));
		if (!parsed.success) return json({ error: 'Invalid message payload' }, { status: 400 });
		for (const message of parsed.data.messages) {
			if (
				JSON.stringify(message.parts ?? []).length > MAX_PARTS_JSON_CHARS ||
				JSON.stringify(message.canvas_mutations ?? []).length > MAX_PARTS_JSON_CHARS
			) {
				return json({ error: 'Message structured data is too large' }, { status: 413 });
			}
		}
		const client = await createParchmentServerClient(event, { mode: 'session' });
		const data = await appendConversationMessages(client, event.params.id, {
			expectedResetEpoch: parsed.data.expected_reset_epoch,
			messages: parsed.data.messages.map((message) => ({
				clientMessageId:
					message.client_message_id ?? derivedClientMessageId(event.params.id, message),
				role: message.role,
				content: message.content.slice(0, MAX_DUPLICATE_CONTENT_CHARS),
				parts:
					(message.parts && message.parts.length > 0 ? message.parts : undefined) ??
					(message.content.length > MAX_DUPLICATE_CONTENT_CHARS
						? [{ type: 'text', text: message.content }]
						: undefined),
				canvasMutations: message.canvas_mutations,
				clientCreatedAt: message.client_created_at
			})) as ConversationMessageAppendRequest['messages']
		});
		return json(
			{
				messages: [],
				inserted: data.inserted,
				replayed: data.replayed,
				reset_epoch: data.resetEpoch,
				next_message_sequence: data.nextMessageSequence
			},
			{ status: 201 }
		);
	} catch (error) {
		return failure(error);
	}
};

export const DELETE: RequestHandler = async (event) => {
	try {
		await requireChatAccess(event);
		const parsed = clearBodySchema.safeParse(await event.request.json().catch(() => null));
		if (!parsed.success) return json({ error: 'Invalid clear payload' }, { status: 400 });
		const client = await createParchmentServerClient(event, { mode: 'session' });
		const data = await clearConversationMessages(
			client,
			event.params.id,
			parsed.data.expected_reset_epoch
		);
		return json({
			success: true,
			deleted: data.deleted,
			reset_epoch: data.resetEpoch,
			summary_version: data.summaryVersion,
			canvas_version: data.canvasVersion
		});
	} catch (error) {
		return failure(error);
	}
};
