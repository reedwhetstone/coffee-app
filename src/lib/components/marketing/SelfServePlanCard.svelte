<script lang="ts">
	import type { SelfServePlan } from '$lib/billing/selfServePlans';

	type StatusTone = 'success' | 'info' | 'warning' | 'muted';

	let {
		plan,
		ctaLabel,
		disabled = false,
		statusLabel = null,
		statusTone = 'muted',
		onChoose
	} = $props<{
		plan: SelfServePlan;
		ctaLabel: string;
		disabled?: boolean;
		statusLabel?: string | null;
		statusTone?: StatusTone;
		onChoose: (plan: SelfServePlan) => void;
	}>();

	const isBundle = $derived(plan.id === 'both');
	const statusClasses = $derived(
		statusTone === 'success'
			? 'border-success/30 bg-success-subtle text-success-strong'
			: statusTone === 'info'
				? 'border-info/30 bg-info-subtle text-info-strong'
				: statusTone === 'warning'
					? 'border-warning/30 bg-warning-subtle text-warning-strong'
					: 'border-line bg-surface-panel text-muted'
	);
</script>

<article
	class={`group relative flex h-full flex-col overflow-hidden rounded-3xl border bg-surface-canvas p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-7 ${isBundle ? 'order-first border-success ring-1 ring-success/20 lg:order-none' : plan.id === 'intelligence' ? 'border-accent/45 hover:border-accent' : 'border-line hover:border-accent/60'}`}
>
	<div
		class={`absolute inset-x-0 top-0 h-1 ${isBundle ? 'bg-success' : plan.id === 'intelligence' ? 'bg-intelligence' : 'bg-accent'}`}
		aria-hidden="true"
	></div>

	<div class="flex items-start justify-between gap-4">
		<div class="flex items-center gap-3">
			<span
				class={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ${isBundle ? 'bg-success-subtle text-success-strong ring-success/25' : plan.id === 'intelligence' ? 'bg-intelligence/10 text-intelligence ring-intelligence/20' : 'bg-accent/10 text-ink ring-accent/25'}`}
			>
				<svg
					class="h-6 w-6"
					fill="none"
					viewBox="0 0 24 24"
					stroke-width="1.5"
					stroke="currentColor"
					aria-hidden="true"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d={plan.iconPath} />
				</svg>
			</span>
			<div>
				<p class={`text-xs font-semibold ${isBundle ? 'text-success-strong' : 'text-accent'}`}>
					{plan.eyebrow}
				</p>
				<h3 class="mt-1 text-xl font-semibold text-ink">{plan.name}</h3>
			</div>
		</div>
		<span
			class={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${isBundle ? 'bg-success-subtle text-success-strong' : 'border border-line bg-surface-panel text-muted'}`}
		>
			{plan.badge}
		</span>
	</div>

	<p class="mt-5 text-sm leading-6 text-muted">{plan.description}</p>

	<div class="mt-6 flex flex-wrap items-end justify-between gap-3 border-y border-line py-4">
		<p class="flex items-baseline gap-1">
			<span class="text-4xl font-bold tracking-tight text-ink">{plan.offer.price}</span>
			<span class="text-sm font-semibold text-muted">{plan.offer.interval}</span>
		</p>
		{#if statusLabel}
			<span class={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClasses}`}>
				{statusLabel}
			</span>
		{/if}
	</div>

	<p class="mt-3 text-xs font-medium text-success-strong">
		{plan.offer.trialDays}-day free trial if eligible{isBundle ? ' · Save $2/month' : ''}
	</p>

	<ul class="mt-5 space-y-3 text-sm leading-6 text-muted">
		{#each plan.features as feature}
			<li class="flex gap-3">
				<span
					class={`mt-1.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${isBundle ? 'bg-success-subtle text-success-strong' : 'bg-accent/10 text-accent'}`}
					aria-hidden="true"
				>
					<svg class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
						<path
							fill-rule="evenodd"
							d="M16.704 5.29a1 1 0 01.006 1.414l-8 8a1 1 0 01-1.42 0l-4-4a1 1 0 011.42-1.408L8 12.586l7.296-7.29a1 1 0 011.408-.006z"
							clip-rule="evenodd"
						/>
					</svg>
				</span>
				<span>{feature}</span>
			</li>
		{/each}
	</ul>

	<div class="mt-auto pt-7">
		<button
			type="button"
			onclick={() => onChoose(plan)}
			{disabled}
			class={`w-full rounded-xl px-4 py-3 text-sm font-semibold text-ink transition-all hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${isBundle ? 'bg-success focus-visible:outline-success' : 'bg-accent focus-visible:outline-accent'}`}
		>
			{ctaLabel}
		</button>
		<a
			href={plan.learnMoreHref}
			class="mt-3 block text-center text-sm font-medium text-muted underline underline-offset-4 transition-colors hover:text-ink"
		>
			Learn more
		</a>
	</div>
</article>
