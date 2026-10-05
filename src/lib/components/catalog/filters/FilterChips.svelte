<script lang="ts">
	/**
	 * A small set of options shown as chips. Single-select groups act like a
	 * toggle: choosing the active chip again clears it.
	 */
	export interface ChipOption {
		value: string;
		label: string;
		/** Coffees this option would match under the other active filters. */
		count?: number | null;
		/** A longer explanation, shown on hover. */
		title?: string;
	}

	interface Props {
		legend: string;
		options: ChipOption[];
		selected: string[];
		multiple?: boolean;
		disabled?: boolean;
		hideLegend?: boolean;
		/** Shown in place of the chips when there are none. */
		emptyText?: string;
		onChange: (selected: string[]) => void;
	}

	let {
		legend,
		options,
		selected,
		multiple = false,
		disabled = false,
		hideLegend = false,
		emptyText,
		onChange
	}: Props = $props();

	function toggle(value: string) {
		if (selected.includes(value)) {
			onChange(selected.filter((entry) => entry !== value));
		} else {
			onChange(multiple ? [...selected, value] : [value]);
		}
	}
</script>

<fieldset class="min-w-0" {disabled}>
	<legend class={hideLegend ? 'sr-only' : 'mb-2 text-xs font-semibold text-ink'}>{legend}</legend>
	{#if options.length === 0 && emptyText}
		<p class="py-1 text-sm text-muted">{emptyText}</p>
	{/if}
	<div class="flex flex-wrap gap-1.5">
		{#each options as option (option.value)}
			{@const isSelected = selected.includes(option.value)}
			{@const isEmpty = option.count === 0 && !isSelected}
			<button
				type="button"
				aria-pressed={isSelected}
				title={option.title}
				disabled={disabled || isEmpty}
				onclick={() => toggle(option.value)}
				class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-40 {isSelected
					? 'border-accent bg-accent/15 font-medium text-ink'
					: 'border-line bg-surface-canvas text-ink hover:border-accent'}"
			>
				<span>{option.label}</span>
				{#if option.count !== undefined && option.count !== null}
					<span class="text-xs tabular-nums text-muted">{option.count.toLocaleString()}</span>
				{/if}
			</button>
		{/each}
	</div>
</fieldset>
