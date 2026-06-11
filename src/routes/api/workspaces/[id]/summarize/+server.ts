import { json } from '@sveltejs/kit';
import { requireChatAccess } from '$lib/server/auth';
import type { RequestHandler } from './$types';
import { OPENROUTER_API_KEY } from '$env/static/private';

type MessagePart = {
	type?: unknown;
	text?: unknown;
};

function textFromParts(parts: unknown): string {
	if (!Array.isArray(parts)) return '';

	return parts
		.map((part) => {
			const messagePart = part as MessagePart;
			return messagePart.type === 'text' && typeof messagePart.text === 'string'
				? messagePart.text
				: '';
		})
		.filter(Boolean)
		.join('\n');
}

export function _workspaceSummaryMessageText(message: {
	content: string | null;
	parts?: unknown;
}): string {
	return textFromParts(message.parts) || message.content || '';
}

// POST /api/workspaces/[id]/summarize - Trigger context compaction
export const POST: RequestHandler = async (event) => {
	try {
		const { user } = await requireChatAccess(event);
		const workspaceId = event.params.id;

		// Verify workspace ownership and get current summary
		const { data: workspace, error: wsError } = await event.locals.supabase
			.from('workspaces')
			.select('id, context_summary, type')
			.eq('id', workspaceId)
			.eq('user_id', user.id)
			.single();

		if (wsError || !workspace) {
			return json({ error: 'Workspace not found' }, { status: 404 });
		}

		// Fetch the most recent messages, then summarize them chronologically.
		const { data: messages, error: msgError } = await event.locals.supabase
			.from('workspace_messages')
			.select('role, content, parts, created_at')
			.eq('workspace_id', workspaceId)
			.order('created_at', { ascending: false })
			.limit(30);

		if (msgError) {
			return json({ error: msgError.message }, { status: 500 });
		}

		if (!messages || messages.length < 4) {
			return json({ summary: workspace.context_summary, skipped: true });
		}

		// Build conversation text for summarization
		const recentMessages = [...messages].reverse();
		const conversationText = recentMessages
			.map((m) => `${m.role}: ${_workspaceSummaryMessageText(m)}`)
			.join('\n');

		const existingSummary = workspace.context_summary || '';

		const prompt = `You are a memory compactor for a coffee business AI workspace (type: ${workspace.type}).
${existingSummary ? `Previous summary:\n${existingSummary}\n` : ''}
Recent conversation:
${conversationText}

Produce a concise summary (max 500 words) that captures:
1. Key facts discussed (specific coffees, roast profiles, inventory items)
2. User preferences and decisions made
3. Ongoing tasks or questions
4. Any important context for future conversations

Keep only what's relevant for continuing the conversation. Drop pleasantries and resolved questions.`;

		const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${OPENROUTER_API_KEY}`
			},
			body: JSON.stringify({
				model: '@preset/test-workhorse-agent',
				messages: [{ role: 'user', content: prompt }],
				max_tokens: 800,
				temperature: 0.3
			})
		});

		if (!response.ok) {
			const err = await response.text();
			return json({ error: `OpenRouter error: ${err}` }, { status: 502 });
		}

		const result = await response.json();
		const summary = result.choices?.[0]?.message?.content || '';

		// Save summary to workspace
		const { error: updateError } = await event.locals.supabase
			.from('workspaces')
			.update({ context_summary: summary })
			.eq('id', workspaceId);

		if (updateError) {
			return json({ error: updateError.message }, { status: 500 });
		}

		return json({ summary });
	} catch (err) {
		const status = (err as { status?: number }).status || 500;
		return json({ error: (err as Error).message }, { status });
	}
};
