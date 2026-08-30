<script lang="ts">
	import { goto } from '$app/navigation';
	import { checkRole, type PageAuthView } from '$lib/types/auth.types';

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

<section class="border-b border-line bg-surface-panel">
	<div
		class="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-end lg:gap-14 lg:px-8 lg:py-20"
	>
		<div>
			{#if isSignedIn}
				<p class="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
					Welcome back, {userLabel}. Your coffee context is ready.
				</p>
			{:else}
				<p class="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
					Coffee-native AI from Purveyors
				</p>
			{/if}

			<h1
				class="mt-4 max-w-4xl font-serif text-4xl font-medium tracking-tight text-ink sm:text-6xl"
			>
				Coffee intelligence you can ask, act on, and build with.
			</h1>
			<p class="mt-6 max-w-3xl text-lg leading-8 text-muted">
				Purveyors connects daily-normalized market data, your roastery records, and Cherry in one
				coffee-native system. See the market, investigate the evidence, and carry the decision into
				real work.
			</p>

			<div class="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
				<button
					onclick={() => goto('/analytics')}
					class="rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-ink transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
				>
					Explore the Market Index
				</button>
				<a
					href="/subscription#cherry-details"
					class="rounded-lg border border-line bg-surface-canvas px-6 py-3 text-center text-sm font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
				>
					See Cherry
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

		<div id="cherry" class="scroll-mt-24 overflow-hidden rounded-2xl bg-line ring-1 ring-line">
			<div class="bg-surface-canvas p-5 sm:p-6">
				<p class="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Cherry</p>
				<p class="mt-3 font-serif text-2xl font-medium leading-8 text-ink">
					Which coffees merit a closer look this week?
				</p>
				<p class="mt-3 text-sm leading-6 text-muted">
					Cherry Runtime works from the coffee data, tools, and records your plan unlocks.
				</p>
			</div>
			<ol class="grid gap-px bg-line">
				{#each groundedSteps as step, index}
					<li class="flex gap-4 bg-surface-panel p-5">
						<span class="text-sm font-semibold text-accent">0{index + 1}</span>
						<div>
							<p class="text-sm font-semibold text-ink">{step.label}</p>
							<p class="mt-1 text-sm leading-6 text-muted">{step.body}</p>
						</div>
					</li>
				{/each}
			</ol>
			<dl class="grid grid-cols-3 gap-px bg-line text-center">
				<div class="bg-surface-canvas p-3">
					<dt class="text-xs text-muted">Catalogs</dt>
					<dd class="mt-1 text-sm font-semibold text-ink">40+</dd>
				</div>
				<div class="bg-surface-canvas p-3">
					<dt class="text-xs text-muted">Market</dt>
					<dd class="mt-1 text-sm font-semibold text-ink">Daily</dd>
				</div>
				<div class="bg-surface-canvas p-3">
					<dt class="text-xs text-muted">Context</dt>
					<dd class="mt-1 text-sm font-semibold text-ink">Plan-aware</dd>
				</div>
			</dl>
		</div>
	</div>
</section>
