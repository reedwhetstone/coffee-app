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
			<h2 class="text-base font-semibold leading-7 text-background-tertiary-light">Choose your path</h2>
			<p class="mt-2 text-4xl font-bold tracking-tight text-text-primary-light sm:text-5xl">
				Start with the catalog, then pick the layer that fits your work
			</p>
		</div>
		<p class="mx-auto mt-6 max-w-2xl text-center text-lg leading-8 text-text-secondary-light">
			Purveyors is organized around three clear jobs: buy better coffee, run better workflows, and use
			better coffee data. Pick the product that matches what you need right now.
		</p>

		<div
			class="isolate mx-auto mt-16 grid max-w-md grid-cols-1 gap-6 sm:mt-20 sm:gap-8 lg:mx-0 lg:max-w-none lg:grid-cols-4 lg:gap-8"
		>
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
						For roasting teams that want sourcing notes, inventory, roast records, tasting, and daily
						workflow in one place.
					</p>
					<p class="mt-6 flex items-baseline gap-x-1">
						<span class="text-4xl font-bold tracking-tight text-text-primary-light">$9</span>
						<span class="text-sm font-semibold leading-6 text-text-secondary-light">/month</span>
					</p>
					<p class="mt-2 text-sm text-text-secondary-light">Or $80/year for Studio Member.</p>
					<ul role="list" class="mt-8 space-y-3 text-sm leading-6 text-text-secondary-light">
						<li class="flex gap-x-3">Inventory, roast, and tasting workflows</li>
						<li class="flex gap-x-3">Saved sourcing context for your team</li>
						<li class="flex gap-x-3">AI help inside day-to-day operations</li>
					</ul>
				</div>
				<button
					onclick={(e) => {
						e.stopPropagation();
						handleSelectPlan('studio');
					}}
					class="mt-8 block w-full rounded-md bg-background-tertiary-light px-3 py-2 text-center text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-background-tertiary-light"
				>
					{isSignedIn ? 'Manage Studio' : 'See plans'}
				</button>
			</div>

			<div
				class="flex cursor-pointer flex-col justify-between rounded-3xl bg-background-primary-light p-8 ring-2 ring-background-tertiary-light transition-all duration-200 hover:scale-105 hover:shadow-lg hover:ring-background-tertiary-light xl:p-10"
				onclick={() => handleSelectPlan('api')}
				onkeydown={(e) => e.key === 'Enter' && handleSelectPlan('api')}
				tabindex="0"
				role="button"
				aria-label="Select Parchment API"
			>
				<div>
					<div class="flex items-center justify-between gap-x-4">
						<h3 class="text-lg font-semibold leading-8 text-background-tertiary-light">
							Parchment API
						</h3>
						<p
							class="rounded-full bg-background-tertiary-light/10 px-2.5 py-1 text-xs font-semibold leading-5 text-background-tertiary-light"
						>
							For apps and integrations
						</p>
					</div>
					<p class="mt-4 text-sm leading-6 text-text-secondary-light">
						For teams that want structured green coffee data inside internal tools, customer products, or
						automations.
					</p>
					<p class="mt-6 flex items-baseline gap-x-2">
						<span class="rounded-full bg-background-tertiary-light/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-background-tertiary-light">Green</span>
						<span class="rounded-full bg-background-tertiary-light/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-background-tertiary-light">Origin</span>
						<span class="rounded-full bg-border-light px-3 py-1 text-xs font-semibold uppercase tracking-wide text-text-secondary-light">Enterprise</span>
					</p>
					<p class="mt-3 text-sm text-text-secondary-light">
						Start with self-serve evaluation, then move into higher-coverage or enterprise access as your
						use case grows.
					</p>
					<ul role="list" class="mt-8 space-y-3 text-sm leading-6 text-text-secondary-light">
						<li class="flex gap-x-3">Structured coffee data for product and ops teams</li>
						<li class="flex gap-x-3">Clear path from evaluation to production use</li>
						<li class="flex gap-x-3">Enterprise support for larger deployments</li>
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

			<div
				class="flex cursor-pointer flex-col justify-between rounded-3xl bg-background-primary-light p-8 ring-1 ring-border-light transition-all duration-200 hover:scale-105 hover:ring-2 hover:ring-background-tertiary-light xl:p-10"
				onclick={() => handleSelectPlan('intelligence')}
				onkeydown={(e) => e.key === 'Enter' && handleSelectPlan('intelligence')}
				tabindex="0"
				role="button"
				aria-label="Select Parchment Intelligence"
			>
				<div>
					<div class="flex items-center justify-between gap-x-4">
						<h3 class="text-lg font-semibold leading-8 text-text-primary-light">
							Parchment Intelligence
						</h3>
					</div>
					<p class="mt-4 text-sm leading-6 text-text-secondary-light">
						For buyers and operators who want clearer visibility into pricing movement, supplier behavior,
						and market changes.
					</p>
					<p class="mt-6 text-sm font-semibold uppercase tracking-wide text-text-secondary-light">
						Market visibility
					</p>
					<p class="mt-2 text-sm text-text-secondary-light">
						Use the live analytics surface today, then go deeper as premium intelligence packaging expands.
					</p>
					<ul role="list" class="mt-8 space-y-3 text-sm leading-6 text-text-secondary-light">
						<li class="flex gap-x-3">Clearer pricing and availability visibility</li>
						<li class="flex gap-x-3">Faster detection of market changes</li>
						<li class="flex gap-x-3">Confidence built on normalized underlying data</li>
					</ul>
				</div>
				<button
					onclick={(e) => {
						e.stopPropagation();
						handleSelectPlan('intelligence');
					}}
					class="mt-8 block w-full rounded-md bg-background-tertiary-light px-3 py-2 text-center text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-background-tertiary-light"
				>
					View analytics
				</button>
			</div>

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
						For custom delivery, embedded data experiences, support commitments, and larger commercial
						buying needs.
					</p>
					<p class="mt-6 flex items-baseline gap-x-1">
						<span class="text-2xl font-bold tracking-tight text-text-primary-light">Talk to us</span>
					</p>
					<ul role="list" class="mt-8 space-y-3 text-sm leading-6 text-text-secondary-light">
						<li class="flex gap-x-3">Custom integrations and delivery patterns</li>
						<li class="flex gap-x-3">Embedded data and internal reporting use cases</li>
						<li class="flex gap-x-3">Commercial support for larger teams</li>
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
