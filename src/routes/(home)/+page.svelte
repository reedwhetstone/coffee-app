<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';

	// Marketing components
	import Hero from '$lib/components/marketing/Hero.svelte';
	import LazyLoad from '$lib/components/LazyLoad.svelte';
	import CoffeeCard from '$lib/components/CoffeeCard.svelte';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import type { TastingNotes } from '$lib/types/coffee.types';

	let { data } = $props<{ data: PageData }>();

	/**
	 * Parses AI tasting notes JSON data safely
	 * @param tastingNotesJson - JSON string from database
	 * @returns Parsed tasting notes or null if invalid
	 */
	function parseTastingNotes(tastingNotesJson: string | null | object): TastingNotes | null {
		if (!tastingNotesJson) return null;

		try {
			// Handle both string and object formats (Supabase jsonb can return either)
			let parsed: unknown;
			if (typeof tastingNotesJson === 'string') {
				parsed = JSON.parse(tastingNotesJson);
			} else if (typeof tastingNotesJson === 'object') {
				parsed = tastingNotesJson;
			} else {
				return null;
			}

			const notes = parsed as Partial<TastingNotes>;

			// Validate that required properties exist
			if (notes.body && notes.flavor && notes.acidity && notes.sweetness && notes.fragrance_aroma) {
				return notes as TastingNotes;
			}
		} catch (error) {
			console.warn('Failed to parse tasting notes:', error, 'Input:', tastingNotesJson);
		}
		return null;
	}

	// Feature cards for the authenticated dashboard
	const features = [
		{
			href: '/catalog',
			icon: '☕',
			title: 'Catalog',
			description:
				'Browse and search our full green coffee catalog with AI-powered recommendations.'
		},
		{
			href: '/beans',
			icon: '🌱',
			title: 'Inventory',
			description: 'Track your green coffee inventory, stock levels, and purchase history.'
		},
		{
			href: '/roast',
			icon: '🔥',
			title: 'Roast',
			description: 'Log roast profiles, track batch weights, and monitor development time.'
		},
		{
			href: '/profit',
			icon: '📊',
			title: 'Profit',
			description: 'Analyze sales margins, cost per pound, and overall roastery profitability.'
		},
		{
			href: '/chat',
			icon: '💬',
			title: 'Chat',
			description: 'Ask questions about any coffee in the catalog using AI-powered analysis.'
		}
	];
</script>

<SeoHead meta={data.meta} />

{#if data.session}
	<!-- Authenticated Dashboard View -->
	<div class="min-h-screen py-8">
		<div class="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
			<!-- Welcome header -->
			<div class="mb-10">
				<h1 class="text-3xl font-bold text-text-primary-light">
					Welcome back{data.session.user?.email ? ', ' + data.session.user.email.split('@')[0] : ''}
				</h1>
				<p class="mt-2 text-text-secondary-light">
					Here's a quick overview of everything available in your roastery platform.
				</p>
			</div>

			<!-- Feature cards grid -->
			<div class="mb-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{#each features as feature}
					<button
						onclick={() => goto(feature.href)}
						class="group rounded-lg border border-background-tertiary-light/20 bg-background-secondary-light p-6 text-left transition-all duration-200 hover:border-background-tertiary-light/50 hover:bg-background-primary-light hover:shadow-md"
					>
						<div class="mb-3 text-3xl">{feature.icon}</div>
						<h3
							class="mb-1 text-lg font-semibold text-text-primary-light group-hover:text-background-tertiary-light"
						>
							{feature.title}
						</h3>
						<p class="text-sm text-text-secondary-light">{feature.description}</p>
					</button>
				{/each}
			</div>

			<!-- Recent arrivals section -->
			{#if data?.data?.length > 0}
				<div>
					<h2 class="mb-6 text-xl font-semibold text-text-primary-light">Recent Arrivals</h2>
					<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
						{#each data.data.slice(0, 6) as coffee}
							<CoffeeCard {coffee} {parseTastingNotes} />
						{/each}
					</div>
					<div class="mt-6 text-center">
						<button
							onclick={() => goto('/catalog')}
							class="rounded-md bg-background-tertiary-light px-6 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-opacity-90"
						>
							Browse Full Catalog
						</button>
					</div>
				</div>
			{/if}
		</div>
	</div>
{:else}
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
							Sign in with the header above to access AI recommendations, inventory tracking, and
							full catalog search
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
{/if}
