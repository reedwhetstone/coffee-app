<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import StripeCheckout from './StripeCheckout.svelte';
	import { signInWithGoogle } from '$lib/supabase';
	import {
		BILLING_OFFERS,
		hasBundledBillingSubscription,
		getBillingOffer,
		hasInteractiveBillingSubscription,
		hasNonterminalBundledBillingSubscription,
		type BillingOffer,
		type BillingOfferId
	} from '$lib/billing/offers';
	import { trackBillingOfferEvent } from '$lib/billing/offerAnalytics';
	import {
		clearSubscriptionMutationRequestId,
		getOrCreateSubscriptionMutationRequestId,
		isPendingSubscriptionMutation,
		isTerminalSubscriptionMutation
	} from '$lib/billing/subscriptionMutation';

	let { data } = $props<{ data: PageData }>();

	type ProductTone = 'success' | 'info' | 'warning' | 'muted';
	type ProductFamily = 'membership' | 'api_plan' | 'ppi_addon' | 'bundle' | 'enterprise';

	interface ProductCardInterval {
		offerId: BillingOfferId;
		label: string;
		price: string;
		interval: string;
		trialDays: number | null;
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

	const monthlyInterval = (offer: BillingOffer, badge?: string): ProductCardInterval => ({
		offerId: offer.offerId as BillingOfferId,
		label: 'Monthly',
		price: offer.price,
		interval: offer.interval,
		trialDays: offer.trialDays,
		badge,
		planSlug: offer.offerId
	});

	// Plan slug to stable offer mapping for intent preservation. Historical annual
	// subscriptions still render below, but annual offers are closed to new sales.
	const planSlugMap: Record<string, BillingOfferId> = Object.fromEntries(
		Object.values(BILLING_OFFERS).map((offer) => [offer.offerId, offer.offerId])
	) as Record<string, BillingOfferId>;

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
			intervals: [monthlyInterval(BILLING_OFFERS.intelligenceMonthly)],
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
					...monthlyInterval(BILLING_OFFERS.apiMonthly),
					label: 'Origin'
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
			intervals: [monthlyInterval(BILLING_OFFERS.studioMonthly)],
			learnMoreHref: '/catalog'
		},
		{
			family: 'bundle',
			name: 'Studio + Intelligence',
			eyebrow: 'Best value',
			headline: 'Roaster operations and the full market view in one subscription.',
			description:
				'Use Mallard Studio for inventory, roasting, and margins, plus Parchment Intelligence for supplier comparisons, arrivals, delistings, and market benchmarks.',
			features: [
				'Everything in Mallard Studio',
				'Everything in Parchment Intelligence',
				'One subscription and one renewal date',
				'The complete bundle cancels or renews together'
			],
			managementCopy:
				'Studio and Intelligence are one subscription in this offer. Canceling, resuming, or renewing applies to both products together.',
			anonymousStateCopy: 'Sign in to see what is on this account.',
			activeStateCopy: 'Studio and Intelligence are active on this account.',
			inactiveStateCopy: 'The combined plan is not active on this account yet.',
			ctaLabel: 'Start both',
			activeCtaLabel: 'Manage current plan',
			intervals: [monthlyInterval(BILLING_OFFERS.bothMonthly, 'Save $2/month')],
			learnMoreHref: '/analytics'
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

	const selfServeProductCards = [
		productCards.find((product) => product.family === 'ppi_addon')!,
		productCards.find((product) => product.family === 'bundle')!,
		productCards.find((product) => product.family === 'membership')!
	];
	const apiProduct = productCards.find((product) => product.family === 'api_plan')!;
	const enterpriseProduct = productCards.find((product) => product.family === 'enterprise')!;

	const subscriptionMutationRetryDelaysMs = [500, 1000, 2000, 4000, 8000] as const;

	let showCheckout = $state(false);
	let selectedOfferId = $state<BillingOfferId | null>(null);
	let selectedPlanName = $state('');
	let selectedIntervalLabel = $state('');
	let selectedPriceLabel = $state('');
	let mutationLoading = $state<string | null>(null);
	let mutationMessages = $state<Record<string, string>>({});
	let mutationErrors = $state<Record<string, string>>({});
	let mutationPending = $state<Record<string, boolean>>({});
	const selectedOffer = $derived(selectedOfferId ? getBillingOffer(selectedOfferId) : null);

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
	const hasInteractiveSubscription = $derived(
		hasInteractiveBillingSubscription(data.subscriptions)
	);
	const hasInteractiveAccess = $derived(
		membershipState?.hasAccess === true || intelligenceState?.enabled === true
	);

	const isProductActive = (product: ProductCard) => {
		if (product.family === 'membership') return membershipState?.hasAccess === true;
		if (product.family === 'api_plan')
			return apiState?.plan === 'member' || apiState?.plan === 'enterprise';
		if (product.family === 'ppi_addon') return intelligenceState?.enabled === true;
		if (product.family === 'bundle') {
			return hasBundledBillingSubscription(data.subscriptions);
		}
		return false;
	};
	const isProductCheckoutBlocked = (product: ProductCard) => {
		if (
			product.family === 'membership' ||
			product.family === 'ppi_addon' ||
			product.family === 'bundle'
		) {
			// Until plan transitions ship, every interactive purchase must begin from
			// zero canonical interactive subscriptions. Otherwise the opposite
			// standalone card could create a second subscription instead of Both.
			return data.billingError !== null || hasInteractiveSubscription || hasInteractiveAccess;
		}
		return isProductActive(product);
	};
	const productCheckoutLabel = (product: ProductCard) => {
		if (!isProductCheckoutBlocked(product)) return product.ctaLabel;
		if (data.billingError !== null) return 'Checkout unavailable';
		if (isProductActive(product)) return product.activeCtaLabel ?? 'Already active';
		return 'Plan change unavailable';
	};

	// Purchase intent from URL params (set before sign-in to preserve selection).
	// Auto-open is gated on the explicit `intent=checkout` marker so that
	// bookmarks/shared links like `/subscription?plan=api-monthly` only highlight
	// the card; they don't force the Stripe modal open.
	const intendedPlanSlug = $derived(page.url.searchParams.get('plan'));
	const hasCheckoutIntent = $derived(page.url.searchParams.get('intent') === 'checkout');
	const intendedOfferId = $derived(
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

	const openCheckout = (product: ProductCard, option: ProductCardInterval) => {
		if (isProductCheckoutBlocked(product)) return;
		trackBillingOfferEvent('billing_checkout_started', option.offerId);
		selectedOfferId = option.offerId;
		selectedPlanName = product.name;
		selectedIntervalLabel = option.label;
		selectedPriceLabel = `${option.price}${option.interval}`;
		showCheckout = true;
	};

	const openCheckoutByOfferId = (offerId: BillingOfferId) => {
		for (const product of productCards) {
			if (!product.intervals) continue;
			for (const option of product.intervals) {
				if (option.offerId === offerId) {
					openCheckout(product, option);
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

		if (product.family === 'bundle' && membershipState && intelligenceState) {
			const hasStudio = membershipState.hasAccess;
			const hasIntelligence = intelligenceState.enabled;
			const hasBundle = hasBundledBillingSubscription(data.subscriptions);
			const hasBundleNeedingAttention =
				hasNonterminalBundledBillingSubscription(data.subscriptions) && !hasBundle;
			if (hasBundle) {
				return {
					label: 'Both products active',
					description: product.activeStateCopy,
					tone: 'success' as ProductTone
				};
			}
			if (hasBundleNeedingAttention) {
				return {
					label: 'Bundle subscription needs attention',
					description:
						'This bundle is not currently granting Studio or Intelligence access. Review its billing status before starting another plan.',
					tone: 'warning' as ProductTone
				};
			}
			if (hasStudio && hasIntelligence) {
				return {
					label: 'Products active separately',
					description:
						'Studio and Intelligence are active in separate subscriptions. Manage each subscription above. Switching them into the combined plan is not available yet.',
					tone: 'warning' as ProductTone
				};
			}
			if (hasStudio || hasIntelligence) {
				return {
					label: 'One product already active',
					description:
						'Manage the current subscription above. Switching an existing plan into the bundle is not available yet.',
					tone: 'warning' as ProductTone
				};
			}
			return {
				label: 'Bundle not active',
				description: product.inactiveStateCopy,
				tone: 'muted' as ProductTone
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
		mutationPending[key] = false;
		const requestId = getOrCreateSubscriptionMutationRequestId(
			sessionStorage,
			subscription.subscriptionId,
			cancelAtPeriodEnd,
			() => crypto.randomUUID()
		);

		try {
			let result: { status: string; reason?: string } | null = null;
			for (let attempt = 0; ; attempt += 1) {
				const response = await fetch(
					`/api/billing/subscriptions/${encodeURIComponent(subscription.subscriptionId)}`,
					{
						method: 'PATCH',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ requestId, cancelAtPeriodEnd })
					}
				);
				const body = await response.json().catch(() => null);
				if (!response.ok) {
					if (response.status === 409) {
						clearSubscriptionMutationRequestId(
							sessionStorage,
							subscription.subscriptionId,
							cancelAtPeriodEnd
						);
					}
					throw new Error(body?.error?.message ?? 'Unable to update this subscription.');
				}
				if (!body || typeof body.status !== 'string') {
					throw new Error('Subscription update returned an invalid response.');
				}

				result = {
					status: body.status,
					reason: typeof body.reason === 'string' ? body.reason : undefined
				};
				if (!isPendingSubscriptionMutation(result.status)) break;
				const delay = subscriptionMutationRetryDelaysMs[attempt];
				if (delay === undefined) break;
				await new Promise((resolve) => setTimeout(resolve, delay));
			}

			if (!result) throw new Error('Subscription update returned an invalid response.');

			if (isPendingSubscriptionMutation(result.status)) {
				mutationPending[key] = true;
				mutationMessages[key] =
					'Parchment accepted the change, but it is still processing. Check the same request again to see the terminal result.';
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
		if (!isSignedIn || !hasCheckoutIntent) {
			for (const offer of [
				BILLING_OFFERS.studioMonthly,
				BILLING_OFFERS.intelligenceMonthly,
				BILLING_OFFERS.bothMonthly
			]) {
				trackBillingOfferEvent('billing_offer_impression', offer.offerId);
			}
		}
		// Auto-open checkout only when the user is returning from the OAuth flow
		// with an explicit `intent=checkout` marker. A bare `?plan=...` URL is
		// treated as a pricing anchor, not a checkout command.
		if (isSignedIn && hasCheckoutIntent && intendedOfferId) {
			openCheckoutByOfferId(intendedOfferId);
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
	{#if data.auth.isSignedIn && showCheckout && selectedOfferId}
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
				{#if selectedOffer?.trialDays}
					<p class="mb-4 rounded-xl border border-line bg-surface-panel p-4 text-sm text-muted">
						If eligible, your {selectedOffer.trialDays}-day free trial starts today. Otherwise,
						billing starts today.
						{#if selectedOffer.offerId === BILLING_OFFERS.bothMonthly.offerId}
							Studio and Intelligence are one subscription and cancel, resume, or renew together.
						{/if}
					</p>
				{/if}
				<StripeCheckout offerId={selectedOfferId} onSuccess={handleCheckoutSuccess} />
			</div>
		</div>
	{:else}
		<section class="border-b border-line bg-surface-panel px-4 py-10 md:px-6 md:py-12">
			<div class="mx-auto max-w-6xl">
				<div class="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
					<div class="max-w-3xl">
						<p class="text-sm font-semibold text-accent">Plans & billing</p>
						<h1 class="mt-3 font-serif text-4xl font-medium tracking-tight text-ink sm:text-5xl">
							Choose the plan that fits your work.
						</h1>
						<p class="mt-4 text-lg leading-8 text-muted">
							Compare Intelligence, Studio, and the combined plan at a glance. Developer and custom
							access stay separate below.
						</p>
					</div>
					{#if !isSignedIn}
						<a
							href={signInHref}
							class="shrink-0 rounded-xl border border-line bg-surface-canvas px-4 py-3 text-sm font-semibold text-ink transition-colors hover:border-accent/40 hover:text-accent"
						>
							Sign in to subscribe
						</a>
					{/if}
				</div>

				{#if isSignedIn}
					<div class="mt-7 grid gap-3 sm:grid-cols-3">
						{#each accountOverviewItems as item}
							<div class="rounded-2xl border border-line bg-surface-canvas px-4 py-3 shadow-sm">
								<p class="text-xs font-semibold text-muted">{item.label}</p>
								<p class="mt-1 text-sm font-semibold text-ink">{item.value}</p>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</section>

		<section class="px-4 py-8 md:px-6 md:py-10">
			<div class="mx-auto max-w-6xl space-y-8">
				{#if isSignedIn && (data.billingError || data.subscriptions.length > 0)}
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
												: mutationPending[mutationKey]
													? 'Check subscription status'
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

				<div id="self-serve-plans" class="scroll-mt-24">
					<div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
						<div>
							<p class="text-xs font-semibold uppercase tracking-wide text-accent">Self-serve</p>
							<h2 class="mt-2 text-2xl font-semibold text-ink">Three plans, one clear choice</h2>
						</div>
						<p class="max-w-xl text-sm leading-6 text-muted sm:text-right">
							Pick one product or save $2/month by keeping Studio and Intelligence together.
						</p>
					</div>

					<div class="mt-5 grid gap-5 lg:grid-cols-3 lg:items-stretch">
						{#each selfServeProductCards as product}
							{@const state = getProductState(product)}
							{@const option = product.intervals?.[0]}
							<div
								class={`flex h-full flex-col rounded-3xl border bg-surface-canvas p-6 shadow-sm ${product.family === 'bundle' ? 'order-first border-success ring-1 ring-success/20 lg:order-none' : product.family === 'ppi_addon' ? 'border-accent/40' : 'border-line'}`}
							>
								<div class="flex items-start justify-between gap-3">
									<div>
										<p
											class={`text-xs font-semibold uppercase tracking-wide ${product.family === 'bundle' ? 'text-success-strong' : 'text-accent'}`}
										>
											{product.eyebrow}
										</p>
										<h3 class="mt-2 text-2xl font-semibold text-ink">{product.name}</h3>
									</div>
									{#if product.family === 'bundle'}
										<span
											class="rounded-full bg-success-subtle px-3 py-1 text-xs font-semibold text-success-strong"
										>
											Best value
										</span>
									{/if}
								</div>

								<p class="mt-4 text-sm font-medium leading-6 text-ink">{product.headline}</p>

								{#if option}
									<div class="mt-5 flex items-end justify-between gap-3">
										<div>
											<p class="text-3xl font-bold text-ink">
												{option.price}<span class="ml-1 text-sm font-normal text-muted"
													>{option.interval}</span
												>
											</p>
											{#if option.trialDays}
												<p class="mt-1 text-xs font-medium text-success-strong">
													{option.trialDays}-day free trial if eligible
												</p>
											{/if}
										</div>
										{#if isSignedIn}
											<span
												class={`rounded-full border px-3 py-1 text-xs font-semibold ${toneClasses(state.tone)}`}
											>
												{state.label}
											</span>
										{/if}
									</div>

									<ul class="mt-6 space-y-3 text-sm leading-6 text-muted">
										{#each product.features.slice(0, 3) as feature}
											<li class="flex gap-3">
												<span
													class={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${product.family === 'bundle' ? 'bg-success' : 'bg-accent'}`}
												></span>
												<span>{feature}</span>
											</li>
										{/each}
									</ul>

									<div class="mt-auto pt-7">
										{#if !isSignedIn}
											<button
												onclick={() => signInForPlan(option.planSlug)}
												class={`w-full rounded-xl px-4 py-3 text-sm font-semibold text-ink transition-opacity hover:opacity-90 ${product.family === 'bundle' ? 'bg-success' : 'bg-accent'}`}
											>
												Start {product.name}
											</button>
										{:else}
											<button
												onclick={() => openCheckout(product, option)}
												disabled={isProductCheckoutBlocked(product)}
												class={`w-full rounded-xl px-4 py-3 text-sm font-semibold text-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 ${product.family === 'bundle' ? 'bg-success' : 'bg-accent'}`}
											>
												{productCheckoutLabel(product)}
											</button>
										{/if}
										{#if product.learnMoreHref}
											<a
												href={product.learnMoreHref}
												class="mt-3 block text-center text-sm font-medium text-muted underline underline-offset-4 transition-colors hover:text-ink"
											>
												Learn more
											</a>
										{/if}
									</div>
								{/if}
							</div>
						{/each}
					</div>
				</div>

				<div id="api-plans" class="scroll-mt-24 border-t border-line pt-8">
					<div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
						<div>
							<p class="text-xs font-semibold uppercase tracking-wide text-accent">
								Developer & custom access
							</p>
							<h2 class="mt-2 text-2xl font-semibold text-ink">
								A separate path for different users
							</h2>
						</div>
						<p class="max-w-xl text-sm leading-6 text-muted sm:text-right">
							API access and tailored commercial work stay out of the everyday product comparison.
						</p>
					</div>

					<div class="mt-5 grid gap-5 lg:grid-cols-[1.35fr_1fr]">
						{#if apiProduct}
							{@const apiProductState = getProductState(apiProduct)}
							{@const apiOption = apiProduct.intervals?.[0]}
							<div class="rounded-3xl border border-line bg-surface-canvas p-6 shadow-sm">
								<div class="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
									<div class="max-w-2xl">
										<div class="flex flex-wrap items-center gap-3">
											<p class="text-xs font-semibold uppercase tracking-wide text-accent">
												Data access
											</p>
											{#if isSignedIn}
												<span
													class={`rounded-full border px-3 py-1 text-xs font-semibold ${toneClasses(apiProductState.tone)}`}
												>
													{apiProductState.label}
												</span>
											{/if}
										</div>
										<h3 class="mt-2 text-xl font-semibold text-ink">Parchment API Origin</h3>
										<p class="mt-2 text-sm leading-6 text-muted">
											Normalized green coffee data for applications, sync jobs, and agents. Start on
											Green, then use Origin for production access.
										</p>
									</div>
									{#if apiOption}
										<div class="min-w-44 shrink-0">
											<p class="text-2xl font-bold text-ink">
												{apiOption.price}<span class="ml-1 text-sm font-normal text-muted"
													>{apiOption.interval}</span
												>
											</p>
											{#if !isSignedIn}
												<button
													onclick={() => signInForPlan(apiOption.planSlug)}
													class="mt-3 w-full rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-ink"
												>
													Start Origin
												</button>
											{:else}
												<button
													onclick={() => openCheckout(apiProduct, apiOption)}
													disabled={isProductCheckoutBlocked(apiProduct)}
													class="mt-3 w-full rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-50"
												>
													{productCheckoutLabel(apiProduct)}
												</button>
											{/if}
											<a
												href="/api#plans"
												class="mt-3 block text-center text-sm font-medium text-muted underline underline-offset-4 hover:text-ink"
											>
												Compare API tiers
											</a>
										</div>
									{/if}
								</div>
							</div>
						{/if}

						<div class="rounded-3xl border border-line bg-surface-canvas p-6 shadow-sm">
							<p class="text-xs font-semibold uppercase tracking-wide text-muted">
								{enterpriseProduct.eyebrow}
							</p>
							<h3 class="mt-2 text-xl font-semibold text-ink">Enterprise</h3>
							<p class="mt-2 text-sm leading-6 text-muted">
								Custom data delivery, embedded intelligence, and support for larger teams.
							</p>
							<a
								href={enterpriseProduct.contactHref ?? '/contact'}
								class="mt-5 inline-flex rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-surface-canvas transition-opacity hover:opacity-90"
							>
								Contact sales
							</a>
						</div>
					</div>
				</div>
			</div>
		</section>
	{/if}
</div>
