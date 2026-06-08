<script lang="ts">
	type ActionTone = 'primary' | 'secondary';

	let {
		eyebrow,
		title,
		description,
		ctaLabel,
		href,
		disabled = false,
		disabledReason,
		statusLabel,
		tone = 'secondary'
	}: {
		eyebrow: string;
		title: string;
		description: string;
		ctaLabel: string;
		href?: string;
		disabled?: boolean;
		disabledReason?: string;
		statusLabel?: string;
		tone?: ActionTone;
	} = $props();

	let isDisabled = $derived(disabled || !href);
	let disabledReasonId = $derived(
		disabledReason
			? `analytics-action-cta-reason-${eyebrow.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
			: undefined
	);
	let linkClass = $derived(
		isDisabled
			? 'cursor-not-allowed border-border-light bg-background-secondary-light text-text-secondary-light opacity-70'
			: tone === 'primary'
				? 'border-background-tertiary-light bg-background-tertiary-light text-white hover:bg-opacity-90'
				: 'border-background-tertiary-light bg-background-primary-light text-background-tertiary-light hover:bg-background-tertiary-light hover:text-white'
	);
</script>

<article
	class="flex h-full flex-col rounded-xl border border-border-light bg-background-primary-light p-4 shadow-sm"
>
	<div class="flex items-start justify-between gap-3">
		<div>
			<p class="text-xs font-semibold uppercase tracking-wide text-background-tertiary-light">
				{eyebrow}
			</p>
			<h3 class="mt-1 text-base font-semibold text-text-primary-light">{title}</h3>
		</div>
		{#if statusLabel}
			<span
				class="rounded-full bg-background-secondary-light px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-text-secondary-light"
			>
				{statusLabel}
			</span>
		{/if}
	</div>

	<p class="mt-2 flex-1 text-sm leading-6 text-text-secondary-light">{description}</p>

	{#if disabledReason}
		<p id={disabledReasonId} class="mt-3 text-xs font-medium text-text-secondary-light">
			{disabledReason}
		</p>
	{/if}

	{#if isDisabled}
		<button
			type="button"
			disabled
			aria-describedby={disabledReasonId}
			class="mt-4 rounded-md border px-4 py-2 text-sm font-semibold transition-all duration-200 {linkClass}"
		>
			{ctaLabel}
		</button>
	{:else}
		<a
			{href}
			class="mt-4 rounded-md border px-4 py-2 text-center text-sm font-semibold transition-all duration-200 {linkClass}"
		>
			{ctaLabel}
		</a>
	{/if}
</article>
