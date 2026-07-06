<script lang="ts">
	import type { PageData } from './$types';
	import type { CoffeeCatalog } from '$lib/types/component.types';
	import { goto } from '$app/navigation';
	import { checkRole, type UserRole } from '$lib/types/auth.types';
	import {
		getDashboardSections,
		getDashboardUpgradePrompt,
		type DashboardCard
	} from '$lib/dashboard/intelligenceHome';
	import { parseTastingNotes } from '$lib/utils/parseTastingNotes';
	import { pageChatContext } from '$lib/stores/pageContextStore.svelte';

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
	let trackedCatalogById = $derived(
		new Map(
			((data.trackedCatalog ?? []) as CoffeeCatalog[]).map((coffee) => [
				coffee.id as unknown as number,
				coffee
			])
		)
	);

	let trackedIds = $state<Set<number>>(new Set());
	$effect(() => {
		trackedIds = new Set(
			(data.trackedLots ?? []).map((lot: { catalogId: number }) => lot.catalogId)
		);
	});

	// Publish the dashboard state so chat can ground answers in it.
	$effect(() => {
		const arrivals = (data.recentArrivals ?? []) as CoffeeCatalog[];
		const delistedSuffix =
			delistedTrackedCount > 0 ? ` (${delistedTrackedCount} recently delisted)` : '';
		pageChatContext.set({
			surface: 'dashboard',
			summary: `Parchment Intelligence home — ${trackedLots.length} tracked lots${delistedSuffix}, ${activeBriefs.length} active sourcing briefs, ${arrivals.length} recent arrivals shown.`,
			entities: arrivals.slice(0, 5).map((coffee) => ({
				type: 'coffee',
				id: coffee.id,
				label: [coffee.name, coffee.source].filter(Boolean).join(' — ') || `Coffee #${coffee.id}`
			}))
		});
		return () => pageChatContext.clear();
	});

	function setTracked(catalogId: number, tracked: boolean) {
		const next = new Set(trackedIds);
		if (tracked) next.add(catalogId);
		else next.delete(catalogId);
		trackedIds = next;
	}

	async function handleToggleTrack(catalogId: number) {
		const wasTracked = trackedIds.has(catalogId);
		setTracked(catalogId, !wasTracked);
		// Optimistic update, reverted on failure.
		try {
			const res = await fetch(`/api/catalog/${catalogId}/track`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' }
			});
			if (!res.ok) throw new Error('track failed');
			const body = (await res.json()) as { tracked: boolean };
			if (body.tracked !== !wasTracked) {
				setTracked(catalogId, body.tracked);
			}
		} catch {
			setTracked(catalogId, wasTracked);
		}
	}

	function watchlistAnnotation(lot: {
		stocked: boolean | null;
		unstockedDate: string | null;
		priceDelta: number | null;
	}): string {
		const parts: string[] = [];
		if (lot.stocked === false) {
			parts.push(`Delisted${lot.unstockedDate ? ` ${lot.unstockedDate}` : ''}`);
		}
		if (lot.priceDelta !== null && Math.abs(lot.priceDelta) >= 0.005) {
			const sign = lot.priceDelta > 0 ? '+' : '−';
			parts.push(`${sign}$${Math.abs(lot.priceDelta).toFixed(2)}/lb since tracked`);
		}
		return parts.join(' · ');
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
	<section class="rounded-2xl border border-line bg-surface-panel p-6 shadow-sm">
		<div class="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
			<div>
				<p class="text-sm font-medium uppercase tracking-[0.18em] text-accent">Intelligence Home</p>
				<h1 class="mt-2 text-3xl font-bold text-ink sm:text-4xl">
					Welcome back, {displayName}
				</h1>
				<p class="mt-3 max-w-3xl text-sm leading-relaxed text-muted sm:text-base">
					This is your intelligence home for green coffee supply-chain research, market analytics,
					and sourcing decisions. Mallard Studio sits beside it as roasting context when your own
					coffee operations need to inform the read.
				</p>
			</div>
			<div class="flex flex-col gap-3 sm:flex-row">
				<button
					onclick={() => goto('/analytics')}
					class="rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-ink transition-all duration-200 hover:bg-opacity-90"
				>
					Open Market Index
				</button>
				{#if canUseParchmentWorkflows}
					<button
						onclick={() => goto('/chat')}
						class="rounded-md border border-accent px-5 py-2.5 text-sm font-medium text-accent transition-all duration-200 hover:bg-accent hover:text-ink"
					>
						Ask Parchment
					</button>
				{:else}
					<button
						onclick={() => goto('/catalog')}
						class="rounded-md border border-accent px-5 py-2.5 text-sm font-medium text-accent transition-all duration-200 hover:bg-accent hover:text-ink"
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
				? 'border-accent/25 bg-accent-subtle/15'
				: 'border-line bg-surface-canvas'}"
		>
			<div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
				<div>
					<p class="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
						{upgradePrompt.variant === 'strong' ? 'Recommended next step' : 'Contextual upgrade'}
					</p>
					<h2 class="mt-2 text-xl font-semibold text-ink">
						{upgradePrompt.headline}
					</h2>
					<p class="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
						{upgradePrompt.body}
					</p>
				</div>
				<button
					onclick={() => goto(upgradePrompt.href)}
					class="rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-ink transition-all duration-200 hover:bg-opacity-90"
				>
					{upgradePrompt.cta}
				</button>
			</div>
		</section>
	{/if}

	{#if canUseParchmentWorkflows}
		<section class="space-y-4" aria-label="Your sourcing workspace">
			<div>
				<h2 class="text-xl font-semibold text-ink sm:text-2xl">Your sourcing workspace</h2>
				<p class="mt-1 text-sm leading-relaxed text-muted">
					Lots you watchlist and briefs you save evolve here: price and availability changes since
					tracking, and live links into the catalog views that match your saved criteria.
				</p>
			</div>

			<div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
				<div class="rounded-xl border border-line bg-surface-panel p-5 shadow-sm lg:col-span-2">
					<div class="flex items-center justify-between gap-3">
						<h3 class="text-sm font-semibold uppercase tracking-[0.16em] text-accent">Watchlist</h3>
						{#if trackedLots.length > 0}
							<p class="text-xs font-medium text-muted">
								{trackedLots.length} tracked{delistedTrackedCount > 0
									? ` · ${delistedTrackedCount} delisted since tracking`
									: ''}
							</p>
						{/if}
					</div>

					{#if trackedLots.length === 0}
						<p class="mt-3 text-sm leading-relaxed text-muted">
							Nothing tracked yet. Bookmark lots in the catalog and this panel reports price moves
							and delistings since you started watching them.
						</p>
						<button
							onclick={() => goto('/catalog')}
							class="mt-4 rounded-md border border-accent px-4 py-2 text-sm font-medium text-accent transition-all duration-200 hover:bg-accent hover:text-ink"
						>
							Find lots to track
						</button>
					{:else}
						<div class="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-2">
							{#each trackedLots as lot (lot.catalogId)}
								{@const coffee = trackedCatalogById.get(lot.catalogId)}
								{#if coffee}
									<CoffeeCard
										{coffee}
										{parseTastingNotes}
										compact={true}
										annotation={watchlistAnnotation(lot)}
										tracked={trackedIds.has(lot.catalogId)}
										onToggleTrack={handleToggleTrack}
									/>
								{/if}
							{/each}
						</div>
						<button
							onclick={() => goto('/catalog?tracked=only')}
							class="mt-3 text-sm font-medium text-accent transition-colors duration-200 hover:text-ink"
						>
							Manage watchlist in catalog
						</button>
					{/if}
				</div>

				<div class="rounded-xl border border-line bg-surface-panel p-5 shadow-sm">
					<h3 class="text-sm font-semibold uppercase tracking-[0.16em] text-accent">
						Active briefs
					</h3>
					{#if activeBriefs.length === 0}
						<p class="mt-3 text-sm leading-relaxed text-muted">
							{canAccessMallard
								? 'No active sourcing briefs. Save brief criteria in chat or the catalog and matches surface here and in the catalog banner.'
								: 'Sourcing briefs are a Mallard Studio workflow. Your watchlist still tracks price and availability changes.'}
						</p>
					{:else}
						<ul class="mt-3 space-y-3">
							{#each activeBriefs as brief (brief.id)}
								<li class="rounded-lg border border-line bg-surface-canvas p-3">
									<p class="text-sm font-semibold text-ink">{brief.name}</p>
									<p class="mt-1 text-xs leading-relaxed text-muted">
										{brief.criteriaDescription}
									</p>
									<a
										href={brief.catalogHref}
										class="mt-2 inline-block text-xs font-semibold text-accent hover:text-ink"
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
				<h2 class="text-xl font-semibold text-ink sm:text-2xl">Decision paths</h2>
				<p class="mt-1 text-sm text-muted">
					Start with the market and catalog. Add Portfolio and Mallard context when the decision
					needs your own coffees.
				</p>
			</div>
			<button
				onclick={() => goto('/')}
				class="text-left text-sm font-medium text-muted transition-colors duration-200 hover:text-accent sm:text-right"
			>
				View public homepage
			</button>
		</div>

		{#each dashboardSections as section}
			<div class="space-y-3">
				<div>
					<h3 class="text-sm font-semibold uppercase tracking-[0.16em] text-accent">
						{section.label}
					</h3>
					<p class="mt-1 text-sm leading-relaxed text-muted">
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
							class="group rounded-xl border border-line bg-surface-panel p-5 text-left shadow-sm transition-all duration-200 {card.status ===
							'coming-soon'
								? 'cursor-default opacity-85'
								: 'hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md'}"
						>
							<div class="flex items-start justify-between gap-3">
								<div
									class="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-accent-subtle/15 px-2 text-xs font-semibold tracking-wide text-accent"
								>
									{card.label}
								</div>
								{#if card.status === 'locked'}
									<span
										class="rounded-full bg-warning-subtle px-2 py-1 text-xs font-medium text-warning-strong"
									>
										Locked
									</span>
								{:else if card.status === 'coming-soon'}
									<span
										class="rounded-full bg-surface-panel px-2 py-1 text-xs font-medium text-muted ring-1 ring-line"
									>
										Direction
									</span>
								{/if}
							</div>
							<h4
								class="mt-4 text-lg font-semibold text-ink transition-colors duration-200 {card.status !==
								'coming-soon'
									? 'group-hover:text-accent'
									: ''}"
							>
								{card.title}
							</h4>
							<p class="mt-2 text-sm leading-relaxed text-muted">
								{card.description}
							</p>
							{#if card.lockedReason}
								<p class="mt-3 text-xs font-medium text-accent">
									{card.lockedReason}
								</p>
							{/if}
							<p class="mt-4 text-sm font-semibold text-accent">
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
					<h2 class="text-xl font-semibold text-ink sm:text-2xl">Latest supply signals</h2>
					<p class="mt-1 text-sm leading-relaxed text-muted">
						Recent arrivals from the live catalog. Use them as a lightweight starting point for
						supplier coverage checks, origin discovery, and pricing comparisons.
					</p>
				</div>
				<button
					onclick={() => goto('/catalog')}
					class="text-left text-sm font-medium text-accent transition-colors duration-200 hover:text-ink sm:text-right"
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
