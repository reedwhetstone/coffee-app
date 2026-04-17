<script lang="ts">
	import { goto } from '$app/navigation';
	import { checkRole } from '$lib/types/auth.types';

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
	class="relative overflow-hidden bg-gradient-to-br from-background-primary-light to-background-secondary-light"
>
	<div class="mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
		<div class="flex flex-col items-center justify-center">
			{#if isSignedIn}
				<div
					class="mb-6 inline-flex items-center rounded-full border border-background-tertiary-light/20 bg-background-tertiary-light/10 px-4 py-1.5 text-sm font-medium text-background-tertiary-light"
				>
					Welcome back, {userLabel}. The market moved while you were out.
				</div>
			{/if}
			<h1 class="text-center text-4xl font-bold tracking-tight text-text-primary-light sm:text-6xl">
				{#if isSignedIn}
					Back to the full market view.
				{:else}
					Source greens with the whole market in view.
				{/if}
			</h1>
		</div>
		<div class="mx-auto max-w-3xl text-center">
			<p class="mt-6 text-lg leading-8 text-text-secondary-light">
				{#if isSignedIn}
					Daily normalized data from 41+ US suppliers. Price movement, arrivals, delistings, and
					origin benchmarks in one place, so you make procurement calls on complete information.
				{:else}
					41+ US specialty importers, scraped daily. Pricing movement, new arrivals, delistings, and
					origin-level benchmarks normalized into one view. The market intelligence your procurement
					process is missing.
				{/if}
			</p>
			<div class="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-x-6">
				<button
					onclick={handlePrimaryAction}
					class="w-full rounded-md bg-background-tertiary-light px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-background-tertiary-light sm:w-auto"
				>
					Explore market analytics
				</button>
				<button
					onclick={handleSecondaryAction}
					class="w-full rounded-md border border-background-tertiary-light px-6 py-3 text-sm font-semibold text-background-tertiary-light transition-all duration-200 hover:bg-background-tertiary-light hover:text-white sm:w-auto"
				>
					Browse catalog
				</button>
				<button
					onclick={handleLearnMore}
					class="text-sm font-semibold leading-6 text-text-primary-light transition-colors duration-200 hover:text-background-tertiary-light"
				>
					How it works <span aria-hidden="true">→</span>
				</button>
				{#if !isSignedIn}
					<a
						href="/auth"
						class="text-sm font-semibold leading-6 text-text-secondary-light transition-colors duration-200 hover:text-background-tertiary-light"
					>
						Sign in
					</a>
				{/if}
			</div>
			{#if isSignedIn && canAccessMemberRoutes}
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
		</div>

		<div class="mt-16 flow-root sm:mt-24">
			<div
				class="-m-2 rounded-xl bg-background-tertiary-light/5 p-2 ring-1 ring-inset ring-background-tertiary-light/10 lg:-m-4 lg:rounded-2xl lg:p-4"
			>
				<div
					class="rounded-md bg-background-secondary-light p-8 shadow-2xl ring-1 ring-border-light"
				>
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
						<div
							class="rounded-lg bg-background-primary-light p-4 shadow-sm ring-1 ring-border-light"
						>
							<div class="flex items-center justify-between">
								<h3 class="font-semibold text-text-primary-light">Ethiopia Yirgacheffe</h3>
								<div class="font-bold text-background-tertiary-light">$7.45/lb</div>
							</div>
							<p class="mt-1 text-sm text-text-secondary-light">Origin median: $7.85 · -4.9% WoW</p>
							<div class="mt-2 flex items-center justify-between text-xs text-text-secondary-light">
								<span>3 new arrivals this week</span>
								<span>Washed</span>
							</div>
						</div>

						<div
							class="rounded-lg bg-background-primary-light p-4 shadow-sm ring-1 ring-border-light sm:col-span-2"
						>
							<div class="mb-2 flex items-center gap-2">
								<div class="h-2 w-2 rounded-full bg-background-tertiary-light"></div>
								<span class="text-xs text-text-secondary-light"
									>Market brief · updated daily</span
								>
							</div>
							<p class="text-sm text-text-primary-light">
								Ethiopia washed lots down 4.9% median week-over-week. 3 new arrivals from importers
								this week. 2 lots delisted. Origin IQR: $6.90 to $8.40. Wholesale average holds $0.55
								below retail.
							</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>

	<div
		class="absolute inset-x-0 top-[calc(100%-13rem)] -z-10 transform-gpu overflow-hidden blur-3xl sm:top-[calc(100%-30rem)]"
	>
		<div
			class="relative left-[calc(50%+3rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 bg-gradient-to-tr from-background-tertiary-light to-harvest-gold opacity-20 sm:left-[calc(50%+36rem)] sm:w-[72.1875rem]"
			style="clip-path: polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)"
		></div>
	</div>
</section>
