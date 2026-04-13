<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import { checkRole } from '$lib/types/auth.types';
	import { parseTastingNotes } from '$lib/utils/parseTastingNotes';

	import Hero from '$lib/components/marketing/Hero.svelte';
	import LazyLoad from '$lib/components/LazyLoad.svelte';
	import CoffeeCard from '$lib/components/CoffeeCard.svelte';

	let { data } = $props<{ data: PageData }>();

	let isSignedIn = $derived(Boolean(data.session?.user));
	let canAccessMemberRoutes = $derived(checkRole(data.role ?? 'viewer', 'member'));
</script>

<div class="min-h-screen">
	<Hero session={data.session} role={data.role} />

	{#if data?.data?.length > 0}
		<section class="bg-background-secondary-light py-16">
			<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
				<div class="mb-12 text-center">
					<h2 class="text-3xl font-bold text-text-primary-light sm:text-4xl">
						Live Green Coffee Market Preview
					</h2>
					<p class="mx-auto mt-4 max-w-3xl text-lg text-text-secondary-light">
						Recent stocked coffees from the normalized Purveyors catalog. See the market first, then
						sign in when you want Mallard Studio workflows, Parchment Intelligence, and deeper
						operating tools.
					</p>
				</div>

				<div class="mb-8 text-center">
					{#if isSignedIn}
						<p class="text-text-secondary-light">
							The homepage stays public-first, but your faster path is still here. Browse live
							arrivals or jump back into your dashboard whenever you are ready.
						</p>
					{:else}
						<p class="text-text-secondary-light">
							The public catalog is open now. Free accounts get you started, then Mallard Studio and
							Parchment Intelligence unlock deeper operating leverage.
						</p>
					{/if}
				</div>

				<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
					{#each data.data.slice(0, 6) as coffee}
						<CoffeeCard {coffee} {parseTastingNotes} />
					{/each}
				</div>

				<div class="py-8 text-center">
					<div
						class="rounded-lg border border-background-tertiary-light/20 bg-background-primary-light p-8"
					>
						{#if isSignedIn}
							<h3 class="mb-2 text-xl font-semibold text-text-primary-light">
								Keep sourcing, or jump back into operations
							</h3>
							<p class="mb-4 text-text-secondary-light">
								Open your dashboard to manage inventory, roasts, and analytics, or keep exploring
								the live catalog.
							</p>
							<div class="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
								<button
									onclick={() => goto('/dashboard')}
									class="rounded-md bg-background-tertiary-light px-8 py-3 font-medium text-white transition-all duration-200 hover:bg-opacity-90"
								>
									Dashboard
								</button>
								<button
									onclick={() => goto('/catalog')}
									class="rounded-md border border-background-tertiary-light px-6 py-3 text-background-tertiary-light transition-all duration-200 hover:bg-background-tertiary-light hover:text-white"
								>
									Browse Full Catalog
								</button>
							</div>
							{#if canAccessMemberRoutes}
								<div class="mt-4 flex flex-wrap items-center justify-center gap-4 text-sm">
									<button
										onclick={() => goto('/beans')}
										class="font-medium text-text-secondary-light transition-colors duration-200 hover:text-background-tertiary-light"
									>
										Inventory
									</button>
									<button
										onclick={() => goto('/roast')}
										class="font-medium text-text-secondary-light transition-colors duration-200 hover:text-background-tertiary-light"
									>
										Roast
									</button>
								</div>
							{/if}
						{:else}
							<h3 class="mb-2 text-xl font-semibold text-text-primary-light">
								Browse the live catalog, then go deeper when you need to
							</h3>
							<p class="mb-4 text-text-secondary-light">
								Start with the public catalog today. Create a free account when you want Explorer,
								then add Mallard Studio Member or Parchment Intelligence as your use case deepens.
							</p>
							<div class="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
								<button
									onclick={() => goto('/catalog')}
									class="rounded-md bg-background-tertiary-light px-8 py-3 font-medium text-white transition-all duration-200 hover:bg-opacity-90"
								>
									Browse Full Catalog
								</button>
								<button
									onclick={() => goto('/api')}
									class="rounded-md border border-background-tertiary-light px-6 py-3 text-background-tertiary-light transition-all duration-200 hover:bg-background-tertiary-light hover:text-white"
								>
									View API Documentation
								</button>
							</div>
							<p class="mt-4 text-sm text-text-secondary-light">
								Prefer to start saving work right away? <a
									href="/auth"
									class="font-medium text-background-tertiary-light hover:underline"
									>Create a free account</a
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
					<p class="text-text-secondary-light">Content temporarily unavailable</p>
				</div>
			{/await}
		{/snippet}
	</LazyLoad>
	<LazyLoad threshold={0.3} rootMargin="200px">
		{#snippet children()}
			{#await import('$lib/components/marketing/Pricing.svelte') then module}
				{@const Pricing = module.default}
				<Pricing session={data.session} />
			{:catch}
				<div class="py-16 text-center">
					<p class="text-text-secondary-light">Content temporarily unavailable</p>
				</div>
			{/await}
		{/snippet}
	</LazyLoad>
	<LazyLoad threshold={0.3} rootMargin="200px">
		{#snippet children()}
			{#await import('$lib/components/marketing/CTA.svelte') then module}
				{@const CTA = module.default}
				<CTA session={data.session} />
			{:catch}
				<div class="py-16 text-center">
					<p class="text-text-secondary-light">Content temporarily unavailable</p>
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
					<p class="text-text-secondary-light">Content temporarily unavailable</p>
				</div>
			{/await}
		{/snippet}
	</LazyLoad>
</div>
