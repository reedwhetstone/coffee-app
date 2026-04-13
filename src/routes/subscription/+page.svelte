<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';
	import { onMount } from 'svelte';
	import StripeCheckout from './StripeCheckout.svelte';
	import { signInWithGoogle } from '$lib/supabase';
	import { BILLING_PURCHASE_KEYS, type BillingPurchaseKey } from '$lib/billing/purchaseKeys';

	let { data } = $props<{ data: PageData }>();

	type ProductTone = 'success' | 'info' | 'warning' | 'muted';
	type ProductFamily = 'membership' | 'api_plan' | 'ppi_addon' | 'enterprise';

	interface ProductCardInterval {
		purchaseKey: BillingPurchaseKey;
		label: string;
		price: string;
		interval: string;
		badge?: string;
	}

	interface ProductCard {
		family: ProductFamily;
		name: string;
		headline: string;
		description: string;
		features: string[];
		managementCopy: string;
		ctaLabel: string;
		contactHref?: string;
		intervals?: ProductCardInterval[];
	}

	const productCards: ProductCard[] = [
		{
			family: 'membership',
			name: 'Mallard Studio',
			headline: 'Workflow software for roasters and coffee operators.',
			description:
				'Use Mallard Studio for inventory, roast logging, tasting notes, profitability workflows, and the CLI that supports those operating jobs.',
			features: [
				'Inventory, roast, tasting, and profit workflows',
				'Concierge and workspace tools inside the app',
				'CLI access for the same operating environment'
			],
			managementCopy: 'Manage your Studio membership and renewal state here when you own it.',
			ctaLabel: 'Unlock Mallard Studio',
			intervals: [
				{
					purchaseKey: BILLING_PURCHASE_KEYS.membershipMonthly,
					label: 'Monthly',
					price: '$9',
					interval: '/month'
				},
				{
					purchaseKey: BILLING_PURCHASE_KEYS.membershipAnnual,
					label: 'Annual',
					price: '$80',
					interval: '/year',
					badge: 'Save $28/year'
				}
			]
		},
		{
			family: 'api_plan',
			name: 'Parchment API',
			headline: 'Normalized coffee data for apps, agents, and internal tools.',
			description:
				'Start with Explorer for evaluation, then move to the paid API plan when you need production access and a stronger usage envelope.',
			features: [
				'Explorer is the free baseline tier',
				'Paid plan for production usage and integrations',
				'Parchment Console for keys, docs, and usage visibility'
			],
			managementCopy: 'Your current API tier is shown below so you can separate data access from Studio membership.',
			ctaLabel: 'Upgrade to Parchment API',
			intervals: [
				{
					purchaseKey: BILLING_PURCHASE_KEYS.apiPlanMonthly,
					label: 'Paid plan',
					price: '$99',
					interval: '/month'
				}
			]
		},
		{
			family: 'ppi_addon',
			name: 'Parchment Intelligence',
			headline: 'Premium analytics and market intelligence for sourcing decisions.',
			description:
				'Unlock the full analytics layer, full price index access, and deeper supplier, origin, and pricing visibility without changing your Studio or API plan.',
			features: [
				'Full analytics and price index access',
				'Deeper supplier, origin, and processing visibility',
				'Sold honestly on current analytics value, not future reports'
			],
			managementCopy: 'Manage Intelligence separately from your other products when you own it.',
			ctaLabel: 'Unlock Parchment Intelligence',
			intervals: [
				{
					purchaseKey: BILLING_PURCHASE_KEYS.ppiAddonMonthly,
					label: 'Monthly',
					price: '$39',
					interval: '/month'
				},
				{
					purchaseKey: BILLING_PURCHASE_KEYS.ppiAddonAnnual,
					label: 'Annual',
					price: '$350',
					interval: '/year',
					badge: 'Save $118/year'
				}
			]
		},
		{
			family: 'enterprise',
			name: 'Enterprise',
			headline: 'Sales-led support for custom integrations and commercial needs.',
			description:
				'Use Enterprise when you need embedded analytics, custom delivery patterns, support commitments, or procurement-friendly commercial terms.',
			features: [
				'Custom integrations and reporting',
				'Embedded analytics or internal dashboards',
				'Commercial support and custom delivery patterns'
			],
			managementCopy: 'Enterprise is not a self-serve SKU. Contact us to scope the right commercial path.',
			ctaLabel: 'Talk to us',
			contactHref: '/contact'
		}
	];

	let showCheckout = $state(false);
	let selectedPurchaseKey = $state<BillingPurchaseKey | null>(null);
	let selectedPlanName = $state('');
	let selectedIntervalLabel = $state('');
	let selectedPriceLabel = $state('');
	let cancelLoading = $state(false);
	let cancelError = $state('');
	let cancelSuccess = $state(false);
	let resumeLoading = $state(false);
	let resumeError = $state('');
	let resumeSuccess = $state(false);

	const membershipState = $derived(data.controlPlane?.membership ?? null);
	const apiState = $derived(data.controlPlane?.api ?? null);
	const intelligenceState = $derived(data.controlPlane?.ppi ?? null);

	const toneClasses = (tone: ProductTone) => {
		switch (tone) {
			case 'success':
				return 'border-green-500/30 bg-green-500/10 text-green-300';
			case 'info':
				return 'border-blue-500/30 bg-blue-500/10 text-blue-300';
			case 'warning':
				return 'border-orange-500/30 bg-orange-500/10 text-orange-300';
			default:
				return 'border-border-light bg-background-primary-light text-text-secondary-light';
		}
	};

	const formatDate = (unixTimestamp: number) => {
		const date = new Date(unixTimestamp * 1000);
		return date.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	};

	const normalizePlanName = (planName: string | null | undefined) => {
		if (!planName || planName.startsWith('prod_')) {
			return 'Mallard Studio Member';
		}

		return planName;
	};

	const openCheckout = (productName: string, option: ProductCardInterval) => {
		selectedPurchaseKey = option.purchaseKey;
		selectedPlanName = productName;
		selectedIntervalLabel = option.label;
		selectedPriceLabel = `${option.price}${option.interval}`;
		showCheckout = true;
	};

	async function handleSignIn() {
		try {
			await signInWithGoogle(data.supabase);
		} catch (error) {
			console.error('Error signing in:', error);
		}
	}

	const handleCheckoutSuccess = async () => {
		await invalidateAll();
	};

	const handleCheckoutCancel = () => {
		showCheckout = false;
	};

	const cancelSubscription = async () => {
		if (!data.subscription?.id) return;

		cancelLoading = true;
		cancelError = '';
		cancelSuccess = false;

		try {
			const response = await fetch('/api/stripe/cancel-subscription', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					subscriptionId: data.subscription.id
				})
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.error || 'Failed to cancel subscription');
			}

			cancelSuccess = true;
			data.subscription.cancel_at_period_end = true;
			await invalidateAll();
		} catch (error) {
			cancelError = error instanceof Error ? error.message : 'An unknown error occurred';
		} finally {
			cancelLoading = false;
		}
	};

	const resumeSubscription = async () => {
		if (!data.subscription?.id) return;

		resumeLoading = true;
		resumeError = '';
		resumeSuccess = false;

		try {
			const response = await fetch('/api/stripe/resume-subscription', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					subscriptionId: data.subscription.id
				})
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.error || 'Failed to resume subscription');
			}

			resumeSuccess = true;
			data.subscription.cancel_at_period_end = false;
			await invalidateAll();
		} catch (error) {
			resumeError = error instanceof Error ? error.message : 'An unknown error occurred';
		} finally {
			resumeLoading = false;
		}
	};

	onMount(() => {
		const url = new URL(window.location.href);
		const sessionId = url.searchParams.get('session_id');
		if (sessionId) {
			goto(`/subscription/success?session_id=${encodeURIComponent(sessionId)}`);
		}
	});
