<script lang="ts">
	import type { PageData } from './$types';
	import { checkRole } from '$lib/types/auth.types';
	import type { UserRole } from '$lib/types/auth.types';
	import { Chat } from '@ai-sdk/svelte';
	import { DefaultChatTransport } from 'ai';
	import SvelteMarkdown from '@humanspeak/svelte-markdown';
	import CoffeePreviewSidebar from '$lib/components/CoffeePreviewSidebar.svelte';
	import ChainOfThought from '$lib/components/ChainOfThought.svelte';
	import type { TastingNotes } from '$lib/types/coffee.types';
	import type { CoffeeCatalog } from '$lib/types/component.types';
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

	function handleCoffeePreview(coffeeIds: number[], focusId?: number) {
		selectedCoffeeIds = coffeeIds;
		focusCoffeeId = focusId;
		coffeePreviewOpen = true;
	}

	function handleSidebarClose() {
		coffeePreviewOpen = false;
		selectedCoffeeIds = [];
		focusCoffeeId = undefined;
	}

	function parseTastingNotes(tastingNotesJson: string | null | object): TastingNotes | null {
		if (!tastingNotesJson) return null;
		try {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			let parsed: any;
			if (typeof tastingNotesJson === 'string') {
				parsed = JSON.parse(tastingNotesJson);
			} else if (typeof tastingNotesJson === 'object') {
				parsed = tastingNotesJson;
			} else {
				return null;
			}
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

	// ─── Vercel AI SDK Chat Instance ───────────────────────────────────────────
	const chat = new Chat({
		transport: new DefaultChatTransport({ api: '/api/chat' }),
		onError: (error) => {
			console.error('Chat error:', error);
		}
	});

	// Input state (not managed by Chat class - we control the textarea)
	let inputMessage = $state('');

	// Scroll management
	let chatContainer = $state<HTMLDivElement>();
	let shouldScrollToBottom = $state(true);

	$effect(() => {
		if (chatContainer && shouldScrollToBottom && chat.messages.length > 0) {
			chatContainer.scrollTo({
				top: chatContainer.scrollHeight,
				behavior: 'smooth'
			});
		}
	});

	function handleScroll() {
		if (!chatContainer) return;
		const { scrollTop, scrollHeight, clientHeight } = chatContainer;
		const isNearBottom = scrollTop + clientHeight >= scrollHeight - 50;
		shouldScrollToBottom = isNearBottom;
	}

	// ─── Thinking steps derived from tool parts in progress ────────────────────
	let thinkingSteps = $derived.by(() => {
		const steps: Array<{ message: string; timestamp: Date }> = [];
		const lastMessage = chat.messages[chat.messages.length - 1];
		if (!lastMessage || lastMessage.role !== 'assistant') return steps;
		if (chat.status !== 'streaming' && chat.status !== 'submitted') return steps;

		for (const part of lastMessage.parts) {
			if (part.type.startsWith('tool-')) {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const toolPart = part as any;
				const toolName = part.type.replace('tool-', '').replace(/_/g, ' ');

				if (toolPart.state === 'input-streaming' || toolPart.state === 'input-available') {
					steps.push({
						message: `Querying ${toolName}...`,
						timestamp: new Date()
					});
				} else if (toolPart.state === 'output-available') {
					const output = toolPart.output;
					let detail = '';
					if (output && typeof output === 'object') {
						if (Array.isArray(output)) {
							detail = ` - Found ${output.length} result${output.length === 1 ? '' : 's'}`;
						} else if ('coffees' in output && Array.isArray(output.coffees)) {
							detail = ` - Found ${output.coffees.length} coffee${output.coffees.length === 1 ? '' : 's'}`;
						} else if ('total_count' in output) {
							detail = ` - Found ${output.total_count} result${output.total_count === 1 ? '' : 's'}`;
						}
					}
					steps.push({
						message: `Finished ${toolName}${detail}`,
						timestamp: new Date()
					});
				} else if (toolPart.state === 'output-error') {
					steps.push({
						message: `Error with ${toolName}: ${toolPart.errorText || 'unknown error'}`,
						timestamp: new Date()
					});
				}
			}
		}

		return steps;
	});

	let isActive = $derived(chat.status === 'streaming' || chat.status === 'submitted');

	// ─── Coffee data extraction from tool results ──────────────────────────────
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	function extractCoffeeData(message: any): CoffeeCatalog[] {
		if (!message?.parts) return [];
		const coffees: CoffeeCatalog[] = [];

		for (const part of message.parts) {
			if (!part.type.startsWith('tool-')) continue;
			if (part.state !== 'output-available') continue;
			const output = part.output;
			if (!output || typeof output !== 'object') continue;

			// coffee_catalog_search returns { coffees: [...] }
			if ('coffees' in output && Array.isArray(output.coffees)) {
				coffees.push(...output.coffees);
			}
		}

		return coffees;
	}

	// ─── Send Message ──────────────────────────────────────────────────────────
	async function sendMessage() {
		if (!inputMessage.trim() || isActive) return;

		const text = inputMessage.trim();
		inputMessage = '';
		shouldScrollToBottom = true;

		await chat.sendMessage({ text });
	}

	function handleSubmit(event: Event) {
		event.preventDefault();
		sendMessage();
	}

	// ─── Export / Clear ────────────────────────────────────────────────────────
	function exportConversation() {
		const timestamp = new Date().toLocaleString();
		let markdown = `# Coffee Chat Conversation\n\n`;
		markdown += `**Exported:** ${timestamp}\n\n---\n\n`;

		for (const message of chat.messages) {
			const role = message.role === 'user' ? 'User' : 'Assistant';
			markdown += `## ${role}\n\n`;

			for (const part of message.parts) {
				if (part.type === 'text') {
					markdown += `${part.text}\n\n`;
				}
			}
			markdown += `---\n\n`;
		}

		const blob = new Blob([markdown], { type: 'text/markdown' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `coffee-chat-${new Date().toISOString().split('T')[0]}.md`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}

	function clearConversation() {
		if (confirm('Are you sure you want to clear the conversation?')) {
			chat.messages = [];
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
					{#if chat.messages.length > 0}
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
		<div bind:this={chatContainer} class="flex-1 overflow-y-auto p-4" onscroll={handleScroll}>
			{#if chat.messages.length === 0}
				<!-- Welcome message -->
				<div class="mx-auto max-w-2xl text-center">
					<div class="mb-8 rounded-lg bg-background-secondary-light p-6">
						<h2 class="mb-3 text-lg font-semibold text-text-primary-light">
							Welcome to Coffee Chat!
						</h2>
						<p class="mb-4 text-text-secondary-light">
							I'm your AI coffee expert, here to help with personalized recommendations, roasting
							advice, and coffee knowledge. Ask me anything about:
						</p>
						<div class="grid grid-cols-1 gap-2 text-sm text-text-secondary-light md:grid-cols-2">
							<div>- Coffee recommendations</div>
							<div>- Roasting techniques</div>
							<div>- Flavor profiles</div>
							<div>- Processing methods</div>
							<div>- Your inventory analysis</div>
							<div>- Brewing guidance</div>
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
					{#each chat.messages as message (message.id)}
						<div
							class="flex {message.role === 'user'
								? 'justify-end'
								: 'justify-start'} message-fade-in"
						>
							<div
								class="max-w-[80%] rounded-lg px-4 py-2 {message.role === 'user'
									? 'bg-background-tertiary-light text-white'
									: 'bg-background-secondary-light text-text-primary-light'}"
							>
								<!-- Render text parts -->
								{#each message.parts as part}
									{#if part.type === 'text'}
										{#if message.role === 'assistant'}
											<div
												class="prose prose-sm max-w-none text-text-primary-light prose-headings:text-text-primary-light prose-p:text-text-primary-light prose-strong:text-text-primary-light prose-ol:text-text-primary-light prose-ul:text-text-primary-light prose-li:text-text-primary-light"
											>
												<SvelteMarkdown source={part.text} />
											</div>
										{:else}
											<div class="whitespace-pre-wrap">{part.text}</div>
										{/if}
									{/if}
								{/each}

								<!-- Render coffee cards from tool results (once per message, not per part) -->
								{#if message.role === 'assistant'}
									{@const coffees = extractCoffeeData(message)}
									{#if coffees.length > 0}
										<div class="my-4">
											<h3 class="mb-3 font-semibold text-text-primary-light">
												Coffee Recommendations ({coffees.length})
											</h3>
											<div class="space-y-3">
												{#each coffees as coffee (coffee.id)}
													<button
														type="button"
														class="group w-full rounded-lg bg-background-primary-light p-4 text-left shadow-sm ring-1 ring-border-light transition-all hover:scale-[1.02] hover:ring-background-tertiary-light"
														onclick={() => {
															const allIds = coffees.map(
																(c: CoffeeCatalog) => c.id
															);
															handleCoffeePreview(allIds, coffee.id);
														}}
													>
														<div
															class="flex flex-col space-y-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0"
														>
															<div class="flex-1">
																<h4
																	class="font-semibold text-text-primary-light group-hover:text-background-tertiary-light"
																>
																	{coffee.name}
																</h4>
																<div
																	class="mt-1 flex items-center justify-between"
																>
																	<p
																		class="text-sm font-medium text-background-tertiary-light"
																	>
																		{coffee.source}
																	</p>
																	<div class="text-right sm:hidden">
																		<div
																			class="font-bold text-background-tertiary-light"
																		>
																			${coffee.cost_lb}/lb
																		</div>
																		{#if coffee.processing}
																			<div
																				class="text-xs text-text-secondary-light"
																			>
																				{coffee.processing.length > 25
																					? coffee.processing.substring(
																							0,
																							25
																						) + '...'
																					: coffee.processing}
																			</div>
																		{/if}
																	</div>
																</div>
																{#if coffee.ai_description}
																	<p
																		class="my-2 line-clamp-2 text-xs text-text-secondary-light"
																	>
																		{coffee.ai_description}
																	</p>
																{/if}
															</div>
															<div
																class="hidden flex-col items-end space-y-1 sm:flex"
															>
																<div class="text-right">
																	<div
																		class="font-bold text-background-tertiary-light"
																	>
																		${coffee.cost_lb}/lb
																	</div>
																	{#if coffee.processing}
																		<div
																			class="mt-1 text-xs text-background-tertiary-light"
																		>
																			{coffee.processing.length > 25
																				? coffee.processing.substring(
																						0,
																						25
																					) + '...'
																				: coffee.processing}
																		</div>
																	{/if}
																</div>
															</div>
														</div>
														<div class="mt-3 flex items-center justify-end">
															<svg
																class="h-4 w-4 text-text-secondary-light transition-transform group-hover:translate-x-1 group-hover:text-background-tertiary-light"
																fill="none"
																stroke="currentColor"
																viewBox="0 0 24 24"
															>
																<path
																	stroke-linecap="round"
																	stroke-linejoin="round"
																	stroke-width="2"
																	d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
																/>
															</svg>
														</div>
													</button>
												{/each}
											</div>
										</div>
									{/if}
								{/if}
								<div class="mt-1 text-xs opacity-70">
									{new Date().toLocaleTimeString()}
								</div>
							</div>
						</div>
					{/each}

					<!-- Thinking steps indicator while streaming -->
					{#if isActive && thinkingSteps.length > 0}
						<div class="flex justify-start">
							<div class="max-w-[80%]">
								<ChainOfThought steps={thinkingSteps} {isActive} />
							</div>
						</div>
					{:else if chat.status === 'submitted'}
						<div class="flex justify-start">
							<div class="max-w-[80%]">
								<ChainOfThought steps={[]} isActive={true} />
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
						disabled={isActive}
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
						disabled={isActive || !inputMessage.trim()}
						class="rounded-lg bg-background-tertiary-light px-4 py-3 text-white transition-all duration-200 hover:bg-opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{#if isActive}
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
</style>
