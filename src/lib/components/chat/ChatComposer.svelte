<script lang="ts">
	import type { Snippet } from 'svelte';
	import ChatDisclosure from './ChatDisclosure.svelte';
	import type { Suggestion } from '$lib/services/suggestionEngine';
	import type { SlashCommand } from '$lib/services/slashCommands';
	import type { CherryAgentName } from '$lib/cherry/identity';

	interface ContextChip {
		id: string;
		label: string;
		detail: string;
		active: boolean;
	}

	let {
		agentName,
		inputMessage = $bindable(''),
		isActive,
		actions,
		suggestions,
		slashCompletions,
		chatError,
		chatCanRetry,
		workspaceError,
		workspaceReady,
		initializingWorkspace,
		contextChips = [],
		onToggleChip,
		onSend,
		onStop,
		onRetry,
		onRetryWorkspace,
		onDismissError
	} = $props<{
		agentName: CherryAgentName;
		inputMessage?: string;
		isActive: boolean;
		actions?: Snippet;
		suggestions: Suggestion[];
		slashCompletions: SlashCommand[];
		chatError: string | null;
		chatCanRetry: boolean;
		workspaceError: string | null;
		workspaceReady: boolean;
		initializingWorkspace: boolean;
		contextChips?: ContextChip[];
		onToggleChip?: (id: ContextChip['id']) => void;
		onSend: () => void;
		onStop: () => void;
		onRetry: () => void;
		onRetryWorkspace: () => void;
		onDismissError: () => void;
	}>();

	function handleSubmit(event: Event) {
		event.preventDefault();
		onSend();
	}

	// ─── Textarea autosize ─────────────────────────────────────────────────────
	// Grow with content up to a cap, then scroll inside the textarea. Driven by
	// an effect on inputMessage (not oninput) so programmatic changes — clearing
	// after send, suggestion chips — also resize it back down.
	const MAX_TEXTAREA_HEIGHT = 192; // ~8 lines

	const hintId = $props.id();
	let textareaEl = $state<HTMLTextAreaElement | null>(null);
	let activeContextCount = $derived(contextChips.filter((chip: ContextChip) => chip.active).length);

	$effect(() => {
		void inputMessage;
		const el = textareaEl;
		if (!el) return;
		el.style.height = 'auto';
		el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
		el.style.overflowY = el.scrollHeight > MAX_TEXTAREA_HEIGHT ? 'auto' : 'hidden';
	});
</script>

