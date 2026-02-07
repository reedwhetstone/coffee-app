<script lang="ts">
	import type { PageData } from './$types';
	import { checkRole } from '$lib/types/auth.types';
	import type { UserRole } from '$lib/types/auth.types';
	import { Chat } from '@ai-sdk/svelte';
	import { DefaultChatTransport } from 'ai';
	import SvelteMarkdown from '@humanspeak/svelte-markdown';
	import GenUIBlockRenderer from '$lib/components/genui/GenUIBlockRenderer.svelte';
	import InlineStatusLine from '$lib/components/genui/InlineStatusLine.svelte';
	import {
		extractBlockFromPart,
		buildSearchDataCache,
		messageHasPresentResults
	} from '$lib/services/blockExtractor';
	import type { BlockAction } from '$lib/types/genui';
	import { goto } from '$app/navigation';

	let { data } = $props<{ data: PageData }>();

	// Destructure with default values to prevent undefined errors
	let { session, role = 'viewer' } = $derived(data);

	// User role management
	let userRole: UserRole = $derived(role as UserRole);

	function hasRequiredRole(requiredRole: UserRole): boolean {
		return checkRole(userRole, requiredRole);
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

	let isActive = $derived(chat.status === 'streaming' || chat.status === 'submitted');

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	function asToolPart(part: unknown): any {
		return part;
	}

	// ─── Accumulated status steps for the entire message ──────────────────────
	// Collects all tool status into a single persistent status block
	function getMessageToolSteps(
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		parts: any[]
	): Array<{ message: string; timestamp: Date }> {
		const steps: Array<{ message: string; timestamp: Date }> = [];

		for (const part of parts) {
			if (!part?.type?.startsWith('tool-')) continue;

			const rawName = part.toolName ?? part.type.replace('tool-', '');
			// Skip present_results — it's an instant passthrough, no user-visible action
			if (rawName === 'present_results') continue;

			const toolName = rawName.replace(/_/g, ' ');

			if (part.state === 'input-streaming' || part.state === 'input-available') {
				steps.push({ message: `Querying ${toolName}...`, timestamp: new Date() });
			} else if (part.state === 'output-available') {
				const output = part.output;
				let detail = '';
				if (output && typeof output === 'object') {
					if (Array.isArray(output)) {
						detail = ` — ${output.length} result${output.length === 1 ? '' : 's'}`;
					} else if ('coffees' in output && Array.isArray(output.coffees)) {
						detail = ` — ${output.coffees.length} coffee${output.coffees.length === 1 ? '' : 's'}`;
					} else if ('inventory' in output && Array.isArray(output.inventory)) {
						detail = ` — ${output.inventory.length} item${output.inventory.length === 1 ? '' : 's'}`;
					} else if ('profiles' in output && Array.isArray(output.profiles)) {
						detail = ` — ${output.profiles.length} profile${output.profiles.length === 1 ? '' : 's'}`;
					} else if ('total_count' in output) {
						detail = ` — ${output.total_count} result${output.total_count === 1 ? '' : 's'}`;
					}
				}
				steps.push({ message: `${toolName}${detail}`, timestamp: new Date() });
			} else if (part.state === 'output-error') {
				steps.push({
					message: `Error: ${part.errorText || 'unknown error'}`,
					timestamp: new Date()
				});
			}
		}
		return steps;
	}

	// ─── Block action handler ─────────────────────────────────────────────────
	function handleBlockAction(action: BlockAction) {
		if (action.type === 'navigate') {
			goto(action.url);
		}
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
				<!-- Chat messages - interleaved rendering -->
				<div class="mx-auto max-w-4xl space-y-4">
					{#each chat.messages as message, msgIndex (message.id)}
						{@const isLastMessage = msgIndex === chat.messages.length - 1}
						{@const isStreaming = isLastMessage && isActive && message.role === 'assistant'}

						{#if message.role === 'user'}
							<!-- User message bubble -->
							<div class="message-fade-in flex justify-end">
								<div
									class="max-w-[80%] rounded-lg bg-background-tertiary-light px-4 py-2 text-white"
								>
									{#each message.parts as part}
										{#if part.type === 'text'}
											<div class="whitespace-pre-wrap">{part.text}</div>
										{/if}
									{/each}
								</div>
							</div>
						{:else}
							<!-- Assistant message -->
							{@const hasPR = messageHasPresentResults(message.parts)}
							{@const searchCache = hasPR ? buildSearchDataCache(message.parts) : undefined}
							{@const extractorOptions = { searchDataCache: searchCache, hasPresentResults: hasPR }}
							{@const toolSteps = getMessageToolSteps(message.parts)}
							{@const hasToolParts = message.parts.some((p) => p.type.startsWith('tool-'))}
							<div class="message-fade-in w-full space-y-3">
								<!-- Persistent accumulated status line for all tool calls -->
								{#if hasToolParts && toolSteps.length > 0}
									<InlineStatusLine steps={toolSteps} isActive={isStreaming} />
								{/if}

								<!-- Text parts stream in live -->
								{#each message.parts as part}
									{#if part.type === 'text' && part.text.trim()}
										<div
											class="prose prose-sm max-w-none text-text-primary-light prose-headings:text-text-primary-light prose-p:text-text-primary-light prose-strong:text-text-primary-light prose-ol:text-text-primary-light prose-ul:text-text-primary-light prose-li:text-text-primary-light"
										>
											<SvelteMarkdown source={part.text} />
										</div>
									{/if}
								{/each}

								<!-- Blocks render only after streaming completes -->
								{#if !isStreaming}
									{#each message.parts as part}
										{#if part.type.startsWith('tool-')}
											{@const toolPart = asToolPart(part)}
											{@const block = extractBlockFromPart(toolPart, extractorOptions)}
											{#if block}
												<div class="block-fade-in block-container" style="contain: layout;">
													<GenUIBlockRenderer {block} onAction={handleBlockAction} />
												</div>
											{:else if toolPart.state === 'output-error'}
												{@const errorBlock = extractBlockFromPart(toolPart)}
												{#if errorBlock}
													<div class="block-fade-in block-container" style="contain: layout;">
														<GenUIBlockRenderer block={errorBlock} onAction={handleBlockAction} />
													</div>
												{/if}
											{/if}
										{/if}
									{/each}
								{/if}
							</div>
						{/if}
					{/each}

					<!-- Initial loading state before any assistant message parts exist -->
					{#if chat.status === 'submitted' && (chat.messages.length === 0 || chat.messages[chat.messages.length - 1]?.role === 'user')}
						<div class="message-fade-in">
							<InlineStatusLine steps={[]} isActive={true} />
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
{/if}

<style>
	.message-fade-in {
		animation: messageFadeIn 0.3s ease-out;
	}

	.block-fade-in {
		animation: blockFadeIn 0.4s ease-out;
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

	@keyframes blockFadeIn {
		from {
			opacity: 0;
			transform: translateY(6px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
