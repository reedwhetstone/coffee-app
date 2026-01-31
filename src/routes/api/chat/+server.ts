import { json } from '@sveltejs/kit';
import { OPENAI_API_KEY } from '$env/static/private';
import { createLangChainService } from '$lib/services/langchainService';
import { requireMemberRole } from '$lib/server/auth';
import type { RequestHandler } from './$types';

// Helper function to parse response and fetch coffee data
async function parseResponseAndFetchCoffeeData(response: string, supabase: any) {
	let structuredResponse = null;
	let coffeeData: any[] = [];

	// Parse JSON response (strict JSON mode should ensure this always works)
	try {
		const parsed = JSON.parse(response);
		if (parsed.message || parsed.coffee_cards || parsed.response_type) {
			structuredResponse = parsed;
		} else {
			console.warn('Parsed JSON does not match expected structure:', parsed);
			// Fallback for malformed but parseable JSON
			structuredResponse = {
				message: typeof parsed === 'string' ? parsed : JSON.stringify(parsed),
				coffee_cards: [],
				response_type: 'text'
			};
		}
	} catch (e) {
		console.error('Failed to parse JSON response from AI:', e);
		console.error('Raw response:', response);
		// Create a fallback response for invalid JSON
		structuredResponse = {
			message:
				'I apologize, but I encountered an issue formatting my response. Please try asking again.',
			coffee_cards: [],
			response_type: 'text'
		};
	}

	// Fetch coffee data if we have IDs
	if (structuredResponse?.coffee_cards?.length > 0) {
		try {
			const { data } = await supabase
				.from('coffee_catalog')
				.select('*')
				.in('id', structuredResponse.coffee_cards)
				.eq('public_coffee', true);

			if (data) {
				coffeeData = data;
			}
		} catch (error) {
			console.error('Error fetching coffee data:', error);
		}
	}

	return { structuredResponse, coffeeData };
}

export const POST: RequestHandler = async (event) => {
	// Create AbortController for handling connection aborts
	const controller = new AbortController();
	const { signal } = controller;

	// Handle client disconnect
	event.request.signal.addEventListener('abort', () => {
		controller.abort();
	});

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

		// Check if request was aborted before processing
		if (signal.aborted) {
			return json({ error: 'Request was cancelled' }, { status: 499 });
		}

		// If streaming is requested, use Server-Sent Events
		if (stream) {
			const { readable, writable } = new TransformStream();
			const writer = writable.getWriter();
			const encoder = new TextEncoder();

			// Helper function to safely write to stream (simplified - no timeout race)
			const safeWrite = async (data: any) => {
				try {
					// Check if request was aborted
					if (signal.aborted) {
						console.log('Stream write cancelled - request aborted');
						return false;
					}

					// Safe JSON stringify with error handling for malformed strings
					let jsonData: string;
					try {
						jsonData = JSON.stringify(data);
					} catch (jsonError) {
						console.error('JSON stringify error:', jsonError);
						// Fallback: sanitize the data and try again
						const sanitizedData = JSON.parse(
							JSON.stringify(data, (_, value) => {
								if (typeof value === 'string') {
									// Replace problematic characters that might break JSON
									return value.replace(/[\u0000-\u001f\u007f-\u009f]/g, '');
								}
								return value;
							})
						);
						jsonData = JSON.stringify(sanitizedData);
					}

					await writer.write(encoder.encode(`data: ${jsonData}\n\n`));
					return true;
				} catch (error) {
					console.error('Error writing to stream:', error);
					return false;
				}
			};

			// Heartbeat mechanism to keep connection alive during long processing
			let heartbeatInterval: NodeJS.Timeout | undefined;
			const startHeartbeat = () => {
				heartbeatInterval = setInterval(async () => {
					if (!signal.aborted) {
						await safeWrite({ type: 'heartbeat', timestamp: new Date().toISOString() });
					}
				}, 15000); // Every 15 seconds
			};
			const stopHeartbeat = () => {
				if (heartbeatInterval) {
					clearInterval(heartbeatInterval);
					heartbeatInterval = undefined;
				}
			};

			// Process streaming in async IIFE to avoid detached promise issues
			(async () => {
				startHeartbeat();

				try {
					// Send initial status
					await safeWrite({ type: 'start', message: 'Understanding your question...' });

					// Process message with streaming callback, passing abort signal
					const response = await langchainService.processMessageWithStreaming(
						message,
						conversation_history || [],
						user.id,
						async (thinkingStep: string) => {
							// Send thinking step via SSE with timestamp
							await safeWrite({
								type: 'thinking',
								step: thinkingStep,
								timestamp: new Date().toISOString()
							});
						},
						signal // Pass abort signal to langchain service
					);

					// Check if aborted before sending final response
					if (signal.aborted) {
						console.log('Request aborted before completion');
						return;
					}

					// Send processing status
					await safeWrite({ type: 'processing', message: 'Preparing your recommendations...' });

					// Parse response and fetch coffee data
					const { structuredResponse, coffeeData } = await parseResponseAndFetchCoffeeData(
						response.response,
						supabase
					);

					// Send coffee data first if available
					if (coffeeData && coffeeData.length > 0) {
						await safeWrite({
							type: 'coffee_data',
							data: coffeeData,
							count: coffeeData.length
						});
					}

					// Send final response
					await safeWrite({
						type: 'complete',
						response: response.response,
						structured_response: structuredResponse,
						coffee_data: coffeeData,
						tool_calls: response.tool_calls,
						conversation_id: response.conversation_id,
						timestamp: new Date().toISOString()
					});
				} catch (error) {
					console.error('LangChain processing error:', error);

					// Handle specific abort errors
					let errorMessage = 'Unknown error occurred';
					if (error instanceof Error) {
						if (error.message.includes('aborted') || error.message.includes('abort')) {
							errorMessage = 'Request was cancelled by the client';
						} else if (error.message.includes('timeout')) {
							errorMessage = 'Request timed out - please try a simpler question';
						} else {
							errorMessage = error.message;
						}
					}

					// Send detailed error information
					await safeWrite({
						type: 'error',
						error: errorMessage,
						details: error instanceof Error ? error.stack : null,
						timestamp: new Date().toISOString()
					});
				} finally {
					stopHeartbeat();
					try {
						await writer.close();
					} catch (closeError) {
						console.log('Writer already closed or error closing:', closeError);
					}
				}
			})();

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

		// Handle abort errors specifically
		if (
			error instanceof Error &&
			(error.message.includes('aborted') || error.message.includes('abort'))
		) {
			return json({ error: 'Request was cancelled by the client' }, { status: 499 });
		}

		return json(
			{ error: error instanceof Error ? error.message : 'Unknown error' },
			{ status: 500 }
		);
	}
};
