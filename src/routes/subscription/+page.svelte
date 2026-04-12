<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';
	import { onMount } from 'svelte';
	import StripeCheckout from './StripeCheckout.svelte';
	import { signInWithGoogle } from '$lib/supabase';
	import { BILLING_PURCHASE_KEYS, type BillingPurchaseKey } from '$lib/billing/purchaseKeys';

	let { data } = $props<{ data: PageData }>();

	let showCheckout = $state(false);
	let selectedPurchaseKey = $state<BillingPurchaseKey | null>(null);
	let selectedPlanName = $state('');
	let selectedInterval = $state('');
	let isAnnual = $state(false);
	let cancelLoading = $state(false);
	let cancelError = $state('');
	let cancelSuccess = $state(false);
	let resumeLoading = $state(false);
	let resumeError = $state('');
	let resumeSuccess = $state(false);

	const plans: {
		monthly: {
			purchaseKey: BillingPurchaseKey;
			name: string;
			price: string;
			interval: string;
			description: string;
			features: string[];
		};
		annual: {
			purchaseKey: BillingPurchaseKey;
			name: string;
			price: string;
			interval: string;
			description: string;
			features: string[];
			savings: string;
		};
	} = {
		monthly: {
			purchaseKey: BILLING_PURCHASE_KEYS.membershipMonthly,
			name: 'Roaster Plan',
			price: '$9',
			interval: 'month',
			description:
				'For active home roasters ready to track their journey and improve their craft with AI-powered insights.',
			features: [
				'Full Coffee AI Concierge',
				'Personal inventory and purchase tracking',
				'Artisan integration and roast logging',
				'Tasting journal and cupping notes',
				'Roast analytics and improvement tips',
				'Priority email support'
			]
		},
		annual: {
			purchaseKey: BILLING_PURCHASE_KEYS.membershipAnnual,
			name: 'Roaster Plan',
			price: '$80',
			interval: 'year',
			description:
				'For active home roasters ready to track their journey and improve their craft with AI-powered insights.',
			features: [
				'Full Coffee AI Concierge',
				'Personal inventory and purchase tracking',
				'Artisan integration and roast logging',
				'Tasting journal and cupping notes',
				'Roast analytics and improvement tips',
				'Priority email support'
			],
			savings: 'Save $28/year'
		}
	};

	const handlePlanSelect = (interval: 'monthly' | 'annual') => {
		const plan = plans[interval];
		selectedPurchaseKey = plan.purchaseKey;
		selectedPlanName = plan.name;
		selectedInterval = interval;
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
		// Stripe's return_url carries the canonical session_id for post-checkout reconciliation.
		// Avoid navigating early to /subscription/success without that identifier.
		await invalidateAll();
	};

	const handleCheckoutCancel = () => {
		showCheckout = false;
	};

	const formatDate = (unixTimestamp: number) => {
		const date = new Date(unixTimestamp * 1000);
		return date.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	};

	const formatBooleanStatus = (value: boolean) => (value ? 'Enabled' : 'Not enabled');

	const normalizePlanName = (planName: string | null | undefined) => {
		if (!planName || planName.startsWith('prod_')) {
			return 'Roaster Plan';
		}

		return planName;
	};

	const toneClasses = (tone: 'success' | 'info' | 'warning' | 'muted') => {
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

<div class="min-h-[calc(100vh-80px)]">
	{#if data?.user && showCheckout && selectedPurchaseKey}
		<div class="px-4 py-10 md:px-6">
			<div class="mx-auto max-w-3xl">
				<div class="mb-4 flex items-center justify-between">
					<h2 class="text-primary-light text-xl font-semibold">
						Subscribe to {selectedPlanName} ({selectedInterval === 'annual'
							? '$80/year'
							: '$9/month'})
					</h2>
					<button
						onclick={handleCheckoutCancel}
						class="text-primary-light/70 hover:text-primary-light rounded-full p-1"
						aria-label="Back to subscription control plane"
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
	{:else if data?.user && data.controlPlane}
		<section class="bg-background-secondary-light px-4 py-10 md:px-6">
			<div class="mx-auto max-w-6xl space-y-8">
				<div class="space-y-3">
					<p class="text-sm font-semibold uppercase tracking-wide text-background-tertiary-light">
						Subscription Control Plane
					</p>
					<h1 class="text-3xl font-bold text-text-primary-light sm:text-4xl">
						Resolved billing and entitlement state
					</h1>
					<p class="max-w-3xl text-base text-text-secondary-light">
						This page reflects your current membership, API, and PPI entitlements after Stripe
						reconciliation. Membership checkout is live today. API and PPI are status sections for
						the current model, not separate purchase flows yet.
					</p>
				</div>

				<div class="grid gap-4 md:grid-cols-3">
					<div class="rounded-2xl border border-border-light bg-background-primary-light p-5">
						<p class="text-xs font-semibold uppercase tracking-wide text-text-secondary-light">
							App role
						</p>
						<p class="mt-2 text-2xl font-semibold capitalize text-text-primary-light">
							{data.role}
						</p>
						<p class="mt-2 text-sm text-text-secondary-light">
							Core app membership state resolves from your stored entitlements.
						</p>
					</div>
					<div class="rounded-2xl border border-border-light bg-background-primary-light p-5">
						<p class="text-xs font-semibold uppercase tracking-wide text-text-secondary-light">
							API plan
						</p>
						<p class="mt-2 text-2xl font-semibold capitalize text-text-primary-light">
							{data.controlPlane.api.plan}
						</p>
						<p class="mt-2 text-sm text-text-secondary-light">
							Resolved independently from the base app role.
						</p>
					</div>
					<div class="rounded-2xl border border-border-light bg-background-primary-light p-5">
						<p class="text-xs font-semibold uppercase tracking-wide text-text-secondary-light">
							PPI access
						</p>
						<p class="mt-2 text-2xl font-semibold text-text-primary-light">
							{formatBooleanStatus(data.controlPlane.ppi.enabled)}
						</p>
						<p class="mt-2 text-sm text-text-secondary-light">
							Shown from resolved entitlement state, not inferred from legacy pseudo-roles.
						</p>
					</div>
				</div>

				<div class="grid gap-6 xl:grid-cols-3">
					<div
						class="rounded-3xl border border-border-light bg-background-primary-light p-6 shadow-sm"
					>
						<div class="flex items-start justify-between gap-4">
							<div>
								<h2 class="text-xl font-semibold text-text-primary-light">Base membership</h2>
								<p class="mt-1 text-sm text-text-secondary-light">
									Core app access and subscription management.
								</p>
							</div>
							<span
								class={`rounded-full border px-3 py-1 text-xs font-semibold ${toneClasses(data.controlPlane.membership.tone)}`}
							>
								{data.controlPlane.membership.statusLabel}
							</span>
						</div>

						<div class="mt-5 space-y-3 text-sm text-text-secondary-light">
							<p>{data.controlPlane.membership.description}</p>
							<p>{data.controlPlane.membership.sourceLabel}</p>
						</div>

						{#if data.subscription}
							<div
								class="mt-5 rounded-2xl border border-border-light bg-background-secondary-light p-4 text-sm text-text-secondary-light"
							>
								<div class="grid grid-cols-2 gap-3">
									<span>Status</span>
									<span class="text-right font-medium capitalize text-text-primary-light">
										{data.subscription.status}
										{#if data.subscription.cancel_at_period_end}
											<span class="text-orange-400"> (canceling)</span>
										{/if}
									</span>

									<span>Plan</span>
									<span class="text-right font-medium text-text-primary-light">
										{normalizePlanName(data.subscription.plan?.name)}
									</span>

									<span>Price</span>
									<span class="text-right font-medium text-text-primary-light">
										${(data.subscription.plan?.amount || 0) / 100}/{data.subscription.plan
											?.interval || 'month'}
									</span>

									<span>Current period ends</span>
									<span class="text-right font-medium text-text-primary-light">
										{data.subscription.current_period_end
											? formatDate(data.subscription.current_period_end)
											: 'N/A'}
									</span>
								</div>
							</div>

							<div class="mt-5 space-y-3">
								{#if data.subscription.cancel_at_period_end}
									<button
										onclick={() => resumeSubscription()}
										disabled={resumeLoading}
										class="w-full rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-300 transition-colors hover:bg-blue-500/20 disabled:opacity-50"
									>
										{resumeLoading ? 'Processing...' : 'Resume membership'}
									</button>
									{#if resumeSuccess}
										<p class="text-sm text-green-400">
											Membership will continue renewing automatically.
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
										{cancelLoading ? 'Processing...' : 'Cancel membership at period end'}
									</button>
									<p class="text-xs text-text-secondary-light">
										Your access will continue until the end of the current billing period.
									</p>
									{#if cancelSuccess}
										<p class="text-sm text-green-400">
											Membership cancellation has been scheduled.
										</p>
									{/if}
									{#if cancelError}
										<p class="text-sm text-red-400">Error: {cancelError}</p>
									{/if}
								{/if}
							</div>
						{:else}
							<div
								class="mt-5 rounded-2xl border border-dashed border-border-light p-4 text-sm text-text-secondary-light"
							>
								No live Stripe membership subscription is attached to this account yet.
							</div>
						{/if}
					</div>

					<div
						class="rounded-3xl border border-border-light bg-background-primary-light p-6 shadow-sm"
					>
						<div class="flex items-start justify-between gap-4">
							<div>
								<h2 class="text-xl font-semibold text-text-primary-light">API access</h2>
								<p class="mt-1 text-sm text-text-secondary-light">
									Resolved from explicit API plan entitlements.
								</p>
							</div>
							<span
								class={`rounded-full border px-3 py-1 text-xs font-semibold ${toneClasses(data.controlPlane.api.tone)}`}
							>
								{data.controlPlane.api.statusLabel}
							</span>
						</div>
						<div class="mt-5 space-y-3 text-sm text-text-secondary-light">
							<p>{data.controlPlane.api.description}</p>
							<p>{data.controlPlane.api.note}</p>
						</div>
					</div>

					<div
						class="rounded-3xl border border-border-light bg-background-primary-light p-6 shadow-sm"
					>
						<div class="flex items-start justify-between gap-4">
							<div>
								<h2 class="text-xl font-semibold text-text-primary-light">PPI analytics</h2>
								<p class="mt-1 text-sm text-text-secondary-light">
									Resolved independently from core membership.
								</p>
							</div>
							<span
								class={`rounded-full border px-3 py-1 text-xs font-semibold ${toneClasses(data.controlPlane.ppi.tone)}`}
							>
								{data.controlPlane.ppi.statusLabel}
							</span>
						</div>
						<div class="mt-5 space-y-3 text-sm text-text-secondary-light">
							<p>{data.controlPlane.ppi.description}</p>
							<p>{data.controlPlane.ppi.note}</p>
						</div>
					</div>
				</div>

				{#if !data.controlPlane.membership.hasAccess}
					<section
						class="rounded-3xl border border-border-light bg-background-primary-light p-6 shadow-sm"
					>
						<div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
							<div>
								<h2 class="text-2xl font-semibold text-text-primary-light">
									Upgrade to membership
								</h2>
								<p class="mt-1 text-sm text-text-secondary-light">
									Checkout currently sells the core membership plans. API and PPI remain status-only
									sections for now.
								</p>
							</div>
							<div
								class="flex items-center rounded-full bg-background-secondary-light p-1 ring-1 ring-border-light"
							>
								<button
									onclick={() => (isAnnual = false)}
									class={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${!isAnnual ? 'bg-background-tertiary-light text-white' : 'text-text-secondary-light hover:text-text-primary-light'}`}
								>
									Monthly
								</button>
								<button
									onclick={() => (isAnnual = true)}
									class={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${isAnnual ? 'bg-background-tertiary-light text-white' : 'text-text-secondary-light hover:text-text-primary-light'}`}
								>
									Annual
								</button>
							</div>
						</div>

						<div class="mt-6 grid gap-6 lg:grid-cols-2">
							{#each [plans.monthly, plans.annual] as plan, index}
								<div
									class="rounded-3xl border border-border-light bg-background-secondary-light p-6"
								>
									<div class="flex items-start justify-between gap-4">
										<div>
											<h3 class="text-xl font-semibold text-text-primary-light">{plan.name}</h3>
											<p class="mt-1 text-sm text-text-secondary-light">{plan.description}</p>
										</div>
										{#if index === 1}
											<span
												class="rounded-full bg-green-500/15 px-3 py-1 text-xs font-semibold text-green-300"
											>
												{plans.annual.savings}
											</span>
										{/if}
									</div>
									<p class="mt-5 flex items-baseline gap-1">
										<span class="text-4xl font-bold text-text-primary-light">{plan.price}</span>
										<span class="text-sm text-text-secondary-light">/{plan.interval}</span>
									</p>
									<ul class="mt-5 space-y-3 text-sm text-text-secondary-light">
										{#each plan.features as feature}
											<li class="flex gap-3">
												<span class="mt-1 h-2 w-2 rounded-full bg-background-tertiary-light"></span>
												<span>{feature}</span>
											</li>
										{/each}
									</ul>
									<button
										onclick={() => handlePlanSelect(index === 0 ? 'monthly' : 'annual')}
										class="mt-6 w-full rounded-lg bg-background-tertiary-light px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
									>
										Choose {index === 0 ? 'monthly' : 'annual'} membership
									</button>
								</div>
							{/each}
						</div>
					</section>
				{/if}
			</div>
		</section>
	{:else}
		<section class="bg-background-secondary-light px-6 py-16">
			<div class="mx-auto max-w-6xl">
				<div class="mx-auto max-w-3xl text-center">
					<h2 class="text-base font-semibold leading-7 text-background-tertiary-light">Pricing</h2>
					<p class="mt-2 text-4xl font-bold tracking-tight text-text-primary-light sm:text-5xl">
						Grow from curious to confident
					</p>
					<p class="mx-auto mt-6 max-w-2xl text-lg leading-8 text-text-secondary-light">
						Start free, upgrade to the Roaster Plan when you want the full membership experience, or
						talk to us about enterprise consulting.
					</p>
				</div>

				<div class="mx-auto mt-12 grid max-w-5xl gap-6 lg:grid-cols-3">
					<div class="rounded-3xl border border-border-light bg-background-primary-light p-8">
						<h3 class="text-xl font-semibold text-text-primary-light">Curious</h3>
						<p class="mt-3 text-sm text-text-secondary-light">
							Browse the marketplace, compare coffees, and explore the free experience.
						</p>
						<p class="mt-6 text-4xl font-bold text-text-primary-light">Free</p>
						<ul class="mt-6 space-y-3 text-sm text-text-secondary-light">
							<li>Marketplace browsing and filtering</li>
							<li>Basic coffee recommendations</li>
							<li>Limited chart visibility</li>
						</ul>
						<button
							onclick={() => goto('/auth')}
							class="mt-8 w-full rounded-lg bg-background-tertiary-light px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
						>
							Browse green coffees
						</button>
					</div>

					<div
						class="rounded-3xl border-2 border-background-tertiary-light bg-background-primary-light p-8 shadow-sm"
					>
						<div class="flex items-center justify-between gap-3">
							<h3 class="text-xl font-semibold text-text-primary-light">Roaster Plan</h3>
							<span
								class="rounded-full bg-background-tertiary-light/10 px-3 py-1 text-xs font-semibold text-background-tertiary-light"
							>
								Most popular
							</span>
						</div>
						<p class="mt-3 text-sm text-text-secondary-light">
							Membership unlocks the full roast management and premium app experience.
						</p>
						<div class="mt-6 space-y-2 text-text-primary-light">
							<p>
								<span class="text-4xl font-bold">$9</span><span
									class="text-sm text-text-secondary-light">/month</span
								>
							</p>
							<p>
								<span class="text-4xl font-bold">$80</span><span
									class="text-sm text-text-secondary-light">/year</span
								>
							</p>
						</div>
						<ul class="mt-6 space-y-3 text-sm text-text-secondary-light">
							<li>AI concierge and premium roast workflows</li>
							<li>Inventory, roast logging, and tasting journal</li>
							<li>Roast analytics and improvement guidance</li>
						</ul>
						<button
							onclick={handleSignIn}
							class="mt-8 w-full rounded-lg bg-background-tertiary-light px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
						>
							Create an account
						</button>
					</div>

					<div class="rounded-3xl border border-border-light bg-background-primary-light p-8">
						<h3 class="text-xl font-semibold text-text-primary-light">Enterprise</h3>
						<p class="mt-3 text-sm text-text-secondary-light">
							Business consulting, QA systems, analytics, and digital operations support for coffee
							companies.
						</p>
						<p class="mt-6 text-2xl font-bold text-text-primary-light">Custom solutions</p>
						<ul class="mt-6 space-y-3 text-sm text-text-secondary-light">
							<li>Operations and analytics strategy</li>
							<li>Workflow and technology integration consulting</li>
							<li>Dedicated strategic partnership</li>
						</ul>
						<button
							onclick={() => goto('/contact')}
							class="mt-8 w-full rounded-lg bg-text-primary-light px-4 py-2 text-sm font-semibold text-background-primary-light transition-opacity hover:opacity-90"
						>
							Schedule consultation
						</button>
					</div>
				</div>
			</div>
		</section>
	{/if}
</div>
