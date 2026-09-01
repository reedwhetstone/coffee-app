<script lang="ts">
	import type { PageData } from './$types';
	import type { CoffeeCatalog } from '$lib/types/component.types';
	import type { UserRole } from '$lib/types/auth.types';
	import {
		getDashboardExperience,
		getDashboardUpgradePrompt,
		hasParchmentWorkflowAccess
	} from '$lib/dashboard/intelligenceHome';
	import { formatPricePerLb, getDisplayPrice } from '$lib/utils/pricing';
	import { pageChatContext } from '$lib/stores/pageContextStore.svelte';
	import { formatSourceName } from '$lib/utils/formatters';

	let { data } = $props<{ data: PageData }>();

	let role = $derived(data.auth.role as UserRole);
	let dashboardContext = $derived({ role, ppiAccess: data.auth.ppiAccess });
	let experience = $derived(getDashboardExperience(dashboardContext));
	let upgradePrompt = $derived(getDashboardUpgradePrompt(dashboardContext));
	let hasWorkspaceAccess = $derived(hasParchmentWorkflowAccess(dashboardContext));
	let trackedLots = $derived(data.trackedLots ?? []);
	let activeBriefs = $derived(data.activeBriefs ?? []);
	let recentArrivals = $derived((data.recentArrivals ?? []) as CoffeeCatalog[]);
	let displayName = $derived(data.auth.user?.email?.split('@')[0] ?? 'there');
	let delistedTrackedCount = $derived(
		trackedLots.filter((lot: { stocked: boolean | null }) => lot.stocked === false).length
	);
	let attentionTrackedCount = $derived(
		trackedLots.filter(
			(lot: { stocked: boolean | null; priceDelta: number | null }) =>
				lot.stocked === false || (lot.priceDelta !== null && Math.abs(lot.priceDelta) >= 0.005)
		).length
	);

	function cherryHref(prompt: string): string {
		if (!experience.agent) return '/subscription';
		return `/chat?${new URLSearchParams({ source: 'dashboard', prompt }).toString()}`;
	}

	let chatHref = $derived(cherryHref(experience.focusQuestion));

	function trackedLotChange(lot: {
		stocked: boolean | null;
		unstockedDate: string | null;
		priceDelta: number | null;
	}): string {
		if (lot.stocked === false) {
			return lot.unstockedDate ? `Delisted ${lot.unstockedDate}` : 'No longer listed';
		}
		if (lot.priceDelta !== null && Math.abs(lot.priceDelta) >= 0.005) {
			const direction = lot.priceDelta > 0 ? 'up' : 'down';
			return `${formatPricePerLb(Math.abs(lot.priceDelta))} ${direction} since tracked`;
		}
		return 'No material price or availability change';
	}

	function trackedLotContext(lot: {
		source: string | null;
		country: string | null;
		processing: string | null;
	}): string {
		return [formatSourceName(lot.source), lot.country, lot.processing].filter(Boolean).join(' · ');
	}

	function arrivalContext(coffee: CoffeeCatalog): string {
		return [formatSourceName(coffee.source), coffee.country, coffee.processing]
			.filter(Boolean)
			.join(' · ');
	}

	function arrivalPrice(coffee: CoffeeCatalog): string {
		const price = getDisplayPrice(coffee);
		return price === null ? 'Price unavailable' : formatPricePerLb(price);
	}

	$effect(() => {
		const delistedSuffix =
			delistedTrackedCount > 0 ? `, ${delistedTrackedCount} recently delisted` : '';
		pageChatContext.set({
			surface: 'dashboard',
			summary: `${experience.accessLabel} dashboard: ${trackedLots.length} tracked coffees${delistedSuffix}, ${activeBriefs.length} active sourcing briefs, and ${recentArrivals.length} recent arrivals shown.`,
			entities: recentArrivals.slice(0, 5).map((coffee) => ({
				type: 'coffee',
				id: coffee.id,
				label:
					[coffee.name, formatSourceName(coffee.source)].filter(Boolean).join(' — ') ||
					`Coffee #${coffee.id}`
			}))
		});
		return () => pageChatContext.clear();
	});
</script>

<svelte:head>
	<title>Dashboard | Purveyors</title>
	<meta
		name="description"
		content="Continue your coffee sourcing, market intelligence, and roastery work in Purveyors."
	/>
