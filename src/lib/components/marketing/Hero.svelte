<script lang="ts">
	import { onMount } from 'svelte';
	import { CATALOG_SIZE_LABEL, IMPORTER_COUNT_LABEL } from '$lib/public-contracts/brand';
	import type { PageAuthView } from '$lib/types/auth.types';

	const SUPPLIER_NAMES = [
		'Cafe Imports',
		'Covoya',
		'Royal Coffee',
		'Ally Coffee',
		'RhoadsRoast',
		'Coffee Bean Corral',
		'Genuine Origin',
		'Burman',
		'Smokin Beans',
		'Home Roast Coffee',
		"Sweet Maria's",
		'Hacea Coffee',
		'Copan Trade',
		"Captain's Coffee",
		'Coffee Shrub',
		'Bodhi Leaf',
		'Showroom Coffee',
		'Roastmasters',
		'Coffee Bean Direct',
		'Happy Mug',
		'Fresh Roasted Coffee',
		'BC Green Coffee',
		'Theta Ridge',
		'Coffee Crafters Green',
		'Yellow Rooster',
		'Sea Island',
		'T.M. Ward Coffee',
		'Forest Coffee',
		'Lavanta Coffee',
		'Sonofresco',
		'Good Brothers',
		'Cafe Kreyol',
		'Prime Green Coffee',
		'The Coffee Project',
		"Dean's Beans",
		'Java Bean Plus',
		'Atlas Coffee',
		'Ally Open',
		'Mill City',
		'Two Cups of Joe',
		'StoneX Specialty',
		'Klatch',
		'Cafe Juan Ana',
		'Primos Coffee',
		'Sleepy Mango',
		'Villa Coffee'
	] as const;

	const FALLBACK_COFFEE_NAMES = [
		'Ethiopia Guji Natural',
		'Colombia Pink Bourbon',
		'Kenya Nyeri AA',
		'Brazil Cerrado Natural'
	] as const;

	let { auth, coffeeNames = [] } = $props<{ auth: PageAuthView; coffeeNames?: string[] }>();

	let isSignedIn = $derived(auth.isSignedIn);
	let coffeeExamples = $derived(coffeeNames.length > 0 ? coffeeNames : [...FALLBACK_COFFEE_NAMES]);
	let coffeeIndex = $state(0);
	let activeCoffeeName = $derived(coffeeExamples[coffeeIndex % coffeeExamples.length]);

	onMount(() => {
		if (
			window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
			coffeeExamples.length < 2
		) {
			return;
		}

		const interval = window.setInterval(() => {
			coffeeIndex = (coffeeIndex + 1) % coffeeExamples.length;
		}, 1250);

		return () => window.clearInterval(interval);
	});
</script>

