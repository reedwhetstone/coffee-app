<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import StripeCheckout from './StripeCheckout.svelte';
	import { signInWithGoogle } from '$lib/supabase';
	import { BILLING_PURCHASE_KEYS, type BillingPurchaseKey } from '$lib/billing/purchaseKeys';
	import {
		clearSubscriptionMutationRequestId,
		getOrCreateSubscriptionMutationRequestId,
		isPendingSubscriptionMutation,
		isTerminalSubscriptionMutation
	} from '$lib/billing/subscriptionMutation';

	let { data } = $props<{ data: PageData }>();

	type ProductTone = 'success' | 'info' | 'warning' | 'muted';
	type ProductFamily = 'membership' | 'api_plan' | 'ppi_addon' | 'enterprise';

	interface ProductCardInterval {
		purchaseKey: BillingPurchaseKey;
		label: string;
		price: string;
		interval: string;
		badge?: string;
		planSlug: string;
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

	// Plan slug to purchase key mapping for intent preservation
	const planSlugMap: Record<string, BillingPurchaseKey> = {
		'intelligence-monthly': BILLING_PURCHASE_KEYS.ppiAddonMonthly,
		'intelligence-annual': BILLING_PURCHASE_KEYS.ppiAddonAnnual,
		'studio-monthly': BILLING_PURCHASE_KEYS.membershipMonthly,
		'studio-annual': BILLING_PURCHASE_KEYS.membershipAnnual,
		'api-monthly': BILLING_PURCHASE_KEYS.apiPlanMonthly
	};

	const productCards: ProductCard[] = [
		{
			family: 'ppi_addon',
			name: 'Parchment Intelligence',
			eyebrow: 'Analytics flagship',
			headline:
				'Supplier comparisons, arrivals and delistings, origin benchmarks, and the weekly procurement brief.',
			description:
				'Parchment Intelligence gives sourcing pros the full market view: supplier health, arriving and departing lots, origin benchmarks, and price history depth across 40+ US importers.',
			features: [
				'Weekly procurement brief with market movements and notable arrivals',
				'Supplier comparisons and supplier health scoring',
				'Arrivals feed and delisting alerts by origin and supplier',
				'Origin benchmarks and price history depth',
				'Extended price-trend depth across every Market Index view'
			],
			managementCopy: 'Manage Parchment Intelligence billing and access here.',
			anonymousStateCopy: 'Sign in to see what is on this account.',
			activeStateCopy: 'Parchment Intelligence is active on this account.',
			inactiveStateCopy: 'Parchment Intelligence is not active on this account yet.',
			ctaLabel: 'Start Intelligence',
			activeCtaLabel: 'Intelligence active',
			intervals: [
				{
					purchaseKey: BILLING_PURCHASE_KEYS.ppiAddonMonthly,
					label: 'Monthly',
					price: '$39',
					interval: '/month',
					planSlug: 'intelligence-monthly'
				},
				{
					purchaseKey: BILLING_PURCHASE_KEYS.ppiAddonAnnual,
					label: 'Annual',
					price: '$350',
					interval: '/year',
					badge: 'Save $118/year',
					planSlug: 'intelligence-annual'
				}
			],
			learnMoreHref: '/analytics'
		},
		{
			family: 'api_plan',
			name: 'Parchment API',
			eyebrow: 'Data access',
			headline: 'Normalized green coffee data from 40+ suppliers through one REST API.',
			description:
				'Start with the free Green tier to evaluate the dataset, then move to Origin for production integrations, higher rate limits, and an account-aware console.',
			features: [
				'Daily-updated catalog from 40+ US specialty importers',
				'Consistent schema across all supplier sources',
				'Origin tier for production integrations and higher usage limits',
				'Parchment Console for API keys, docs, and usage visibility'
			],
			managementCopy:
				'Your current API tier is shown here so billing stays clear and separate from Studio.',
			anonymousStateCopy: 'Sign in to see what is on this account.',
			activeStateCopy: 'This account has paid API access.',
			inactiveStateCopy: 'This account is on the free Green tier.',
			ctaLabel: 'Upgrade to Origin',
			activeCtaLabel: 'API plan active',
			intervals: [
				{
					purchaseKey: BILLING_PURCHASE_KEYS.apiPlanMonthly,
					label: 'Origin',
					price: '$99',
					interval: '/month',
					planSlug: 'api-monthly'
				}
			],
			learnMoreHref: '/api'
		},
		{
			family: 'membership',
			name: 'Mallard Studio',
			eyebrow: 'Roaster operations',
			headline: 'Inventory, roast logs, and profit tracking for roasters running production.',
			description:
				'Mallard Studio is the operating workspace for coffee teams that need cleaner production workflows, better record-keeping, and fewer spreadsheets.',
			features: [
				'Green coffee inventory and lot tracking',
				'Roast logs with profile charting and cupping notes',
				'Profit and margin tracking across production',
				'Workspace tools for team handoff and day-to-day operations'
			],
			managementCopy: 'Review your Studio membership, renewal timing, and billing here.',
			anonymousStateCopy: 'Sign in to see what is on this account.',
			activeStateCopy: 'Studio is active on this account.',
			inactiveStateCopy: 'No Studio membership is attached to this account yet.',
			ctaLabel: 'Start Studio',
			activeCtaLabel: 'Studio active',
			intervals: [
				{
					purchaseKey: BILLING_PURCHASE_KEYS.membershipMonthly,
					label: 'Monthly',
					price: '$9',
					interval: '/month',
					planSlug: 'studio-monthly'
				},
				{
					purchaseKey: BILLING_PURCHASE_KEYS.membershipAnnual,
					label: 'Annual',
					price: '$80',
					interval: '/year',
					badge: 'Save $28/year',
					planSlug: 'studio-annual'
				}
			],
			learnMoreHref: '/catalog'
		},
		{
			family: 'enterprise',
			name: 'Enterprise',
			eyebrow: 'Custom commercial needs',
			headline:
				'Tailored integrations, embedded analytics, and commercial terms for teams that need more than self-serve.',
			description:
				'Choose Enterprise for custom integrations, embedded analytics, procurement support, or commercial terms shaped around your workflow.',
			features: [
				'Custom integrations and reporting pipelines',
				'Embedded analytics or internal dashboards',
				'Procurement support and tailored delivery',
				'Commercial support and custom contractual terms'
			],
			managementCopy: 'Enterprise engagements are managed directly with the team.',
			anonymousStateCopy: 'Talk with us to map the right commercial path.',
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
	let mutationLoading = $state<string | null>(null);
	let mutationMessages = $state<Record<string, string>>({});
	let mutationErrors = $state<Record<string, string>>({});

	const membershipState = $derived(
		data.accountState
			? {
					hasAccess: data.accountState.role === 'member' || data.accountState.role === 'admin',
					statusLabel:
						data.accountState.role === 'admin'
							? 'Admin access'
							: data.accountState.role === 'member'
								? 'Membership active'
								: 'Free viewer access',
					tone:
						data.accountState.role === 'admin'
							? ('info' as ProductTone)
							: data.accountState.role === 'member'
								? ('success' as ProductTone)
								: ('muted' as ProductTone),
					sourceLabel:
						'Access is resolved by Parchment from the canonical billing and entitlement lifecycle.'
				}
			: null
	);
	const apiState = $derived(
		data.accountState
			? {
					plan: data.accountState.apiPlan,
					statusLabel:
						data.accountState.apiPlan === 'enterprise'
							? 'Enterprise'
							: data.accountState.apiPlan === 'member'
								? 'Origin'
								: 'Green',
					tone:
						data.accountState.apiPlan === 'viewer'
							? ('muted' as ProductTone)
							: ('success' as ProductTone),
					description: `Your account currently resolves to the ${data.accountState.apiPlan === 'member' ? 'Origin' : data.accountState.apiPlan === 'enterprise' ? 'Enterprise' : 'Green'} API tier.`,
					note: 'Parchment owns API billing and entitlement decisions.'
				}
			: null
	);
	const intelligenceState = $derived(
		data.accountState
			? {
					enabled: data.accountState.ppiAccess,
					statusLabel: data.accountState.ppiAccess
						? 'Parchment Intelligence active'
						: 'Parchment Intelligence not active',
					tone: data.accountState.ppiAccess ? ('success' as ProductTone) : ('muted' as ProductTone),
					description: data.accountState.ppiAccess
						? 'Your account includes the full analytics and market-intelligence layer.'
						: 'Your account keeps the baseline public analytics surface.',
					note: 'Parchment owns Intelligence billing and entitlement decisions.'
				}
			: null
	);
	const isSignedIn = $derived(data.auth.isSignedIn);

	// Purchase intent from URL params (set before sign-in to preserve selection).
	// Auto-open is gated on the explicit `intent=checkout` marker so that
	// bookmarks/shared links like `/subscription?plan=api-monthly` only highlight
	// the card; they don't force the Stripe modal open.
	const intendedPlanSlug = $derived(page.url.searchParams.get('plan'));
	const hasCheckoutIntent = $derived(page.url.searchParams.get('intent') === 'checkout');
	const intendedPurchaseKey = $derived(
		intendedPlanSlug ? (planSlugMap[intendedPlanSlug] ?? null) : null
	);

	// Build a sign-in href that forwards the current subscription page (with
	// any plan/intent params) as the post-auth target, so a signed-out visitor
	// who followed a deep-link like /subscription?plan=X&intent=checkout still
	// lands back on the page with auto-open ready to fire after OAuth.
	const signInHref = $derived.by(() => {
		const next = `/subscription${page.url.search}`;
		return `/auth?next=${encodeURIComponent(next)}`;
	});

	const toneClasses = (tone: ProductTone) => {
		switch (tone) {
			case 'success':
				return 'border-success/30 bg-success-subtle text-success-strong';
			case 'info':
				return 'border-info/30 bg-info-subtle text-info-strong';
			case 'warning':
				return 'border-warning/30 bg-warning-subtle text-warning-strong';
			default:
				return 'border-line bg-surface-canvas text-muted';
		}
	};

	const formatDate = (timestamp: string | null) => {
		if (!timestamp) return 'Not available';
		const date = new Date(timestamp);
		return date.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	};

	const openCheckout = (productName: string, option: ProductCardInterval) => {
		selectedPurchaseKey = option.purchaseKey;
		selectedPlanName = productName;
		selectedIntervalLabel = option.label;
		selectedPriceLabel = `${option.price}${option.interval}`;
		showCheckout = true;
	};

	const openCheckoutByKey = (purchaseKey: BillingPurchaseKey) => {
		for (const product of productCards) {
			if (!product.intervals) continue;
			for (const option of product.intervals) {
				if (option.purchaseKey === purchaseKey) {
					openCheckout(product.name, option);
					return;
				}
			}
		}
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

	// Build a sign-in URL that preserves the plan intent
	function signInForPlan(planSlug: string) {
		const nextUrl = `/subscription?plan=${planSlug}&intent=checkout`;
		signInWithGoogle(data.supabase, nextUrl);
	}

	const handleCheckoutSuccess = async () => {
		await goto('/subscription/success');
	};

	const handleCheckoutCancel = () => {
		showCheckout = false;
	};

	const accountOverviewItems = $derived.by(() => {
		if (!isSignedIn) {
			return [
				{
					label: 'Sourcing and procurement',
					value: 'Parchment Intelligence',
					description:
						'Supplier comparisons, arrivals, delistings, origin benchmarks, and the weekly procurement brief.'
				},
				{
					label: 'Data and integrations',
					value: 'Parchment API',
					description: 'Normalized green coffee data from 40+ suppliers through one REST API.'
				},
				{
					label: 'Roaster operations',
					value: 'Mallard Studio',
					description: 'Inventory, roast logs, and profit tracking for production teams.'
				}
			];
		}

		return [
			{
				label: 'Parchment Intelligence',
				value: intelligenceState?.statusLabel ?? 'Unknown',
				description:
					intelligenceState?.description ?? 'Intelligence details are unavailable right now.'
			},
			{
				label: 'Parchment API',
				value: apiState?.statusLabel ?? 'Unknown',
				description: apiState?.description ?? 'API plan details are unavailable right now.'
			},
			{
				label: 'Mallard Studio',
				value: membershipState?.statusLabel ?? 'Unknown',
				description: membershipState?.sourceLabel ?? 'Membership status is unavailable right now.'
			}
		];
	});

	const familyLabel = (family: string) => {
		switch (family) {
			case 'membership':
				return 'Mallard Studio';
			case 'api_plan':
				return 'Parchment API';
			case 'ppi_addon':
				return 'Parchment Intelligence';
			default:
				return family.replaceAll('_', ' ');
		}
	};

	const subscriptionName = (subscription: PageData['subscriptions'][number]) =>
		[...new Set(subscription.items.map((item) => familyLabel(item.productFamily)))].join(' + ');

	const mutateSubscription = async (
		subscription: PageData['subscriptions'][number],
		cancelAtPeriodEnd: boolean
	) => {
		const key = `${subscription.subscriptionId}:${cancelAtPeriodEnd}`;
		mutationLoading = key;
		mutationErrors[key] = '';
		mutationMessages[key] = '';
		const requestId = getOrCreateSubscriptionMutationRequestId(
			sessionStorage,
			subscription.subscriptionId,
			cancelAtPeriodEnd,
			() => crypto.randomUUID()
		);

		try {
			const response = await fetch(
				`/api/billing/subscriptions/${encodeURIComponent(subscription.subscriptionId)}`,
				{
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ requestId, cancelAtPeriodEnd })
				}
			);
			const result = await response.json().catch(() => null);
			if (!response.ok) {
				if (response.status === 409) {
					clearSubscriptionMutationRequestId(
						sessionStorage,
						subscription.subscriptionId,
						cancelAtPeriodEnd
					);
				}
				throw new Error(result?.error?.message ?? 'Unable to update this subscription.');
			}
			if (!result || typeof result.status !== 'string') {
				throw new Error('Subscription update returned an invalid response.');
			}

			if (isPendingSubscriptionMutation(result.status)) {
				mutationMessages[key] = 'Parchment accepted the change and is applying it.';
				return;
			}
			if (isTerminalSubscriptionMutation(result.status)) {
				clearSubscriptionMutationRequestId(
					sessionStorage,
					subscription.subscriptionId,
					cancelAtPeriodEnd
				);
				if (result.status === 'conflict') {
					throw new Error(
						result.reason ?? 'This subscription changed before the request completed.'
					);
				}
				mutationMessages[key] =
					result.status === 'superseded'
						? 'A newer subscription change already superseded this request.'
						: 'The complete subscription was updated.';
				await invalidateAll();
				return;
			}
			throw new Error('Subscription update returned an unknown state.');
		} catch (cause) {
			mutationErrors[key] =
				cause instanceof Error ? cause.message : 'Unable to update subscription.';
		} finally {
			mutationLoading = null;
		}
	};

	onMount(() => {
		const url = new URL(window.location.href);
		// Auto-open checkout only when the user is returning from the OAuth flow
		// with an explicit `intent=checkout` marker. A bare `?plan=...` URL is
		// treated as a pricing anchor, not a checkout command.
		if (isSignedIn && hasCheckoutIntent && intendedPurchaseKey) {
			openCheckoutByKey(intendedPurchaseKey);
			// Strip the intent marker so a refresh of this URL doesn't
			// re-launch the modal. Leave `plan=` intact so the card stays
			// highlighted for context. Preserve the existing history.state
			// object so SvelteKit's client navigation metadata (back/forward
			// routing) isn't clobbered.
			url.searchParams.delete('intent');
			window.history.replaceState(window.history.state, '', url.toString());
		}
	});
</script>

<div class="min-h-[calc(100vh-80px)] bg-surface-canvas">
	{#if data.auth.isSignedIn && showCheckout && selectedPurchaseKey}
		<div class="px-4 py-10 md:px-6">
			<div class="mx-auto max-w-3xl">
				<div class="mb-4 flex items-center justify-between gap-4">
					<div>
						<p class="text-sm font-semibold text-accent">Checkout</p>
						<h2 class="text-2xl font-semibold text-ink">
							{selectedPlanName}
							{selectedIntervalLabel}
						</h2>
						<p class="mt-1 text-sm text-muted">{selectedPriceLabel}</p>
					</div>
					<button
						onclick={handleCheckoutCancel}
						class="rounded-full p-1 text-ink/70 hover:text-ink"
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
				<StripeCheckout purchaseKey={selectedPurchaseKey} onSuccess={handleCheckoutSuccess} />
			</div>
		</div>
	{:else}
		<section class="border-b border-line bg-surface-panel px-4 py-14 md:px-6 md:py-20">
			<div
				class="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(20rem,0.9fr)] lg:items-end"
			>
				<div class="max-w-3xl space-y-5">
					<p class="text-sm font-semibold text-accent">
						{isSignedIn ? 'Your account' : 'Plans'}
					</p>
					<h1 class="font-serif text-4xl font-medium tracking-tight text-ink sm:text-5xl">
						{isSignedIn ? 'Your Purveyors account.' : 'Source greens with the full market in view.'}
					</h1>
					<p class="text-lg leading-8 text-muted">
						{isSignedIn
							? 'Review access and billing in one place.'
							: 'Daily-normalized data from 40+ US importers. Pricing movement, arrivals, delistings, and origin benchmarks for sourcing pros.'}
					</p>
					<div class="flex flex-wrap items-center gap-3">
						<button
							onclick={() => goto('/analytics')}
							class="rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-ink transition-opacity hover:opacity-90"
						>
							See the Market Index
						</button>
						<a
							href="/catalog"
							class="rounded-xl border border-line bg-surface-canvas px-4 py-3 text-sm font-medium text-ink transition-colors hover:border-accent/40 hover:text-accent"
						>
							Browse catalog
						</a>
						{#if !isSignedIn}
							<a
								href={signInHref}
								class="text-sm text-muted underline underline-offset-2 transition-colors hover:text-ink"
							>
								Already have an account? Sign in
							</a>
						{/if}
					</div>
				</div>

				<div class="rounded-3xl border border-line bg-surface-canvas p-6 shadow-sm">
					<p class="text-xs font-semibold text-muted">
						{isSignedIn ? 'Account overview' : 'Product line'}
					</p>
					<h2 class="mt-3 text-2xl font-semibold text-ink">
						{isSignedIn ? 'Current access on this account' : 'One platform, four products'}
					</h2>
					<p class="mt-2 text-sm leading-7 text-muted">
						{isSignedIn
							? 'Confirm what is active before starting a checkout or changing your billing.'
							: 'Start with the product that matches the job. Sign in when you are ready to subscribe.'}
					</p>

					<div class="mt-5 space-y-4">
						{#each accountOverviewItems as item}
							<div class="rounded-2xl border border-line bg-surface-panel p-4">
								<div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
									<div>
										<p class="text-xs font-semibold text-muted">
											{item.label}
										</p>
										<p class="mt-1 text-base font-semibold text-ink">{item.value}</p>
									</div>
								</div>
								<p class="mt-2 text-sm leading-6 text-muted">{item.description}</p>
							</div>
						{/each}
					</div>
				</div>
			</div>
		</section>

		<section class="px-4 py-8 md:px-6 md:py-10">
			<div class="mx-auto max-w-6xl space-y-8">
				{#if isSignedIn}
					<div class="rounded-3xl border border-line bg-surface-panel p-6 shadow-sm">
						<div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
							<div>
								<p class="text-xs font-semibold text-accent">Canonical billing</p>
								<h2 class="mt-2 text-2xl font-semibold text-ink">Your subscriptions</h2>
								<p class="mt-2 text-sm text-muted">
									Each subscription is shown once. Bundled products renew, cancel, or resume
									together.
								</p>
							</div>
						</div>

						{#if data.billingError}
							<p
								class="mt-5 rounded-xl border border-warning/30 bg-warning-subtle p-4 text-sm text-warning-strong"
							>
								{data.billingError}
							</p>
						{:else if data.subscriptions.length === 0}
							<p class="mt-5 rounded-xl border border-dashed border-line p-4 text-sm text-muted">
								No paid subscription is attached to this account.
							</p>
						{:else}
							<div class="mt-5 grid gap-4 lg:grid-cols-2">
								{#each data.subscriptions as subscription (subscription.subscriptionId)}
									{@const targetCancel = !subscription.cancelAtPeriodEnd}
									{@const mutationKey = `${subscription.subscriptionId}:${targetCancel}`}
									<div class="rounded-2xl border border-line bg-surface-canvas p-5">
										<div class="flex items-start justify-between gap-4">
											<div>
												<h3 class="font-semibold text-ink">{subscriptionName(subscription)}</h3>
												<p class="mt-1 text-sm text-muted">
													{subscription.items.length}
													{subscription.items.length === 1 ? 'product' : 'products'}
												</p>
											</div>
											<span
												class="rounded-full border border-line px-3 py-1 text-xs font-semibold text-ink"
											>
												{subscription.cancelAtPeriodEnd ? 'Ends at renewal' : subscription.status}
											</span>
										</div>
										<ul class="mt-4 space-y-2 text-sm text-muted">
											{#each subscription.items as item}
												<li>{familyLabel(item.productFamily)} · {item.purchaseKey}</li>
											{/each}
										</ul>
										<p class="mt-4 text-sm text-muted">
											Renews or ends: {formatDate(subscription.currentPeriodEnd)}
										</p>
										<button
											onclick={() => mutateSubscription(subscription, targetCancel)}
											disabled={mutationLoading !== null}
											class="mt-4 w-full rounded-lg border border-line bg-surface-panel px-4 py-2 text-sm font-semibold text-ink disabled:opacity-50"
										>
											{mutationLoading === mutationKey
												? 'Submitting...'
												: subscription.cancelAtPeriodEnd
													? `Keep ${subscriptionName(subscription)} active`
													: `End ${subscriptionName(subscription)} at renewal`}
										</button>
										{#if mutationMessages[mutationKey]}
											<p class="mt-3 text-sm text-info-strong">{mutationMessages[mutationKey]}</p>
										{/if}
										{#if mutationErrors[mutationKey]}
											<p class="mt-3 text-sm text-danger">{mutationErrors[mutationKey]}</p>
										{/if}
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{/if}

				<div class="grid gap-6 xl:grid-cols-2">
					{#each productCards as product}
						{@const state = getProductState(product)}
						<div
							class={`rounded-3xl border bg-surface-canvas p-6 shadow-sm ${product.family === 'ppi_addon' ? 'border-accent/40 ring-1 ring-accent/20' : 'border-line'}`}
						>
							<div class="flex items-start justify-between gap-4">
								<div class="space-y-2">
									<p class="text-xs font-semibold text-accent">
										{product.eyebrow}
									</p>
									<h2 class="text-2xl font-semibold text-ink">{product.name}</h2>
									<p class="text-sm font-medium text-ink">{product.headline}</p>
								</div>
								<span
									class={`rounded-full border px-3 py-1 text-xs font-semibold ${toneClasses(state.tone)}`}
								>
									{product.family === 'enterprise' ? 'Contact sales' : state.label}
								</span>
							</div>

							<p class="mt-4 text-sm leading-7 text-muted">{product.description}</p>

							<ul class="mt-5 space-y-3 text-sm text-muted">
								{#each product.features as feature}
									<li class="flex gap-3">
										<span class="mt-1 h-2 w-2 rounded-full bg-accent"></span>
										<span>{feature}</span>
									</li>
								{/each}
							</ul>

							{#if isSignedIn}
								<div class="mt-5 rounded-2xl border border-line bg-surface-panel p-4">
									<div class="flex items-start justify-between gap-3">
										<div>
											<p class="text-xs font-semibold text-muted">Account state</p>
											<p class="mt-2 text-base font-semibold text-ink">
												{state.label}
											</p>
										</div>
									</div>

									<p class="mt-3 text-sm leading-7 text-muted">
										{state.description}
									</p>

									{#if product.family === 'membership'}
										<p class="mt-3 text-sm text-muted">{product.managementCopy}</p>
										<p class="mt-2 text-xs text-muted">
											Manage every canonical subscription, including bundles, in the billing section
											above.
										</p>
									{:else if product.family === 'api_plan'}
										<div
											class="mt-3 rounded-2xl border border-dashed border-line bg-surface-canvas p-4"
										>
											<p class="text-sm leading-7 text-muted">
												{apiState?.description}
											</p>
											<p class="mt-2 text-sm text-muted">{apiState?.note}</p>
										</div>
									{:else if product.family === 'ppi_addon'}
										<div
											class="mt-3 rounded-2xl border border-dashed border-line bg-surface-canvas p-4"
										>
											<p class="text-sm leading-7 text-muted">
												{intelligenceState?.description}
											</p>
											<p class="mt-2 text-sm text-muted">
												{intelligenceState?.note}
											</p>
										</div>
									{:else}
										<div
											class="mt-3 rounded-2xl border border-dashed border-line bg-surface-canvas p-4 text-sm text-muted"
										>
											{product.managementCopy}
										</div>
									{/if}
								</div>
							{/if}

							{#if product.intervals?.length}
								<div class="mt-5 grid gap-3 sm:grid-cols-2">
									{#each product.intervals as option}
										<div class="rounded-2xl border border-line bg-surface-panel p-4">
											<div class="flex items-start justify-between gap-3">
												<div>
													<p class="text-sm font-semibold text-ink">
														{option.label}
													</p>
													<p class="mt-1 text-2xl font-bold text-ink">
														{option.price}<span class="ml-1 text-sm font-normal text-muted"
															>{option.interval}</span
														>
													</p>
												</div>
												{#if option.badge}
													<span
														class="rounded-full bg-success-subtle px-3 py-1 text-xs font-semibold text-success-strong"
													>
														{option.badge}
													</span>
												{/if}
											</div>

											{#if !isSignedIn}
												<div class="mt-4 space-y-2">
													<button
														onclick={() => signInForPlan(option.planSlug)}
														class="w-full rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-ink transition-opacity hover:opacity-90"
													>
														Start {product.name}
													</button>
													{#if product.learnMoreHref}
														<a
															href={product.learnMoreHref}
															class="inline-flex w-full items-center justify-center rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-accent/40 hover:text-accent"
														>
															Learn more
														</a>
													{/if}
												</div>
											{:else}
												<button
													onclick={() => openCheckout(product.name, option)}
													class="mt-4 w-full rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-ink transition-opacity hover:opacity-90"
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
									class="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-surface-canvas transition-opacity hover:opacity-90"
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
