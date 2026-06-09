<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import { checkRole, type UserRole } from '$lib/types/auth.types';
	import {
		getDashboardSections,
		getDashboardUpgradePrompt,
		type DashboardCard
	} from '$lib/dashboard/intelligenceHome';
	import { parseTastingNotes } from '$lib/utils/parseTastingNotes';

	import CoffeeCard from '$lib/components/CoffeeCard.svelte';

	let { data } = $props<{ data: PageData }>();

	let role = $derived((data.role ?? 'viewer') as UserRole);
	let canAccessMallard = $derived(checkRole(role, 'member'));
	let canUseParchmentWorkflows = $derived(data.ppiAccess === true || canAccessMallard);
	let trackedLots = $derived(data.trackedLots ?? []);
	let activeBriefs = $derived(data.activeBriefs ?? []);
	let delistedTrackedCount = $derived(
		trackedLots.filter((lot: { stocked: boolean | null }) => lot.stocked === false).length
	);

	function formatTrackedPrice(value: number | null): string {
		return value === null ? '—' : `$${value.toFixed(2)}/lb`;
	}

	function formatTrackedDelta(delta: number | null): string | null {
		if (delta === null || Math.abs(delta) < 0.005) return null;
		const sign = delta > 0 ? '+' : '−';
		return `${sign}$${Math.abs(delta).toFixed(2)}/lb since tracked`;
	}
	let displayName = $derived(data.session?.user?.email?.split('@')[0] ?? 'there');
	let dashboardContext = $derived({ role, ppiAccess: data.ppiAccess === true });
	let dashboardSections = $derived(getDashboardSections(dashboardContext));
	let upgradePrompt = $derived(getDashboardUpgradePrompt(dashboardContext));

	function openCard(card: DashboardCard) {
		if (card.status === 'coming-soon') return;
		if (card.status === 'locked') {
			goto('/subscription');
			return;
		}
		if (card.href) goto(card.href);
	}
</script>

