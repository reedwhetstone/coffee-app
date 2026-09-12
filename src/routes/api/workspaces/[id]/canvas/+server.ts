import { env } from '$env/dynamic/private';
import { MAX_CANVAS_JSON_CHARS, decodeCanvasState } from '$lib/services/canvasPersistence';
import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { requireChatAccess } from '$lib/server/auth';
import { createParchmentServerClient, ParchmentConfigError } from '$lib/server/parchmentClient';
import {
	ParchmentConversationError,
	legacyConversationError,
	updateConversationCanvas
} from '$lib/server/parchmentConversation';
import type { RequestHandler } from './$types';
import type { ConversationCanvasUpdateRequest } from '@purveyors/sdk';

const canvasBodySchema = z
	.object({
		canvas_state: z.unknown().optional(),
		expected_reset_epoch: z.number().int().min(0),
		expected_canvas_version: z.number().int().min(0)
	})
	.strict();

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

async function persistCanvas(event: Parameters<RequestHandler>[0]) {
	await requireChatAccess(event);
	const parsed = canvasBodySchema.safeParse(await event.request.json().catch(() => null));
	if (!parsed.success) return json({ error: 'Invalid JSON payload' }, { status: 400 });
	const canvasState = parsed.data.canvas_state ?? {};
	if (JSON.stringify(canvasState).length > MAX_CANVAS_JSON_CHARS) {
		return json(
			{ error: `canvas_state exceeds ${MAX_CANVAS_JSON_CHARS} serialized characters` },
			{ status: 413 }
		);
	}
	if (
		canvasState &&
		typeof canvasState === 'object' &&
		'encoding' in canvasState &&
		env.CHERRY_COMPRESSED_CANVAS_WRITES !== 'true'
	) {
		return json(
			{ error: 'Compressed canvas saves are not enabled on this deployment' },
			{ status: 400 }
		);
	}
	// Validate compressed state before storing it; never save an unreadable envelope.
	try {
		decodeCanvasState(canvasState);
	} catch {
		return json({ error: 'Invalid encoded canvas state' }, { status: 400 });
	}
	const client = await createParchmentServerClient(event, { mode: 'session' });
	const data = await updateConversationCanvas(client, event.params.id, {
		expectedResetEpoch: parsed.data.expected_reset_epoch,
		expectedCanvasVersion: parsed.data.expected_canvas_version,
		canvasState: canvasState as ConversationCanvasUpdateRequest['canvasState']
	});
	return json({
		success: true,
		canvas_state: decodeCanvasState(data.canvasState),
		canvas_version: data.canvasVersion,
		reset_epoch: data.resetEpoch
	});
}

export const PUT: RequestHandler = async (event) => {
	try {
		return await persistCanvas(event);
	} catch (error) {
		return failure(error);
	}
};

export const POST: RequestHandler = PUT;
