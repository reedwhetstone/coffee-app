import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { OPENROUTER_API_KEY } from '$env/static/private';
import { AuthError, requireChatAccess } from '$lib/server/auth';
import {
	buildDreamPrompt,
	getUserMemory,
	saveUserMemory,
	USER_MEMORY_DREAM_COOLDOWN_MS
} from '$lib/server/userMemory';
import type { RequestHandler } from './$types';

const dreamSchema = z.object({
	messages: z
		.array(
			z.object({
				role: z.enum(['user', 'assistant']),
				content: z.string().max(4000)
			})
		)
		.min(4)
		.max(30)
});

// POST /api/memory/dream — agent compaction pass over recent conversation.
// Fired by the client every ~16 messages; one model call per pass, with a
// cooldown so rapid triggers can't stack inference cost.
export const POST: RequestHandler = async (event) => {
	try {
		const { user } = await requireChatAccess(event);

		if (!OPENROUTER_API_KEY) {
			return json({ error: 'OpenRouter API key not configured' }, { status: 500 });
		}

		const parsed = dreamSchema.safeParse(await event.request.json());
		if (!parsed.success) {
			return json({ error: 'Invalid messages payload' }, { status: 400 });
		}

		const existing = await getUserMemory(event.locals.supabase, user.id);

		// Cost guard: skip if the document was updated very recently.
		if (existing?.updated_at) {
			const age = Date.now() - new Date(existing.updated_at).getTime();
			if (Number.isFinite(age) && age < USER_MEMORY_DREAM_COOLDOWN_MS) {
				return json({ skipped: true, reason: 'cooldown' });
			}
		}

		const conversationText = parsed.data.messages
			.map((m) => `${m.role}: ${m.content}`)
			.join('\n')
			.slice(0, 24000);

		const userName =
			(user.user_metadata?.full_name as string | undefined) ||
			(user.user_metadata?.name as string | undefined) ||
			user.email?.split('@')[0];

		const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${OPENROUTER_API_KEY}`
			},
			body: JSON.stringify({
				model: '@preset/test-workhorse-agent',
				messages: [
					{
						role: 'user',
						content: buildDreamPrompt(existing?.content ?? '', conversationText, userName)
					}
				],
				max_tokens: 900,
				temperature: 0.2
			})
		});

		if (!response.ok) {
			const err = await response.text();
			return json({ error: `OpenRouter error: ${err}` }, { status: 502 });
		}

		const result = await response.json();
		const updated = (result.choices?.[0]?.message?.content ?? '').trim();
		if (!updated) {
			return json({ skipped: true, reason: 'empty-response' });
		}

		const { error } = await saveUserMemory(event.locals.supabase, user.id, updated, 'agent');
		if (error) return json({ error }, { status: 500 });

		return json({ ok: true });
	} catch (error) {
		if (error instanceof AuthError) return json({ error: error.message }, { status: error.status });
		console.error('Memory dream error:', error);
		return json({ error: 'Failed to update memory' }, { status: 500 });
	}
};
