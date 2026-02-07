<script lang="ts">
	import type { PageData } from './$types';
	import { checkRole } from '$lib/types/auth.types';
	import type { UserRole } from '$lib/types/auth.types';
	import { Chat } from '@ai-sdk/svelte';
	import { DefaultChatTransport } from 'ai';
	import SvelteMarkdown from '@humanspeak/svelte-markdown';
	import GenUIBlockRenderer from '$lib/components/genui/GenUIBlockRenderer.svelte';
	import InlineStatusLine from '$lib/components/genui/InlineStatusLine.svelte';
	import Canvas from '$lib/components/canvas/Canvas.svelte';
	import { canvasStore } from '$lib/stores/canvasStore.svelte';
	import {
		extractBlockFromPart,
		extractCanvasMutationsFromPart,
		extractCompanionBlocks,
		buildSearchDataCache,
		messageHasPresentResults
	} from '$lib/services/blockExtractor';
	import type { BlockAction, CanvasBlock } from '$lib/types/genui';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import {
		workspaceStore,
		type Workspace,
		type WorkspaceMessage
	} from '$lib/stores/workspaceStore.svelte';

	let { data } = $props<{ data: PageData }>();

	// Destructure with default values to prevent undefined errors
	let { session, role = 'viewer' } = $derived(data);

	// User role management
	let userRole: UserRole = $derived(role as UserRole);

	function hasRequiredRole(requiredRole: UserRole): boolean {
		return checkRole(userRole, requiredRole);
	}

	// ─── Workspace state ──────────────────────────────────────────────────────
	let workspacesLoaded = $state(false);
	let showWorkspaceMenu = $state(false);
	let editingTitle = $state<string | null>(null);
	let editTitleValue = $state('');

	// Build workspace context for the AI system prompt
	function getWorkspaceContext() {
		const ws = workspaceStore.currentWorkspace;
		if (!ws) return undefined;

		// Describe canvas state for the AI
		let canvasDescription = '';
		if (canvasStore.blocks.length > 0) {
			const blockDescriptions = canvasStore.blocks.map((b: CanvasBlock) => {
				const type = b.block.type.replace(/-/g, ' ');
				return type;
			});
			canvasDescription = blockDescriptions.join(', ');
		}

		return {
			type: ws.type,
			summary: ws.context_summary || undefined,
			canvasDescription: canvasDescription || undefined
		};
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

	// ─── Workspace lifecycle ──────────────────────────────────────────────────
	onMount(async () => {
		if (!hasRequiredRole('member')) return;
		await workspaceStore.loadWorkspaces();
		workspacesLoaded = true;

		// Auto-create first workspace or load most recent
		if (workspaceStore.workspaces.length === 0) {
			const ws = await workspaceStore.createWorkspace('General', 'general');
			if (ws) await loadWorkspace(ws.id);
		} else {
			await loadWorkspace(workspaceStore.workspaces[0].id);
		}
	});

	async function loadWorkspace(workspaceId: string) {
		const result = await workspaceStore.switchWorkspace(workspaceId);
		if (!result) return;

		// Clear current chat and canvas
		chat.messages = [];
		canvasStore.clearAll();
		dispatchedParts = new Set();

		// Restore messages from persisted workspace
		if (result.messages.length > 0) {
			// Reconstruct UIMessage-compatible objects from saved messages
			const restored = result.messages.map((msg: WorkspaceMessage) => ({
				id: msg.id,
				role: msg.role,
				parts:
					Array.isArray(msg.parts) && msg.parts.length > 0
						? msg.parts
						: [{ type: 'text', text: msg.content }],
				createdAt: new Date(msg.created_at)
			}));
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			chat.messages = restored as any;
		}

		// Restore canvas state
		if (
			result.workspace.canvas_state &&
			typeof result.workspace.canvas_state === 'object' &&
			'blocks' in result.workspace.canvas_state
		) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const cs = result.workspace.canvas_state as any;
			if (Array.isArray(cs.blocks)) {
				canvasStore.dispatch({ type: 'clear' });
				for (const cb of cs.blocks) {
					if (cb.block) {
						canvasStore.dispatch({ type: 'add', block: cb.block, messageId: cb.messageId || '' });
					}
				}
			}
			if (cs.layout) {
				canvasStore.dispatch({ type: 'layout', layout: cs.layout });
			}
		}
	}

	async function handleCreateWorkspace() {
		const ws = await workspaceStore.createWorkspace();
		if (ws) {
			showWorkspaceMenu = false;
			await loadWorkspace(ws.id);
		}
	}

	async function handleSwitchWorkspace(workspaceId: string) {
		if (workspaceId === workspaceStore.currentWorkspaceId) {
			showWorkspaceMenu = false;
			return;
		}
		// Save current workspace state before switching
		await persistCurrentState();
		showWorkspaceMenu = false;
		await loadWorkspace(workspaceId);
	}

	async function handleDeleteWorkspace(workspaceId: string) {
		if (!confirm('Delete this workspace and all its messages?')) return;
		await workspaceStore.deleteWorkspace(workspaceId);
		if (workspaceStore.workspaces.length === 0) {
			const ws = await workspaceStore.createWorkspace('General', 'general');
			if (ws) await loadWorkspace(ws.id);
		} else if (workspaceStore.currentWorkspaceId !== workspaceId) {
			// Already on a different workspace
		} else {
			await loadWorkspace(workspaceStore.workspaces[0].id);
		}
	}

	function startEditTitle(ws: Workspace) {
		editingTitle = ws.id;
		editTitleValue = ws.title;
	}

	async function saveTitle() {
		if (editingTitle && editTitleValue.trim()) {
			await workspaceStore.updateTitle(editingTitle, editTitleValue.trim());
		}
		editingTitle = null;
	}

	// Persist chat messages and canvas state to the current workspace
	async function persistCurrentState() {
		const wsId = workspaceStore.currentWorkspaceId;
		if (!wsId) return;

		// Save new messages (ones not yet persisted)
		const savedCount = workspaceStore.getSavedMessageCount(wsId);
		const newMessages = chat.messages.slice(savedCount);
		if (newMessages.length > 0) {
			const toSave = newMessages.map((msg) => {
				const textParts = msg.parts.filter((p) => p.type === 'text');
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const content = textParts.map((p: any) => p.text || '').join('\n');
				return {
					role: msg.role,
					content,
					parts: msg.parts
				};
			});
			await workspaceStore.saveMessages(wsId, toSave);
		}

		// Save canvas state
		await workspaceStore.saveCanvasState(wsId, {
			blocks: canvasStore.blocks.map((b: CanvasBlock) => ({
				block: b.block,
				messageId: b.messageId,
				pinned: b.pinned
			})),
			layout: canvasStore.layout
		});
	}

	// Auto-persist periodically when streaming completes
	let lastPersistedMessageCount = $state(0);
	$effect(() => {
		if (!isActive && chat.messages.length > 0 && chat.messages.length !== lastPersistedMessageCount) {
			lastPersistedMessageCount = chat.messages.length;
			// Debounce persistence
			const timeout = setTimeout(() => persistCurrentState(), 2000);
			return () => clearTimeout(timeout);
		}
	});

	// Trigger context compaction after ~10 message pairs
	$effect(() => {
		const wsId = workspaceStore.currentWorkspaceId;
		if (!wsId || isActive) return;
		const msgCount = chat.messages.length;
		if (msgCount > 0 && msgCount % 20 === 0) {
			workspaceStore.triggerSummarize(wsId);
		}
	});

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

	// ─── Canvas panel state ──────────────────────────────────────────────────
	let canvasOpen = $state(false);
	let dividerDragging = $state(false);
	let chatWidthPercent = $state(60); // Chat takes 60% by default
	let mobileCanvasOpen = $state(false);

	// Auto-open canvas when blocks arrive
	$effect(() => {
		if (!canvasStore.isEmpty && !canvasOpen) {
			canvasOpen = true;
		}
	});

	// Track which message IDs have been dispatched to canvas (to avoid duplicates)
	let dispatchedParts = $state(new Set<string>());

	// Dispatch blocks to canvas when streaming completes for a message
	$effect(() => {
		if (isActive) return; // Wait until streaming stops

		for (const message of chat.messages) {
			if (message.role !== 'assistant') continue;

			const hasPR = messageHasPresentResults(message.parts);
			const searchCache = hasPR ? buildSearchDataCache(message.parts) : undefined;
			const extractorOptions = { searchDataCache: searchCache, hasPresentResults: hasPR };

			for (const part of message.parts) {
				if (!part.type.startsWith('tool-')) continue;

				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const p = part as any;
				const partKey = `${message.id}-${p.toolInvocationId ?? p.toolName ?? part.type}`;
				if (dispatchedParts.has(partKey)) continue;

				const block = extractBlockFromPart(p, extractorOptions);

				// If this is a present_results part, use explicit canvas mutations
				const mutations = extractCanvasMutationsFromPart(p, block, message.id);
				if (mutations) {
					for (const m of mutations) canvasStore.dispatch(m);
					dispatchedParts = new Set([...dispatchedParts, partKey]);
				} else if (block && block.type !== 'error') {
					// Non-present_results tools: auto-add to canvas
					canvasStore.dispatch({ type: 'add', block, messageId: message.id });
					dispatchedParts = new Set([...dispatchedParts, partKey]);

					// Also dispatch companion blocks (e.g., roast-chart for single roast profile)
					const companions = extractCompanionBlocks(p);
					for (const companion of companions) {
						canvasStore.dispatch({ type: 'add', block: companion, messageId: message.id });
					}
				}
			}
		}
	});

	// Build a lookup: messageId + toolInvocationId → canvasBlockId
	let canvasBlockLookup = $derived(() => {
		const map = new Map<string, string>();
		for (const cb of canvasStore.blocks) {
			// Map messageId to the canvas block (simplified: last one wins per message)
			map.set(cb.messageId, cb.id);
		}
		return map;
	});

	// ─── Divider drag handling ────────────────────────────────────────────────
	function startDividerDrag(e: MouseEvent) {
		e.preventDefault();
		dividerDragging = true;

		const onMove = (ev: MouseEvent) => {
			const container = (e.target as HTMLElement)?.closest('.chat-canvas-container');
			if (!container) return;
			const rect = container.getBoundingClientRect();
			const percent = ((ev.clientX - rect.left) / rect.width) * 100;
			chatWidthPercent = Math.max(30, Math.min(80, percent));
		};

		const onUp = () => {
			dividerDragging = false;
			window.removeEventListener('mousemove', onMove);
			window.removeEventListener('mouseup', onUp);
		};

		window.addEventListener('mousemove', onMove);
		window.addEventListener('mouseup', onUp);
	}

	// ─── Accumulated status steps for the entire message ──────────────────────
	function getMessageToolSteps(
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		parts: any[]
	): Array<{ message: string; timestamp: Date }> {
		const steps: Array<{ message: string; timestamp: Date }> = [];

		for (const part of parts) {
			if (!part?.type?.startsWith('tool-')) continue;

			const rawName = part.toolName ?? part.type.replace('tool-', '');
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
		} else if (action.type === 'focus-canvas-block') {
			canvasStore.dispatch({ type: 'focus', blockId: action.blockId });
			// On mobile, open canvas overlay
			if (window.innerWidth < 768) {
				mobileCanvasOpen = true;
			}
		} else if (action.type === 'scroll-to-message') {
			scrollToMessage(action.messageId);
		}
	}

	function scrollToMessage(messageId: string) {
		const el = document.getElementById(`msg-${messageId}`);
		if (el && chatContainer) {
			el.scrollIntoView({ behavior: 'smooth', block: 'start' });
			el.classList.add('message-highlight');
			setTimeout(() => el.classList.remove('message-highlight'), 2000);
		}
	}

	// ─── Send Message ──────────────────────────────────────────────────────────
	async function sendMessage() {
		if (!inputMessage.trim() || isActive) return;

		const text = inputMessage.trim();
		inputMessage = '';
		shouldScrollToBottom = true;

		await chat.sendMessage({
			text,
			body: { workspaceContext: getWorkspaceContext() }
		});
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
			canvasStore.clearAll();
			dispatchedParts = new Set();
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
	<!-- Main chat + canvas interface -->
	<div class="flex h-screen flex-col bg-background-primary-light">
		<!-- Header -->
		<header class="border-b border-border-light bg-background-secondary-light px-4 py-3">
			<div class="flex items-center justify-between">
				<div>
					<h1 class="text-xl font-semibold text-text-primary-light">Coffee Chat</h1>
					<p class="text-sm text-text-secondary-light">AI-powered coffee assistant</p>
				</div>
				<div class="flex items-center space-x-2">
					<!-- Canvas toggle (mobile) -->
					{#if !canvasStore.isEmpty}
						<button
							onclick={() => (mobileCanvasOpen = !mobileCanvasOpen)}
							class="rounded-md border border-border-light px-3 py-1 text-sm text-text-secondary-light transition-all duration-200 hover:text-text-primary-light md:hidden"
						>
							Canvas ({canvasStore.blockCount})
						</button>
					{/if}
					<!-- Canvas toggle (desktop) -->
					{#if !canvasStore.isEmpty}
						<button
							onclick={() => (canvasOpen = !canvasOpen)}
							class="hidden rounded-md border border-border-light px-3 py-1 text-sm text-text-secondary-light transition-all duration-200 hover:text-text-primary-light md:block"
						>
							{canvasOpen ? 'Hide' : 'Show'} Canvas ({canvasStore.blockCount})
						</button>
					{/if}
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

		<!-- Chat + Canvas split container -->
		<div class="chat-canvas-container flex flex-1 overflow-hidden">
			<!-- Chat pane -->
			<div
				class="flex flex-col overflow-hidden"
				style="width: {canvasOpen ? chatWidthPercent : 100}%; transition: width 0.2s ease;"
			>
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
									<div id="msg-{message.id}" class="message-fade-in flex justify-end">
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
									<div id="msg-{message.id}" class="message-fade-in w-full space-y-3">
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

										<!-- Inline previews render after streaming completes -->
										{#if !isStreaming}
											{#each message.parts as part}
												{#if part.type.startsWith('tool-')}
													{@const toolPart = asToolPart(part)}
													{@const block = extractBlockFromPart(toolPart, extractorOptions)}
													{#if block}
														{@const lookup = canvasBlockLookup()}
														{@const canvasId = lookup.get(message.id)}
														<div class="preview-fade-in my-1">
															<GenUIBlockRenderer
																{block}
																renderMode="chat"
																onAction={handleBlockAction}
																canvasBlockId={canvasId}
															/>
														</div>
													<!-- Companion block previews (e.g., roast chart for single roast) -->
													{@const companions = extractCompanionBlocks(toolPart)}
													{#each companions as companionBlock}
														<div class="preview-fade-in my-1">
															<GenUIBlockRenderer
																block={companionBlock}
																renderMode="chat"
																onAction={handleBlockAction}
																canvasBlockId={canvasId}
															/>
														</div>
													{/each}
													{:else if toolPart.state === 'output-error'}
														{@const errorBlock = extractBlockFromPart(toolPart)}
														{#if errorBlock}
															<div class="preview-fade-in my-1">
																<GenUIBlockRenderer
																	block={errorBlock}
																	renderMode="chat"
																	onAction={handleBlockAction}
																/>
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

			<!-- Resizable divider (desktop only) -->
			{#if canvasOpen}
				<div
					class="hidden w-1 cursor-col-resize bg-border-light transition-colors hover:bg-background-tertiary-light/40 md:block"
					class:bg-background-tertiary-light={dividerDragging}
					role="separator"
					tabindex="0"
					onmousedown={startDividerDrag}
				></div>

				<!-- Canvas pane (desktop) -->
				<div
					class="hidden overflow-hidden md:block"
					style="width: {100 - chatWidthPercent}%;"
				>
					<Canvas
						onAction={handleBlockAction}
						onScrollToMessage={scrollToMessage}
					/>
				</div>
			{/if}
		</div>
	</div>

	<!-- Mobile canvas overlay -->
	{#if mobileCanvasOpen}
		<div class="fixed inset-0 z-50 flex flex-col bg-background-primary-light md:hidden">
			<div class="flex items-center justify-between border-b border-border-light px-4 py-3">
				<span class="text-sm font-medium text-text-primary-light">
					Canvas ({canvasStore.blockCount})
				</span>
				<button
					onclick={() => (mobileCanvasOpen = false)}
					class="rounded-md px-3 py-1 text-sm text-text-secondary-light transition-colors hover:text-text-primary-light"
				>
					Close
				</button>
			</div>
			<div class="flex-1 overflow-hidden">
				<Canvas
					onAction={handleBlockAction}
					onScrollToMessage={(msgId: string) => {
						mobileCanvasOpen = false;
						setTimeout(() => scrollToMessage(msgId), 300);
					}}
				/>
			</div>
		</div>
	{/if}

	<!-- Mobile floating indicator -->
	{#if !canvasStore.isEmpty && !mobileCanvasOpen}
		<button
			onclick={() => (mobileCanvasOpen = true)}
			class="fixed bottom-20 right-4 z-40 flex items-center gap-1.5 rounded-full bg-background-tertiary-light px-3 py-2 text-sm text-white shadow-lg transition-transform hover:scale-105 md:hidden"
		>
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
			</svg>
			{canvasStore.blockCount}
		</button>
	{/if}
{/if}

<style>
	.message-fade-in {
		animation: messageFadeIn 0.3s ease-out;
	}

	.preview-fade-in {
		animation: previewFadeIn 0.25s ease-out;
	}

	:global(.message-highlight) {
		animation: highlightPulse 2s ease-out;
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

	@keyframes previewFadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes highlightPulse {
		0% {
			background-color: rgba(99, 102, 241, 0.15);
		}
		100% {
			background-color: transparent;
		}
	}
</style>
