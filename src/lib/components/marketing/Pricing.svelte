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

		goto('/subscription');
	}
</script>

<section id="pricing" class="bg-background-secondary-light py-24 sm:py-32">
	<div class="mx-auto max-w-7xl px-6 lg:px-8">
		<div class="mx-auto max-w-4xl text-center">
			<h2 class="text-base font-semibold leading-7 text-background-tertiary-light">Products</h2>
			<p class="mt-2 text-4xl font-bold tracking-tight text-text-primary-light sm:text-5xl">
				Choose the coffee workflow, data, or intelligence layer you need
			</p>
		</div>
		<p class="mx-auto mt-6 max-w-2xl text-center text-lg leading-8 text-text-secondary-light">
			Start with the public catalog, then buy the product that matches your job to be done: Mallard
			Studio for workflow, Parchment API for machine-readable data, or Parchment Intelligence for
			deeper market visibility.
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
						For roasters and operators who want sourcing, inventory, roast, tasting, and workflow
						tools in one operating environment.
					</p>
					<p class="mt-6 flex items-baseline gap-x-1">
						<span class="text-4xl font-bold tracking-tight text-text-primary-light">$9</span>
						<span class="text-sm font-semibold leading-6 text-text-secondary-light">/month</span>
					</p>
					<p class="mt-2 text-sm text-text-secondary-light">Or $80/year for Studio Member.</p>
					<ul role="list" class="mt-8 space-y-3 text-sm leading-6 text-text-secondary-light">
						<li class="flex gap-x-3">Workflow tools for inventory, roasting, and tasting</li>
						<li class="flex gap-x-3">Saved sourcing research and operating context</li>
						<li class="flex gap-x-3">AI help and production workflow support</li>
					</ul>
				</div>
				<button
					onclick={(e) => {
						e.stopPropagation();
						handleSelectPlan('studio');
					}}
					class="mt-8 block w-full rounded-md bg-background-tertiary-light px-3 py-2 text-center text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-background-tertiary-light"
				>
					{isSignedIn ? 'Manage Studio options' : 'See Mallard Studio'}
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
							For apps and agents
						</p>
					</div>
					<p class="mt-4 text-sm leading-6 text-text-secondary-light">
						Build on normalized coffee data with a free Explorer baseline and a paid production tier
						when you need more.
					</p>
					<p class="mt-6 flex items-baseline gap-x-1">
						<span class="text-4xl font-bold tracking-tight text-text-primary-light">$99</span>
						<span class="text-sm font-semibold leading-6 text-text-secondary-light">/month</span>
					</p>
					<p class="mt-2 text-sm text-text-secondary-light">Start with Explorer for free.</p>
					<ul role="list" class="mt-8 space-y-3 text-sm leading-6 text-text-secondary-light">
						<li class="flex gap-x-3">Machine-readable coffee data for developers</li>
						<li class="flex gap-x-3">Useful for internal tools, apps, and agents</li>
						<li class="flex gap-x-3">Clear upgrade path from Explorer to production use</li>
					</ul>
				</div>
				<button
					onclick={(e) => {
						e.stopPropagation();
						handleSelectPlan('api');
					}}
					class="mt-8 block w-full rounded-md bg-background-tertiary-light px-3 py-2 text-center text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-background-tertiary-light"
				>
					See Parchment API
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
						Unlock the premium analytics and market-intelligence layer for richer supplier, origin,
						and pricing visibility.
					</p>
					<p class="mt-6 flex items-baseline gap-x-1">
						<span class="text-4xl font-bold tracking-tight text-text-primary-light">$39</span>
						<span class="text-sm font-semibold leading-6 text-text-secondary-light">/month</span>
					</p>
					<p class="mt-2 text-sm text-text-secondary-light">
						Or $350/year for deeper market visibility.
					</p>
					<ul role="list" class="mt-8 space-y-3 text-sm leading-6 text-text-secondary-light">
						<li class="flex gap-x-3">Full analytics and price-index access</li>
						<li class="flex gap-x-3">Better sourcing visibility and market context</li>
						<li class="flex gap-x-3">Honest current value, with more intelligence layers coming</li>
					</ul>
				</div>
				<button
					onclick={(e) => {
						e.stopPropagation();
						handleSelectPlan('intelligence');
					}}
					class="mt-8 block w-full rounded-md bg-background-tertiary-light px-3 py-2 text-center text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-background-tertiary-light"
				>
					See Intelligence options
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
						For custom integrations, embedded analytics, commercial support, and sales-led
						partnerships.
					</p>
					<p class="mt-6 flex items-baseline gap-x-1">
						<span class="text-2xl font-bold tracking-tight text-text-primary-light">Talk to us</span
						>
					</p>
					<ul role="list" class="mt-8 space-y-3 text-sm leading-6 text-text-secondary-light">
						<li class="flex gap-x-3">Custom delivery patterns and integrations</li>
						<li class="flex gap-x-3">Embedded analytics and internal dashboards</li>
						<li class="flex gap-x-3">Support for larger commercial workflows</li>
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
