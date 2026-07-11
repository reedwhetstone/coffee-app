<script lang="ts">
	type MetricTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'intelligence';

	let {
		label,
		value,
		detail = '',
		tone = 'neutral'
	} = $props<{
		label: string;
		value: string | number;
		detail?: string;
		tone?: MetricTone;
	}>();

	const toneClasses: Record<MetricTone, string> = {
		neutral: 'border-line',
		accent: 'border-accent/35',
		success: 'border-success/35',
		warning: 'border-warning/35',
		danger: 'border-danger/35',
		intelligence: 'border-intelligence/35'
	};

	let toneClass = $derived(toneClasses[(tone ?? 'neutral') as MetricTone]);
</script>

<div class="rounded-lg border {toneClass} bg-surface-panel p-4 shadow-sm">
	<p class="text-sm font-medium text-muted">{label}</p>
	<p class="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-ink">
		{value}
	</p>
	{#if detail}
		<p class="mt-1 text-xs leading-5 text-muted">{detail}</p>
	{/if}
</div>
