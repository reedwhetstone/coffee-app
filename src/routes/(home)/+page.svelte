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
						Browse current coffees before you commit to anything else
					</h2>
					<p class="mx-auto mt-4 max-w-3xl text-lg text-text-secondary-light">
						See recent supplier availability in one place, compare likely fits faster, and move into
						workflow, API, or analytics tools only if you need them.
					</p>
				</div>

				<div class="mb-8 text-center">
					{#if isSignedIn}
						<p class="text-text-secondary-light">
							Keep using the public market view to source, then return to your dashboard when you
							need operations tools.
						</p>
					{:else}
						<p class="text-text-secondary-light">
							The catalog is open now. Create an account later if you want saved work or paid
							access.
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
								Keep comparing coffees, or return to your workspace
							</h3>
							<p class="mb-4 text-text-secondary-light">
								Open your dashboard for Mallard Studio workflows, or stay in the catalog to keep
								sourcing.
							</p>
							<div class="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
								<button
									onclick={() => goto('/catalog')}
									class="rounded-md bg-background-tertiary-light px-8 py-3 font-medium text-white transition-all duration-200 hover:bg-opacity-90"
								>
									Browse full catalog
								</button>
								<button
									onclick={() => goto('/dashboard')}
									class="rounded-md border border-background-tertiary-light px-6 py-3 text-background-tertiary-light transition-all duration-200 hover:bg-background-tertiary-light hover:text-white"
								>
									Open dashboard
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
								Start with the catalog, then choose the right next step
							</h3>
							<p class="mb-4 text-text-secondary-light">
								Use the public catalog to compare coffees first. Move into Mallard Studio, Parchment
								API, or Parchment Intelligence only when your work calls for it.
							</p>
							<div class="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
								<button
									onclick={() => goto('/catalog')}
									class="rounded-md bg-background-tertiary-light px-8 py-3 font-medium text-white transition-all duration-200 hover:bg-opacity-90"
								>
									Browse full catalog
								</button>
								<button
									onclick={() => goto('/subscription')}
									class="rounded-md border border-background-tertiary-light px-6 py-3 text-background-tertiary-light transition-all duration-200 hover:bg-background-tertiary-light hover:text-white"
								>
									See plans
								</button>
							</div>
							<p class="mt-4 text-sm text-text-secondary-light">
								Need structured data instead? <a
									href="/api"
									class="font-medium text-background-tertiary-light hover:underline"
									>Explore the API</a
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
