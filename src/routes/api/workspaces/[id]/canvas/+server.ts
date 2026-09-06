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

const MAX_CANVAS_JSON_CHARS = 200000;
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
	const client = await createParchmentServerClient(event, { mode: 'session' });
	const data = await updateConversationCanvas(client, event.params.id, {
		expectedResetEpoch: parsed.data.expected_reset_epoch,
		expectedCanvasVersion: parsed.data.expected_canvas_version,
		canvasState: canvasState as ConversationCanvasUpdateRequest['canvasState']
	});
	return json({
		success: true,
		canvas_state: data.canvasState,
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
