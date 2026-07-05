<script lang="ts">
	import { goto } from '$app/navigation';
	import { checkRole } from '$lib/types/auth.types';
	import OrganicBand from '$lib/components/marketing/OrganicBand.svelte';
	import AccentSpine from '$lib/components/ui/AccentSpine.svelte';

	import type { UserRole } from '$lib/types/auth.types';

	interface SessionData {
		user?: {
			email?: string;
		};
	}

	let { session = null, role = 'viewer' } = $props<{
		session?: SessionData | null;
		role?: UserRole;
	}>();

	let isSignedIn = $derived(Boolean(session?.user));
	let canAccessMemberRoutes = $derived(checkRole(role, 'member'));
	let userLabel = $derived(session?.user?.email?.split('@')[0] ?? 'there');

	function handlePrimaryAction() {
		goto('/analytics');
	}

	function handleSecondaryAction() {
		goto('/catalog');
	}

	function handleLearnMore() {
		document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
	}
</script>

<section
	class="texture-grain relative overflow-hidden bg-gradient-to-br from-surface-canvas to-surface-panel"
>
	<div class="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
		<div class="flex flex-col items-center justify-center">
			{#if isSignedIn}
				<div
					class="mb-6 inline-flex items-center rounded-full border border-accent/20 bg-accent/10 px-4 py-1.5 text-sm font-medium text-accent"
				>
					Welcome back, {userLabel}. The market moved while you were out.
				</div>
			{/if}
			<h1 class="text-center font-serif text-4xl font-medium tracking-tight text-ink sm:text-6xl">
				{#if isSignedIn}
					Back to the full market view.
				{:else}
					Source green coffee <br /> with the whole market in view.
				{/if}
			</h1>
		</div>
		<div class="mx-auto max-w-3xl text-center">
			<p class="mt-6 text-lg leading-8 text-muted">
				Daily normalized data from 40+ US suppliers. Price movement, arrivals, delistings, and
				origin benchmarks in one place, so you make procurement calls with real time intelligence.
			</p>
			<div class="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-x-6">
				<button
					onclick={handlePrimaryAction}
					class="w-full rounded-md bg-accent px-6 py-3 text-sm font-semibold text-ink shadow-sm transition-all duration-200 hover:bg-opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:w-auto"
				>
					Explore the Market Index
				</button>
				<button
					onclick={handleSecondaryAction}
					class="w-full rounded-md border border-accent px-6 py-3 text-sm font-semibold text-accent transition-all duration-200 hover:bg-accent hover:text-ink sm:w-auto"
				>
					Browse the catalog
				</button>
				<button
					onclick={handleLearnMore}
					class="text-sm font-semibold leading-6 text-ink transition-colors duration-200 hover:text-accent"
				>
					How it works <span aria-hidden="true">→</span>
				</button>
				{#if !isSignedIn}
					<a
						href="/auth"
						class="text-sm font-semibold leading-6 text-muted transition-colors duration-200 hover:text-accent"
					>
						Sign in
					</a>
				{/if}
			</div>
			{#if isSignedIn && canAccessMemberRoutes}
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
		</div>
	</div>

	<!-- Sample daily market brief with an organic accent spine -->
	<div class="mx-auto max-w-7xl px-4 pb-20 sm:px-6 sm:pb-24 lg:px-8">
		<div
			class="relative mx-auto max-w-2xl overflow-hidden rounded-lg border border-line bg-surface-raised p-5 shadow-md sm:p-6"
		>
			<AccentSpine />
			<div class="pl-3">
				<div class="flex items-center justify-between gap-2">
					<div class="flex items-center gap-2">
						<div class="h-2 w-2 rounded-full bg-accent"></div>
						<span class="text-xs font-semibold text-ink">Market brief · updated every morning</span>
					</div>
					<span class="rounded-full bg-surface-panel px-2.5 py-0.5 text-xs text-muted">Sample</span>
				</div>
				<p class="mt-3 font-serif text-base leading-7 text-ink sm:text-lg">
					Ethiopia washed lots down 4.9% median week-over-week. 3 new arrivals from importers this
					week, 2 lots delisted. Origin IQR $6.90–$8.40; wholesale holds $0.55 below retail.
				</p>
				<div class="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-muted">
					<span>40+ importers tracked</span>
					<span>90+ days of price history</span>
					<span>Arrivals and delistings daily</span>
				</div>
			</div>
		</div>
	</div>

	<!-- Slim organic accent ribbon closing the hero -->
	<div class="h-3 w-full overflow-hidden sm:h-4" aria-hidden="true">
		<OrganicBand />
	</div>
</section>
