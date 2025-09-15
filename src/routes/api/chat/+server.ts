import { json } from '@sveltejs/kit';
import { OPENAI_API_KEY } from '$env/static/private';
import { createLangChainService } from '$lib/services/langchainService';
import { requireMemberRole } from '$lib/server/auth';
import type { RequestHandler } from './$types';

// Helper function to parse response and fetch coffee data
async function parseResponseAndFetchCoffeeData(response: string, supabase: any) {
	let structuredResponse = null;
	let coffeeData: any[] = [];

	// Try to parse as JSON first
	try {
		const parsed = JSON.parse(response);
		if (parsed.message || parsed.coffee_cards || parsed.response_type) {
			structuredResponse = parsed;
		}
	} catch (e) {
		// Look for coffee_cards pattern in text
		const coffeeCardsMatch = response.match(/coffee_cards:\s*\[([^\]]+)\]/);
		if (coffeeCardsMatch) {
			const idsString = coffeeCardsMatch[1];
			const coffeeIds = idsString
				.split(',')
				.map((id) => parseInt(id.trim()))
				.filter((id) => !isNaN(id));

			// Extract message (everything before the coffee_cards line)
			const messageMatch = response.split(/\n.*coffee_cards:/)[0];

			structuredResponse = {
				message: messageMatch.trim(),
				coffee_cards: coffeeIds,
				response_type: 'mixed'
			};
		}
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

			// Helper function to safely write to stream with timeout and abort handling
			const safeWrite = async (data: any) => {
				try {
					// Check if request was aborted
					if (signal.aborted) {
						console.log('Stream write cancelled - request aborted');
						return;
					}

					// Safe JSON stringify with error handling for malformed strings
					let jsonData: string;
					try {
						jsonData = JSON.stringify(data);
					} catch (jsonError) {
						console.error('JSON stringify error:', jsonError);
						// Fallback: sanitize the data and try again
						const sanitizedData = JSON.parse(JSON.stringify(data, (_, value) => {
							if (typeof value === 'string') {
								// Replace problematic characters that might break JSON
								return value.replace(/[\u0000-\u001f\u007f-\u009f]/g, '');
							}
							return value;
						}));
						jsonData = JSON.stringify(sanitizedData);
					}

					// Increase timeout for complex AI processing and add proper cleanup
					const writePromise = writer.write(encoder.encode(`data: ${jsonData}\n\n`));

					let timeoutId: NodeJS.Timeout | undefined;
					const timeoutPromise = new Promise((_, reject) => {
						timeoutId = setTimeout(() => {
							reject(new Error('Write timeout after 10 seconds'));
						}, 10000); // Increased from 5s to 10s for complex processing
					});

					try {
						await Promise.race([writePromise, timeoutPromise]);
						if (timeoutId) clearTimeout(timeoutId);
					} catch (raceError) {
						if (timeoutId) clearTimeout(timeoutId);
						throw raceError;
					}
				} catch (error) {
					console.error('Error writing to stream:', error);
					// Don't rethrow - continue processing even if write fails
				}
			};

			// Send initial status
			await safeWrite({ type: 'start', message: 'Understanding your question...' });

			// Process message with streaming callback
			try {
				const streamingPromise = langchainService.processMessageWithStreaming(
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
					}
				);

				streamingPromise
					.then(async (response) => {
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

						await writer.close();
					})
					.catch(async (error) => {
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

						await writer.close();
					});
			} catch (immediateError) {
				console.error('Immediate LangChain error:', immediateError);
				await safeWrite({
					type: 'error',
					error: 'Failed to initialize LangChain processing',
					details:
						immediateError instanceof Error ? immediateError.message : 'Unknown immediate error',
					timestamp: new Date().toISOString()
				});
				await writer.close();
			}

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
