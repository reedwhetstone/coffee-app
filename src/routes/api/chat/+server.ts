import { json } from '@sveltejs/kit';
import { OPENAI_API_KEY } from '$env/static/private';
import { createLangChainService } from '$lib/services/langchainService';
import { requireMemberRole } from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	try {
		// Require member role for chat features
		const { user } = await requireMemberRole(event);
		const { supabase } = event.locals;

		const { message, conversation_history } = await event.request.json();

		// Validate input
		if (!message || typeof message !== 'string') {
			return json({ error: 'Message is required' }, { status: 400 });
		}

		// Validate OpenAI API key
		if (!OPENAI_API_KEY) {
			console.error('OPENAI_API_KEY is missing or empty');
			return json({ error: 'OpenAI API key not configured' }, { status: 500 });
		}

		// Create LangChain service instance
		const langchainService = createLangChainService(OPENAI_API_KEY, supabase);

		// Process the message
		const response = await langchainService.processMessage(
			message,
			conversation_history || [],
			user.id
		);

		return json({
			response: response.response,
			tool_calls: response.tool_calls,
			conversation_id: response.conversation_id
		});
	} catch (error) {
		console.error('Chat API error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Unknown error' },
			{ status: 500 }
		);
	}
};