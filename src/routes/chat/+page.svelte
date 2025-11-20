<script lang="ts">
	import type { PageData } from './$types';
	import { checkRole } from '$lib/types/auth.types';
	import type { UserRole } from '$lib/types/auth.types';
	import ChainOfThought from '$lib/components/ChainOfThought.svelte';
	import ChatMessageRenderer from '$lib/components/ChatMessageRenderer.svelte';
	import CoffeePreviewSidebar from '$lib/components/CoffeePreviewSidebar.svelte';
	import type { TastingNotes } from '$lib/types/coffee.types';
	import { getContext } from 'svelte';

	let { data } = $props<{ data: PageData }>();

	// Destructure with default values to prevent undefined errors
	let { session, role = 'viewer' } = $derived(data);

	// User role management
	let userRole: UserRole = $derived(role as UserRole);

	function hasRequiredRole(requiredRole: UserRole): boolean {
		return checkRole(userRole, requiredRole);
	}

	// Get right sidebar context from layout
	const rightSidebarContext = getContext<{ setOpen: (isOpen: boolean) => void }>('rightSidebar');

	// Coffee preview sidebar state
	let coffeePreviewOpen = $state(false);
	let selectedCoffeeIds = $state<number[]>([]);
	let focusCoffeeId = $state<number | undefined>(undefined);

	// Sync sidebar state with layout
	$effect(() => {
		if (rightSidebarContext) {
			rightSidebarContext.setOpen(coffeePreviewOpen);
		}
	});

	// Handle coffee preview request
	function handleCoffeePreview(coffeeIds: number[], focusId?: number) {
		selectedCoffeeIds = coffeeIds;
		focusCoffeeId = focusId;
		coffeePreviewOpen = true;
	}

	// Handle sidebar close
	function handleSidebarClose() {
		coffeePreviewOpen = false;
		selectedCoffeeIds = [];
		focusCoffeeId = undefined;
	}

	/**
	 * Parses AI tasting notes JSON data safely
	 * @param tastingNotesJson - JSON string from database
	 * @returns Parsed tasting notes or null if invalid
	 */
	function parseTastingNotes(tastingNotesJson: string | null | object): TastingNotes | null {
		if (!tastingNotesJson) return null;

		try {
			// Handle both string and object formats (Supabase jsonb can return either)
			let parsed: any;
			if (typeof tastingNotesJson === 'string') {
				parsed = JSON.parse(tastingNotesJson);
			} else if (typeof tastingNotesJson === 'object') {
				parsed = tastingNotesJson;
			} else {
				return null;
			}

			// Validate that required properties exist
			if (
				parsed.body &&
				parsed.flavor &&
				parsed.acidity &&
				parsed.sweetness &&
				parsed.fragrance_aroma
			) {
				return parsed as TastingNotes;
			}
		} catch (error) {
			console.error('Error parsing tasting notes:', error);
		}

		return null;
	}

	// Chat state management
	let messages: Array<{
		role: 'user' | 'assistant';
		content: string;
		timestamp: Date;
		coffeeCards?: number[];
		coffeeData?: any[];
		isStructured?: boolean;
		isStreaming?: boolean;
	}> = $state([]);
	let inputMessage = $state('');
	let isLoading = $state(false);
	let chatContainer = $state<HTMLDivElement>();
	let thinkingSteps = $state<Array<{ message: string; timestamp: Date }>>([]);
	let shouldScrollToBottom = $state(true);
	let streamingContent = $state('');
	let isStreamingResponse = $state(false);

	// Smart scroll behavior - scroll to bottom for new messages, but allow user control
	$effect(() => {
		if (chatContainer && shouldScrollToBottom) {
			// Smooth scroll to bottom for new content
			chatContainer.scrollTo({
				top: chatContainer.scrollHeight,
				behavior: 'smooth'
			});
		}
	});

	// Track if user manually scrolled up
	function handleScroll() {
		if (!chatContainer) return;
		const { scrollTop, scrollHeight, clientHeight } = chatContainer;
		const isNearBottom = scrollTop + clientHeight >= scrollHeight - 50;
		shouldScrollToBottom = isNearBottom;
	}

	/**
	 * Process a single SSE data item
	 */
	function processSSEDataItem(data: any) {
		if (data.type === 'start') {
			// Initial start message
			thinkingSteps.push({
				message: data.message || 'Starting AI processing...',
				timestamp: new Date()
			});
		} else if (data.type === 'thinking') {
			// Add thinking step with proper timestamp handling
			thinkingSteps.push({
				message: data.step,
				timestamp: data.timestamp ? new Date(data.timestamp) : new Date()
			});
		} else if (data.type === 'processing') {
			// Add processing status
			thinkingSteps.push({
				message: data.message || 'Processing response...',
				timestamp: new Date()
			});
		} else if (data.type === 'coffee_data') {
			// Handle coffee data streaming
			thinkingSteps.push({
				message: `📋 Found ${data.count} coffee${data.count === 1 ? '' : 's'} to display`,
				timestamp: new Date()
			});
		} else if (data.type === 'complete') {
			// Use structured response data if available
			const structuredResponse = data.structured_response;
			const coffeeData = data.coffee_data || [];

			// Create base message with streaming flag
			const newMessage: any = {
				role: 'assistant',
				content: '',
				timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
				isStreaming: true
			};

			// Store content for streaming
			streamingContent = structuredResponse?.message || data.response;

			// Dynamically add all structured fields from the response
			if (structuredResponse) {
				// Add all fields from structured_response except 'message' (already used for content)
				Object.entries(structuredResponse).forEach(([key, value]) => {
					if (key !== 'message') {
						newMessage[key] = value;
					}
				});
				newMessage.isStructured = true;
			}

			// Add coffee_data if present (comes separately from API)
			if (coffeeData.length > 0) {
				newMessage.coffeeData = coffeeData;
			}

			// Maintain backward compatibility with existing field names
			if (structuredResponse?.coffee_cards) {
				newMessage.coffeeCards = structuredResponse.coffee_cards;
			}

			// Add message and start streaming animation
			messages.push(newMessage);

			// Clear thinking steps with fade out animation
			isStreamingResponse = true;
			setTimeout(() => {
				thinkingSteps = [];
				startStreamingText();
			}, 500); // Brief delay to show transition
		} else if (data.type === 'error') {
			// Handle error with detailed information
			thinkingSteps = [];
			console.error('AI processing error:', data.error, data.details);

			messages.push({
				role: 'assistant',
				content: `Sorry, I encountered an error: ${data.error}. Please try again.`,
				timestamp: data.timestamp ? new Date(data.timestamp) : new Date()
			});
		}
	}

	/**
	 * Send message to chat API with streaming thinking steps
	 */
	async function sendMessage() {
		if (!inputMessage.trim() || isLoading) return;

		const userMessage = inputMessage.trim();
		inputMessage = '';
		isLoading = true;
		thinkingSteps = []; // Clear previous thinking steps
		shouldScrollToBottom = true; // Reset scroll behavior for new message

		// Add user message to chat
		messages.push({
			role: 'user',
			content: userMessage,
			timestamp: new Date()
		});

		try {
			// Use streaming API for real-time thinking steps
			const response = await fetch('/api/chat', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					message: userMessage,
					conversation_history: messages.slice(0, -1), // Exclude the message we just added
					stream: true
				})
			});

			if (!response.ok) {
				// Handle specific status codes gracefully
				if (response.status === 499) {
					console.log('Request was cancelled by client or server timeout');
					return; // Silently return, don't show error to user
				}

				const errorText = await response.text().catch(() => 'Unknown error');
				throw new Error(`Chat request failed (${response.status}): ${errorText}`);
			}

			// Handle Server-Sent Events
			if (response.body) {
				const reader = response.body.getReader();
				const decoder = new TextDecoder();
				let buffer = ''; // Buffer for incomplete lines across chunks

				try {
					while (true) {
						const { done, value } = await reader.read();

						if (done) {
							// Process any remaining buffered data
							if (buffer.trim()) {
								const lines = buffer.split('\n');
								for (const line of lines) {
									if (line.trim() && line.startsWith('data: ')) {
										try {
											const dataContent = line.slice(6);
											if (!dataContent.trim()) continue;
											const data = JSON.parse(dataContent);
											processSSEDataItem(data);
										} catch (e) {
											console.error('Error parsing final buffered SSE data:', e, line);
											if (e instanceof SyntaxError) {
												console.error('JSON parse error - line length:', line.length);
												console.error('Line preview:', line.substring(0, 200));
											}
										}
									}
								}
							}
							break;
						}

						// Decode chunk and add to buffer (use stream: true for multi-byte character handling)
						buffer += decoder.decode(value, { stream: true });

						// Process complete lines (ending with \n)
						const lines = buffer.split('\n');
						// Keep the last line in buffer (might be incomplete)
						buffer = lines.pop() || '';

						for (const line of lines) {
							if (line.trim() && line.startsWith('data: ')) {
								try {
									const dataContent = line.slice(6);
									// Add extra validation for JSON content
									if (!dataContent.trim()) continue;

									const data = JSON.parse(dataContent);
									processSSEDataItem(data);
								} catch (e) {
									console.error('Error parsing SSE data:', e, line);
									if (e instanceof SyntaxError) {
										console.error('JSON parse error - line length:', line.length);
										console.error('Line preview:', line.substring(0, 200));
									}
								}
							}
						}
					}
				} catch (streamError) {
					console.log('Stream reading error (likely client cancellation):', streamError);
					// Don't throw error for stream reading issues - these are often cancellations
				} finally {
					try {
						reader.releaseLock();
					} catch {}
				}
			}
		} catch (error) {
			console.error('Chat error:', error);
			thinkingSteps = [];

			// Only show error message if it's not a cancellation
			const errorMessage = error instanceof Error ? error.message : String(error);
			if (!errorMessage.includes('cancelled') && !errorMessage.includes('aborted')) {
				messages.push({
					role: 'assistant',
					content: 'Sorry, I encountered an error. Please try again.',
					timestamp: new Date()
				});
			}
		} finally {
			isLoading = false;
		}
	}

	/**
	 * Simple fade-in animation for response
	 */
	function startStreamingText() {
		if (!streamingContent) return;

		const lastMessage = messages[messages.length - 1];
		if (!lastMessage) return;

		// Immediately set the full content
		lastMessage.content = streamingContent;
		messages = [...messages]; // Trigger reactivity

		// Remove streaming flag after fade animation
		setTimeout(() => {
			lastMessage.isStreaming = false;
			isStreamingResponse = false;
			messages = [...messages]; // Final update
		}, 1200); // 1.2 seconds for fade animation
	}

	/**
	 * Handle form submission
	 */
	function handleSubmit(event: Event) {
		event.preventDefault();
		sendMessage();
	}

	/**
	 * Detect structured data fields in a message object
	 * Returns an object containing only the structured data fields
	 */
	function detectStructuredFields(message: any): Record<string, any> | null {
		// Base message fields that are not considered structured data
		const baseFields = new Set(['role', 'content', 'timestamp']);

		const structuredFields: Record<string, any> = {};
		let hasStructuredData = false;

		for (const [key, value] of Object.entries(message)) {
			// Skip base message fields
			if (baseFields.has(key)) continue;

			// Detect structured data patterns
			const isStructuredField =
				// Arrays with content
				(Array.isArray(value) && value.length > 0) ||
				// Non-null objects (excluding Date objects)
				(typeof value === 'object' && value !== null && !(value instanceof Date)) ||
				// Boolean metadata fields
				(typeof value === 'boolean' && (key.startsWith('is') || key.startsWith('has'))) ||
				// Fields with naming patterns indicating structured data
				key.endsWith('_cards') ||
				key.endsWith('_data') ||
				key.endsWith('_ids') ||
				key.endsWith('_type') ||
				key.endsWith('_metadata') ||
				// Explicit structured field
				key === 'isStructured';

			if (isStructuredField) {
				structuredFields[key] = value;
				hasStructuredData = true;
			}
		}

		return hasStructuredData ? structuredFields : null;
	}

	/**
	 * Format conversation data as Markdown
	 */
	function formatConversationAsMarkdown(messages: any[], exportData: any): string {
		const timestamp = new Date().toLocaleString();
		const userId = exportData.user_id || 'Unknown';

		let markdown = `# Coffee Chat Conversation\n\n`;
		markdown += `**Exported:** ${timestamp}  \n`;
		markdown += `**User ID:** ${userId}\n\n`;
		markdown += `---\n\n`;

		messages.forEach((message, index) => {
			const messageTime = new Date(message.timestamp).toLocaleString();
			const role = message.role === 'user' ? '🧑‍💼 User' : '🤖 Assistant';

			markdown += `## ${role}\n`;
			markdown += `*${messageTime}*\n\n`;
			markdown += `${message.content}\n\n`;

			// Add legacy coffee card information if present (for backward compatibility)
			if (message.coffeeCards && message.coffeeCards.length > 0) {
				markdown += `### ☕ Coffee Recommendations\n\n`;

				if (message.coffeeData && message.coffeeData.length > 0) {
					message.coffeeData.forEach((coffee: any, coffeeIndex: number) => {
						markdown += `**${coffee.name || 'Unknown Coffee'}**\n`;
						if (coffee.origin) markdown += `- Origin: ${coffee.origin}\n`;
						if (coffee.variety) markdown += `- Variety: ${coffee.variety}\n`;
						if (coffee.processing) markdown += `- Processing: ${coffee.processing}\n`;
						if (coffee.price_per_lb) markdown += `- Price: $${coffee.price_per_lb}/lb\n`;
						if (coffee.description) {
							markdown += `- Description: ${coffee.description}\n`;
						}
						markdown += `\n`;
					});
				} else {
					markdown += `Coffee IDs: ${message.coffeeCards.join(', ')}\n\n`;
				}
			}

			// Add structured data as JSON code block if present
			const structuredFields = detectStructuredFields(message);
			if (structuredFields) {
				markdown += `\`\`\`json\n`;
				markdown += JSON.stringify(structuredFields, null, 2);
				markdown += `\n\`\`\`\n\n`;
			}

			if (index < messages.length - 1) {
				markdown += `---\n\n`;
			}
		});

		return markdown;
	}

	/**
	 * Export conversation history
	 */
	function exportConversation() {
		const exportData = {
			conversation: messages,
			exported_at: new Date().toISOString(),
			user_id: session?.user?.id
		};

		const markdownContent = formatConversationAsMarkdown(messages, exportData);

		const blob = new Blob([markdownContent], {
			type: 'text/markdown'
		});
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `coffee-chat-${new Date().toISOString().split('T')[0]}.md`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}

	/**
	 * Clear conversation
	 */
	function clearConversation() {
		if (confirm('Are you sure you want to clear the conversation?')) {
			messages = [];
		}
	}