<section class="texture-grain overflow-hidden border-b border-line bg-surface-canvas">
	<div
		class="relative mx-auto grid max-w-7xl gap-10 px-6 py-14 sm:py-16 lg:grid-cols-[minmax(0,0.94fr)_minmax(25rem,0.76fr)] lg:items-center lg:gap-16 lg:px-8 lg:py-20"
	>
		<div class="relative z-10 max-w-3xl">
			<p class="text-sm font-semibold text-organic-rust">Coffee-native AI from Purveyors</p>
			<h1
				class="mt-4 max-w-3xl font-serif text-5xl font-medium leading-[0.98] tracking-tight text-ink sm:text-6xl lg:text-7xl"
			>
				The intelligence layer for coffee.
			</h1>
			<p class="mt-6 max-w-2xl text-lg leading-8 text-muted sm:text-xl sm:leading-9">
				Purveyors connects live green coffee data, coffee-native intelligence, and roastery
				operations in one trusted system. See the market, understand the evidence, and turn insight
				into action.
			</p>

			<div class="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
				<a
					href="/analytics"
					class="rounded-md bg-accent px-6 py-3 text-sm font-semibold text-ink transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
				>
					Explore the Market Index
				</a>
				<a
					href="#platform"
					class="group inline-flex items-center gap-2 py-2 text-sm font-semibold text-link transition-colors hover:text-ink"
				>
					See how Purveyors connects the work
					<span class="transition-transform group-hover:translate-y-0.5" aria-hidden="true">↓</span>
				</a>
			</div>

			{#if isSignedIn}
				<p class="mt-5 text-sm text-muted">
					Your saved market and roastery context is ready when you are.
				</p>
			{/if}
		</div>

		<div
			id="cherry"
			class="relative z-10 overflow-hidden rounded-lg border border-line bg-surface-raised shadow-sm"
		>
			<img
				src="/marketing/homepage-intelligence.webp"
				alt=""
				width="960"
				height="384"
				class="h-36 w-full object-cover sm:h-44"
				aria-hidden="true"
				fetchpriority="high"
			/>
			<div class="bg-ink p-6 text-on-dark sm:p-7">
				<div class="flex items-center justify-between gap-4">
					<p class="text-xs font-semibold text-accent">Cherry AI</p>
					<span
						class="rounded-full border border-on-dark/20 px-2.5 py-1 text-[11px] text-on-dark/70"
					>
						Source-aware
					</span>
				</div>
				<p class="mt-4 max-w-md font-serif text-2xl font-medium leading-8 text-on-dark sm:text-3xl">
					What changed in the market this week?
				</p>
				<p class="hero-answer mt-4 max-w-lg text-sm leading-6 text-on-dark/75">
					Parchment Intelligence provides live offers and pricing insight. Mallard Studio structures
					inventory, roasts, and sales. Cherry AI works across both - reasoning, acting, and moving
					work forward.
				</p>

				<div class="mt-6 h-px overflow-hidden bg-on-dark/15" aria-hidden="true">
					<div class="hero-path h-full bg-accent"></div>
				</div>
				<ul class="mt-5 grid gap-3 text-xs text-on-dark/75 sm:grid-cols-3">
					<li class="hero-signal">
						<span class="block font-semibold text-on-dark">Current offers</span>
						Live supplier records
					</li>
					<li class="hero-signal">
						<span class="block font-semibold text-on-dark">Market history</span>
						Movement and benchmarks
					</li>
					<li class="hero-signal">
						<span class="block font-semibold text-on-dark">Your operation</span>
						Inventory, roasts, and sales
					</li>
				</ul>
			</div>
		</div>
	</div>

	<dl class="mx-auto grid max-w-7xl border-t border-line px-6 sm:grid-cols-3 lg:px-8">
		<div class="min-w-0 py-5 sm:border-r sm:border-line sm:pr-8">
			<dt class="text-xs font-medium text-muted">Live market coverage</dt>
			<dd class="mt-1 font-serif text-2xl font-medium text-ink">{CATALOG_SIZE_LABEL} offers</dd>
			<div class="mt-3 flex min-w-0 items-center gap-2" aria-hidden="true">
				<span class="relative flex size-2 shrink-0">
					<span
						class="absolute inline-flex size-full rounded-full bg-accent opacity-40 motion-safe:animate-ping"
					></span>
					<span class="relative inline-flex size-2 rounded-full bg-accent"></span>
				</span>
				<div class="min-w-0 overflow-hidden text-xs font-medium text-muted">
					{#key activeCoffeeName}
						<span class="coffee-swap block truncate">{activeCoffeeName}</span>
					{/key}
				</div>
			</div>
			<span class="sr-only">Recent coffee examples include {coffeeExamples.join(', ')}.</span>
		</div>
		<div class="min-w-0 border-t border-line py-5 sm:border-l-0 sm:border-r sm:border-t-0 sm:px-8">
			<dt class="text-xs font-medium text-muted">Normalized sources</dt>
			<dd class="mt-1 font-serif text-2xl font-medium text-ink">
				{IMPORTER_COUNT_LABEL} importers
			</dd>
			<div class="supplier-marquee mt-3 overflow-hidden" aria-hidden="true">
				<div class="supplier-marquee-track flex w-max">
					{#each [0, 1] as _copy}
						<div class="supplier-marquee-group flex shrink-0 gap-2 pr-2">
							{#each SUPPLIER_NAMES as supplier}
								<span
									class="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface-panel px-2.5 py-1 text-[11px] font-medium text-muted"
								>
									<span class="size-1 rounded-full bg-organic-rust"></span>
									{supplier}
								</span>
							{/each}
						</div>
					{/each}
				</div>
			</div>
			<span class="sr-only">Live sources include {SUPPLIER_NAMES.join(', ')}.</span>
		</div>
		<div class="min-w-0 border-t border-line py-5 sm:border-t-0 sm:pl-8">
			<dt class="text-xs font-medium text-muted">Coffee context</dt>
			<dd class="mt-1 font-serif text-2xl font-medium text-ink">Updated daily</dd>
			<div class="mt-3 flex items-center gap-2 text-xs font-medium text-muted">
				<span
					class="inline-flex h-5 items-center rounded-full bg-success-subtle px-2 text-success-strong"
				>
					Fresh
				</span>
				Prices, stock, and arrivals
			</div>
		</div>
	</dl>
</section>

<style>
	.hero-path {
		transform-origin: left;
		animation: draw-signal 1.2s 0.35s cubic-bezier(0.22, 1, 0.36, 1) both;
	}

	.hero-answer,
	.hero-signal {
		animation: reveal-signal 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
	}

	.hero-answer {
		animation-delay: 0.18s;
	}

	.coffee-swap {
		animation: coffee-swap 0.34s cubic-bezier(0.22, 1, 0.36, 1) both;
	}

	.supplier-marquee {
		mask-image: linear-gradient(to right, transparent, black 8%, black 92%, transparent);
	}

	.supplier-marquee-track {
		animation: supplier-scroll 72s linear infinite;
	}

	.hero-signal:nth-child(1) {
		animation-delay: 0.5s;
	}

	.hero-signal:nth-child(2) {
		animation-delay: 0.66s;
	}

	.hero-signal:nth-child(3) {
		animation-delay: 0.82s;
	}

	@keyframes draw-signal {
		from {
			transform: scaleX(0);
		}
		to {
			transform: scaleX(1);
		}
	}

	@keyframes reveal-signal {
		from {
			opacity: 0;
			transform: translateY(0.45rem);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes coffee-swap {
		from {
			opacity: 0;
			transform: translateY(0.5rem);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes supplier-scroll {
		to {
			transform: translateX(-50%);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.hero-path,
		.hero-answer,
		.hero-signal,
		.coffee-swap,
		.supplier-marquee-track {
			animation: none;
		}
	}
</style>
