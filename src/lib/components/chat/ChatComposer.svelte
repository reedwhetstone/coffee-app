<script lang="ts">
	import SuggestionChips from '$lib/components/genui/SuggestionChips.svelte';
	import type { Suggestion } from '$lib/services/suggestionEngine';
	import type { SlashCommand } from '$lib/services/slashCommands';

	interface ContextChip {
		id: 'memory' | 'canvas' | 'page';
		label: string;
		detail: string;
		active: boolean;
	}

	let {
		inputMessage = $bindable(''),
		isActive,
		canUseMallardWorkspaces,
		suggestions,
		slashCompletions,
		chatError,
		contextChips = [],
		onToggleChip,
		onSend,
		onDismissError
	} = $props<{
		inputMessage?: string;
		isActive: boolean;
		canUseMallardWorkspaces: boolean;
		suggestions: Suggestion[];
		slashCompletions: SlashCommand[];
		chatError: string | null;
		contextChips?: ContextChip[];
		onToggleChip?: (id: ContextChip['id']) => void;
		onSend: () => void;
		onDismissError: () => void;
	}>();

	function handleSubmit(event: Event) {
		event.preventDefault();
		onSend();
	}
</script>

<!-- Chat error banner -->
{#if chatError}
	<div
		class="mx-4 mt-2 flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700"
	>
		<svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
			/>
		</svg>
		<span class="flex-1">{chatError}</span>
		<button
			onclick={onDismissError}
			class="shrink-0 text-red-500 hover:text-red-700"
			aria-label="Dismiss error"
		>
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M6 18L18 6M6 6l12 12"
				/>
			</svg>
		</button>
	</div>
{/if}

<!-- Input area -->
<div class="border-t border-border-light bg-background-secondary-light p-4">
	{#if slashCompletions.length > 0 && inputMessage.startsWith('/')}
		<div
			class="mx-auto mb-2 max-w-4xl rounded-lg border border-border-light bg-background-primary-light shadow-sm"
		>
			{#each slashCompletions as cmd (cmd.name)}
				<button
					onclick={() => {
						if (cmd.chatText) {
							inputMessage = cmd.chatText;
						} else {
							inputMessage = cmd.name;
						}
					}}
					class="flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors first:rounded-t-lg last:rounded-b-lg hover:bg-background-secondary-light"
				>
					<span class="font-mono text-xs font-medium text-background-tertiary-light"
						>{cmd.name}</span
					>
					<span class="text-text-secondary-light">{cmd.description}</span>
				</button>
			{/each}
		</div>
	{:else if !isActive && suggestions.length > 0}
		<div class="mx-auto max-w-4xl">
			<SuggestionChips
				{suggestions}
				onSelect={(text) => {
					inputMessage = text;
				}}
			/>
		</div>
	{/if}
	{#if contextChips.length > 0}
		<div class="mx-auto mb-2 flex max-w-4xl flex-wrap items-center gap-1.5">
			<span class="text-[11px] uppercase tracking-wide text-text-secondary-light">Context:</span>
			{#each contextChips as chip (chip.id)}
				<button
					type="button"
					onclick={() => onToggleChip?.(chip.id)}
					title={chip.active ? chip.detail : `${chip.label} — excluded from your next message`}
					aria-pressed={chip.active}
					class="flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors {chip.active
						? 'border-background-tertiary-light bg-background-tertiary-light/10 text-text-primary-light'
						: 'border-border-light text-text-secondary-light line-through opacity-60'}"
				>
					{#if chip.active}
						<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2.5"
								d="M5 13l4 4L19 7"
							/>
						</svg>
					{/if}
					{chip.label}
				</button>
			{/each}
		</div>
	{/if}
	<form onsubmit={handleSubmit} class="mx-auto max-w-4xl">
		<div class="flex space-x-2">
			<textarea
				bind:value={inputMessage}
				placeholder={canUseMallardWorkspaces
					? 'Ask me about sourcing, portfolio, roasting, or coffee market decisions...'
					: 'Ask me about sourcing, portfolio, catalog, or coffee market decisions...'}
				class="flex-1 resize-none rounded-lg border border-border-light bg-background-primary-light px-4 py-3 text-text-primary-light placeholder-text-secondary-light focus:border-background-tertiary-light focus:outline-none focus:ring-1 focus:ring-background-tertiary-light"
				rows="1"
				disabled={isActive}
				onkeydown={(e) => {
					if (e.key === 'Enter' && !e.shiftKey) {
						e.preventDefault();
						onSend();
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
