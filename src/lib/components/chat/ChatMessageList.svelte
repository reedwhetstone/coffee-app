<script lang="ts">
	import type { Chat } from '@ai-sdk/svelte';
	import SvelteMarkdown from '@humanspeak/svelte-markdown';
	import GenUIBlockRenderer from '$lib/components/genui/GenUIBlockRenderer.svelte';
	import InlineStatusLine from '$lib/components/genui/InlineStatusLine.svelte';
	import { canvasStore } from '$lib/stores/canvasStore.svelte';
	import {
		buildToolCanvasDispatchPlan,
		extractBlockFromPart,
		extractCompanionBlocks,
		buildSearchDataCacheThroughPart,
		messageHasPresentResults
	} from '$lib/services/blockExtractor';
	import type { BlockAction } from '$lib/types/genui';

	let {
		chat,
		isActive,
		canUseMallardWorkspaces,
		containerEl = $bindable(),
		onScroll,
		onBlockAction,
		onExecuteAction,
		onExampleSelect,
		onAskAgainMessage,
		messageActionsDisabled = false
	} = $props<{
		chat: Chat;
		isActive: boolean;
		canUseMallardWorkspaces: boolean;
		containerEl?: HTMLDivElement;
		onScroll: () => void;
		onBlockAction: (action: BlockAction) => void;
		onExecuteAction: (
			executionId: string,
			actionType: string,
			fields: Record<string, unknown>,
			blockId?: string
		) => Promise<unknown>;
		onExampleSelect: (text: string) => void;
		onAskAgainMessage: (messageId: string) => void;
		messageActionsDisabled?: boolean;
	}>();

	let copiedMessageId = $state<string | null>(null);
	let copyFailedMessageId = $state<string | null>(null);

	function assistantText(parts: Array<{ type: string; text?: string }>): string {
		return parts
			.filter((part) => part.type === 'text' && part.text?.trim())
			.map((part) => part.text?.trim() ?? '')
			.join('\n\n');
	}

	async function copyAssistantMessage(messageId: string, text: string) {
		if (!text) return;
		try {
			if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
			await navigator.clipboard.writeText(text);
			copyFailedMessageId = null;
			copiedMessageId = messageId;
		} catch {
			copiedMessageId = null;
			copyFailedMessageId = messageId;
		}
		setTimeout(() => {
			if (copiedMessageId === messageId) copiedMessageId = null;
			if (copyFailedMessageId === messageId) copyFailedMessageId = null;
		}, 1600);
	}

	// Progressive disclosure: collapse old tool previews
	// Messages more than COLLAPSE_THRESHOLD exchanges old get collapsed previews
	const COLLAPSE_THRESHOLD = 10; // collapse previews on messages older than 10 from the end
	let expandedMessages = $state(new Set<string>());

	function isOldMessage(msgIndex: number, totalMessages: number): boolean {
		return totalMessages - msgIndex > COLLAPSE_THRESHOLD;
	}

	function getCollapsedSummary(parts: unknown[]): string {
		let blockCount = 0;
		const types: string[] = [];
		for (const part of parts) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const p = part as any;
			if (p?.type?.startsWith('tool-') && p.state === 'output-available') {
				blockCount++;
				const name = (p.toolName ?? p.type.replace('tool-', '')).replace(/_/g, ' ');
				if (name !== 'present results' && !types.includes(name)) types.push(name);
			}
		}
		if (blockCount === 0) return '';
		return `${blockCount} tool result${blockCount > 1 ? 's' : ''}${types.length > 0 ? `: ${types.join(', ')}` : ''}`;
	}

	function buildExtractorOptionsThroughPart(
		messageIndex: number,
		partIndex: number,
		hasPresentResults: boolean
	) {
		return {
			searchDataCache: hasPresentResults
				? buildSearchDataCacheThroughPart(chat.messages, messageIndex, partIndex)
				: undefined,
			hasPresentResults,
			messageId: chat.messages[messageIndex]?.id,
			allowExecutionIdSynthesis:
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				!(chat.messages[messageIndex] as any)?.metadata?.workspaceRestored
		};
	}

	// Build a lookup: messageId → canvasBlockId[] (supports multiple blocks per message)
	let canvasBlockLookup = $derived(() => {
		const map = new Map<string, string[]>();
		for (const cb of canvasStore.blocks) {
			const existing = map.get(cb.messageId);
			if (existing) {
				existing.push(cb.id);
			} else {
				map.set(cb.messageId, [cb.id]);
			}
		}
		return map;
	});

	// ─── Accumulated status steps for the entire message ──────────────────────
	function getMessageToolSteps(
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		parts: any[]
	): Array<{ message: string; timestamp: Date }> {
		const steps: Array<{ message: string; timestamp: Date }> = [];

		for (const part of parts) {
			if (!part?.type?.startsWith('tool-')) continue;

			const rawName = part.toolName ?? part.type.replace('tool-', '');

			// present_results gets its own step so canvas pushes are never invisible
			if (rawName === 'present_results') {
				if (part.state === 'output-available') {
					const items = part.output?.presentation?.items;
					const count = Array.isArray(items) ? items.length : 0;
					steps.push({
						message: `presenting ${count} item${count === 1 ? '' : 's'} to the evidence workspace`,
						timestamp: new Date()
					});
				} else if (part.state === 'output-error') {
					steps.push({
						message: `Error presenting results: ${part.errorText || 'unknown error'}`,
						timestamp: new Date()
					});
				}
				continue;
			}

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
</script>

<!-- Chat messages area -->
<div
	bind:this={containerEl}
	class="flex-1 overflow-y-auto px-4 py-6"
	onscroll={onScroll}
	role="log"
	aria-label="Parchment conversation"
	aria-live={isActive ? 'off' : 'polite'}
	aria-relevant="additions text"
>
	{#if chat.messages.length === 0}
		<div class="mx-auto flex min-h-full max-w-2xl flex-col justify-center py-10 text-center">
			<p class="mb-2 text-sm font-medium text-accent">Parchment Intelligence</p>
			<h2 class="font-serif text-2xl font-medium tracking-tight text-ink">
				What do you need to know about green coffee?
			</h2>
			<p class="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted">
				Research stocked coffees, suppliers, market movement, and your portfolio with source-aware
				evidence.
			</p>

			<div class="mt-8 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
				<button
					onclick={() =>
						onExampleSelect(
							'Compare stocked Ethiopian coffees with stone fruit notes by supplier, price, process, and provenance.'
						)}
					class="block w-full rounded-md border border-line bg-surface-panel px-3 py-2.5 text-left text-muted transition-colors hover:border-accent hover:text-ink"
				>
					Compare stocked Ethiopian coffees
				</button>
				<button
					onclick={() =>
						onExampleSelect(
							'Review my current portfolio and call out gaps by origin, process, and flavor profile.'
						)}
					class="block w-full rounded-md border border-line bg-surface-panel px-3 py-2.5 text-left text-muted transition-colors hover:border-accent hover:text-ink"
				>
					Find gaps in my current portfolio
				</button>
				<button
					onclick={() =>
						onExampleSelect(
							'What moved in the green coffee market this week, and what evidence supports it?'
						)}
					class="block w-full rounded-md border border-line bg-surface-panel px-3 py-2.5 text-left text-muted transition-colors hover:border-accent hover:text-ink"
				>
					Review this week’s market movement
				</button>
				<button
					onclick={() =>
						onExampleSelect(
							canUseMallardWorkspaces
								? 'Use my Mallard Studio context to compare roast approaches for this washed Costa Rican coffee.'
								: 'Build a source-aware shortlist of versatile washed coffees under $9 per pound.'
						)}
					class="block w-full rounded-md border border-line bg-surface-panel px-3 py-2.5 text-left text-muted transition-colors hover:border-accent hover:text-ink"
				>
					{canUseMallardWorkspaces ? 'Compare roast approaches' : 'Build a sourcing shortlist'}
				</button>
			</div>
		</div>
	{:else}
		<!-- Chat messages - interleaved rendering -->
		<div class="mx-auto max-w-3xl space-y-6">
			{#each chat.messages as message, msgIndex (message.id)}
				{@const isLastMessage = msgIndex === chat.messages.length - 1}
				{@const isStreaming = isLastMessage && isActive && message.role === 'assistant'}

				{#if message.role === 'user'}
					<!-- User message bubble -->
					<div id="msg-{message.id}" class="message-fade-in flex justify-end">
						<div
							class="max-w-[85%] rounded-lg border border-accent/25 bg-accent/10 px-4 py-2.5 text-ink sm:max-w-[75%]"
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
					{@const toolSteps = getMessageToolSteps(message.parts)}
					{@const hasToolParts = message.parts.some((p: { type: string }) =>
						p.type.startsWith('tool-')
					)}
					<div id="msg-{message.id}" class="message-fade-in w-full space-y-3">
						<!-- Persistent accumulated status line for all tool calls -->
						{#if hasToolParts && toolSteps.length > 0}
							<InlineStatusLine steps={toolSteps} isActive={isStreaming} />
						{/if}

						<!-- Text parts stream in live -->
						{#each message.parts as part}
							{#if part.type === 'text' && part.text.trim()}
								<div
									class="prose prose-sm max-w-2xl text-ink prose-headings:text-ink prose-p:leading-7 prose-p:text-ink prose-strong:text-ink prose-ol:text-ink prose-ul:text-ink prose-li:text-ink"
								>
									<SvelteMarkdown source={part.text} />
								</div>
							{/if}
						{/each}

						<!-- Inline previews render after streaming completes -->
						{#if !isStreaming}
							{@const isOld = isOldMessage(msgIndex, chat.messages.length)}
							{@const isExpanded = expandedMessages.has(message.id)}
							{@const collapsedSummary =
								isOld && !isExpanded ? getCollapsedSummary(message.parts) : ''}
							{#if isOld && !isExpanded && collapsedSummary}
								<!-- Collapsed preview summary for old messages -->
								<button
									onclick={() => {
										expandedMessages.add(message.id);
										expandedMessages = new Set(expandedMessages);
									}}
									class="flex items-center gap-1.5 rounded-md border border-line bg-surface-panel px-3 py-1.5 text-xs text-muted transition-colors hover:text-ink"
								>
									<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="1.5"
											d="M9 5l7 7-7 7"
										/>
									</svg>
									{collapsedSummary}
								</button>
							{:else}
								{@const _lookup = canvasBlockLookup()}
								{@const _canvasIds = _lookup.get(message.id) || []}
								{@const _partCanvasMap = (() => {
									const map = new Map<number, string[]>();
									let blockIdx = 0;
									for (let i = 0; i < message.parts.length; i++) {
										const p = message.parts[i];
										if (p.type.startsWith('tool-')) {
											const b = extractBlockFromPart(
												p as Record<string, unknown>,
												buildExtractorOptionsThroughPart(msgIndex, i, hasPR)
											);
											const dispatchPlan = buildToolCanvasDispatchPlan(p, b, message.id);
											if (dispatchPlan.canvasBlocks.length > 0) {
												map.set(
													i,
													_canvasIds.slice(blockIdx, blockIdx + dispatchPlan.canvasBlocks.length)
												);
												blockIdx += dispatchPlan.canvasBlocks.length;
											}
										}
									}
									return map;
								})()}
								{#each message.parts as part, partIndex}
									{#if part.type.startsWith('tool-')}
										{@const toolPart = part as Record<string, unknown>}
										{@const extractorOptions = buildExtractorOptionsThroughPart(
											msgIndex,
											partIndex,
											hasPR
										)}
										{@const block = extractBlockFromPart(toolPart, extractorOptions)}
										{#if block}
											{@const canvasIds = _partCanvasMap.get(partIndex) ?? []}
											<div class="preview-fade-in my-1">
												<GenUIBlockRenderer
													{block}
													renderMode="chat"
													onAction={onBlockAction}
													{onExecuteAction}
													canvasBlockId={canvasIds[0] ?? ''}
												/>
											</div>
											<!-- Companion block previews (e.g., roast chart for single roast) -->
											{@const companions = extractCompanionBlocks(toolPart)}
											{#each companions as companionBlock, companionIndex}
												<div class="preview-fade-in my-1">
													<GenUIBlockRenderer
														block={companionBlock}
														renderMode="chat"
														onAction={onBlockAction}
														{onExecuteAction}
														canvasBlockId={canvasIds[companionIndex + 1] ?? ''}
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
														onAction={onBlockAction}
													/>
												</div>
											{/if}
										{/if}
									{/if}
								{/each}
								{#if isOld && isExpanded}
									<button
										onclick={() => {
											expandedMessages.delete(message.id);
											expandedMessages = new Set(expandedMessages);
										}}
										class="text-xs text-muted hover:text-ink"
									>
										Collapse previews
									</button>
								{/if}
							{/if}
						{/if}

						{#if !isStreaming && assistantText(message.parts)}
							<div
								class="flex max-w-2xl items-center gap-1 border-t border-line/70 pt-2 text-xs text-muted"
							>
								<button
									type="button"
									onclick={() => copyAssistantMessage(message.id, assistantText(message.parts))}
									aria-live="polite"
									class="rounded-md px-2 py-1 hover:bg-surface-panel hover:text-ink"
								>
									{copyFailedMessageId === message.id
										? 'Copy failed'
										: copiedMessageId === message.id
											? 'Copied'
											: 'Copy'}
								</button>
								<button
									type="button"
									onclick={() => onAskAgainMessage(message.id)}
									disabled={messageActionsDisabled}
									class="rounded-md px-2 py-1 hover:bg-surface-panel hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
								>
									Ask again
								</button>
							</div>
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