</script>

<div class="min-h-[calc(100vh-80px)] bg-background-secondary-light">
	{#if data?.user && showCheckout && selectedPurchaseKey}
		<div class="px-4 py-10 md:px-6">
			<div class="mx-auto max-w-3xl">
				<div class="mb-4 flex items-center justify-between gap-4">
					<div>
						<p class="text-sm font-semibold uppercase tracking-wide text-background-tertiary-light">
							Checkout
						</p>
						<h2 class="text-primary-light text-2xl font-semibold">
							{selectedPlanName} {selectedIntervalLabel}
						</h2>
						<p class="mt-1 text-sm text-text-secondary-light">{selectedPriceLabel}</p>
					</div>
					<button
						onclick={handleCheckoutCancel}
						class="text-primary-light/70 hover:text-primary-light rounded-full p-1"
						aria-label="Back to subscription page"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-6 w-6"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
					</button>
				</div>
				<StripeCheckout
					purchaseKey={selectedPurchaseKey}
					onSuccess={handleCheckoutSuccess}
					onCancel={handleCheckoutCancel}
				/>
			</div>
		</div>
	{:else}
		<section class="px-4 py-10 md:px-6">
			<div class="mx-auto max-w-6xl space-y-8">
				<div class="space-y-3">
					<p class="text-sm font-semibold uppercase tracking-wide text-background-tertiary-light">
						Pricing and account state
					</p>
					<h1 class="text-3xl font-bold text-text-primary-light sm:text-4xl">
						Choose the right product for how you use Purveyors
					</h1>
					<p class="max-w-4xl text-base text-text-secondary-light">
						/subscription is a pricing and account-state surface, not a generic membership blob. Use
						it to compare Mallard Studio, Parchment API, Parchment Intelligence, and Enterprise, then
						manage the products already attached to your account.
					</p>
				</div>

				{#if data?.user && data.controlPlane}
					<div class="grid gap-4 md:grid-cols-3">
						<div class="rounded-2xl border border-border-light bg-background-primary-light p-5">
							<p class="text-xs font-semibold uppercase tracking-wide text-text-secondary-light">
								Mallard Studio status
							</p>
							<p class="mt-2 text-2xl font-semibold text-text-primary-light">
								{membershipState?.statusLabel}
							</p>
							<p class="mt-2 text-sm text-text-secondary-light">{membershipState?.sourceLabel}</p>
						</div>
						<div class="rounded-2xl border border-border-light bg-background-primary-light p-5">
							<p class="text-xs font-semibold uppercase tracking-wide text-text-secondary-light">
								Parchment API tier
							</p>
							<p class="mt-2 text-2xl font-semibold text-text-primary-light">
								{apiState?.statusLabel}
							</p>
							<p class="mt-2 text-sm text-text-secondary-light">{apiState?.note}</p>
						</div>
						<div class="rounded-2xl border border-border-light bg-background-primary-light p-5">
							<p class="text-xs font-semibold uppercase tracking-wide text-text-secondary-light">
								Parchment Intelligence
							</p>
							<p class="mt-2 text-2xl font-semibold text-text-primary-light">
								{intelligenceState?.statusLabel}
							</p>
							<p class="mt-2 text-sm text-text-secondary-light">{intelligenceState?.note}</p>
						</div>
					</div>
				{/if}

				<div class="grid gap-6 xl:grid-cols-2">
					{#each productCards as product}
						<div class="rounded-3xl border border-border-light bg-background-primary-light p-6 shadow-sm">
							<div class="flex items-start justify-between gap-4">
								<div>
									<h2 class="text-2xl font-semibold text-text-primary-light">{product.name}</h2>
									<p class="mt-1 text-sm font-medium text-background-tertiary-light">
										{product.headline}
									</p>
								</div>
								{#if data?.user && product.family === 'membership' && membershipState}
									<span
										class={`rounded-full border px-3 py-1 text-xs font-semibold ${toneClasses(membershipState.tone)}`}
									>
										{membershipState.statusLabel}
									</span>
								{:else if data?.user && product.family === 'api_plan' && apiState}
									<span
										class={`rounded-full border px-3 py-1 text-xs font-semibold ${toneClasses(apiState.tone)}`}
									>
										{apiState.statusLabel}
									</span>
								{:else if data?.user && product.family === 'ppi_addon' && intelligenceState}
									<span
										class={`rounded-full border px-3 py-1 text-xs font-semibold ${toneClasses(intelligenceState.tone)}`}
									>
										{intelligenceState.statusLabel}
									</span>
								{:else if product.family === 'enterprise'}
									<span
										class="rounded-full border border-border-light bg-background-secondary-light px-3 py-1 text-xs font-semibold text-text-secondary-light"
									>
										Contact sales
									</span>
								{/if}
							</div>

							<p class="mt-4 text-sm text-text-secondary-light">{product.description}</p>

							<ul class="mt-5 space-y-3 text-sm text-text-secondary-light">
								{#each product.features as feature}
									<li class="flex gap-3">
										<span class="mt-1 h-2 w-2 rounded-full bg-background-tertiary-light"></span>
										<span>{feature}</span>
									</li>
								{/each}
							</ul>

							<div class="mt-5 rounded-2xl border border-border-light bg-background-secondary-light p-4">
								<p class="text-xs font-semibold uppercase tracking-wide text-text-secondary-light">
									Account state
								</p>
								{#if !data?.user}
									<p class="mt-2 text-sm text-text-secondary-light">
										Sign in to see what your account already owns. Until then, this page shows the live
										pricing story and available purchase paths.
									</p>
								{:else if product.family === 'membership'}
									<p class="mt-2 text-sm text-text-secondary-light">{product.managementCopy}</p>
									{#if data.subscription}
										<div class="mt-4 grid grid-cols-2 gap-3 text-sm text-text-secondary-light">
											<span>Status</span>
											<span class="text-right font-medium text-text-primary-light">
												{data.subscription.status}
												{#if data.subscription.cancel_at_period_end}
													<span class="text-orange-400"> (canceling)</span>
												{/if}
											</span>

											<span>Plan</span>
											<span class="text-right font-medium text-text-primary-light">
												{normalizePlanName(data.subscription.plan?.name)}
											</span>

											<span>Renews or ends</span>
											<span class="text-right font-medium text-text-primary-light">
												{data.subscription.current_period_end
													? formatDate(data.subscription.current_period_end)
													: 'N/A'}
											</span>
										</div>

										<div class="mt-4 space-y-3">
											{#if !membershipState?.canManageSubscription && membershipState?.managementBlockedReason}
												<div class="rounded-2xl border border-orange-500/30 bg-orange-500/10 p-4 text-sm text-orange-300">
													{membershipState.managementBlockedReason}
												</div>
											{:else if data.subscription.cancel_at_period_end}
												<button
													onclick={() => resumeSubscription()}
													disabled={resumeLoading}
													class="w-full rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-300 transition-colors hover:bg-blue-500/20 disabled:opacity-50"
												>
													{resumeLoading ? 'Processing...' : 'Resume Studio membership'}
												</button>
												{#if resumeSuccess}
													<p class="text-sm text-green-400">
														Mallard Studio will continue renewing automatically.
													</p>
												{/if}
												{#if resumeError}
													<p class="text-sm text-red-400">Error: {resumeError}</p>
												{/if}
											{:else}
												<button
													onclick={() => cancelSubscription()}
													disabled={cancelLoading}
													class="w-full rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/20 disabled:opacity-50"
												>
													{cancelLoading ? 'Processing...' : 'Cancel at period end'}
												</button>
												<p class="text-xs text-text-secondary-light">
													Studio access continues through the current billing period.
												</p>
												{#if cancelSuccess}
													<p class="text-sm text-green-400">
														Mallard Studio cancellation has been scheduled.
													</p>
												{/if}
												{#if cancelError}
													<p class="text-sm text-red-400">Error: {cancelError}</p>
												{/if}
											{/if}
										</div>
									{:else}
										<p class="mt-2 text-sm text-text-secondary-light">
											No live Mallard Studio subscription is attached to this account yet.
										</p>
									{/if}
								{:else if product.family === 'api_plan'}
									<p class="mt-2 text-sm text-text-secondary-light">{apiState?.description}</p>
								{:else if product.family === 'ppi_addon'}
									<p class="mt-2 text-sm text-text-secondary-light">{intelligenceState?.description}</p>
								{:else}
									<p class="mt-2 text-sm text-text-secondary-light">{product.managementCopy}</p>
								{/if}
							</div>

							{#if product.intervals?.length}
								<div class="mt-5 grid gap-3 sm:grid-cols-2">
									{#each product.intervals as option}
										<div class="rounded-2xl border border-border-light bg-background-secondary-light p-4">
											<div class="flex items-start justify-between gap-3">
												<div>
													<p class="text-sm font-semibold text-text-primary-light">{option.label}</p>
													<p class="mt-1 text-2xl font-bold text-text-primary-light">
														{option.price}<span class="ml-1 text-sm font-normal text-text-secondary-light"
															>{option.interval}</span
														>
													</p>
												</div>
												{#if option.badge}
													<span class="rounded-full bg-green-500/15 px-3 py-1 text-xs font-semibold text-green-300">
														{option.badge}
													</span>
												{/if}
											</div>

											{#if !data?.user}
												<button
													onclick={handleSignIn}
													class="mt-4 w-full rounded-lg bg-background-tertiary-light px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
												>
													Sign in to continue
												</button>
											{:else if product.family === 'membership' && membershipState?.hasAccess}
												<div class="mt-4 rounded-lg border border-border-light px-4 py-2 text-center text-sm text-text-secondary-light">
													Already active on your account
												</div>
											{:else if product.family === 'api_plan' && apiState?.plan !== 'viewer'}
												<div class="mt-4 rounded-lg border border-border-light px-4 py-2 text-center text-sm text-text-secondary-light">
													Already active on your account
												</div>
											{:else if product.family === 'ppi_addon' && intelligenceState?.enabled}
												<div class="mt-4 rounded-lg border border-border-light px-4 py-2 text-center text-sm text-text-secondary-light">
													Already active on your account
												</div>
											{:else}
												<button
													onclick={() => openCheckout(product.name, option)}
													class="mt-4 w-full rounded-lg bg-background-tertiary-light px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
												>
													{product.ctaLabel}
												</button>
											{/if}
										</div>
									{/each}
								</div>
							{:else}
								<a
									href={product.contactHref}
									class="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-text-primary-light px-4 py-2 text-sm font-semibold text-background-primary-light transition-opacity hover:opacity-90"
								>
									{product.ctaLabel}
								</a>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		</section>
	{/if}
</div>
