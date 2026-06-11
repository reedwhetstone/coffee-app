<script lang="ts">
	import type { Chat } from '@ai-sdk/svelte';
	import SvelteMarkdown from '@humanspeak/svelte-markdown';
	import GenUIBlockRenderer from '$lib/components/genui/GenUIBlockRenderer.svelte';
	import InlineStatusLine from '$lib/components/genui/InlineStatusLine.svelte';
	import { canvasStore } from '$lib/stores/canvasStore.svelte';
	import {
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
		onExampleSelect
	} = $props<{
		chat: Chat;
		isActive: boolean;
		canUseMallardWorkspaces: boolean;
		containerEl?: HTMLDivElement;
		onScroll: () => void;
		onBlockAction: (action: BlockAction) => void;
		onExampleSelect: (text: string) => void;
	}>();

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
			hasPresentResults
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
						message: `presenting ${count} item${count === 1 ? '' : 's'} to the canvas`,
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
<div bind:this={containerEl} class="flex-1 overflow-y-auto p-4" onscroll={onScroll}>
	{#if chat.messages.length === 0}
		<!-- Welcome message -->
		<div class="mx-auto max-w-2xl text-center">
			<div class="mb-8 rounded-lg bg-background-secondary-light p-6">
				<h2 class="mb-3 text-lg font-semibold text-text-primary-light">
					Welcome to Parchment Intelligence Chat!
				</h2>
				<p class="mb-4 text-text-secondary-light">
					I'm your coffee supply-chain intelligence assistant, here to help with sourcing, catalog,
					portfolio, and market questions. Ask me anything about:
				</p>
				<div class="grid grid-cols-1 gap-2 text-sm text-text-secondary-light md:grid-cols-2">
					<div>- Green coffee recommendations</div>
					<div>- Market and supplier signals</div>
					<div>- Flavor profiles</div>
					<div>- Processing methods</div>
					<div>- Portfolio analysis</div>
					{#if canUseMallardWorkspaces}
						<div>- Roasting techniques</div>
					{/if}
				</div>
			</div>

			<!-- Example queries -->
			<div class="space-y-2">
				<p class="text-sm font-medium text-text-primary-light">Try asking:</p>
				<div class="space-y-2 text-sm">
					<button
						onclick={() =>
							onExampleSelect(
								'Check the green coffee catalog for an Ethiopian with stone fruit notes and a unique processing method.'
							)}
						class="block w-full rounded-md border border-border-light bg-background-secondary-light p-2 text-left text-text-secondary-light transition-all hover:bg-background-tertiary-light hover:text-white"
					>
						"Check the green coffee catalog for an Ethiopian with stone fruit notes and a unique
						processing method."
					</button>
					<button
						onclick={() =>
							onExampleSelect(
								'Review my current portfolio and call out gaps by origin, process, and flavor profile.'
							)}
						class="block w-full rounded-md border border-border-light bg-background-secondary-light p-2 text-left text-text-secondary-light transition-all hover:bg-background-tertiary-light hover:text-white"
					>
						"Review my current portfolio and call out gaps by origin, process, and flavor profile."
					</button>
					{#if canUseMallardWorkspaces}
						<button
							onclick={() =>
								onExampleSelect("What's the best way to roast a washed Costa Rican coffee?")}
							class="block w-full rounded-md border border-border-light bg-background-secondary-light p-2 text-left text-text-secondary-light transition-all hover:bg-background-tertiary-light hover:text-white"
						>
							"What's the best way to roast a washed Costa Rican coffee?"
						</button>
					{/if}
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
						<div class="max-w-[80%] rounded-lg bg-background-tertiary-light px-4 py-2 text-white">
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
									class="prose prose-sm max-w-none text-text-primary-light prose-headings:text-text-primary-light prose-p:text-text-primary-light prose-strong:text-text-primary-light prose-ol:text-text-primary-light prose-ul:text-text-primary-light prose-li:text-text-primary-light"
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
									class="flex items-center gap-1.5 rounded-md border border-border-light bg-background-secondary-light px-3 py-1.5 text-xs text-text-secondary-light transition-colors hover:text-text-primary-light"
								>
									<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M9 5l7 7-7 7"
										/>
									</svg>
									{collapsedSummary}
								</button>
							{:else}
								{@const _lookup = canvasBlockLookup()}
								{@const _canvasIds = _lookup.get(message.id) || []}
								{@const _partCanvasMap = (() => {
									const map = new Map<number, string>();
									let blockIdx = 0;
									for (let i = 0; i < message.parts.length; i++) {
										const p = message.parts[i];
										if (p.type.startsWith('tool-')) {
											const b = extractBlockFromPart(
												p as Record<string, unknown>,
												buildExtractorOptionsThroughPart(msgIndex, i, hasPR)
											);
											if (b) {
												map.set(i, _canvasIds[blockIdx] ?? '');
												blockIdx++;
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
											{@const canvasId = _partCanvasMap.get(partIndex) ?? ''}
											<div class="preview-fade-in my-1">
												<GenUIBlockRenderer
													{block}
													renderMode="chat"
													onAction={onBlockAction}
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
														onAction={onBlockAction}
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
										class="text-xs text-text-secondary-light hover:text-text-primary-light"
									>
										Collapse previews
									</button>
								{/if}
							{/if}
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
