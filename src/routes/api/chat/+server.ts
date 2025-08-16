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

		const { message, conversation_history, stream } = await event.request.json();

		// Validate input
		if (!message || typeof message !== 'string') {
			return json({ error: 'Message is required' }, { status: 400 });
		}

		// Validate OpenAI API key
		if (!OPENAI_API_KEY) {
			console.error('OPENAI_API_KEY is missing or empty');
			return json({ error: 'OpenAI API key not configured' }, { status: 500 });
		}

		// Create LangChain service instance with base URL and auth headers for tool calls
		const baseUrl = event.url.origin;

		// Get the session cookie to pass to tool calls
		const sessionCookie = event.request.headers.get('cookie');
		const authHeaders: Record<string, string> = {};
		if (sessionCookie) {
			authHeaders['cookie'] = sessionCookie;
		}

		const langchainService = createLangChainService(OPENAI_API_KEY, supabase, baseUrl, authHeaders);

		// If streaming is requested, use Server-Sent Events
		if (stream) {
			const { readable, writable } = new TransformStream();
			const writer = writable.getWriter();
			const encoder = new TextEncoder();

			// Process message with streaming callback
			langchainService
				.processMessageWithStreaming(
					message,
					conversation_history || [],
					user.id,
					(thinkingStep: string) => {
						// Send thinking step via SSE
						const data = JSON.stringify({ type: 'thinking', step: thinkingStep });
						writer.write(encoder.encode(`data: ${data}\n\n`));
					}
				)
				.then((response) => {
					// Send final response
					const data = JSON.stringify({
						type: 'complete',
						response: response.response,
						tool_calls: response.tool_calls,
						conversation_id: response.conversation_id
					});
					writer.write(encoder.encode(`data: ${data}\n\n`));
					writer.close();
				})
				.catch((error) => {
					// Send error
					const data = JSON.stringify({
						type: 'error',
						error: error instanceof Error ? error.message : 'Unknown error'
					});
					writer.write(encoder.encode(`data: ${data}\n\n`));
					writer.close();
				});

			return new Response(readable, {
				headers: {
					'Content-Type': 'text/event-stream',
					'Cache-Control': 'no-cache',
					Connection: 'keep-alive'
				}
			});
		}

		// Fallback to regular JSON response for non-streaming requests
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
