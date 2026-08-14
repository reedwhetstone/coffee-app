<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { checkRole } from '$lib/types/auth.types';
	import { parseTastingNotes } from '$lib/utils/parseTastingNotes';

	import Hero from '$lib/components/marketing/Hero.svelte';
	import PersonaRouter from '$lib/components/marketing/PersonaRouter.svelte';
	import LazyLoad from '$lib/components/LazyLoad.svelte';
	import CoffeeCard from '$lib/components/CoffeeCard.svelte';

	let { data } = $props<{ data: PageData }>();

	let isSignedIn = $derived(data.auth.isSignedIn);
	let canAccessMemberRoutes = $derived(checkRole(data.auth.role, 'member'));
	let accountDeletionAccepted = $state(false);

	onMount(() => {
		accountDeletionAccepted =
			sessionStorage.getItem('purveyors:account-deletion-accepted') === 'true';
		if (accountDeletionAccepted) {
			sessionStorage.removeItem('purveyors:account-deletion-accepted');
		}
	});
</script>

<div class="min-h-screen">
	{#if accountDeletionAccepted}
		<div
			class="border-b border-success/30 bg-success-subtle px-4 py-3 text-center text-sm font-medium text-success-strong"
			role="status"
		>
			Your account deletion request was accepted. Purveyors is securely finishing cleanup; no
			further action is needed.
		</div>
	{/if}
	<Hero auth={data.auth} />

	<PersonaRouter />

	{#if data?.data?.length > 0}
		<section class="bg-surface-panel py-16">
			<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
				<div class="mb-12 text-center">
					<h2 class="font-serif text-3xl font-medium tracking-tight text-ink sm:text-4xl">
						Current offer list across 40+ importers.
					</h2>
					<p class="mx-auto mt-4 max-w-3xl text-lg text-muted">
						Live green coffee availability from US specialty importers, normalized by origin,
						process, score, and price. Updated daily.
					</p>
				</div>

				<div class="mb-8 text-center">
					{#if isSignedIn}
						<p class="text-muted">
							See what is on offer today. Head to the Market Index for market context, or to your
							dashboard for production workflows.
						</p>
					{:else}
						<p class="text-muted">
							The catalog is public. Sign in to save searches or access Intelligence features.
						</p>
					{/if}
				</div>

				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
					{#each data.data.slice(0, 6) as coffee}
						<CoffeeCard {coffee} {parseTastingNotes} />
					{/each}
				</div>

				<div class="py-8 text-center">
					<div class="rounded-lg border border-accent/20 bg-surface-canvas p-8">
						{#if isSignedIn}
							<h3 class="mb-2 text-xl font-semibold text-ink">
								See the full catalog or check the Market Index.
							</h3>
							<p class="mb-4 text-muted">
								Browse all current lots or pull up price movement and origin benchmarks for your
								next sourcing call.
							</p>
							<div class="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
								<button
									onclick={() => goto('/catalog')}
									class="rounded-md bg-accent px-8 py-3 font-medium text-ink transition-all duration-200 hover:bg-opacity-90"
								>
									Browse the full catalog
								</button>
								<button
									onclick={() => goto('/analytics')}
									class="rounded-md border border-accent px-6 py-3 text-accent transition-all duration-200 hover:bg-accent hover:text-ink"
								>
									Open the Market Index
								</button>
							</div>
							{#if canAccessMemberRoutes}
								<div class="mt-4 flex flex-wrap items-center justify-center gap-4 text-sm">
									<button
										onclick={() => goto('/beans')}
										class="font-medium text-muted transition-colors duration-200 hover:text-accent"
									>
										Inventory
									</button>
									<button
										onclick={() => goto('/roast')}
										class="font-medium text-muted transition-colors duration-200 hover:text-accent"
									>
										Roast
									</button>
								</div>
							{/if}
						{:else}
							<h3 class="mb-2 text-xl font-semibold text-ink">
								Ready to source with the full market in view?
							</h3>
							<p class="mb-4 text-muted">
								Daily market intelligence, supplier coverage, and origin benchmarks from 40+
								importers. Free to explore.
							</p>
							<div class="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
								<button
									onclick={() => goto('/analytics')}
									class="rounded-md bg-accent px-8 py-3 font-medium text-ink transition-all duration-200 hover:bg-opacity-90"
								>
									Explore the Market Index
								</button>
								<button
									onclick={() => goto('/catalog')}
									class="rounded-md border border-accent px-6 py-3 text-accent transition-all duration-200 hover:bg-accent hover:text-ink"
								>
									Browse the full catalog
								</button>
							</div>
							<p class="mt-4 text-sm text-muted">
								Need structured data? <a href="/api" class="font-medium text-accent hover:underline"
									>Parchment API</a
								>.
							</p>
						{/if}
					</div>
				</div>
			</div>
		</section>
	{/if}

	<LazyLoad threshold={0.3} rootMargin="200px">
		{#snippet children()}
			{#await import('$lib/components/marketing/Features.svelte') then module}
				{@const Features = module.default}
				<Features />
			{:catch}
				<div class="py-16 text-center">
					<p class="text-muted">Content temporarily unavailable</p>
				</div>
			{/await}
		{/snippet}
	</LazyLoad>
	<LazyLoad threshold={0.3} rootMargin="200px">
		{#snippet children()}
			{#await import('$lib/components/marketing/Pricing.svelte') then module}
				{@const Pricing = module.default}
				<Pricing auth={data.auth} />
			{:catch}
				<div class="py-16 text-center">
					<p class="text-muted">Content temporarily unavailable</p>
				</div>
			{/await}
		{/snippet}
	</LazyLoad>
	<LazyLoad threshold={0.3} rootMargin="200px">
		{#snippet children()}
			{#await import('$lib/components/marketing/CTA.svelte') then module}
				{@const CTA = module.default}
				<CTA auth={data.auth} />
			{:catch}
				<div class="py-16 text-center">
					<p class="text-muted">Content temporarily unavailable</p>
				</div>
			{/await}
		{/snippet}
	</LazyLoad>
	<LazyLoad threshold={0.3} rootMargin="200px">
		{#snippet children()}
			{#await import('$lib/components/marketing/Footer.svelte') then module}
				{@const Footer = module.default}
				<Footer />
			{:catch}
				<div class="py-8 text-center">
					<p class="text-muted">Content temporarily unavailable</p>
				</div>
			{/await}
		{/snippet}
	</LazyLoad>
</div>