<div class="mx-auto max-w-6xl space-y-8 px-4 py-4 sm:px-6 lg:px-8">
	<section
		class="rounded-2xl border border-border-light bg-background-secondary-light p-6 shadow-sm"
	>
		<div class="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
			<div>
				<p class="text-sm font-medium uppercase tracking-[0.18em] text-background-tertiary-light">
					Intelligence Home
				</p>
				<h1 class="mt-2 text-3xl font-bold text-text-primary-light sm:text-4xl">
					Welcome back, {displayName}
				</h1>
				<p class="mt-3 max-w-3xl text-sm leading-relaxed text-text-secondary-light sm:text-base">
					This is your intelligence home for green coffee supply-chain research, market analytics,
					and sourcing decisions. Mallard Studio sits beside it as roasting context when your own
					coffee operations need to inform the read.
				</p>
			</div>
			<div class="flex flex-col gap-3 sm:flex-row">
				<button
					onclick={() => goto('/analytics')}
					class="rounded-md bg-background-tertiary-light px-5 py-2.5 text-sm font-medium text-white transition-all duration-200 hover:bg-opacity-90"
				>
					Open Market Index
				</button>
				{#if canUseParchmentWorkflows}
					<button
						onclick={() => goto('/chat')}
						class="rounded-md border border-background-tertiary-light px-5 py-2.5 text-sm font-medium text-background-tertiary-light transition-all duration-200 hover:bg-background-tertiary-light hover:text-white"
					>
						Ask Parchment
					</button>
				{:else}
					<button
						onclick={() => goto('/catalog')}
						class="rounded-md border border-background-tertiary-light px-5 py-2.5 text-sm font-medium text-background-tertiary-light transition-all duration-200 hover:bg-background-tertiary-light hover:text-white"
					>
						Browse catalog
					</button>
				{/if}
			</div>
		</div>
	</section>

	{#if upgradePrompt}
		<section
			class="rounded-lg border p-6 {upgradePrompt.variant === 'strong'
				? 'border-background-tertiary-light/25 bg-accent-subtle/15'
				: 'border-border-light bg-background-primary-light'}"
		>
			<div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
				<div>
					<p
						class="text-xs font-semibold uppercase tracking-[0.16em] text-background-tertiary-light"
					>
						{upgradePrompt.variant === 'strong' ? 'Recommended next step' : 'Contextual upgrade'}
					</p>
					<h2 class="mt-2 text-xl font-semibold text-text-primary-light">
						{upgradePrompt.headline}
					</h2>
					<p class="mt-2 max-w-3xl text-sm leading-relaxed text-text-secondary-light">
						{upgradePrompt.body}
					</p>
				</div>
				<button
					onclick={() => goto(upgradePrompt.href)}
					class="rounded-md bg-background-tertiary-light px-5 py-2.5 text-sm font-medium text-white transition-all duration-200 hover:bg-opacity-90"
				>
					{upgradePrompt.cta}
				</button>
			</div>
		</section>
	{/if}

	{#if canUseParchmentWorkflows}
		<section class="space-y-4" aria-label="Your sourcing workspace">
			<div>
				<h2 class="text-xl font-semibold text-text-primary-light sm:text-2xl">
					Your sourcing workspace
				</h2>
				<p class="mt-1 text-sm leading-relaxed text-text-secondary-light">
					Lots you watchlist and briefs you save evolve here: price and availability changes since
					tracking, and live links into the catalog views that match your saved criteria.
				</p>
			</div>

			<div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
				<div
					class="rounded-xl border border-border-light bg-background-secondary-light p-5 shadow-sm lg:col-span-2"
				>
					<div class="flex items-center justify-between gap-3">
						<h3
							class="text-sm font-semibold uppercase tracking-[0.16em] text-background-tertiary-light"
						>
							Watchlist
						</h3>
						{#if trackedLots.length > 0}
							<p class="text-xs font-medium text-text-secondary-light">
								{trackedLots.length} tracked{delistedTrackedCount > 0
									? ` · ${delistedTrackedCount} delisted since tracking`
									: ''}
							</p>
						{/if}
					</div>

					{#if trackedLots.length === 0}
						<p class="mt-3 text-sm leading-relaxed text-text-secondary-light">
							Nothing tracked yet. Bookmark lots in the catalog and this panel reports price moves
							and delistings since you started watching them.
						</p>
						<button
							onclick={() => goto('/catalog')}
							class="mt-4 rounded-md border border-background-tertiary-light px-4 py-2 text-sm font-medium text-background-tertiary-light transition-all duration-200 hover:bg-background-tertiary-light hover:text-white"
						>
							Find lots to track
						</button>
					{:else}
						<ul class="mt-3 divide-y divide-border-light">
							{#each trackedLots as lot (lot.catalogId)}
								<li class="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
									<div class="min-w-0">
										<p class="truncate text-sm font-semibold text-text-primary-light">
											{lot.name}
										</p>
										<p class="text-xs text-text-secondary-light">
											{[lot.source, lot.country].filter(Boolean).join(' · ') || 'Supplier unknown'}
										</p>
									</div>
									<div class="flex flex-shrink-0 items-center gap-3 text-sm">
										{#if lot.stocked === false}
											<span
												class="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700 ring-1 ring-red-100"
											>
												Delisted{lot.unstockedDate ? ` ${lot.unstockedDate}` : ''}
											</span>
										{:else}
											<span
												class="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100"
											>
												Stocked
											</span>
										{/if}
										<span class="font-semibold text-text-primary-light">
											{formatTrackedPrice(lot.currentPrice)}
										</span>
										{#if formatTrackedDelta(lot.priceDelta)}
											<span
												class="text-xs font-medium {lot.priceDelta && lot.priceDelta > 0
													? 'text-amber-700'
													: 'text-emerald-700'}"
											>
												{formatTrackedDelta(lot.priceDelta)}
											</span>
										{/if}
									</div>
								</li>
							{/each}
						</ul>
						<button
							onclick={() => goto('/catalog')}
							class="mt-3 text-sm font-medium text-background-tertiary-light transition-colors duration-200 hover:text-text-primary-light"
						>
							Manage watchlist in catalog
						</button>
					{/if}
				</div>

				<div
					class="rounded-xl border border-border-light bg-background-secondary-light p-5 shadow-sm"
				>
					<h3
						class="text-sm font-semibold uppercase tracking-[0.16em] text-background-tertiary-light"
					>
						Active briefs
					</h3>
					{#if activeBriefs.length === 0}
						<p class="mt-3 text-sm leading-relaxed text-text-secondary-light">
							{canAccessMallard
								? 'No active sourcing briefs. Save brief criteria in chat or the catalog and matches surface here and in the catalog banner.'
								: 'Sourcing briefs are a Mallard Studio workflow. Your watchlist still tracks price and availability changes.'}
						</p>
					{:else}
						<ul class="mt-3 space-y-3">
							{#each activeBriefs as brief (brief.id)}
								<li class="rounded-lg border border-border-light bg-background-primary-light p-3">
									<p class="text-sm font-semibold text-text-primary-light">{brief.name}</p>
									<p class="mt-1 text-xs leading-relaxed text-text-secondary-light">
										{brief.criteriaDescription}
									</p>
									<a
										href={brief.catalogHref}
										class="mt-2 inline-block text-xs font-semibold text-background-tertiary-light hover:text-text-primary-light"
									>
										View matching lots
									</a>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			</div>
		</section>
	{/if}

	<section class="space-y-6">
		<div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
			<div>
				<h2 class="text-xl font-semibold text-text-primary-light sm:text-2xl">Decision paths</h2>
				<p class="mt-1 text-sm text-text-secondary-light">
					Start with the market and catalog. Add Portfolio and Mallard context when the decision
					needs your own coffees.
				</p>
			</div>
			<button
				onclick={() => goto('/')}
				class="text-left text-sm font-medium text-text-secondary-light transition-colors duration-200 hover:text-background-tertiary-light sm:text-right"
			>
				View public homepage
			</button>
		</div>

		{#each dashboardSections as section}
			<div class="space-y-3">
				<div>
					<h3
						class="text-sm font-semibold uppercase tracking-[0.16em] text-background-tertiary-light"
					>
						{section.label}
					</h3>
					<p class="mt-1 text-sm leading-relaxed text-text-secondary-light">
						{section.description}
					</p>
				</div>

				<div
					class="grid grid-cols-1 gap-4 sm:grid-cols-2 {section.id === 'parchment'
						? 'xl:grid-cols-4'
						: 'xl:grid-cols-2'}"
				>
					{#each section.cards as card}
						<button
							type="button"
							onclick={() => openCard(card)}
							class="group rounded-xl border border-border-light bg-background-secondary-light p-5 text-left shadow-sm transition-all duration-200 {card.status ===
							'coming-soon'
								? 'cursor-default opacity-85'
								: 'hover:-translate-y-0.5 hover:border-background-tertiary-light/40 hover:shadow-md'}"
						>
							<div class="flex items-start justify-between gap-3">
								<div
									class="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-accent-subtle/15 px-2 text-xs font-semibold tracking-wide text-background-tertiary-light"
								>
									{card.label}
								</div>
								{#if card.status === 'locked'}
									<span
										class="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800"
									>
										Locked
									</span>
								{:else if card.status === 'coming-soon'}
									<span
										class="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700"
									>
										Direction
									</span>
								{/if}
							</div>
							<h4
								class="mt-4 text-lg font-semibold text-text-primary-light transition-colors duration-200 {card.status !==
								'coming-soon'
									? 'group-hover:text-background-tertiary-light'
									: ''}"
							>
								{card.title}
							</h4>
							<p class="mt-2 text-sm leading-relaxed text-text-secondary-light">
								{card.description}
							</p>
							{#if card.lockedReason}
								<p class="mt-3 text-xs font-medium text-background-tertiary-light">
									{card.lockedReason}
								</p>
							{/if}
							<p class="mt-4 text-sm font-semibold text-background-tertiary-light">
								{card.status === 'locked' ? 'View upgrade options' : card.cta}
							</p>
						</button>
					{/each}
				</div>
			</div>
		{/each}
	</section>

	{#if data.recentArrivals?.length > 0}
		<section class="space-y-4">
			<div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<h2 class="text-xl font-semibold text-text-primary-light sm:text-2xl">
						Latest supply signals
					</h2>
					<p class="mt-1 text-sm leading-relaxed text-text-secondary-light">
						Recent arrivals from the live catalog. Use them as a lightweight starting point for
						supplier coverage checks, origin discovery, and pricing comparisons.
					</p>
				</div>
				<button
					onclick={() => goto('/catalog')}
					class="text-left text-sm font-medium text-background-tertiary-light transition-colors duration-200 hover:text-text-primary-light sm:text-right"
				>
					Research full catalog
				</button>
			</div>

			<div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
				{#each data.recentArrivals as coffee}
					<CoffeeCard {coffee} {parseTastingNotes} />
				{/each}
			</div>
		</section>
	{/if}
</div>
