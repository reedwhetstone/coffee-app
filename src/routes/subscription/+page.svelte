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
		eyebrow: string;
		headline: string;
		description: string;
		features: string[];
		managementCopy: string;
		anonymousStateCopy: string;
		activeStateCopy: string;
		inactiveStateCopy: string;
		ctaLabel: string;
		activeCtaLabel?: string;
		contactHref?: string;
		intervals?: ProductCardInterval[];
		learnMoreHref?: string;
	}

	const productCards: ProductCard[] = [
		{
			family: 'membership',
			name: 'Mallard Studio',
			eyebrow: 'For roasters and operators',
			headline: 'Run inventory, roasting, cupping, and margin tracking in one place.',
			description:
				'Mallard Studio is the operating workspace for coffee teams that need cleaner production workflows, better record-keeping, and fewer spreadsheets.',
			features: [
				'Inventory, roast logs, cupping notes, and profit workflows',
				'Workspace tools for day-to-day production and team handoff',
				'CLI access for the same operating environment'
			],
			managementCopy:
				'Review your Studio membership, renewal timing, and any changes to billing here.',
			anonymousStateCopy:
				'Sign in to see whether this account already has Studio access. You can still compare plans before you do.',
			activeStateCopy: 'Studio is active on this account and ready for day-to-day work.',
			inactiveStateCopy: 'No Studio membership is attached to this account yet.',
			ctaLabel: 'Start Studio',
			activeCtaLabel: 'Studio active',
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
			],
			learnMoreHref: '/catalog'
		},
		{
			family: 'api_plan',
			name: 'Parchment API',
			eyebrow: 'For apps, agents, and data workflows',
			headline: 'Bring normalized green coffee data into your own product or internal stack.',
			description:
				'Start with Green to evaluate the dataset, then move to Origin when you need production access, stronger limits, and an account-aware console.',
			features: [
				'Free Green tier for evaluation and testing',
				'Origin for production integrations and higher usage',
				'Parchment Console for keys, docs, and usage visibility'
			],
			managementCopy:
				'Your current API tier appears here so billing stays clear and separate from Studio.',
			anonymousStateCopy:
				'Sign in to view your current API tier, or keep browsing plans if you are still evaluating.',
			activeStateCopy: 'This account already has paid API access.',
			inactiveStateCopy: 'This account is currently on the free Green tier.',
			ctaLabel: 'Choose Origin',
			activeCtaLabel: 'API plan active',
			intervals: [
				{
					purchaseKey: BILLING_PURCHASE_KEYS.apiPlanMonthly,
					label: 'Origin',
					price: '$99',
					interval: '/month'
				}
			],
			learnMoreHref: '/api'
		},
		{
			family: 'ppi_addon',
			name: 'Parchment Intelligence',
			eyebrow: 'For deeper market visibility',
			headline: 'Get fuller pricing visibility, supplier context, and market analysis.',
			description:
				'Add the premium analytics layer when your team needs richer sourcing visibility without changing your Studio or API plan.',
			features: [
				'Full analytics and price index access',
				'Deeper supplier, origin, and processing visibility',
				'Built for sourcing decisions, not internal dashboards'
			],
			managementCopy:
				'Manage Parchment Intelligence separately so analytics access stays clear and product-specific.',
			anonymousStateCopy:
				'Sign in to see whether Intelligence is already enabled for this account, or compare the add-on first.',
			activeStateCopy: 'Parchment Intelligence is already active on this account.',
			inactiveStateCopy: 'Parchment Intelligence is not active on this account yet.',
			ctaLabel: 'Add Intelligence',
			activeCtaLabel: 'Intelligence active',
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
			],
			learnMoreHref: '/analytics'
		},
		{
			family: 'enterprise',
			name: 'Enterprise',
			eyebrow: 'For custom commercial needs',
			headline: 'Plan a tailored engagement for teams that need more than self-serve.',
			description:
				'Choose Enterprise when you need custom integrations, embedded analytics, procurement support, or commercial terms shaped around your workflow.',
			features: [
				'Custom integrations and reporting',
				'Embedded analytics or internal dashboards',
				'Commercial support and tailored delivery patterns'
			],
			managementCopy:
				'Enterprise is handled with the team directly rather than through self-serve checkout.',
			anonymousStateCopy:
				'If you need a tailored rollout, talk with us and we will map the right commercial path.',
			activeStateCopy: 'Enterprise engagements are managed directly with the team.',
			inactiveStateCopy: 'Enterprise is available through a scoped conversation.',
			ctaLabel: 'Talk to sales',
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
	const isSignedIn = $derived(Boolean(data?.user));

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

	function getProductState(product: ProductCard) {
		if (!isSignedIn) {
			return {
				label: 'Sign in for account details',
				description: product.anonymousStateCopy,
				tone: 'muted' as ProductTone
			};
		}

		if (product.family === 'membership' && membershipState) {
			return {
				label: membershipState.statusLabel,
				description: membershipState.hasAccess
					? product.activeStateCopy
					: product.inactiveStateCopy,
				tone: membershipState.tone
			};
		}

		if (product.family === 'api_plan' && apiState) {
			const isActive = apiState.plan !== 'viewer';
			return {
				label: apiState.statusLabel,
				description: isActive ? product.activeStateCopy : product.inactiveStateCopy,
				tone: apiState.tone
			};
		}

		if (product.family === 'ppi_addon' && intelligenceState) {
			return {
				label: intelligenceState.statusLabel,
				description: intelligenceState.enabled
					? product.activeStateCopy
					: product.inactiveStateCopy,
				tone: intelligenceState.tone
			};
		}

		return {
			label: 'Talk with us',
			description: product.inactiveStateCopy,
			tone: 'info' as ProductTone
		};
	}

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

	const accountOverviewItems = $derived.by(() => {
		if (!isSignedIn) {
			return [
				{
					label: 'Best for operators',
					value: 'Mallard Studio',
					description: 'Inventory, roast logging, cupping, and day-to-day production workflows.'
				},
				{
					label: 'Best for product teams',
					value: 'Parchment API',
					description: 'Normalized coffee data for apps, agents, and internal tooling.'
				},
				{
					label: 'Best for sourcing visibility',
					value: 'Parchment Intelligence',
					description: 'A richer market view with supplier context, pricing depth, and analytics.'
				}
			];
		}

		return [
			{
				label: 'Mallard Studio',
				value: membershipState?.statusLabel ?? 'Unknown',
				description: membershipState?.sourceLabel ?? 'Membership status is unavailable right now.'
			},
			{
				label: 'Parchment API',
				value: apiState?.statusLabel ?? 'Unknown',
				description: apiState?.description ?? 'API plan details are unavailable right now.'
			},
			{
				label: 'Parchment Intelligence',
				value: intelligenceState?.statusLabel ?? 'Unknown',
				description:
					intelligenceState?.description ?? 'Intelligence details are unavailable right now.'
			}
		];
	});

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

<div class="min-h-[calc(100vh-80px)] bg-background-primary-light">
	{#if data?.user && showCheckout && selectedPurchaseKey}
		<div class="px-4 py-10 md:px-6">
			<div class="mx-auto max-w-3xl">
				<div class="mb-4 flex items-center justify-between gap-4">
					<div>
						<p class="text-sm font-semibold uppercase tracking-wide text-background-tertiary-light">
							Checkout
						</p>
						<h2 class="text-primary-light text-2xl font-semibold">
							{selectedPlanName}
							{selectedIntervalLabel}
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
		<section
			class="border-b border-border-light bg-background-secondary-light px-4 py-14 md:px-6 md:py-20"
		>
			<div
				class="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(20rem,0.9fr)] lg:items-end"
			>
				<div class="max-w-3xl space-y-5">
					<p
						class="text-sm font-semibold uppercase tracking-[0.2em] text-background-tertiary-light"
					>
						Plans and account
					</p>
					<h1 class="text-4xl font-bold tracking-tight text-text-primary-light sm:text-5xl">
						Pricing that stays connected to the rest of the public site.
					</h1>
					<p class="text-lg leading-8 text-text-secondary-light">
						Review Mallard Studio, Parchment API, Parchment Intelligence, and Enterprise in one
						place. Signed-out visitors can compare products without leaving the marketing site, and
						signed-in customers can see what is active before making a change.
					</p>
					<div class="flex flex-wrap gap-3">
						<button
							onclick={() => goto('/catalog')}
							class="rounded-xl border border-border-light bg-background-primary-light px-4 py-3 text-sm font-medium text-text-primary-light transition-colors hover:border-background-tertiary-light/40 hover:text-background-tertiary-light"
						>
							Browse catalog
						</button>
						<button
							onclick={() => goto('/api')}
							class="rounded-xl border border-border-light bg-background-primary-light px-4 py-3 text-sm font-medium text-text-primary-light transition-colors hover:border-background-tertiary-light/40 hover:text-background-tertiary-light"
						>
							Explore API
						</button>
						{#if !data?.user}
							<button
								onclick={handleSignIn}
								class="rounded-xl bg-background-tertiary-light px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
							>
								Sign in to view your account
							</button>
						{/if}
					</div>
				</div>

				<div
					class="rounded-3xl border border-border-light bg-background-primary-light p-6 shadow-sm"
				>
					<p class="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary-light">
						Account overview
					</p>
					<h2 class="mt-3 text-2xl font-semibold text-text-primary-light">
						{isSignedIn
							? 'Current product access on this account'
							: 'How the product line is organized'}
					</h2>
					<p class="mt-2 text-sm leading-7 text-text-secondary-light">
						{isSignedIn
							? 'Use this page to confirm what is active before you start a checkout or change your billing.'
							: 'Each offer serves a different job to be done, so you can compare the right surface before creating an account.'}
					</p>

					<div class="mt-5 space-y-4">
						{#each accountOverviewItems as item}
							<div class="rounded-2xl border border-border-light bg-background-secondary-light p-4">
								<div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
									<div>
										<p
											class="text-xs font-semibold uppercase tracking-wide text-text-secondary-light"
										>
											{item.label}
										</p>
										<p class="mt-1 text-base font-semibold text-text-primary-light">{item.value}</p>
									</div>
								</div>
								<p class="mt-2 text-sm leading-6 text-text-secondary-light">{item.description}</p>
							</div>
						{/each}
					</div>
				</div>
			</div>
		</section>

		<section class="px-4 py-8 md:px-6 md:py-10">
			<div class="mx-auto max-w-6xl space-y-8">
				<div class="grid gap-6 xl:grid-cols-2">
					{#each productCards as product}
						{@const state = getProductState(product)}
						<div
							class="rounded-3xl border border-border-light bg-background-primary-light p-6 shadow-sm"
						>
							<div class="flex items-start justify-between gap-4">
								<div class="space-y-2">
									<p
										class="text-xs font-semibold uppercase tracking-[0.18em] text-background-tertiary-light"
									>
										{product.eyebrow}
									</p>
									<h2 class="text-2xl font-semibold text-text-primary-light">{product.name}</h2>
									<p class="text-sm font-medium text-text-primary-light">{product.headline}</p>
								</div>
								<span
									class={`rounded-full border px-3 py-1 text-xs font-semibold ${toneClasses(state.tone)}`}
								>
									{product.family === 'enterprise' ? 'Contact sales' : state.label}
								</span>
							</div>

							<p class="mt-4 text-sm leading-7 text-text-secondary-light">{product.description}</p>

							<ul class="mt-5 space-y-3 text-sm text-text-secondary-light">
								{#each product.features as feature}
									<li class="flex gap-3">
										<span class="mt-1 h-2 w-2 rounded-full bg-background-tertiary-light"></span>
										<span>{feature}</span>
									</li>
								{/each}
							</ul>

							<div
								class="mt-5 rounded-2xl border border-border-light bg-background-secondary-light p-4"
							>
								<div class="flex items-start justify-between gap-3">
									<div>
										<p
											class="text-xs font-semibold uppercase tracking-wide text-text-secondary-light"
										>
											Account state
										</p>
										<p class="mt-2 text-base font-semibold text-text-primary-light">
											{state.label}
										</p>
									</div>
								</div>

								<p class="mt-3 text-sm leading-7 text-text-secondary-light">{state.description}</p>

								{#if !data?.user}
									<div
										class="mt-3 rounded-2xl border border-dashed border-border-light bg-background-primary-light p-4"
									>
										<p class="text-sm text-text-secondary-light">{product.managementCopy}</p>
										<button
											onclick={handleSignIn}
											class="mt-3 inline-flex rounded-lg bg-background-tertiary-light px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
										>
											Sign in for account details
										</button>
									</div>
								{:else if product.family === 'membership'}
									<p class="mt-3 text-sm text-text-secondary-light">{product.managementCopy}</p>
									{#if data.subscription}
										<div
											class="mt-4 rounded-2xl border border-border-light bg-background-primary-light p-4"
										>
											<p
												class="text-xs font-semibold uppercase tracking-wide text-text-secondary-light"
											>
												Membership billing
											</p>
											<div class="mt-3 grid grid-cols-2 gap-3 text-sm text-text-secondary-light">
												<span>Status</span>
												<span class="text-right font-medium text-text-primary-light">
													{data.subscription.status}
													{#if data.subscription.cancel_at_period_end}
														<span class="text-orange-400"> (ends at renewal)</span>
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
										</div>

										<div class="mt-4 space-y-3">
											{#if !membershipState?.canManageSubscription && membershipState?.managementBlockedReason}
												<div
													class="rounded-2xl border border-orange-500/30 bg-orange-500/10 p-4 text-sm text-orange-300"
												>
													{membershipState.managementBlockedReason}
												</div>
											{:else if data.subscription.cancel_at_period_end}
												<button
													onclick={() => resumeSubscription()}
													disabled={resumeLoading}
													class="w-full rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-300 transition-colors hover:bg-blue-500/20 disabled:opacity-50"
												>
													{resumeLoading ? 'Processing...' : 'Keep Studio active'}
												</button>
												{#if resumeSuccess}
													<p class="text-sm text-green-400">
														Studio will continue renewing automatically.
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
													{cancelLoading ? 'Processing...' : 'End at renewal'}
												</button>
												<p class="text-xs text-text-secondary-light">
													Studio access stays active through the current billing period.
												</p>
												{#if cancelSuccess}
													<p class="text-sm text-green-400">
														Studio will end at the close of the current billing period.
													</p>
												{/if}
												{#if cancelError}
													<p class="text-sm text-red-400">Error: {cancelError}</p>
												{/if}
											{/if}
										</div>
									{:else}
										<div
											class="mt-3 rounded-2xl border border-dashed border-border-light bg-background-primary-light p-4 text-sm text-text-secondary-light"
										>
											{product.inactiveStateCopy}
										</div>
									{/if}
								{:else if product.family === 'api_plan'}
									<div
										class="mt-3 rounded-2xl border border-dashed border-border-light bg-background-primary-light p-4"
									>
										<p class="text-sm leading-7 text-text-secondary-light">
											{apiState?.description}
										</p>
										<p class="mt-2 text-sm text-text-secondary-light">{apiState?.note}</p>
									</div>
								{:else if product.family === 'ppi_addon'}
									<div
										class="mt-3 rounded-2xl border border-dashed border-border-light bg-background-primary-light p-4"
									>
										<p class="text-sm leading-7 text-text-secondary-light">
											{intelligenceState?.description}
										</p>
										<p class="mt-2 text-sm text-text-secondary-light">{intelligenceState?.note}</p>
									</div>
								{:else}
									<div
										class="mt-3 rounded-2xl border border-dashed border-border-light bg-background-primary-light p-4 text-sm text-text-secondary-light"
									>
										{product.managementCopy}
									</div>
								{/if}
							</div>

							{#if product.intervals?.length}
								<div class="mt-5 grid gap-3 sm:grid-cols-2">
									{#each product.intervals as option}
										<div
											class="rounded-2xl border border-border-light bg-background-secondary-light p-4"
										>
											<div class="flex items-start justify-between gap-3">
												<div>
													<p class="text-sm font-semibold text-text-primary-light">
														{option.label}
													</p>
													<p class="mt-1 text-2xl font-bold text-text-primary-light">
														{option.price}<span
															class="ml-1 text-sm font-normal text-text-secondary-light"
															>{option.interval}</span
														>
													</p>
												</div>
												{#if option.badge}
													<span
														class="rounded-full bg-green-500/15 px-3 py-1 text-xs font-semibold text-green-300"
													>
														{option.badge}
													</span>
												{/if}
											</div>

											{#if !data?.user}
												<div class="mt-4 space-y-2">
													<button
														onclick={handleSignIn}
														class="w-full rounded-lg bg-background-tertiary-light px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
													>
														Sign in to continue
													</button>
													{#if product.learnMoreHref}
														<a
															href={product.learnMoreHref}
															class="inline-flex w-full items-center justify-center rounded-lg border border-border-light px-4 py-2 text-sm font-medium text-text-primary-light transition-colors hover:border-background-tertiary-light/40 hover:text-background-tertiary-light"
														>
															Learn more
														</a>
													{/if}
												</div>
											{:else if product.family === 'membership' && membershipState?.hasAccess}
												<div
													class="mt-4 rounded-lg border border-border-light px-4 py-2 text-center text-sm text-text-secondary-light"
												>
													{product.activeCtaLabel}
												</div>
											{:else if product.family === 'api_plan' && apiState?.plan !== 'viewer'}
												<div
													class="mt-4 rounded-lg border border-border-light px-4 py-2 text-center text-sm text-text-secondary-light"
												>
													{product.activeCtaLabel}
												</div>
											{:else if product.family === 'ppi_addon' && intelligenceState?.enabled}
												<div
													class="mt-4 rounded-lg border border-border-light px-4 py-2 text-center text-sm text-text-secondary-light"
												>
													{product.activeCtaLabel}
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
