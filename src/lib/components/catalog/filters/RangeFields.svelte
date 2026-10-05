<script lang="ts">
	/**
	 * A minimum and maximum pair. The range is applied when a field is committed
	 * (blur or Enter), and never while the two bounds are inverted.
	 */
	interface Props {
		legend: string;
		idPrefix: string;
		unit: string;
		min: string | number;
		max: string | number;
		step?: number;
		lowest?: number;
		highest?: number;
		disabled?: boolean;
		includeUnknown?: boolean;
		includeUnknownLabel?: string;
		onChange: (range: { min: string; max: string; includeUnknown: boolean }) => void;
	}

	let {
		legend,
		idPrefix,
		unit,
		min,
		max,
		step = 1,
		lowest = 0,
		highest,
		disabled = false,
		includeUnknown = false,
		includeUnknownLabel,
		onChange
	}: Props = $props();

	let draft = $state<{ min: string | null; max: string | null }>({ min: null, max: null });
	let error = $state<string | null>(null);

	let shownMin = $derived(draft.min ?? String(min ?? ''));
	let shownMax = $derived(draft.max ?? String(max ?? ''));
	let active = $derived(shownMin !== '' || shownMax !== '');

	function inverted(low: string, high: string): boolean {
		if (low === '' || high === '') return false;
		const a = Number(low);
		const b = Number(high);
		return Number.isFinite(a) && Number.isFinite(b) && a > b;
	}

	function commit(nextMin: string, nextMax: string, nextIncludeUnknown = includeUnknown) {
		if (inverted(nextMin, nextMax)) {
			draft = { min: nextMin, max: nextMax };
			error = `The lowest ${unit} cannot be above the highest.`;
			return;
		}
		error = null;
		draft = { min: null, max: null };
		const stillActive = nextMin !== '' || nextMax !== '';
		onChange({ min: nextMin, max: nextMax, includeUnknown: stillActive && nextIncludeUnknown });
	}

	const fieldClass =
		'w-full rounded-md border border-line bg-surface-canvas px-2 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50';
</script>

<fieldset class="min-w-0" {disabled}>
	<legend class="mb-2 text-xs font-semibold text-ink">{legend}</legend>
	<div class="flex items-center gap-2">
		<label class="flex-1" for={`${idPrefix}-min`}>
			<span class="sr-only">Lowest {unit}</span>
			<input
				id={`${idPrefix}-min`}
				type="number"
				inputmode="decimal"
				min={lowest}
				max={highest}
				{step}
				placeholder="Min"
				value={shownMin}
				onchange={(event) => commit(event.currentTarget.value, shownMax)}
				class={fieldClass}
			/>
		</label>
		<span class="text-sm text-muted">to</span>
		<label class="flex-1" for={`${idPrefix}-max`}>
			<span class="sr-only">Highest {unit}</span>
			<input
				id={`${idPrefix}-max`}
				type="number"
				inputmode="decimal"
				min={lowest}
				max={highest}
				{step}
				placeholder="Max"
				value={shownMax}
				onchange={(event) => commit(shownMin, event.currentTarget.value)}
				class={fieldClass}
			/>
		</label>
	</div>
	{#if error}
		<p class="mt-1.5 text-xs text-danger" role="alert">{error}</p>
	{/if}
	{#if includeUnknownLabel}
		<label class="mt-2 flex items-start gap-2 text-xs text-ink">
			<input
				type="checkbox"
				checked={includeUnknown}
				disabled={disabled || !active}
				onchange={(event) => commit(shownMin, shownMax, event.currentTarget.checked)}
				class="mt-0.5 h-4 w-4 rounded border border-line text-accent focus:ring-2 focus:ring-accent disabled:opacity-40"
			/>
			<span>{includeUnknownLabel}</span>
		</label>
	{/if}
</fieldset>