<!-- Chat error banner -->
{#if chatError}
	<div
		role="alert"
		class="mx-4 mt-2 flex items-center gap-2 rounded-lg border border-danger/40 bg-danger-subtle px-4 py-2 text-sm text-danger-strong"
	>
		<svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="1.5"
				d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
			/>
		</svg>
		<span class="flex-1">{chatError}</span>
		{#if chatCanRetry}<button onclick={onRetry} class="shrink-0 font-medium underline">Retry</button
			>{/if}
		<button
			onclick={onDismissError}
			class="shrink-0 text-danger hover:text-danger-strong"
			aria-label="Dismiss error"
		>
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="1.5"
					d="M6 18L18 6M6 6l12 12"
				/>
			</svg>
		</button>
	</div>
{/if}

{#if workspaceError}
	<div
		role="alert"
		class="mx-4 mt-2 flex items-center gap-3 rounded-lg border border-danger/40 bg-danger-subtle px-4 py-3 text-sm text-danger-strong"
	>
		<span class="flex-1"
			>Your conversation could not be prepared for saving. Retry before sending.</span
		>
		<button
			onclick={onRetryWorkspace}
			disabled={initializingWorkspace}
			class="shrink-0 font-medium underline disabled:opacity-50"
		>
			{initializingWorkspace ? 'Retrying…' : 'Retry setup'}
		</button>
	</div>
{/if}

<!-- Input area: keep the composer visually distinct without turning the full viewport edge into a form. -->
<div
	class="shrink-0 bg-surface-canvas px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 sm:px-4"
>
	{#if slashCompletions.length > 0 && inputMessage.startsWith('/')}
		<div class="mx-auto mb-2 max-w-4xl rounded-lg border border-line bg-surface-raised shadow-sm">
			{#each slashCompletions as cmd (cmd.name)}
				<button
					onclick={() => {
						if (cmd.chatText) {
							inputMessage = cmd.chatText;
						} else {
							inputMessage = cmd.name;
						}
					}}
					class="flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors first:rounded-t-lg last:rounded-b-lg hover:bg-surface-panel"
				>
					<span class="font-mono text-xs font-medium text-accent">{cmd.name}</span>
					<span class="text-muted">{cmd.description}</span>
				</button>
			{/each}
		</div>
	{/if}
	<form onsubmit={handleSubmit} class="mx-auto max-w-4xl">
		<div
			class="flex items-end gap-2 rounded-lg border border-line bg-surface-raised p-2 shadow-sm focus-within:border-accent focus-within:ring-1 focus-within:ring-accent"
		>
			<textarea
				bind:this={textareaEl}
				bind:value={inputMessage}
				aria-label={`Message ${agentName}`}
				placeholder="Ask about coffee…"
				aria-describedby={hintId}
				class="min-h-11 min-w-0 flex-1 resize-none border-0 bg-transparent px-2 py-2 text-ink placeholder-muted focus:outline-none focus:ring-0"
				rows="1"
				disabled={isActive || !workspaceReady}
				onkeydown={(e) => {
					if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
						e.preventDefault();
						onSend();
					}
				}}
			></textarea>
			<button
				type={isActive ? 'button' : 'submit'}
				onclick={isActive ? onStop : undefined}
				disabled={!isActive && (!workspaceReady || !inputMessage.trim())}
				aria-label={isActive ? 'Stop response' : 'Send message'}
				class="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-accent text-ink transition-all duration-200 hover:bg-opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
			>
				{#if isActive}
					<svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"
						><rect x="5" y="5" width="10" height="10" rx="1" /></svg
					>
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
		<p id={hintId} class="sr-only">Enter to send, Shift+Enter for new line</p>
	</form>
	<div
		class="relative mx-auto flex max-w-4xl items-center gap-1"
		aria-label="Conversation controls"
	>
		{#if contextChips.length > 0}
			<ChatDisclosure
				label={`Context: using ${activeContextCount} of ${contextChips.length} sources`}
			>
				{#snippet trigger()}Context <span class="tabular-nums"
						>{activeContextCount}/{contextChips.length}</span
					>{/snippet}
				<p class="px-2 py-1 text-xs font-semibold text-ink">Context for your next message</p>
				{#each contextChips as chip (chip.id)}
					<button
						type="button"
						onclick={() => onToggleChip?.(chip.id)}
						aria-pressed={chip.active}
						aria-label={chip.label}
						class="flex min-h-11 w-full gap-2 rounded-md p-2 text-left text-xs hover:bg-surface-canvas focus-visible:ring-2 focus-visible:ring-accent"
					>
						<span aria-hidden="true" class="text-ink">{chip.active ? '✓' : '+'}</span>
						<span class="min-w-0"
							><span class="font-medium text-ink"
								>{chip.label}{chip.active ? '' : ' · Excluded'}</span
							><span class="mt-1 block whitespace-pre-wrap break-words leading-5 text-muted"
								>{chip.detail}</span
							></span
						>
					</button>
				{/each}
			</ChatDisclosure>
		{/if}
		{#if !isActive && suggestions.length > 0}
			<ChatDisclosure label="Suggested prompts" closeOnSelect>
				{#snippet trigger()}<span aria-hidden="true" class="text-base">✦</span>{/snippet}
				{#each suggestions as suggestion (suggestion.label)}
					<button
						type="button"
						onclick={() => {
							inputMessage = suggestion.text;
							textareaEl?.focus();
						}}
						class="min-h-11 w-full rounded-md px-2 py-2 text-left text-xs text-ink hover:bg-surface-canvas"
						>{suggestion.label}</button
					>
				{/each}
			</ChatDisclosure>
		{/if}
		<div class="ml-auto">{@render actions?.()}</div>
	</div>
</div>