</script>

<svelte:head>
	<title>Coffee Chat - AI Assistant</title>
	<meta
		name="description"
		content="Chat with our AI coffee expert for personalized recommendations and roasting advice."
	/>
</svelte:head>

{#if !session}
	<!-- Unauthenticated state -->
	<div class="bg-background-primary-light flex min-h-screen items-center justify-center">
		<div
			class="bg-background-secondary-light mx-auto max-w-md rounded-lg p-8 text-center shadow-lg"
		>
			<h1 class="text-text-primary-light mb-4 text-2xl font-bold">Coffee Chat</h1>
			<p class="text-text-secondary-light mb-6">
				Sign in to access our AI coffee expert for personalized recommendations and roasting advice.
			</p>
			<a
				href="/auth"
				class="bg-background-tertiary-light rounded-md px-6 py-3 font-medium text-white transition-all duration-200 hover:bg-opacity-90"
			>
				Sign In
			</a>
		</div>
	</div>
{:else if !hasRequiredRole('member')}
	<!-- Member role required -->
	<div class="bg-background-primary-light flex min-h-screen items-center justify-center">
		<div
			class="bg-background-secondary-light mx-auto max-w-md rounded-lg p-8 text-center shadow-lg"
		>
			<h1 class="text-text-primary-light mb-4 text-2xl font-bold">Premium Feature</h1>
			<p class="text-text-secondary-light mb-6">
				The Coffee Chat AI assistant is available for premium members. Upgrade to access
				personalized recommendations and expert roasting advice.
			</p>
			<div class="space-y-3">
				<a
					href="/subscription"
					class="bg-background-tertiary-light block rounded-md px-6 py-3 font-medium text-white transition-all duration-200 hover:bg-opacity-90"
				>
					Upgrade to Premium
				</a>
				<a
					href="/"
					class="border-background-tertiary-light text-background-tertiary-light hover:bg-background-tertiary-light block rounded-md border px-6 py-3 transition-all duration-200 hover:text-white"
				>
					Back to Home
				</a>
			</div>
		</div>
	</div>
{:else}
	<!-- Main chat interface for authenticated members -->
	<div class="bg-background-primary-light flex h-screen flex-col">
		<!-- Header -->
		<header class="border-border-light bg-background-secondary-light border-b px-4 py-3">
			<div class="flex items-center justify-between">
				<div>
					<h1 class="text-text-primary-light text-xl font-semibold">Coffee Chat</h1>
					<p class="text-text-secondary-light text-sm">AI-powered coffee assistant</p>
				</div>
				<div class="flex space-x-2">
					{#if messages.length > 0}
						<button
							onclick={exportConversation}
							class="border-background-tertiary-light text-background-tertiary-light hover:bg-background-tertiary-light rounded-md border px-3 py-1 text-sm transition-all duration-200 hover:text-white"
						>
							Export
						</button>
						<button
							onclick={clearConversation}
							class="rounded-md border border-red-500 px-3 py-1 text-sm text-red-500 transition-all duration-200 hover:bg-red-500 hover:text-white"
						>
							Clear
						</button>
					{/if}
				</div>
			</div>
		</header>

		<!-- Chat messages area -->
		<div bind:this={chatContainer} class="flex-1 overflow-y-auto p-4" onscroll={handleScroll}>
			{#if messages.length === 0}
				<!-- Welcome message -->
				<div class="mx-auto max-w-2xl text-center">
					<div class="bg-background-secondary-light mb-8 rounded-lg p-6">
						<h2 class="text-text-primary-light mb-3 text-lg font-semibold">
							Welcome to Coffee Chat! ☕
						</h2>
						<p class="text-text-secondary-light mb-4">
							I'm your AI coffee expert, here to help with personalized recommendations, roasting
							advice, and coffee knowledge. Ask me anything about:
						</p>
						<div class="text-text-secondary-light grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
							<div>• Coffee recommendations</div>
							<div>• Roasting techniques</div>
							<div>• Flavor profiles</div>
							<div>• Processing methods</div>
							<div>• Your inventory analysis</div>
							<div>• Brewing guidance</div>
						</div>
					</div>

					<!-- Example queries -->
					<div class="space-y-2">
						<p class="text-text-primary-light text-sm font-medium">Try asking:</p>
						<div class="space-y-2 text-sm">
							<button
								onclick={() =>
									(inputMessage =
										'Check the green coffee catalog for an Ethiopian with stone fruit notes and a unique processing method.')}
								class="border-border-light bg-background-secondary-light text-text-secondary-light hover:bg-background-tertiary-light block w-full rounded-md border p-2 text-left transition-all hover:text-white"
							>
								"Check the green coffee catalog for an Ethiopian with stone fruit notes and a unique
								processing method."
							</button>
							<button
								onclick={() =>
									(inputMessage = "What's the best way to roast a washed Costa Rican coffee?")}
								class="border-border-light bg-background-secondary-light text-text-secondary-light hover:bg-background-tertiary-light block w-full rounded-md border p-2 text-left transition-all hover:text-white"
							>
								"What's the best way to roast a washed Costa Rican coffee?"
							</button>
							<button
								onclick={() =>
									(inputMessage = 'Analyze my recent roasting sessions and suggest improvements')}
								class="border-border-light bg-background-secondary-light text-text-secondary-light hover:bg-background-tertiary-light block w-full rounded-md border p-2 text-left transition-all hover:text-white"
							>
								"Analyze my recent roasting sessions and suggest improvements"
							</button>
						</div>
					</div>
				</div>
			{:else}
				<!-- Chat messages -->
				<div class="mx-auto max-w-4xl space-y-4">
					{#each messages as message, index}
						<div
							class="flex {message.role === 'user'
								? 'justify-end'
								: 'justify-start'} message-fade-in"
						>
							<div
								class="max-w-[80%] rounded-lg px-4 py-2 transition-all duration-300 {message.role ===
								'user'
									? 'bg-background-tertiary-light text-white'
									: 'bg-background-secondary-light text-text-primary-light'} {message.isStreaming
									? 'animate-pulse'
									: ''}"
							>
								{#if message.role === 'assistant' && message.isStructured}
									<ChatMessageRenderer
										message={message.content}
										coffeeCards={message.coffeeCards}
										coffeeData={message.coffeeData || []}
										onCoffeePreview={handleCoffeePreview}
										isStreaming={message.isStreaming || false}
									/>
								{:else}
									<div
										class="whitespace-pre-wrap transition-all duration-1000 ease-out {message.isStreaming
											? 'translate-y-4 opacity-0'
											: 'translate-y-0 opacity-100'}"
									>
										{message.content}
									</div>
								{/if}
								<div class="mt-1 text-xs opacity-70">
									{message.timestamp.toLocaleTimeString()}
								</div>
							</div>
						</div>
					{/each}

					{#if (isLoading && thinkingSteps.length > 0) || isStreamingResponse}
						<div
							class="flex justify-start transition-all duration-500 {isStreamingResponse
								? 'scale-95 opacity-50'
								: 'scale-100 opacity-100'}"
						>
							<div class="max-w-[80%]">
								<ChainOfThought
									steps={thinkingSteps}
									isActive={isLoading && !isStreamingResponse}
								/>
							</div>
						</div>
					{:else if isLoading}
						<div class="flex justify-start">
							<div class="max-w-[80%]">
								<ChainOfThought steps={[]} isActive={isLoading} />
							</div>
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Input area -->
		<div class="border-border-light bg-background-secondary-light border-t p-4">
			<form onsubmit={handleSubmit} class="mx-auto max-w-4xl">
				<div class="flex space-x-2">
					<textarea
						bind:value={inputMessage}
						placeholder="Ask me about coffee recommendations, roasting advice, or anything coffee-related..."
						class="border-border-light bg-background-primary-light text-text-primary-light placeholder-text-secondary-light focus:border-background-tertiary-light focus:ring-background-tertiary-light flex-1 resize-none rounded-lg border px-4 py-3 focus:outline-none focus:ring-1"
						rows="1"
						disabled={isLoading}
						onkeydown={(e) => {
							if (e.key === 'Enter' && !e.shiftKey) {
								e.preventDefault();
								sendMessage();
							}
						}}
						oninput={(e) => {
							const target = e.target as HTMLTextAreaElement;
							target.style.height = 'auto';
							target.style.height = target.scrollHeight + 'px';
						}}
					></textarea>
					<button
						type="submit"
						disabled={isLoading || !inputMessage.trim()}
						class="bg-background-tertiary-light rounded-lg px-4 py-3 text-white transition-all duration-200 hover:bg-opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{#if isLoading}
							<div
								class="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"
							></div>
						{:else}
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-5 w-5"
								viewBox="0 0 20 20"
								fill="currentColor"
							>
								<path
									fill-rule="evenodd"
									d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
									clip-rule="evenodd"
								/>
							</svg>
						{/if}
					</button>
				</div>
				<div class="text-text-secondary-light mt-2 text-xs">
					Press Enter to send, Shift+Enter for new line
				</div>
			</form>
		</div>
	</div>

	<!-- Coffee Preview Sidebar -->
	<CoffeePreviewSidebar
		isOpen={coffeePreviewOpen}
		coffeeIds={selectedCoffeeIds}
		focusId={focusCoffeeId}
		onClose={handleSidebarClose}
		{parseTastingNotes}
	/>
{/if}

<style>
	.message-fade-in {
		animation: messageFadeIn 0.3s ease-out;
	}

	@keyframes messageFadeIn {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* Delayed fade-in for coffee cards */
	:global(.animate-fade-in-delayed) {
		animation: fadeInDelayed 0.8s ease-out 0.4s both;
	}

	@keyframes fadeInDelayed {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