</svelte:head>

<div class="mx-auto max-w-7xl space-y-10 py-3 sm:py-5">
	<section
		class="grid gap-8 border-b border-line pb-9 lg:grid-cols-[minmax(0,1.08fr)_minmax(22rem,0.72fr)] lg:items-stretch"
		aria-labelledby="dashboard-heading"
	>
		<div class="flex min-w-0 flex-col justify-center">
			<p class="text-sm font-semibold text-organic-rust">{experience.accessLabel}</p>
			<p class="mt-4 text-sm text-muted">Welcome back, {displayName}</p>
			<h1
				id="dashboard-heading"
				class="mt-2 max-w-3xl font-serif text-4xl font-medium leading-tight tracking-tight text-ink sm:text-5xl"
			>
				{experience.headline}
			</h1>
			<p class="mt-4 max-w-2xl text-base leading-7 text-muted sm:text-lg sm:leading-8">
				{experience.introduction}
			</p>

			{#if hasWorkspaceAccess}
				<dl class="mt-8 grid max-w-2xl grid-cols-3 border-y border-line">
					<div class="py-4 pr-4">
						<dt class="text-xs text-muted">Tracked coffees</dt>
						<dd class="mt-1 font-serif text-2xl font-medium text-ink">{trackedLots.length}</dd>
					</div>
					<div class="border-l border-line px-4 py-4">
						<dt class="text-xs text-muted">Need attention</dt>
						<dd class="mt-1 font-serif text-2xl font-medium text-ink">
							{attentionTrackedCount}
						</dd>
					</div>
					<div class="border-l border-line py-4 pl-4">
						<dt class="text-xs text-muted">Active briefs</dt>
						<dd class="mt-1 font-serif text-2xl font-medium text-ink">{activeBriefs.length}</dd>
					</div>
				</dl>
			{/if}
		</div>

		<div
			class="flex min-w-0 flex-col justify-between rounded-lg bg-ink p-6 text-on-dark shadow-sm sm:p-7"
		>
			<div>
				<div class="flex flex-wrap items-center justify-between gap-3">
					<p class="text-xs font-semibold text-accent">Cherry AI</p>
					<span
						class="rounded-full border border-on-dark/20 px-2.5 py-1 text-[11px] text-on-dark/70"
					>
						{experience.agent ? 'Ready in your workspace' : 'Available with a plan'}
					</span>
				</div>
				<h2 class="mt-5 font-serif text-2xl font-medium leading-tight text-on-dark sm:text-3xl">
					{experience.agent?.name ?? 'Coffee-native AI for the work ahead'}
				</h2>
				<p class="mt-3 text-sm leading-6 text-on-dark/70">
					{experience.agent?.shortDescription ?? experience.focusQuestion}
				</p>
				{#if experience.agent}
					<div class="mt-6 border-l-2 border-accent pl-4">
						<p class="text-sm leading-6 text-on-dark/85">{experience.focusQuestion}</p>
					</div>
				{/if}
			</div>
			<a
				href={chatHref}
				class="mt-7 inline-flex w-fit items-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-ink transition-opacity hover:opacity-90"
			>
				{experience.agent ? `Open ${experience.agent.name}` : 'Explore Cherry AI plans'}
				<span aria-hidden="true">→</span>
			</a>
		</div>
	</section>

	{#if hasWorkspaceAccess}
		<section
			class="space-y-5"
			aria-labelledby="continue-heading"
			aria-label="Your sourcing workspace"
		>
			<div class="max-w-3xl">
				<p class="text-sm font-semibold text-organic-rust">Live workspace</p>
				<h2 id="continue-heading" class="mt-1 font-serif text-3xl font-medium text-ink">
					Continue your work
				</h2>
				<p class="mt-2 text-sm leading-6 text-muted">
					Review the changes that can alter a sourcing decision, then pick up the briefs you already
					started.
				</p>
			</div>

			<div class="grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.55fr)]">
				<div class="min-w-0 rounded-lg border border-line bg-surface-panel">
					<div
						class="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4"
					>
						<div>
							<h3 class="font-semibold text-ink">Tracked coffees</h3>
							<p class="mt-0.5 text-xs text-muted">
								Price and availability since you started watching
							</p>
						</div>
						<a href="/catalog?tracked=only" class="text-sm font-semibold text-link hover:text-ink">
							Open watchlist <span aria-hidden="true">→</span>
						</a>
					</div>

					{#if trackedLots.length === 0}
						<div class="px-5 py-8">
							<p class="font-medium text-ink">Nothing tracked yet.</p>
							<p class="mt-2 max-w-xl text-sm leading-6 text-muted">
								Track a coffee in the catalog and this dashboard will surface price movement and
								delistings.
							</p>
							<a
								href="/catalog"
								class="mt-4 inline-block text-sm font-semibold text-link hover:text-ink"
							>
								Find coffees to track <span aria-hidden="true">→</span>
							</a>
						</div>
					{:else}
						<ul class="divide-y divide-line">
							{#each trackedLots.slice(0, 5) as lot (lot.catalogId)}
								<li>
									<a
										href={`/catalog?coffee=${lot.catalogId}`}
										class="grid min-w-0 gap-2 px-5 py-4 transition-colors hover:bg-surface-canvas sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
									>
										<div class="min-w-0">
											<p class="font-medium leading-6 text-ink">{lot.name}</p>
											<p class="mt-0.5 text-xs leading-5 text-muted">{trackedLotContext(lot)}</p>
										</div>
										<div class="sm:text-right">
											<p class="text-sm font-semibold text-ink">
												{lot.currentPrice === null
													? 'Price unavailable'
													: formatPricePerLb(lot.currentPrice)}
											</p>
											<p
												class="mt-0.5 text-xs {lot.stocked === false || (lot.priceDelta ?? 0) > 0
													? 'text-organic-rust'
													: 'text-muted'}"
											>
												{trackedLotChange(lot)}
											</p>
										</div>
									</a>
								</li>
							{/each}
						</ul>
						{#if experience.agent}
							<div class="border-t border-line px-5 py-3">
								<a
									href={cherryHref(
										'Review the price and availability changes across my tracked coffees. What should I investigate first?'
									)}
									class="text-sm font-semibold text-link hover:text-ink"
								>
									Review tracked changes with {experience.agent.name}
									<span aria-hidden="true">→</span>
								</a>
							</div>
						{/if}
					{/if}
				</div>

				<div class="min-w-0 rounded-lg border border-line bg-surface-panel">
					<div class="border-b border-line px-5 py-4">
						<h3 class="font-semibold text-ink">Active sourcing briefs</h3>
						<p class="mt-0.5 text-xs text-muted">Saved needs you can continue now</p>
					</div>
					{#if activeBriefs.length === 0}
						<div class="px-5 py-8">
							<p class="text-sm leading-6 text-muted">
								No active sourcing briefs. Create one through the
								<a
									href="https://api.purveyors.io/docs"
									class="font-semibold text-link hover:text-ink">Parchment API docs</a
								>.
							</p>
						</div>
					{:else}
						<ul class="divide-y divide-line">
							{#each activeBriefs.slice(0, 4) as brief (brief.id)}
								<li>
									<a href={brief.catalogHref} class="block px-5 py-4 hover:bg-surface-canvas">
										<p class="font-medium leading-6 text-ink">{brief.name}</p>
										<p class="mt-1 text-xs leading-5 text-muted">{brief.criteriaDescription}</p>
										<p class="mt-2 text-xs font-semibold text-link">View matching coffees →</p>
									</a>
								</li>
							{/each}
						</ul>
						{#if experience.agent}
							<div class="border-t border-line px-5 py-3">
								<a
									href={cherryHref(
										'Compare my active sourcing briefs with current supply and help me decide which one to pursue first.'
									)}
									class="text-sm font-semibold text-link hover:text-ink"
								>
									Prioritize briefs with {experience.agent.name}
									<span aria-hidden="true">→</span>
								</a>
							</div>
						{/if}
					{/if}
				</div>
			</div>
		</section>
	{/if}

	<section class="space-y-5" aria-labelledby="start-heading">
		<div class="max-w-3xl">
			<p class="text-sm font-semibold text-organic-rust">Next actions</p>
			<h2 id="start-heading" class="mt-1 font-serif text-3xl font-medium text-ink">
				Start something
			</h2>
			<p class="mt-2 text-sm leading-6 text-muted">
				Choose the next useful task for your {experience.accessLabel} workspace.
			</p>
		</div>

		<div
			class="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 lg:grid-cols-4"
		>
			{#each experience.tasks as task}
				<a
					href={task.href}
					class="group min-w-0 bg-surface-panel p-5 transition-colors hover:bg-surface-raised"
				>
					<p class="text-xs font-semibold text-organic-rust">{task.eyebrow}</p>
					<h3 class="mt-3 font-serif text-xl font-medium leading-6 text-ink">{task.title}</h3>
					<p class="mt-2 text-sm leading-6 text-muted">{task.description}</p>
					<p class="mt-5 text-sm font-semibold text-link transition-colors group-hover:text-ink">
						Continue <span aria-hidden="true">→</span>
					</p>
				</a>
			{/each}
		</div>
	</section>

	<section
		class="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(19rem,0.65fr)]"
		aria-labelledby="arrivals-heading"
	>
		<div class="min-w-0 rounded-lg border border-line bg-surface-panel">
			<div class="flex flex-wrap items-end justify-between gap-3 border-b border-line px-5 py-4">
				<div>
					<p class="text-xs font-semibold text-organic-rust">Live market proof</p>
					<h2 id="arrivals-heading" class="mt-1 font-serif text-2xl font-medium text-ink">
						Recent arrivals
					</h2>
				</div>
				<a href="/catalog" class="text-sm font-semibold text-link hover:text-ink">
					Research full catalog <span aria-hidden="true">→</span>
				</a>
			</div>
			{#if recentArrivals.length === 0}
				<p class="px-5 py-8 text-sm leading-6 text-muted">
					Current arrivals are temporarily unavailable. The dashboard remains ready for your saved
					work.
				</p>
			{:else}
				<ul class="grid sm:grid-cols-2">
					{#each recentArrivals.slice(0, 6) as coffee, index (coffee.id)}
						<li
							class="min-w-0 border-line {index > 0 ? 'border-t' : ''} {index === 1
								? 'sm:border-t-0'
								: ''} {index % 2 === 1 ? 'sm:border-l' : ''}"
						>
							<a
								href={`/catalog?coffee=${coffee.id}`}
								class="block min-w-0 p-5 hover:bg-surface-canvas"
							>
								<div class="flex min-w-0 items-start justify-between gap-4">
									<div class="min-w-0">
										<h3 class="font-medium leading-6 text-ink">{coffee.name}</h3>
										<p class="mt-1 text-xs leading-5 text-muted">{arrivalContext(coffee)}</p>
									</div>
									<p class="shrink-0 text-sm font-semibold text-ink">{arrivalPrice(coffee)}</p>
								</div>
							</a>
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		{#if upgradePrompt}
			<aside class="rounded-lg border border-accent/30 bg-accent-subtle/10 p-5">
				<p class="text-xs font-semibold text-organic-rust">Extend the system</p>
				<h2 class="mt-2 font-serif text-2xl font-medium leading-tight text-ink">
					{upgradePrompt.headline}
				</h2>
				<p class="mt-3 text-sm leading-6 text-muted">{upgradePrompt.body}</p>
				<a
					href={upgradePrompt.href}
					class="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-link hover:text-ink"
				>
					{upgradePrompt.cta} <span aria-hidden="true">→</span>
				</a>
			</aside>
		{:else}
			<aside class="rounded-lg border border-line bg-surface-panel p-5">
				<p class="text-xs font-semibold text-organic-rust">Build on Purveyors</p>
				<h2 class="mt-2 font-serif text-2xl font-medium leading-tight text-ink">
					Take the same coffee data beyond the browser.
				</h2>
				<p class="mt-3 text-sm leading-6 text-muted">
					Use Parchment Console for keys and usage, or open the Parchment API documentation for
					integrations and agents.
				</p>
				<div class="mt-5 flex flex-col gap-2 text-sm font-semibold">
					<a href="/api-dashboard" class="text-link hover:text-ink">Open Parchment Console →</a>
					<a href="/docs" class="text-link hover:text-ink">Read Parchment API docs →</a>
				</div>
			</aside>
		{/if}
	</section>
</div>
