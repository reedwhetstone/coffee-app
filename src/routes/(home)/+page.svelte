<script lang="ts">
	import type { PageData } from './$types';
	import { onMount } from 'svelte';
	import { parseTastingNotes } from '$lib/utils/parseTastingNotes';

	import Hero from '$lib/components/marketing/Hero.svelte';
	import PersonaRouter from '$lib/components/marketing/PersonaRouter.svelte';
	import Pricing from '$lib/components/marketing/Pricing.svelte';
	import CTA from '$lib/components/marketing/CTA.svelte';
	import Footer from '$lib/components/marketing/Footer.svelte';
	import CoffeeCard from '$lib/components/CoffeeCard.svelte';

	let { data } = $props<{ data: PageData }>();

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
		<section
			class="border-t border-line bg-surface-panel py-16 sm:py-20"
			aria-labelledby="live-market-heading"
		>
			<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
				<div class="mb-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
					<div class="max-w-3xl">
						<p class="text-sm font-semibold text-organic-rust">Live market proof</p>
						<h2
							id="live-market-heading"
							class="mt-2 font-serif text-4xl font-medium tracking-tight text-ink sm:text-5xl"
						>
							Today’s catalog, already normalized.
						</h2>
						<p class="mt-4 max-w-2xl text-lg leading-8 text-muted">
							Source-linked offers from specialty importers, ready to compare by origin, process,
							price, and evidence.
						</p>
					</div>
					<div class="flex flex-wrap gap-4 text-sm font-semibold">
						<a href="/catalog" class="text-link transition-colors hover:text-ink">
							Browse the full catalog <span aria-hidden="true">→</span>
						</a>
						<a href="/analytics" class="text-link transition-colors hover:text-ink">
							Open the Market Index <span aria-hidden="true">→</span>
						</a>
					</div>
				</div>

				<div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
					{#each data.data.slice(0, 3) as coffee}
						<CoffeeCard {coffee} {parseTastingNotes} compact />
					{/each}
				</div>
			</div>
		</section>
	{/if}

	<Pricing auth={data.auth} />
	<CTA auth={data.auth} />
	<Footer />
</div>
