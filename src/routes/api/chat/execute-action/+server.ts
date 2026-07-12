import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { requireChatAccess } from '$lib/server/auth';
import type { RequestHandler } from './$types';
import type { Json } from '$lib/types/database.types';

const PARCHMENT_ACTIONS = new Set(['add_bean_to_inventory', 'update_bean']);
const MALLARD_ACTIONS = new Set(['create_roast_session', 'update_roast_notes', 'record_sale']);
const ALLOWED_ACTIONS = new Set([...PARCHMENT_ACTIONS, ...MALLARD_ACTIONS]);

const bodySchema = z.object({
	executionId: z.string().min(1).max(200),
	actionType: z.string(),
	fields: z.record(z.string(), z.unknown())
});

export const POST: RequestHandler = async (event) => {
	try {
		const { memberAccess } = await requireChatAccess(event);
		const parsed = bodySchema.safeParse(await event.request.json());
		if (!parsed.success) return json({ error: 'Invalid action request' }, { status: 400 });
		const { executionId, actionType, fields } = parsed.data;

		if (!ALLOWED_ACTIONS.has(actionType)) {
			return json({ error: `Unknown action type: ${actionType}` }, { status: 400 });
		}
		if (!memberAccess && !PARCHMENT_ACTIONS.has(actionType)) {
			return json({ error: 'Mallard Studio access required for this action' }, { status: 403 });
		}

		const { data, error } = await event.locals.supabase.rpc('execute_chat_action', {
			p_execution_id: executionId,
			p_action_type: actionType,
			p_fields: fields as Json
		});
		if (error) {
			const conflict = error.code === '23505';
			return json(
				{ error: error.message },
				{ status: conflict ? 409 : error.code === '42501' ? 403 : 400 }
			);
		}

		const envelope = data as {
			status: string;
			result?: unknown;
			error?: string;
			replayed?: boolean;
		};
		if (envelope.status !== 'success') {
			return json({ error: envelope.error || 'Action execution failed' }, { status: 400 });
		}
		return json({ ...(envelope.result as object), replayed: !!envelope.replayed });
	} catch (err) {
		const status = (err as { status?: number }).status || 500;
		return json({ error: (err as Error).message }, { status });
	}
};
