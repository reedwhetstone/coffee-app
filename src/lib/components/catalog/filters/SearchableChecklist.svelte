<script lang="ts">
	/**
	 * A searchable list of checkboxes for vocabularies too long for chips
	 * (countries, suppliers, varieties). Indented options are members of the
	 * family listed above them.
	 */
	export interface ChecklistOption {
		value: string;
		label: string;
		count?: number | null;
		indent?: boolean;
	}

	interface Props {
		id: string;
		label: string;
		searchPlaceholder: string;
		options: ChecklistOption[];
		selected: string[];
		disabled?: boolean;
		hideLabel?: boolean;
		/** Shown when there are no options at all. */
		emptyText?: string;
		/** Shown when the search matches none of the options. */
		noMatchText?: string;
		onChange: (selected: string[]) => void;
	}

	let {
		id,
		label,
		searchPlaceholder,
		options,
		selected,
		disabled = false,
		hideLabel = false,
		emptyText = 'None in these results.',
		noMatchText = 'No matches.',
		onChange
	}: Props = $props();

	let search = $state('');
	let needle = $derived(search.trim().toLowerCase());
	let visibleOptions = $derived(
		needle ? options.filter((option) => option.label.toLowerCase().includes(needle)) : options
	);

	function toggle(value: string, checked: boolean) {
		onChange(checked ? [...selected, value] : selected.filter((entry) => entry !== value));
	}
</script>

<div class="min-w-0">
	<div class="flex items-baseline justify-between gap-3">
		<label for={id} class={hideLabel ? 'sr-only' : 'text-xs font-semibold text-ink'}>{label}</label>
		{#if selected.length > 0}
			<button
				type="button"
				class="text-xs text-link hover:text-accent"
				{disabled}
				onclick={() => onChange([])}
			>
				Clear {selected.length}
			</button>
		{/if}
	</div>
	<input
		{id}
		type="search"
		bind:value={search}
		{disabled}
		placeholder={searchPlaceholder}
		class="mt-1.5 w-full rounded-md border border-line bg-surface-canvas px-3 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
	/>
	<ul
		class="mt-1.5 max-h-52 overflow-y-auto rounded-md border border-line bg-surface-canvas py-1"
		aria-label={label}
	>
		{#each visibleOptions as option (option.value)}
			{@const isSelected = selected.includes(option.value)}
			{@const isEmpty = option.count === 0 && !isSelected}
			<li>
				<label
					class="flex cursor-pointer items-center gap-2 px-3 py-1 text-sm text-ink hover:bg-surface-panel {option.indent &&
					!needle
						? 'pl-8'
						: ''} {isEmpty ? 'opacity-40' : ''}"
				>
					<input
						type="checkbox"
						checked={isSelected}
						disabled={disabled || isEmpty}
						onchange={(event) => toggle(option.value, event.currentTarget.checked)}
						class="h-4 w-4 rounded border border-line text-accent focus:ring-2 focus:ring-accent"
					/>
					<span class="min-w-0 flex-1 truncate">{option.label}</span>
					{#if option.count !== undefined && option.count !== null}
						<span class="text-xs tabular-nums text-muted">{option.count.toLocaleString()}</span>
					{/if}
				</label>
			</li>
		{:else}
			<li class="px-3 py-2 text-sm text-muted">
				{options.length === 0 ? emptyText : noMatchText}
			</li>
		{/each}
	</ul>
</div>
