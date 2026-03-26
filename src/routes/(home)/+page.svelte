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

	{#if data?.data?.length > 0}
		<div class="bg-background-secondary-light py-16">
			<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
				<div class="mb-12 text-center">
					<h2 class="text-3xl font-bold text-text-primary-light sm:text-4xl">
						Explore Our Coffee Marketplace
					</h2>
					<p class="mt-4 text-lg text-text-secondary-light">
						Browse our curated selection of premium coffee beans from around the world
					</p>
				</div>

				<div class="mb-8 text-center">
					{#if isSignedIn}
						<p class="text-text-secondary-light">
							The public homepage stays public-first. Jump into your dashboard or browse the full
							catalog whenever you're ready.
						</p>
					{:else}
						<p class="text-text-secondary-light">
							Sign in with the header above to access AI recommendations, inventory tracking, and
							full catalog search
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
							<h3 class="mb-2 text-xl font-semibold text-text-primary-light">Back to work?</h3>
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
							<h3 class="mb-2 text-xl font-semibold text-text-primary-light">Want to see more?</h3>
							<p class="mb-4 text-text-secondary-light">
								Sign up to browse our full catalog of hundreds of premium coffee beans
							</p>
							<div class="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
								<button
									onclick={() => goto('/auth')}
									class="rounded-md bg-background-tertiary-light px-8 py-3 font-medium text-white transition-all duration-200 hover:bg-opacity-90"
								>
									Sign Up Free - No Credit Card Required
								</button>
								<button
									onclick={() => goto('/api')}
									class="rounded-md border border-background-tertiary-light px-6 py-3 text-background-tertiary-light transition-all duration-200 hover:bg-background-tertiary-light hover:text-white"
								>
									View API Documentation
								</button>
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>
