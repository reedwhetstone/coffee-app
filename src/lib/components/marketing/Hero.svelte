<script lang="ts">
	import { goto } from '$app/navigation';
	import { checkRole, type PageAuthView } from '$lib/types/auth.types';
	import OrganicBand from '$lib/components/marketing/OrganicBand.svelte';

	let { auth } = $props<{ auth: PageAuthView }>();

	let isSignedIn = $derived(auth.isSignedIn);
	let canAccessMemberRoutes = $derived(checkRole(auth.role, 'member'));
	let userLabel = $derived(auth.user?.email?.split('@')[0] ?? 'there');

	const groundedSteps = [
		{
			label: 'Read the market',
			body: 'Find arrivals, delistings, supplier changes, and price movement.'
		},
		{
			label: 'Check the evidence',
			body: 'Compare live offers with origin benchmarks and price history.'
		},
		{
			label: 'Move the work forward',
			body: 'Build a shortlist, update your portfolio, or open the underlying records.'
		}
	] as const;
</script>

<section
	class="texture-grain relative overflow-hidden bg-gradient-to-br from-surface-canvas via-surface-canvas to-intelligence-subtle/50"
>
	<div
		class="absolute -right-40 -top-40 h-96 w-96 rounded-full border border-intelligence/15"
		aria-hidden="true"
	></div>
	<div
		class="absolute -right-16 top-20 h-64 w-64 rounded-full border border-accent/20"
		aria-hidden="true"
	></div>

	<div
		class="relative mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:gap-16 lg:px-8 lg:py-24"
	>
		<div>
			{#if isSignedIn}
				<div
					class="mb-6 inline-flex items-center rounded-full border border-accent/20 bg-accent/10 px-4 py-1.5 text-sm font-medium text-accent"
				>
					Welcome back, {userLabel}. Your coffee context is ready.
				</div>
			{:else}
				<div
					class="mb-6 inline-flex items-center gap-2 rounded-full border border-intelligence/25 bg-intelligence-subtle px-4 py-1.5 text-sm font-semibold text-intelligence-strong"
				>
					<svg
						class="h-4 w-4"
						viewBox="0 0 20 20"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
						aria-hidden="true"
					>
						<path
							d="M10 2.5v3M10 14.5v3M2.5 10h3M14.5 10h3M4.7 4.7l2.1 2.1M13.2 13.2l2.1 2.1M15.3 4.7l-2.1 2.1M6.8 13.2l-2.1 2.1"
						/>
						<circle cx="10" cy="10" r="3.25" />
					</svg>
					AI-native coffee intelligence
				</div>
			{/if}

			<h1 class="font-serif text-5xl font-medium tracking-tight text-ink sm:text-6xl lg:text-7xl">
				Coffee intelligence you can ask, act on, and build with.
			</h1>
			<p class="mt-6 max-w-2xl text-lg leading-8 text-muted">
				Purveyors connects daily-normalized market data, your roastery records, and Ask Parchment in
				one coffee-native system. See the market, investigate the evidence, and carry the decision
				into real work.
			</p>

			<div class="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
				<button
					onclick={() => goto('/analytics')}
					class="rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-ink shadow-sm transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
				>
					Explore the Market Index
				</button>
				<a
					href="/subscription#ask-parchment-details"
					class="rounded-xl border border-intelligence/35 bg-surface-canvas px-6 py-3 text-center text-sm font-semibold text-intelligence-strong transition-colors hover:border-intelligence hover:bg-intelligence-subtle"
				>
					See Ask Parchment
				</a>
				<button
					onclick={() => goto('/catalog')}
					class="px-3 py-3 text-sm font-semibold text-ink transition-colors hover:text-accent"
				>
					Browse the catalog <span aria-hidden="true">→</span>
				</button>
			</div>

			{#if isSignedIn && canAccessMemberRoutes}
				<div class="mt-5 flex flex-wrap items-center gap-4 text-sm">
					<button
						onclick={() => goto('/beans')}
						class="font-medium text-muted transition-colors hover:text-accent"
					>
						Open inventory
					</button>
					<button
						onclick={() => goto('/roast')}
						class="font-medium text-muted transition-colors hover:text-accent"
					>
						Open roast workspace
					</button>
				</div>
			{:else if !isSignedIn}
				<p class="mt-5 text-sm text-muted">
					The catalog and core Market Index are free to explore. <a
						href="/auth"
						class="font-semibold text-link hover:text-accent">Sign in</a
					>
					to keep your work together.
				</p>
			{/if}
		</div>

		<div id="ai-workbench" class="relative scroll-mt-24">
			<div class="absolute -inset-4 rotate-1 rounded-[2rem] bg-accent/10" aria-hidden="true"></div>
			<div
				class="relative overflow-hidden rounded-3xl border border-line bg-surface-raised shadow-xl"
			>
				<div class="flex items-center justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
					<div class="flex items-center gap-3">
						<span
							class="flex h-10 w-10 items-center justify-center rounded-xl bg-intelligence text-white"
						>
							<svg
								class="h-5 w-5"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="1.5"
								aria-hidden="true"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.847-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.847a4.5 4.5 0 003.09 3.09L15.75 12l-2.847.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.456-2.456L14.25 6l1.035-.259a3.375 3.375 0 002.456-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"
								/>
							</svg>
						</span>
						<div>
							<p class="font-semibold text-ink">Ask Parchment</p>
							<p class="text-xs text-muted">Grounded in coffee data and your workflow</p>
						</div>
					</div>
					<span
						class="rounded-full bg-success-subtle px-3 py-1 text-xs font-semibold text-success-strong"
					>
						AI workbench
					</span>
				</div>

				<div class="p-5 sm:p-6">
					<div class="rounded-2xl bg-intelligence-subtle p-5">
						<p class="text-xs font-semibold text-intelligence-strong">A sourcing question</p>
						<p class="mt-2 font-serif text-xl font-medium leading-7 text-ink sm:text-2xl">
							“Which coffees merit a closer look this week?”
						</p>
					</div>

					<div class="mt-4 space-y-3">
						{#each groundedSteps as step, index}
							<div class="flex gap-4 rounded-2xl border border-line bg-surface-canvas p-4">
								<span
									class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-bold text-ink"
								>
									{index + 1}
								</span>
								<div>
									<p class="text-sm font-semibold text-ink">{step.label}</p>
									<p class="mt-1 text-sm leading-5 text-muted">{step.body}</p>
								</div>
							</div>
						{/each}
					</div>

					<div class="mt-4 flex flex-wrap gap-2 text-xs text-muted">
						<span class="rounded-full border border-line px-3 py-1">40+ supplier catalogs</span>
						<span class="rounded-full border border-line px-3 py-1">Market history</span>
						<span class="rounded-full border border-line px-3 py-1">Roaster context</span>
					</div>
				</div>
			</div>
		</div>
	</div>

	<div class="relative border-t border-line bg-surface-panel/80">
		<div
			class="mx-auto grid max-w-7xl grid-cols-2 gap-px px-4 py-5 text-center sm:grid-cols-4 sm:px-6 lg:px-8"
		>
			<div class="px-3 py-2">
				<p class="text-sm font-semibold text-ink">Normalized daily</p>
				<p class="mt-1 text-xs text-muted">One consistent coffee schema</p>
			</div>
			<div class="px-3 py-2">
				<p class="text-sm font-semibold text-ink">40+ importers</p>
				<p class="mt-1 text-xs text-muted">One live market view</p>
			</div>
			<div class="px-3 py-2">
				<p class="text-sm font-semibold text-ink">Coffee-native AI</p>
				<p class="mt-1 text-xs text-muted">Grounded tools, not generic chat</p>
			</div>
			<div class="px-3 py-2">
				<p class="text-sm font-semibold text-ink">Built to connect</p>
				<p class="mt-1 text-xs text-muted">Web, API, CLI, and agents</p>
			</div>
		</div>
	</div>

	<div class="h-3 w-full overflow-hidden sm:h-4" aria-hidden="true">
		<OrganicBand />
	</div>
</section>
