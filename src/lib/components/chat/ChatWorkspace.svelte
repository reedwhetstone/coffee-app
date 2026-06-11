<script lang="ts">
	import { Chat } from '@ai-sdk/svelte';
	import { DefaultChatTransport } from 'ai';
	import Canvas from '$lib/components/canvas/Canvas.svelte';
	import ChatMessageList from '$lib/components/chat/ChatMessageList.svelte';
	import ChatComposer from '$lib/components/chat/ChatComposer.svelte';
	import MemoryPanel from '$lib/components/chat/MemoryPanel.svelte';
	import { canvasStore } from '$lib/stores/canvasStore.svelte';
	import {
		extractBlockFromPart,
		extractCanvasMutationsFromPart,
		extractCompanionBlocks,
		buildSearchDataCacheThroughPart,
		messageHasPresentResults
	} from '$lib/services/blockExtractor';
	import type { BlockAction, CanvasBlock } from '$lib/types/genui';
	import { getSuggestions } from '$lib/services/suggestionEngine';
	import { matchSlashCommand, getSlashCompletions } from '$lib/services/slashCommands';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import {
		workspaceStore,
		type Workspace,
		type WorkspaceMessage
	} from '$lib/stores/workspaceStore.svelte';
	import { pageChatContext } from '$lib/stores/pageContextStore.svelte';
	import {
		applyAnalyticsSeedToInput,
		readAnalyticsSeedFromSearchParams
	} from '$lib/analytics/actionContext';

	let {
		canUseChat,
		canUseMallardWorkspaces,
		variant = 'page',
		initialWorkspaceData = null
	} = $props<{
		canUseChat: boolean;
		canUseMallardWorkspaces: boolean;
		/**
		 * page: full /chat workbench with the resizable canvas split.
		 * drawer: chat-only pane (canvas reachable via overlay) for the
		 * app-wide Ask drawer.
		 */
		variant?: 'page' | 'drawer';
		/**
		 * Server-prefetched workspace list + active conversation (chat page
		 * load). When present, mount skips the client fetch waterfall.
		 */
		initialWorkspaceData?: {
			workspaces: Workspace[];
			workspace: Workspace | null;
			messages: WorkspaceMessage[];
		} | null;
	}>();

	// ─── Context visibility toggles (chips above the composer) ────────────────
	let includeWorkspaceMemory = $state(true);
	let includeCanvasContext = $state(true);
	let includePageContext = $state(true);
	let includeUserMemoryDoc = $state(true);

	// ─── Persistent user memory document ───────────────────────────────────────
	let memoryPanelOpen = $state(false);
	let memoryDocExists = $state(false);
	let lastDreamedCount = 0;

	onMount(() => {
		fetch('/api/memory')
			.then((res) => (res.ok ? res.json() : null))
			.then((data) => {
				if (data && typeof data.content === 'string' && data.content.trim().length > 0) {
					memoryDocExists = true;
				}
			})
			.catch(() => {});
	});

	// Dreaming: every ~16 messages, ask the server to fold durable facts from
	// the recent conversation into the persistent memory document. One model
	// call per pass; the endpoint enforces a cooldown.
	$effect(() => {
		const msgCount = chat.messages.length;
		if (isActive || msgCount < 8 || msgCount % 16 !== 0 || msgCount === lastDreamedCount) return;
		lastDreamedCount = msgCount;

		const recent = chat.messages
			.slice(-16)
			.map((msg) => ({
				role: msg.role,
				content: msg.parts
					.filter((p) => p.type === 'text')
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					.map((p: any) => p.text || '')
					.join('\n')
					.slice(0, 4000)
			}))
			.filter(
				(msg): msg is { role: 'user' | 'assistant'; content: string } =>
					(msg.role === 'user' || msg.role === 'assistant') && msg.content.trim().length > 0
			);
		if (recent.length < 4) return;

		fetch('/api/memory/dream', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ messages: recent })
		})
			.then((res) => {
				if (res.ok) memoryDocExists = true;
			})
			.catch(() => {});
	});

	interface ContextChip {
		id: 'memory' | 'canvas' | 'page' | 'usermemory';
		label: string;
		detail: string;
		active: boolean;
	}

	let contextChips = $derived.by((): ContextChip[] => {
		const chips: ContextChip[] = [];
		if (memoryDocExists) {
			chips.push({
				id: 'usermemory',
				label: 'Memory',
				detail: 'Your persistent memory document, maintained across all conversations',
				active: includeUserMemoryDoc
			});
		}
		const ws = workspaceStore.currentWorkspace;
		if (ws?.context_summary) {
			chips.push({
				id: 'memory',
				label: 'Workspace memory',
				detail: ws.context_summary,
				active: includeWorkspaceMemory
			});
		}
		if (!canvasStore.isEmpty) {
			chips.push({
				id: 'canvas',
				label: `Canvas (${canvasStore.blockCount})`,
				detail: 'The assistant can see what is on your canvas',
				active: includeCanvasContext
			});
		}
		const pageContext = pageChatContext.current;
		if (pageContext) {
			chips.push({
				id: 'page',
				label: `Viewing: ${pageContext.surface}`,
				detail: pageContext.summary,
				active: includePageContext
			});
		}
		return chips;
	});

	function toggleContextChip(id: ContextChip['id']) {
		if (id === 'memory') includeWorkspaceMemory = !includeWorkspaceMemory;
		else if (id === 'canvas') includeCanvasContext = !includeCanvasContext;
		else if (id === 'usermemory') includeUserMemoryDoc = !includeUserMemoryDoc;
		else includePageContext = !includePageContext;
	}

	// Build workspace context for the AI system prompt
	function getWorkspaceContext() {
		const ws = workspaceStore.currentWorkspace;
		if (!ws) return undefined;

		// Describe canvas state for the AI with item names/details
		let canvasDescription = '';
		const visible = canvasStore.visibleBlocks;
		if (visible.length > 0) {
			const descriptions = visible.map((b: CanvasBlock, i: number) => {
				const block = b.block;
				const pos = i + 1;
				switch (block.type) {
					case 'coffee-cards': {
						const items = Array.isArray(block.data) ? block.data : [];
						const names = items
							.slice(0, 5)
							.map((c) => c?.name || 'Unknown')
							.join(', ');
						return `${pos}. Coffee cards: ${names}${items.length > 5 ? ` (+${items.length - 5} more)` : ''}`;
					}
					case 'roast-profiles': {
						const items = Array.isArray(block.data) ? block.data : [];
						const names = items
							.slice(0, 5)
							.map((r) => `${r?.coffee_name || 'Unknown'} (${r?.roast_date || '?'})`)
							.join(', ');
						return `${pos}. Roast profiles: ${names}${items.length > 5 ? ` (+${items.length - 5} more)` : ''}`;
					}
					case 'roast-chart':
						return `${pos}. Roast temperature chart (roast #${block.data?.roastId || '?'})`;
					case 'inventory-table': {
						const items = Array.isArray(block.data) ? block.data : [];
						return `${pos}. Inventory table (${items.length} beans)`;
					}
					case 'tasting-radar':
						return `${pos}. Tasting radar: ${block.data?.beanName || 'Unknown'}`;
					case 'action-card':
						return `${pos}. Action card: ${block.data?.summary || 'Action'} [${block.data?.status || 'unknown'}]`;
					default:
						return `${pos}. ${block.type.replace(/-/g, ' ')}`;
				}
			});
			canvasDescription = descriptions.join('\n');
		}

		return {
			type: ws.type,
			summary: includeWorkspaceMemory ? ws.context_summary || undefined : undefined,
			canvasDescription: includeCanvasContext ? canvasDescription || undefined : undefined
		};
	}

	// ─── Chat error display ──────────────────────────────────────────────────
	let chatError = $state<string | null>(null);

	// ─── Vercel AI SDK Chat Instance ───────────────────────────────────────────
	// Single continuous conversation: only the most recent messages are sent to
	// the model; older context is carried by the conversation summary and the
	// persistent memory document.
	const CONTEXT_WINDOW_MESSAGES = 24;

	const chat = new Chat({
		transport: new DefaultChatTransport({
			api: '/api/chat',
			prepareSendMessagesRequest: ({ messages, body }) => ({
				body: { ...(body ?? {}), messages: messages.slice(-CONTEXT_WINDOW_MESSAGES) }
			})
		}),
		onError: (error) => {
			console.error('Chat error:', error);
			chatError = error instanceof Error ? error.message : 'An error occurred. Please try again.';
			setTimeout(() => {
				chatError = null;
			}, 8000);
		}
	});

	// Input state (not managed by Chat class - we control the textarea)
	let inputMessage = $state('');
	let lastAnalyticsSeed = $state<string | null>(null);

	$effect(() => {
		const analyticsSeed = readAnalyticsSeedFromSearchParams(page.url.searchParams);
		const seedState = applyAnalyticsSeedToInput({
			canUseChat,
			incomingSeed: analyticsSeed,
			inputMessage,
			lastAnalyticsSeed
		});
		if (seedState.inputMessage !== inputMessage) inputMessage = seedState.inputMessage;
		if (seedState.lastAnalyticsSeed !== lastAnalyticsSeed) {
			lastAnalyticsSeed = seedState.lastAnalyticsSeed;
		}
	});

	// ─── Workspace lifecycle ──────────────────────────────────────────────────
	onMount(() => {
		if (!canUseChat) return;

		// Capture workspace ID locally to ensure it's available in cleanup
		// even if store state hasn't synchronized yet
		let activeWorkspaceId: string | null = null;
		const unsubscribeWorkspace = $effect.root(() => {
			$effect(() => {
				activeWorkspaceId = workspaceStore.currentWorkspaceId;
			});
		});

		// beforeunload: persist state via sendBeacon (reliable during tab close/nav)
		const handleBeforeUnload = () => {
			const wsId = activeWorkspaceId;
			if (!wsId) return;
			// Save unsaved messages
			const savedCount = workspaceStore.getSavedMessageCount(wsId);
			const newMessages = chat.messages.slice(savedCount);
			if (newMessages.length > 0) {
				const toSave = newMessages.map((msg) => {
					const textParts = msg.parts.filter((p) => p.type === 'text');
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					const content = textParts.map((p: any) => p.text || '').join('\n');
					return { role: msg.role, content, parts: msg.parts };
				});
				navigator.sendBeacon(
					`/api/workspaces/${wsId}/messages`,
					new Blob([JSON.stringify({ messages: toSave })], { type: 'application/json' })
				);
			}
			// Save canvas state (including pinned, minimized, focusBlockId)
			const fIdx = canvasStore.focusBlockId
				? canvasStore.blocks.findIndex((b: CanvasBlock) => b.id === canvasStore.focusBlockId)
				: -1;
			navigator.sendBeacon(
				`/api/workspaces/${wsId}/canvas`,
				new Blob(
					[
						JSON.stringify({
							canvas_state: {
								blocks: canvasStore.blocks.map((b: CanvasBlock) => ({
									block: b.block,
									messageId: b.messageId,
									pinned: b.pinned,
									minimized: b.minimized
								})),
								layout: canvasStore.layout,
								focusBlockId: canvasStore.focusBlockId,
								focusBlockIndex: fIdx >= 0 ? fIdx : undefined
							}
						})
					],
					{ type: 'application/json' }
				)
			);
		};
		window.addEventListener('beforeunload', handleBeforeUnload);

		// Load (or create) the single continuous conversation. Older multi-
		// workspace data stays intact; everything funnels into the first one.
		// Server-prefetched data (page variant) skips the fetch waterfall.
		(async () => {
			if (initialWorkspaceData) {
				const { workspaces: list, workspace, messages } = initialWorkspaceData;
				workspaceStore.hydrate(list, workspace ? { workspace, messages } : null);
				if (workspace) {
					applyWorkspaceResult({ workspace, messages });
					return;
				}
			} else {
				await workspaceStore.loadWorkspaces();
			}

			if (workspaceStore.workspaces.length === 0) {
				const ws = await workspaceStore.createWorkspace('Coffee', 'general');
				if (ws) await loadWorkspace(ws.id);
			} else {
				await loadWorkspace(workspaceStore.workspaces[0].id);
			}
		})();

		return () => {
			window.removeEventListener('beforeunload', handleBeforeUnload);
			handleBeforeUnload(); // Also fires on SvelteKit client-side navigation
			unsubscribeWorkspace(); // Clean up the workspace ID tracker
		};
	});

	async function loadWorkspace(workspaceId: string) {
		const result = await workspaceStore.switchWorkspace(workspaceId);
		if (!result) return;
		applyWorkspaceResult(result);
	}

	function applyWorkspaceResult(result: { workspace: Workspace; messages: WorkspaceMessage[] }) {
		// Clear current chat and canvas
		chat.messages = [];
		canvasStore.clearAll();
		dispatchedParts = new Set();
		lastSentPageContext = null;

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

		// Mark all tool parts from restored messages as already dispatched
		// This prevents the $effect from re-dispatching blocks that are
		// already represented in the restored canvas state
		for (const msg of result.messages) {
			if (msg.role !== 'assistant') continue;
			const parts = Array.isArray(msg.parts) ? msg.parts : [];
			for (const part of parts) {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const p = part as any;
				if (p?.type?.startsWith('tool-')) {
					const partKey = `${msg.id}-${p.toolCallId ?? p.toolName ?? p.type}`;
					dispatchedParts.add(partKey);
					// Also mark companion blocks
					const companions = extractCompanionBlocks(p);
					for (let ci = 0; ci < companions.length; ci++) {
						dispatchedParts.add(`${partKey}-companion-${ci}`);
					}
				}
			}
		}

		// Restore canvas state (including pinned, minimized, focusBlockId)
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
						// Restore pinned state
						if (cb.pinned) {
							const addedBlock = canvasStore.blocks[canvasStore.blocks.length - 1];
							if (addedBlock) {
								canvasStore.dispatch({ type: 'pin', blockId: addedBlock.id });
							}
						}
						// Restore minimized state
						if (cb.minimized) {
							const addedBlock = canvasStore.blocks[canvasStore.blocks.length - 1];
							if (addedBlock) {
								canvasStore.dispatch({ type: 'minimize', blockId: addedBlock.id });
							}
						}
					}
				}
			}
			if (cs.layout) {
				canvasStore.dispatch({ type: 'layout', layout: cs.layout });
			}
			// Restore focus block by index (IDs regenerate, so match by position)
			if (cs.focusBlockId != null && typeof cs.focusBlockIndex === 'number') {
				const targetBlock = canvasStore.blocks[cs.focusBlockIndex];
				if (targetBlock) {
					canvasStore.dispatch({ type: 'focus', blockId: targetBlock.id });
				}
			}
		}
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

		// Save canvas state (including pinned, minimized, focusBlockId)
		const focusIdx = canvasStore.focusBlockId
			? canvasStore.blocks.findIndex((b: CanvasBlock) => b.id === canvasStore.focusBlockId)
			: -1;
		await workspaceStore.saveCanvasState(wsId, {
			blocks: canvasStore.blocks.map((b: CanvasBlock) => ({
				block: b.block,
				messageId: b.messageId,
				pinned: b.pinned,
				minimized: b.minimized
			})),
			layout: canvasStore.layout,
			focusBlockId: canvasStore.focusBlockId,
			focusBlockIndex: focusIdx >= 0 ? focusIdx : undefined
		});
	}

	// Auto-persist when streaming completes (fast debounce)
	let lastPersistedMessageCount = $state(0);
	$effect(() => {
		if (
			!isActive &&
			chat.messages.length > 0 &&
			chat.messages.length !== lastPersistedMessageCount
		) {
			lastPersistedMessageCount = chat.messages.length;
			const timeout = setTimeout(() => persistCurrentState(), 500);
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

	// Scroll when new messages arrive
	$effect(() => {
		if (chatContainer && shouldScrollToBottom && chat.messages.length > 0) {
			chatContainer.scrollTo({
				top: chatContainer.scrollHeight,
				behavior: 'smooth'
			});
		}
	});

	// Scroll during streaming — throttled to avoid scroll thrashing
	let lastScrollTime = 0;
	$effect(() => {
		if (!isActive || !shouldScrollToBottom || !chatContainer) return;
		// Access the last message's parts to create a reactive dependency on streaming content
		const lastMsg = chat.messages[chat.messages.length - 1];
		if (lastMsg) {
			const _partsLen = lastMsg.parts.length;
			const lastTextPart = lastMsg.parts.findLast((p) => p.type === 'text');
			if (lastTextPart) {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const _textLen = (lastTextPart as any).text?.length;
			}
		}
		// Throttle scrolls to at most once per 100ms during streaming
		const now = Date.now();
		if (now - lastScrollTime < 100) return;
		lastScrollTime = now;
		requestAnimationFrame(() => {
			chatContainer?.scrollTo({ top: chatContainer.scrollHeight });
		});
	});

	function handleScroll() {
		if (!chatContainer) return;
		const { scrollTop, scrollHeight, clientHeight } = chatContainer;
		const isNearBottom = scrollTop + clientHeight >= scrollHeight - 50;
		shouldScrollToBottom = isNearBottom;
	}

	let isActive = $derived(chat.status === 'streaming' || chat.status === 'submitted');

	// Context-aware suggestions above input
	let suggestions = $derived(
		getSuggestions(
			workspaceStore.currentWorkspace?.type || 'general',
			canvasStore.blocks,
			chat.messages.length > 0,
			{ canUseMallardWorkspaces }
		)
	);

	// ─── Canvas panel state ──────────────────────────────────────────────────
	let canvasOpen = $state(false);
	let hasUserClosedCanvas = $state(false);
	let dividerDragging = $state(false);
	let chatWidthPercent = $state(60); // Chat takes 60% by default
	let mobileCanvasOpen = $state(false);

	// Auto-open canvas when blocks arrive, but respect user's explicit close.
	// The drawer variant has no inline canvas pane, so it never auto-opens.
	$effect(() => {
		if (variant === 'page' && !canvasStore.isEmpty && !canvasOpen && !hasUserClosedCanvas) {
			canvasOpen = true;
		}
		// Reset the user-closed flag when canvas is cleared
		if (canvasStore.isEmpty) {
			hasUserClosedCanvas = false;
		}
	});

	// Track which message IDs have been dispatched to canvas (to avoid duplicates)
	let dispatchedParts = $state(new Set<string>());

	// Dispatch blocks to canvas when streaming completes for a message
	$effect(() => {
		if (isActive) return; // Wait until streaming stops

		for (const [messageIndex, message] of chat.messages.entries()) {
			if (message.role !== 'assistant') continue;

			const hasPR = messageHasPresentResults(message.parts);

			for (const [partIndex, part] of message.parts.entries()) {
				if (!part.type.startsWith('tool-')) continue;

				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const p = part as any;
				const partKey = `${message.id}-${p.toolCallId ?? p.toolName ?? part.type}`;
				if (dispatchedParts.has(partKey)) continue;

				// present_results may reference earlier search output, but never later parts.
				// Building the cache through this part prevents a presentation from resolving
				// against a search that appears later in the same assistant message.
				const searchDataCache = hasPR
					? buildSearchDataCacheThroughPart(chat.messages, messageIndex, partIndex)
					: undefined;
				const extractorOptions = { searchDataCache, hasPresentResults: hasPR };
				const block = extractBlockFromPart(p, extractorOptions);

				// If this is a present_results part, use explicit canvas mutations
				const mutations = extractCanvasMutationsFromPart(p, block, message.id);
				if (mutations) {
					for (const m of mutations) canvasStore.dispatch(m);
					dispatchedParts.add(partKey);
				} else if (
					p.state === 'output-available' &&
					(p.toolName === 'present_results' || p.type === 'tool-present_results')
				) {
					// Cache-miss/error presentations intentionally render inline only. Mark them
					// handled so a later completed turn cannot revisit this old part.
					dispatchedParts.add(partKey);
				} else if (block && block.type !== 'error') {
					// Non-present_results tools: auto-add to canvas
					canvasStore.dispatch({ type: 'add', block, messageId: message.id });
					dispatchedParts.add(partKey);

					// Also dispatch companion blocks (e.g., roast-chart for single roast profile)
					const companions = extractCompanionBlocks(p);
					for (let ci = 0; ci < companions.length; ci++) {
						const companionKey = `${partKey}-companion-${ci}`;
						if (!dispatchedParts.has(companionKey)) {
							canvasStore.dispatch({
								type: 'add',
								block: companions[ci],
								messageId: message.id
							});
							dispatchedParts.add(companionKey);
						}
					}
				}
			}
		}
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

	// ─── Action Card Execution ───────────────────────────────────────────────
	async function executeAction(actionType: string, fields: Record<string, unknown>) {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 30000);

		try {
			const response = await fetch('/api/chat/execute-action', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ actionType, fields }),
				signal: controller.signal
			});

			clearTimeout(timeoutId);

			if (!response.ok) {
				const data = await response.json().catch(() => ({ error: 'Unknown error' }));
				throw new Error(data.error || 'Action execution failed');
			}

			return response.json();
		} catch (err) {
			clearTimeout(timeoutId);
			if (err instanceof DOMException && err.name === 'AbortError') {
				throw new Error('Action timed out after 30 seconds');
			}
			throw err;
		}
	}

	// ─── Slash command completions ────────────────────────────────────────────
	let slashCompletions = $derived(getSlashCompletions(inputMessage, canUseMallardWorkspaces));

	// ─── Page context (what the user is looking at elsewhere in the app) ──────
	// Snapshotted at send time and only attached when changed since the last
	// message, so the token cost stays bounded.
	let lastSentPageContext: string | null = null;

	function buildSendBody(): Record<string, unknown> {
		const body: Record<string, unknown> = { workspaceContext: getWorkspaceContext() };
		if (!includeUserMemoryDoc) body.includeUserMemory = false;
		const context = includePageContext ? pageChatContext.current : null;
		if (context) {
			const serialized = JSON.stringify(context);
			if (serialized !== lastSentPageContext) {
				lastSentPageContext = serialized;
				body.pageContext = context;
			}
		}
		return body;
	}

	// ─── Send Message ──────────────────────────────────────────────────────────
	async function sendMessage() {
		if (!inputMessage.trim() || isActive) return;

		const text = inputMessage.trim();

		// Intercept slash commands
		const cmd = matchSlashCommand(text, canUseMallardWorkspaces);
		if (cmd) {
			inputMessage = '';
			if (cmd.action === 'clear-canvas') {
				canvasStore.clearAll();
				return;
			}
			if (cmd.action === 'pin-focused') {
				const fid = canvasStore.focusBlockId;
				if (fid) canvasStore.dispatch({ type: 'pin', blockId: fid });
				return;
			}
			if (cmd.action === 'unpin-focused') {
				const fid = canvasStore.focusBlockId;
				if (fid) canvasStore.dispatch({ type: 'unpin', blockId: fid });
				return;
			}
			if (cmd.chatText) {
				inputMessage = '';
				shouldScrollToBottom = true;
				await chat.sendMessage({ text: cmd.chatText }, { body: buildSendBody() });
				return;
			}
		}

		inputMessage = '';
		shouldScrollToBottom = true;

		await chat.sendMessage({ text }, { body: buildSendBody() });
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

	async function clearConversation() {
		if (confirm('Are you sure you want to clear the conversation?')) {
			chat.messages = [];
			dispatchedParts = new Set();
			lastPersistedMessageCount = 0;

			// Clear persisted messages for current workspace. Canvas is intentionally preserved.
			const wsId = workspaceStore.currentWorkspaceId;
			if (wsId) {
				await fetch(`/api/workspaces/${wsId}/messages`, { method: 'DELETE' });
			}
		}
	}
</script>

<!-- Main chat + canvas interface -->
<div class="flex flex-col bg-background-primary-light {variant === 'page' ? 'h-screen' : 'h-full'}">
	<!-- Chat + Canvas split container -->
	<div class="chat-canvas-container flex flex-1 overflow-hidden">
		<!-- Chat pane: full width on mobile (the inline canvas pane is md+ only,
		     so a narrower chat would just leave dead space); split width on md+. -->
		<div
			class="chat-pane flex flex-col overflow-hidden"
			style="--chat-width: {variant === 'page' && canvasOpen ? chatWidthPercent : 100}%;"
		>
			<!-- Chat toolbar -->
			<div class="flex items-center justify-end border-b border-border-light px-3 py-1.5">
				<div class="flex items-center gap-2">
					<button
						onclick={() => (memoryPanelOpen = true)}
						class="rounded-md border border-border-light px-2 py-0.5 text-xs text-text-secondary-light transition-all hover:text-text-primary-light"
						title="View and edit the persistent memory document"
					>
						Memory
					</button>
					{#if !canvasStore.isEmpty}
						<button
							onclick={() => (mobileCanvasOpen = !mobileCanvasOpen)}
							class="rounded-md border border-border-light px-2 py-0.5 text-xs text-text-secondary-light transition-all hover:text-text-primary-light {variant ===
							'page'
								? 'md:hidden'
								: ''}"
						>
							Canvas ({canvasStore.blockCount})
						</button>
						{#if variant === 'page'}
							<button
								onclick={() => {
									canvasOpen = !canvasOpen;
									if (!canvasOpen) hasUserClosedCanvas = true;
									else hasUserClosedCanvas = false;
								}}
								class="hidden rounded-md border border-border-light px-2 py-0.5 text-xs text-text-secondary-light transition-all hover:text-text-primary-light md:block"
							>
								{canvasOpen ? 'Hide' : 'Show'} Canvas ({canvasStore.blockCount})
							</button>
						{/if}
					{/if}
					{#if chat.messages.length > 0}
						<button
							onclick={exportConversation}
							class="rounded-md border border-background-tertiary-light px-2 py-0.5 text-xs text-background-tertiary-light transition-all hover:bg-background-tertiary-light hover:text-white"
						>
							Export
						</button>
						<button
							onclick={clearConversation}
							class="rounded-md border border-red-500 px-2 py-0.5 text-xs text-red-500 transition-all hover:bg-red-500 hover:text-white"
						>
							Clear
						</button>
					{/if}
				</div>
			</div>

			<div class="relative flex min-h-0 flex-1 flex-col">
				<ChatMessageList
					{chat}
					{isActive}
					{canUseMallardWorkspaces}
					bind:containerEl={chatContainer}
					onScroll={handleScroll}
					onBlockAction={handleBlockAction}
					onExampleSelect={(text) => (inputMessage = text)}
				/>

				<!-- Mobile floating canvas indicator: anchored inside the message
				     area (above the composer) so it can't overlap the send button. -->
				{#if variant === 'page' && !canvasStore.isEmpty && !mobileCanvasOpen}
					<button
						onclick={() => (mobileCanvasOpen = true)}
						class="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 rounded-full bg-background-tertiary-light px-3 py-2 text-sm text-white shadow-lg transition-transform hover:scale-105 md:hidden"
					>
						<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
							/>
						</svg>
						{canvasStore.blockCount}
					</button>
				{/if}
			</div>

			<ChatComposer
				bind:inputMessage
				{isActive}
				{canUseMallardWorkspaces}
				{suggestions}
				{slashCompletions}
				{chatError}
				{contextChips}
				onToggleChip={toggleContextChip}
				onSend={sendMessage}
				onDismissError={() => (chatError = null)}
			/>
		</div>

		<!-- Resizable divider (desktop only) -->
		{#if variant === 'page' && canvasOpen}
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<div
				class="hidden w-1 cursor-col-resize bg-border-light transition-colors hover:bg-background-tertiary-light/40 md:block"
				class:bg-background-tertiary-light={dividerDragging}
				role="separator"
				tabindex="0"
				onmousedown={startDividerDrag}
			></div>

			<!-- Canvas pane (desktop) -->
			<div class="hidden overflow-hidden md:block" style="width: {100 - chatWidthPercent}%;">
				<Canvas
					onAction={handleBlockAction}
					onScrollToMessage={scrollToMessage}
					onExecuteAction={executeAction}
				/>
			</div>
		{/if}
	</div>
</div>

<MemoryPanel bind:open={memoryPanelOpen} />

<!-- Canvas overlay (mobile always; desktop too in drawer variant) -->
{#if mobileCanvasOpen}
	<div
		class="fixed inset-0 z-50 flex flex-col bg-background-primary-light {variant === 'page'
			? 'md:hidden'
			: ''}"
	>
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
				onExecuteAction={executeAction}
			/>
		</div>
	</div>
{/if}

<style>
	.chat-pane {
		width: 100%;
		transition: width 0.2s ease;
	}
	@media (min-width: 768px) {
		.chat-pane {
			width: var(--chat-width, 100%);
		}
	}
</style>
