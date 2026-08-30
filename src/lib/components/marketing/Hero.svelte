<script lang="ts">
	import { CATALOG_SIZE_LABEL, IMPORTER_COUNT_LABEL } from '$lib/public-contracts/brand';
	import type { PageAuthView } from '$lib/types/auth.types';

	let { auth } = $props<{ auth: PageAuthView }>();

	let isSignedIn = $derived(auth.isSignedIn);
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
				Purveyors connects live green coffee data, Cherry, and roastery operations in one trusted
				system. See the market, understand the evidence, and move.
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
					<p class="text-xs font-semibold text-accent">Cherry</p>
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
					Parchment supplies current offers and price history. Mallard Studio supplies your
					inventory, roasts, and sales. Cherry connects that context before it responds.
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
		<div class="py-5 sm:border-r sm:border-line sm:pr-8">
			<dt class="text-xs font-medium text-muted">Live market coverage</dt>
			<dd class="mt-1 font-serif text-2xl font-medium text-ink">{CATALOG_SIZE_LABEL} offers</dd>
		</div>
		<div class="border-t border-line py-5 sm:border-l-0 sm:border-r sm:border-t-0 sm:px-8">
			<dt class="text-xs font-medium text-muted">Normalized sources</dt>
			<dd class="mt-1 font-serif text-2xl font-medium text-ink">
				{IMPORTER_COUNT_LABEL} importers
			</dd>
		</div>
		<div class="border-t border-line py-5 sm:border-t-0 sm:pl-8">
			<dt class="text-xs font-medium text-muted">Coffee context</dt>
			<dd class="mt-1 font-serif text-2xl font-medium text-ink">Updated daily</dd>
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

	@media (prefers-reduced-motion: reduce) {
		.hero-path,
		.hero-answer,
		.hero-signal {
			animation: none;
		}
	}
</style>
