<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';

	// Marketing components
	import Hero from '$lib/components/marketing/Hero.svelte';
	import LazyLoad from '$lib/components/LazyLoad.svelte';
	import CoffeeCard from '$lib/components/CoffeeCard.svelte';
	import type { TastingNotes } from '$lib/types/coffee.types';

	let { data } = $props<{ data: PageData }>();

	// Client-side redirect for authenticated users - avoids server round-trip
	$effect(() => {
		if (data.session) {
			goto('/catalog', { replaceState: true });
		}
	});

	/**
	 * Parses AI tasting notes JSON data safely
	 * @param tastingNotesJson - JSON string from database
	 * @returns Parsed tasting notes or null if invalid
	 */
	function parseTastingNotes(tastingNotesJson: string | null | object): TastingNotes | null {
		if (!tastingNotesJson) return null;

		try {
			// Handle both string and object formats (Supabase jsonb can return either)
			let parsed: any;
			if (typeof tastingNotesJson === 'string') {
				parsed = JSON.parse(tastingNotesJson);
			} else if (typeof tastingNotesJson === 'object') {
				parsed = tastingNotesJson;
			} else {
				return null;
			}

			// Validate that required properties exist
			if (
				parsed.body &&
				parsed.flavor &&
				parsed.acidity &&
				parsed.sweetness &&
				parsed.fragrance_aroma
			) {
				return parsed as TastingNotes;
			}
		} catch (error) {
			console.warn('Failed to parse tasting notes:', error, 'Input:', tastingNotesJson);
		}
		return null;
	}
</script>

<!-- Marketing Landing Page for Non-Authenticated Users -->
<div class="min-h-screen">
	<Hero />
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
	<!-- <Testimonials /> -->
	<LazyLoad threshold={0.3} rootMargin="200px">
		{#snippet children()}
			{#await import('$lib/components/marketing/Pricing.svelte') then module}
				{@const Pricing = module.default}
				<Pricing />
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
				<CTA />
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

	<!-- Marketplace Preview for Unauthenticated Users -->
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

				<!-- Coffee catalog preview message -->
				<div class="mb-8 text-center">
					<p class="text-text-secondary-light">
						Sign in with the header above to access AI recommendations, inventory tracking, and full
						catalog search
					</p>
				</div>

				<!-- Coffee Cards Preview (Limited) -->
				<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
					{#each data.data.slice(0, 6) as coffee}
						<CoffeeCard {coffee} {parseTastingNotes} />
					{/each}
				</div>

				<!-- Sign Up Prompt with API Cross-Reference -->
				<div class="py-8 text-center">
					<div
						class="rounded-lg border border-background-tertiary-light/20 bg-background-primary-light p-8"
					>
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
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>
