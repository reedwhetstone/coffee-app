<script lang="ts">
	import type { PageAuthView } from '$lib/types/auth.types';

	let { auth } = $props<{ auth: PageAuthView }>();

	let isSignedIn = $derived(auth.isSignedIn);
</script>

<section class="texture-grain bg-ink" aria-labelledby="final-cta-heading">
	<div
		class="mx-auto grid max-w-7xl gap-8 px-6 py-16 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:px-8"
	>
		<div class="max-w-3xl">
			<p class="text-sm font-semibold text-accent">The market is already moving.</p>
			<h2
				id="final-cta-heading"
				class="mt-2 font-serif text-4xl font-medium tracking-tight text-on-dark sm:text-5xl"
			>
				See the whole market. Move with confidence.
			</h2>
			<p class="mt-4 max-w-2xl text-base leading-7 text-on-dark/70">
				{isSignedIn
					? 'Your saved market and roastery context is ready.'
					: 'The catalog and core Market Index are free to explore. Add deeper intelligence when the work calls for it.'}
			</p>
		</div>
		<div class="flex flex-col gap-3 sm:flex-row lg:flex-col">
			<a
				href="/analytics"
				class="rounded-md bg-accent px-6 py-3 text-center text-sm font-semibold text-ink transition-opacity hover:opacity-90"
			>
				{isSignedIn ? 'Open the Market Index' : 'Explore the Market Index'}
			</a>
			<a
				href="/subscription"
				class="rounded-md border border-on-dark/30 px-6 py-3 text-center text-sm font-semibold text-on-dark transition-colors hover:border-on-dark hover:bg-on-dark hover:text-ink"
			>
				{isSignedIn ? 'Manage your plan' : 'See plans'}
			</a>
		</div>
	</div>
</section>
