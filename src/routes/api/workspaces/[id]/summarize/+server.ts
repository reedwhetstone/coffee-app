import { json } from '@sveltejs/kit';
import { requireMemberRole } from '$lib/server/auth';
import type { RequestHandler } from './$types';
import { OPENAI_API_KEY } from '$env/static/private';

// POST /api/workspaces/[id]/summarize - Trigger context compaction
export const POST: RequestHandler = async (event) => {
	try {
		const { user } = await requireMemberRole(event);
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

		// Fetch recent messages
		const { data: messages, error: msgError } = await event.locals.supabase
			.from('workspace_messages')
			.select('role, content, created_at')
			.eq('workspace_id', workspaceId)
			.order('created_at', { ascending: true })
			.limit(30);

		if (msgError) {
			return json({ error: msgError.message }, { status: 500 });
		}

		if (!messages || messages.length < 4) {
			return json({ summary: workspace.context_summary, skipped: true });
		}

		// Build conversation text for summarization
		const conversationText = messages
			.map((m) => `${m.role}: ${m.content}`)
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

		const response = await fetch('https://api.openai.com/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${OPENAI_API_KEY}`
			},
			body: JSON.stringify({
				model: 'gpt-4o-mini',
				messages: [{ role: 'user', content: prompt }],
				max_tokens: 800,
				temperature: 0.3
			})
		});

		if (!response.ok) {
			const err = await response.text();
			return json({ error: `OpenAI error: ${err}` }, { status: 502 });
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
