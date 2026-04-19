<script lang="ts">
	import { goto } from '$app/navigation';

	interface SessionData {
		user?: {
			email?: string;
		};
	}

	let { session = null } = $props<{
		session?: SessionData | null;
	}>();

	let isSignedIn = $derived(Boolean(session?.user));

	function handleSelectPlan(plan: 'studio' | 'api' | 'intelligence' | 'enterprise') {
		if (plan === 'enterprise') {
			goto('/contact');
			return;
		}

		if (plan === 'api') {
			goto('/api');
			return;
		}

		if (plan === 'intelligence') {
			goto('/analytics');
			return;
		}

		goto('/subscription');
	}
</script>

<section id="pricing" class="bg-background-secondary-light py-24 sm:py-32">
	<div class="mx-auto max-w-7xl px-6 lg:px-8">
		<div class="mx-auto max-w-4xl text-center">
			<h2 class="text-base font-semibold leading-7 text-background-tertiary-light">Products</h2>
			<p class="mt-2 text-4xl font-bold tracking-tight text-text-primary-light sm:text-5xl">
				Pick the intelligence layer that matches your work.
			</p>
		</div>
		<p class="mx-auto mt-6 max-w-2xl text-center text-lg leading-8 text-text-secondary-light">
			Market intelligence for buyers. Workflow tools for roasters. Structured data for developers.
			Three distinct products built on the same daily-normalized green coffee data.
		</p>

		<div
			class="isolate mx-auto mt-16 grid max-w-md grid-cols-1 gap-6 sm:mt-20 sm:gap-8 lg:mx-0 lg:max-w-none lg:grid-cols-4 lg:gap-8"
		>
			<!-- Parchment Intelligence: flagship, highlighted -->
			<div
				class="flex cursor-pointer flex-col justify-between rounded-3xl bg-background-primary-light p-8 ring-2 ring-background-tertiary-light transition-all duration-200 hover:scale-105 hover:shadow-lg xl:p-10"
				onclick={() => handleSelectPlan('intelligence')}
				onkeydown={(e) => e.key === 'Enter' && handleSelectPlan('intelligence')}
				tabindex="0"
				role="button"
				aria-label="Select Parchment Intelligence"
			>
				<div>
					<div class="flex items-center justify-between gap-x-4">
						<h3 class="text-lg font-semibold leading-8 text-background-tertiary-light">
							Parchment Intelligence
						</h3>
						<p
							class="rounded-full bg-background-tertiary-light/10 px-2.5 py-1 text-xs font-semibold leading-5 text-background-tertiary-light"
						>
							For buyers
						</p>
					</div>
					<p class="mt-4 text-sm leading-6 text-text-secondary-light">
						Cross-supplier price intelligence, arrivals, delistings, and origin benchmarks delivered
						daily. Make procurement calls on complete market data.
					</p>
					<p class="mt-6 text-sm font-semibold uppercase tracking-wide text-text-secondary-light">
						What you get
					</p>
					<ul role="list" class="mt-4 space-y-3 text-sm leading-6 text-text-secondary-light">
						<li class="flex gap-x-3">Weekly procurement brief</li>
						<li class="flex gap-x-3">Supplier comparison matrix</li>
						<li class="flex gap-x-3">Origin price trend detail</li>
						<li class="flex gap-x-3">Arrivals and delistings feed</li>
					</ul>
				</div>
				<button
					onclick={(e) => {
						e.stopPropagation();
						handleSelectPlan('intelligence');
					}}
					class="mt-8 block w-full rounded-md bg-background-tertiary-light px-3 py-2 text-center text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-background-tertiary-light"
				>
					{isSignedIn ? 'Add Intelligence' : 'See analytics'}
				</button>
			</div>

			<!-- Parchment API -->
			<div
				class="flex cursor-pointer flex-col justify-between rounded-3xl bg-background-primary-light p-8 ring-1 ring-border-light transition-all duration-200 hover:scale-105 hover:ring-2 hover:ring-background-tertiary-light xl:p-10"
				onclick={() => handleSelectPlan('api')}
				onkeydown={(e) => e.key === 'Enter' && handleSelectPlan('api')}
				tabindex="0"
				role="button"
				aria-label="Select Parchment API"
			>
				<div>
					<div class="flex items-center justify-between gap-x-4">
						<h3 class="text-lg font-semibold leading-8 text-text-primary-light">Parchment API</h3>
					</div>
					<p class="mt-4 text-sm leading-6 text-text-secondary-light">
						Normalized green coffee data from 41+ suppliers through one REST API. Daily updates,
						consistent schema. Connect it to your tools without rebuilding what we already track.
					</p>
					<p class="mt-6 flex items-baseline gap-x-2">
						<span
							class="rounded-full bg-background-tertiary-light/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-background-tertiary-light"
							>Green</span
						>
						<span
							class="rounded-full bg-background-tertiary-light/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-background-tertiary-light"
							>Origin</span
						>
						<span
							class="rounded-full bg-border-light px-3 py-1 text-xs font-semibold uppercase tracking-wide text-text-secondary-light"
							>Enterprise</span
						>
					</p>
					<ul role="list" class="mt-8 space-y-3 text-sm leading-6 text-text-secondary-light">
						<li class="flex gap-x-3">Structured lot data with origin, process, score, price</li>
						<li class="flex gap-x-3">Arrivals and availability updated daily</li>
						<li class="flex gap-x-3">Enterprise support for production deployments</li>
					</ul>
				</div>
				<button
					onclick={(e) => {
						e.stopPropagation();
						handleSelectPlan('api');
					}}
					class="mt-8 block w-full rounded-md bg-background-tertiary-light px-3 py-2 text-center text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-background-tertiary-light"
				>
					Get API access
				</button>
			</div>

			<!-- Mallard Studio -->
			<div
				class="flex cursor-pointer flex-col justify-between rounded-3xl bg-background-primary-light p-8 ring-1 ring-border-light transition-all duration-200 hover:scale-105 hover:ring-2 hover:ring-background-tertiary-light xl:p-10"
				onclick={() => handleSelectPlan('studio')}
				onkeydown={(e) => e.key === 'Enter' && handleSelectPlan('studio')}
				tabindex="0"
				role="button"
				aria-label="Select Mallard Studio"
			>
				<div>
					<div class="flex items-center justify-between gap-x-4">
						<h3 class="text-lg font-semibold leading-8 text-text-primary-light">Mallard Studio</h3>
					</div>
					<p class="mt-4 text-sm leading-6 text-text-secondary-light">
						Inventory, roast logs, and profit tracking for roasters running production. Keep
						sourcing, roasting, and tasting in one place.
					</p>
					<p class="mt-6 flex items-baseline gap-x-1">
						<span class="text-4xl font-bold tracking-tight text-text-primary-light">$9</span>
						<span class="text-sm font-semibold leading-6 text-text-secondary-light">/month</span>
					</p>
					<p class="mt-2 text-sm text-text-secondary-light">Or $80/year.</p>
					<ul role="list" class="mt-8 space-y-3 text-sm leading-6 text-text-secondary-light">
						<li class="flex gap-x-3">Green coffee inventory and lot tracking</li>
						<li class="flex gap-x-3">Roast profile logs with D3 charting</li>
						<li class="flex gap-x-3">Profit and production reporting</li>
					</ul>
				</div>
				<button
					onclick={(e) => {
						e.stopPropagation();
						handleSelectPlan('studio');
					}}
					class="mt-8 block w-full rounded-md bg-background-tertiary-light px-3 py-2 text-center text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-background-tertiary-light"
				>
					{isSignedIn ? 'Manage Studio' : 'See Studio plans'}
				</button>
			</div>

			<!-- Enterprise -->
			<div
				class="flex cursor-pointer flex-col justify-between rounded-3xl bg-background-primary-light p-8 ring-1 ring-border-light transition-all duration-200 hover:scale-105 hover:ring-2 hover:ring-background-tertiary-light xl:p-10"
				onclick={() => handleSelectPlan('enterprise')}
				onkeydown={(e) => e.key === 'Enter' && handleSelectPlan('enterprise')}
				tabindex="0"
				role="button"
				aria-label="Contact sales for Enterprise"
			>
				<div>
					<div class="flex items-center justify-between gap-x-4">
						<h3 class="text-lg font-semibold leading-8 text-text-primary-light">Enterprise</h3>
					</div>
					<p class="mt-4 text-sm leading-6 text-text-secondary-light">
						Custom data delivery, embedded intelligence, and support commitments for larger
						procurement teams and commercial buyers.
					</p>
					<p class="mt-6 flex items-baseline gap-x-1">
						<span class="text-2xl font-bold tracking-tight text-text-primary-light">Talk to us</span
						>
					</p>
					<ul role="list" class="mt-8 space-y-3 text-sm leading-6 text-text-secondary-light">
						<li class="flex gap-x-3">Custom integrations and delivery patterns</li>
						<li class="flex gap-x-3">Embedded data for internal reporting</li>
						<li class="flex gap-x-3">Dedicated support and SLA</li>
					</ul>
				</div>
				<button
					onclick={(e) => {
						e.stopPropagation();
						goto('/contact');
					}}
					class="mt-8 block w-full rounded-md bg-text-primary-light px-3 py-2 text-center text-sm font-semibold text-background-primary-light shadow-sm transition-all duration-200 hover:bg-opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary-light"
				>
					Contact sales
				</button>
			</div>
		</div>
	</div>
</section>
