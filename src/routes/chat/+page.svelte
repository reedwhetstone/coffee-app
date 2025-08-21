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
	}> = $state([]);
	let inputMessage = $state('');
	let isLoading = $state(false);
	let chatContainer = $state<HTMLDivElement>();
	let thinkingSteps = $state<Array<{ message: string; timestamp: Date }>>([]);

	// Scroll to bottom when new messages are added or thinking steps update
	$effect(() => {
		if ((messages.length || thinkingSteps.length) && chatContainer) {
			chatContainer.scrollTop = chatContainer.scrollHeight;
		}
	});

	/**
	 * Send message to chat API with streaming thinking steps
	 */
	async function sendMessage() {
		if (!inputMessage.trim() || isLoading) return;

		const userMessage = inputMessage.trim();
		inputMessage = '';
		isLoading = true;
		thinkingSteps = []; // Clear previous thinking steps

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
				throw new Error('Failed to get chat response');
			}

			// Handle Server-Sent Events
			if (response.body) {
				const reader = response.body.getReader();
				const decoder = new TextDecoder();

				while (true) {
					const { done, value } = await reader.read();
					if (done) break;

					const chunk = decoder.decode(value);
					const lines = chunk.split('\n');

					for (const line of lines) {
						if (line.trim() && line.startsWith('data: ')) {
							try {
								const data = JSON.parse(line.slice(6));

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
									// Clear thinking steps and add final response
									thinkingSteps = [];

									// Use structured response data if available
									const structuredResponse = data.structured_response;
									const coffeeData = data.coffee_data || [];

									// Create base message
									const newMessage: any = {
										role: 'assistant',
										content: structuredResponse?.message || data.response,
										timestamp: data.timestamp ? new Date(data.timestamp) : new Date()
									};

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

									messages.push(newMessage);
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
							} catch (e) {
								console.error('Error parsing SSE data:', e, line);
							}
						}
					}
				}
			}
		} catch (error) {
			console.error('Chat error:', error);
			thinkingSteps = [];
			messages.push({
				role: 'assistant',
				content: 'Sorry, I encountered an error. Please try again.',
				timestamp: new Date()
			});
		} finally {
			isLoading = false;
		}
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
	<div class="flex min-h-screen items-center justify-center bg-background-primary-light">
		<div
			class="mx-auto max-w-md rounded-lg bg-background-secondary-light p-8 text-center shadow-lg"
		>
			<h1 class="mb-4 text-2xl font-bold text-text-primary-light">Coffee Chat</h1>
			<p class="mb-6 text-text-secondary-light">
				Sign in to access our AI coffee expert for personalized recommendations and roasting advice.
			</p>
			<a
				href="/auth"
				class="rounded-md bg-background-tertiary-light px-6 py-3 font-medium text-white transition-all duration-200 hover:bg-opacity-90"
			>
				Sign In
			</a>
		</div>
	</div>
{:else if !hasRequiredRole('member')}
	<!-- Member role required -->
	<div class="flex min-h-screen items-center justify-center bg-background-primary-light">
		<div
			class="mx-auto max-w-md rounded-lg bg-background-secondary-light p-8 text-center shadow-lg"
		>
			<h1 class="mb-4 text-2xl font-bold text-text-primary-light">Premium Feature</h1>
			<p class="mb-6 text-text-secondary-light">
				The Coffee Chat AI assistant is available for premium members. Upgrade to access
				personalized recommendations and expert roasting advice.
			</p>
			<div class="space-y-3">
				<a
					href="/subscription"
					class="block rounded-md bg-background-tertiary-light px-6 py-3 font-medium text-white transition-all duration-200 hover:bg-opacity-90"
				>
					Upgrade to Premium
				</a>
				<a
					href="/"
					class="block rounded-md border border-background-tertiary-light px-6 py-3 text-background-tertiary-light transition-all duration-200 hover:bg-background-tertiary-light hover:text-white"
				>
					Back to Home
				</a>
			</div>
		</div>
	</div>
{:else}
	<!-- Main chat interface for authenticated members -->
	<div class="flex h-screen flex-col bg-background-primary-light">
		<!-- Header -->
		<header class="border-b border-border-light bg-background-secondary-light px-4 py-3">
			<div class="flex items-center justify-between">
				<div>
					<h1 class="text-xl font-semibold text-text-primary-light">Coffee Chat</h1>
					<p class="text-sm text-text-secondary-light">AI-powered coffee assistant</p>
				</div>
				<div class="flex space-x-2">
					{#if messages.length > 0}
						<button
							onclick={exportConversation}
							class="rounded-md border border-background-tertiary-light px-3 py-1 text-sm text-background-tertiary-light transition-all duration-200 hover:bg-background-tertiary-light hover:text-white"
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
		<div bind:this={chatContainer} class="flex-1 overflow-y-auto p-4">
			{#if messages.length === 0}
				<!-- Welcome message -->
				<div class="mx-auto max-w-2xl text-center">
					<div class="mb-8 rounded-lg bg-background-secondary-light p-6">
						<h2 class="mb-3 text-lg font-semibold text-text-primary-light">
							Welcome to Coffee Chat! ☕
						</h2>
						<p class="mb-4 text-text-secondary-light">
							I'm your AI coffee expert, here to help with personalized recommendations, roasting
							advice, and coffee knowledge. Ask me anything about:
						</p>
						<div class="grid grid-cols-1 gap-2 text-sm text-text-secondary-light md:grid-cols-2">
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
						<p class="text-sm font-medium text-text-primary-light">Try asking:</p>
						<div class="space-y-2 text-sm">
							<button
								onclick={() =>
									(inputMessage =
										'Check the green coffee catalog for an Ethiopian with stone fruit notes and a unique processing method.')}
								class="block w-full rounded-md border border-border-light bg-background-secondary-light p-2 text-left text-text-secondary-light transition-all hover:bg-background-tertiary-light hover:text-white"
							>
								"Check the green coffee catalog for an Ethiopian with stone fruit notes and a unique
								processing method."
							</button>
							<button
								onclick={() =>
									(inputMessage = "What's the best way to roast a washed Costa Rican coffee?")}
								class="block w-full rounded-md border border-border-light bg-background-secondary-light p-2 text-left text-text-secondary-light transition-all hover:bg-background-tertiary-light hover:text-white"
							>
								"What's the best way to roast a washed Costa Rican coffee?"
							</button>
							<button
								onclick={() =>
									(inputMessage = 'Analyze my recent roasting sessions and suggest improvements')}
								class="block w-full rounded-md border border-border-light bg-background-secondary-light p-2 text-left text-text-secondary-light transition-all hover:bg-background-tertiary-light hover:text-white"
							>
								"Analyze my recent roasting sessions and suggest improvements"
							</button>
						</div>
					</div>
				</div>
			{:else}
				<!-- Chat messages -->
				<div class="mx-auto max-w-4xl space-y-4">
					{#each messages as message}
						<div class="flex {message.role === 'user' ? 'justify-end' : 'justify-start'}">
							<div
								class="max-w-[80%] rounded-lg px-4 py-2 {message.role === 'user'
									? 'bg-background-tertiary-light text-white'
									: 'bg-background-secondary-light text-text-primary-light'}"
							>
								{#if message.role === 'assistant' && message.isStructured}
									<ChatMessageRenderer
										message={message.content}
										coffeeCards={message.coffeeCards}
										coffeeData={message.coffeeData || []}
										{parseTastingNotes}
										onCoffeePreview={handleCoffeePreview}
									/>
								{:else}
									<div class="whitespace-pre-wrap">{message.content}</div>
								{/if}
								<div class="mt-1 text-xs opacity-70">
									{message.timestamp.toLocaleTimeString()}
								</div>
							</div>
						</div>
					{/each}

					{#if isLoading && thinkingSteps.length > 0}
						<div class="flex justify-start">
							<div class="max-w-[80%]">
								<ChainOfThought steps={thinkingSteps} isActive={isLoading} />
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
		<div class="border-t border-border-light bg-background-secondary-light p-4">
			<form onsubmit={handleSubmit} class="mx-auto max-w-4xl">
				<div class="flex space-x-2">
					<textarea
						bind:value={inputMessage}
						placeholder="Ask me about coffee recommendations, roasting advice, or anything coffee-related..."
						class="flex-1 resize-none rounded-lg border border-border-light bg-background-primary-light px-4 py-3 text-text-primary-light placeholder-text-secondary-light focus:border-background-tertiary-light focus:outline-none focus:ring-1 focus:ring-background-tertiary-light"
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
						class="rounded-lg bg-background-tertiary-light px-4 py-3 text-white transition-all duration-200 hover:bg-opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
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
				<div class="mt-2 text-xs text-text-secondary-light">
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
