<script lang="ts">
	import { goto } from '$app/navigation';
	import { HOMEPAGE_PRICING_CARDS } from '$lib/billing/publicCatalog';

	interface SessionData {
		user?: {
			email?: string;
		};
	}

	let { session = null } = $props<{
		session?: SessionData | null;
	}>();

	let isSignedIn = $derived(Boolean(session?.user));

	function handleSelectPlan(key: string, href: string) {
		if (key === 'parchment-api' && isSignedIn) {
			goto('/api-dashboard');
			return;
		}

		goto(href);
	}
</script>

<section id="pricing" class="bg-background-secondary-light py-24 sm:py-32">
	<div class="mx-auto max-w-7xl px-6 lg:px-8">
		<div class="mx-auto max-w-4xl text-center">
			<h2 class="text-base font-semibold leading-7 text-background-tertiary-light">Pricing</h2>
			<p class="mt-2 text-4xl font-bold tracking-tight text-text-primary-light sm:text-5xl">
				Choose the product line that matches the job to be done
			</p>
		</div>
		<p class="mx-auto mt-6 max-w-2xl text-center text-lg leading-8 text-text-secondary-light">
			Mallard Studio handles workflow, Parchment API serves developers and agents, and Parchment
			Intelligence unlocks the full analytics layer. Enterprise stays sales-led.
		</p>

		<div
			class="isolate mx-auto mt-16 grid max-w-md grid-cols-1 gap-6 sm:mt-20 sm:gap-8 lg:mx-0 lg:max-w-none lg:grid-cols-2 xl:grid-cols-4 xl:gap-8"
		>
			{#each HOMEPAGE_PRICING_CARDS as card}
				<div
					class={`flex cursor-pointer flex-col justify-between rounded-3xl bg-background-primary-light p-8 transition-all duration-200 hover:scale-[1.02] xl:p-10 ${card.highlighted ? 'shadow-lg ring-2 ring-background-tertiary-light' : 'ring-1 ring-border-light hover:ring-2 hover:ring-background-tertiary-light'}`}
					onclick={() => handleSelectPlan(card.key, card.href)}
					onkeydown={(e) => e.key === 'Enter' && handleSelectPlan(card.key, card.href)}
					tabindex="0"
					role="button"
					aria-label={`Select ${card.name}`}
				>
					<div>
						<div class="flex items-center justify-between gap-x-4">
							<div>
								<p
									class="text-xs font-semibold uppercase tracking-[0.18em] text-background-tertiary-light"
								>
									{card.eyebrow}
								</p>
								<h3 class="mt-2 text-lg font-semibold leading-8 text-text-primary-light">
									{card.name}
								</h3>
							</div>
							<p
								class="rounded-full bg-background-tertiary-light/10 px-2.5 py-1 text-xs font-semibold leading-5 text-background-tertiary-light"
							>
								{card.badge}
							</p>
						</div>
						<p class="mt-4 text-sm leading-6 text-text-secondary-light">{card.description}</p>
						<p class="mt-6 flex flex-wrap items-end gap-x-2 gap-y-1">
							<span class="text-4xl font-bold tracking-tight text-text-primary-light"
								>{card.price}</span
							>
							<span class="text-sm font-semibold leading-6 text-text-secondary-light"
								>{card.priceDetail}</span
							>
						</p>
						<ul role="list" class="mt-8 space-y-3 text-sm leading-6 text-text-secondary-light">
							{#each card.features as feature}
								<li class="flex gap-x-3">
									<svg
										class="h-6 w-5 flex-none text-background-tertiary-light"
										viewBox="0 0 20 20"
										fill="currentColor"
									>
										<path
											fill-rule="evenodd"
											d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
											clip-rule="evenodd"
										/>
									</svg>
									{feature}
								</li>
							{/each}
						</ul>
					</div>
					<button
						onclick={(e) => {
							e.stopPropagation();
							handleSelectPlan(card.key, card.href);
						}}
						class={`mt-8 block w-full rounded-md px-3 py-2 text-center text-sm font-semibold shadow-sm transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${card.highlighted ? 'bg-background-tertiary-light text-white hover:bg-opacity-90 focus-visible:outline-background-tertiary-light' : 'border border-background-tertiary-light text-background-tertiary-light hover:bg-background-tertiary-light hover:text-white focus-visible:outline-background-tertiary-light'}`}
					>
						{card.key === 'parchment-api' && isSignedIn ? 'Open Parchment Console' : card.ctaLabel}
					</button>
				</div>
			{/each}
		</div>
	</div>
</section>
