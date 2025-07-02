<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import StripeCheckout from './StripeCheckout.svelte';
	import { signInWithGoogle } from '$lib/supabase';

	let { data } = $props<{ data: PageData }>();
	const siteUrl =
		typeof window !== 'undefined'
			? window.location.origin.includes('localhost')
				? 'http://localhost:5173'
				: 'https://www.purveyors.io'
			: 'https://www.purveyors.io';

	let showCheckout = $state(false);
	let selectedPriceId = $state('');
	let selectedPlanName = $state('');
	let selectedInterval = $state('');
	let isAnnual = $state(false);
	let cancelLoading = $state(false);
	let cancelError = $state('');
	let cancelSuccess = $state(false);
	let resumeLoading = $state(false);
	let resumeError = $state('');
	let resumeSuccess = $state(false);

	// Available subscription plans
	const plans: {
		monthly: {
			id: string;
			name: string;
			price: string;
			interval: string;
			description: string;
			features: string[];
		};
		annual: {
			id: string;
			name: string;
			price: string;
			interval: string;
			description: string;
			features: string[];
			savings: string;
		};
	} = {
		monthly: {
			id: 'price_1RgGYuKwI9NkGqAnm4oiHpbx',
			name: 'Roaster Plan',
			price: '$9',
			interval: 'month',
			description:
				'For active home roasters ready to track their journey and improve their craft with AI-powered insights.',
			features: [
				'All Curious features',
				'Full Coffee AI Concierge',
				'Personal inventory & purchase tracking',
				'Artisan integration & roast logging',
				'Tasting journal & cupping notes',
				'Roast analytics & improvement tips',
				'Priority email support'
			]
		},
		annual: {
			id: 'price_1RgGZvKwI9NkGqAnzYJbJkXU',
			name: 'Roaster Plan',
			price: '$80',
			interval: 'year',
			description:
				'For active home roasters ready to track their journey and improve their craft with AI-powered insights.',
			features: [
				'All Curious features',
				'Full Coffee AI Concierge',
				'Personal inventory & purchase tracking',
				'Artisan integration & roast logging',
				'Tasting journal & cupping notes',
				'Roast analytics & improvement tips',
				'Priority email support'
			],
			savings: 'Save $28/year'
		}
	};

	const handlePlanSelect = (interval: 'monthly' | 'annual') => {
		const plan = plans[interval];
		selectedPriceId = plan.id;
		selectedPlanName = plan.name;
		selectedInterval = interval;
		showCheckout = true;
	};

	const toggleBilling = () => {
		isAnnual = !isAnnual;
	};

	async function handleSignIn() {
		try {
			await signInWithGoogle(data.supabase);
		} catch (error) {
			console.error('Error signing in:', error);
		}
	}

	const handleCheckoutSuccess = () => {
		goto('/subscription/success');
	};

	const handleCheckoutCancel = () => {
		showCheckout = false;
	};

	// Function to format date from unix timestamp
	const formatDate = (unixTimestamp: number) => {
		const date = new Date(unixTimestamp * 1000);
		return date.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	};

	// Function to cancel subscription
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
			// Update local data to show cancellation status
			data.subscription.cancel_at_period_end = true;
		} catch (error) {
			cancelError = error instanceof Error ? error.message : 'An unknown error occurred';
		} finally {
			cancelLoading = false;
		}
	};

	// Function to resume subscription
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
			// Update local data to show resumed status
			data.subscription.cancel_at_period_end = false;
		} catch (error) {
			resumeError = error instanceof Error ? error.message : 'An unknown error occurred';
		} finally {
			resumeLoading = false;
		}
	};

	// Check if user is authenticated when component mounts
	onMount(() => {
		// if (!data?.session?.user) {
		// 	// Redirect to home page if not authenticated
		// 	goto('/');
		// }

		// Alternative approach: check URL for Stripe session ID
		const url = new URL(window.location.href);
		if (url.searchParams.has('session_id')) {
			// Redirect to success page with the session ID
			goto('/subscription/success');
		}
	});
</script>

<svelte:head>
	<script async src="https://js.stripe.com/v3/pricing-table.js"></script>
</svelte:head>

<div class="min-h-[calc(100vh-80px)]">
	{#if data?.user && (data.role === 'member' || data.role === 'admin')}
		<!-- Show subscription management UI for existing members -->
		<div class="px-4 py-10 md:px-6">
			<div class="mx-auto max-w-3xl">
				<div class="flex flex-col items-center rounded-lg p-6">
					<h3 class="text-primary-light mb-2 text-xl font-semibold">Subscription Management</h3>

					{#if data.subscription}
						<div class="text-primary-light w-full max-w-md space-y-4">
							<!-- Subscription Details -->
							<div class="rounded-lg bg-background-tertiary-light/50 p-4 shadow-sm">
								<h4 class="text-primary-light mb-2 font-medium">Your Plan</h4>
								<div class="text-primary-light/80 grid grid-cols-2 gap-2 text-sm">
									<span>Status:</span>
									<span class="font-medium capitalize">
										{data.subscription.status}
										{#if data.subscription.cancel_at_period_end}
											<span class="text-orange-400">(Cancels at period end)</span>
										{/if}
									</span>

									<span>Plan:</span>
									<span class="font-medium">
										{data.subscription.plan?.name || 'Premium Plan'}
									</span>

									<span>Price:</span>
									<span class="font-medium">
										${(data.subscription.plan?.amount || 0) / 100}/
										{data.subscription.plan?.interval || 'month'}
									</span>

									<span>Current period ends:</span>
									<span class="font-medium">
										{data.subscription.current_period_end
											? formatDate(data.subscription.current_period_end)
											: 'N/A'}
									</span>
								</div>
							</div>

							<!-- Action Buttons -->
							<div class="mt-4 flex flex-col items-center space-y-3">
								{#if data.subscription.cancel_at_period_end}
									<div class="text-primary-light/80 text-center text-sm">
										<p>
											Your subscription will end on {formatDate(
												data.subscription.current_period_end
											)}.
										</p>
										<p>You'll continue to have access until that date.</p>
									</div>

									<button
										onclick={() => resumeSubscription()}
										disabled={resumeLoading}
										class="mt-2 w-full rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm text-blue-400 transition-colors hover:bg-blue-500/20 disabled:opacity-50"
									>
										{resumeLoading ? 'Processing...' : 'Resume Subscription'}
									</button>

									{#if resumeSuccess}
										<div class="mt-2 text-sm text-green-400">
											Your subscription has been resumed and will continue automatically.
										</div>
									{/if}

									{#if resumeError}
										<div class="mt-2 text-sm text-red-400">
											Error: {resumeError}
										</div>
									{/if}
								{:else}
									<button
										onclick={() => cancelSubscription()}
										disabled={cancelLoading}
										class="w-full rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50"
									>
										{cancelLoading ? 'Processing...' : 'Cancel Subscription'}
									</button>
									<p class="text-primary-light/70 mt-1 text-xs">
										Your subscription will continue until the end of the current billing period.
									</p>

									{#if cancelSuccess}
										<div class="mt-2 text-sm text-green-400">
											Your subscription has been canceled and will end on {formatDate(
												data.subscription.current_period_end
											)}.
										</div>
									{/if}

									{#if cancelError}
										<div class="mt-2 text-sm text-red-400">
											Error: {cancelError}
										</div>
									{/if}
								{/if}
							</div>

							<div class="mt-6 text-center">
								<button
									onclick={() => goto('/')}
									class="rounded bg-blue-500/10 px-4 py-2 text-sm text-blue-400 hover:bg-blue-500/20"
								>
									Return to Homepage
								</button>
							</div>
						</div>
					{:else}
						<!-- Fallback if we couldn't load subscription details -->
						<div class="text-primary-light text-center">
							<p class="mb-4">You're a member with active benefits!</p>
							<p class="text-primary-light/70 text-sm">
								We couldn't load your subscription details at the moment.
							</p>
							<button
								onclick={() => goto('/')}
								class="mt-4 rounded bg-blue-500/10 px-4 py-2 text-sm text-blue-400 hover:bg-blue-500/20"
							>
								Return to Homepage
							</button>
						</div>
					{/if}
				</div>
			</div>
		</div>
	{:else if data?.user && showCheckout && selectedPriceId}
		<!-- Checkout Form (for authenticated users who selected a plan) -->
		<div class="px-4 py-10 md:px-6">
			<div class="mx-auto max-w-3xl">
				<div>
					<div class="mb-4 flex items-center justify-between">
						<h2 class="text-primary-light text-xl font-semibold">
							Subscribe to {selectedPlanName} ({selectedInterval === 'annual'
								? '$80/year'
								: '$9/month'})
						</h2>
						<button
							onclick={handleCheckoutCancel}
							class="text-primary-light/70 hover:text-primary-light rounded-full p-1"
							aria-label="Back to plan selection"
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
						priceId={selectedPriceId}
						clientReferenceId={data.user.id}
						customerEmail={data.user.email}
						onSuccess={handleCheckoutSuccess}
						onCancel={handleCheckoutCancel}
					/>
				</div>
			</div>
		</div>
	{:else}
		<!-- Plan Selection UI - Always show plans, but change button based on auth status -->
		<section class="bg-background-secondary-light px-6 py-16">
			<div class="mx-auto max-w-7xl">
				<div class="mx-auto max-w-4xl text-center">
					<h2 class="text-base font-semibold leading-7 text-background-tertiary-light">Pricing</h2>
					<p class="mt-2 text-4xl font-bold tracking-tight text-text-primary-light sm:text-5xl">
						Grow from curious to confident
					</p>
				</div>
				<p class="mx-auto mt-6 max-w-2xl text-center text-lg leading-8 text-text-secondary-light">
					Whether you're just starting or roasting for profit, we have the right plan for your
					journey. Start free, upgrade anytime.
				</p>
				{#if !data?.user}
					<div
						class="mx-auto mt-8 max-w-md rounded-lg border border-blue-500/20 bg-blue-500/10 p-4"
					>
						<p class="text-sm text-blue-400">
							🎉 <strong>New users:</strong> Browse our free coffee marketplace first, then upgrade when
							you're ready!
						</p>
						<button
							onclick={() => goto('/')}
							class="mt-2 text-sm text-blue-400 underline hover:text-blue-300"
						>
							← Explore the marketplace first
						</button>
					</div>
				{/if}

				<!-- Billing Toggle -->
				<div class="mx-auto mt-12 flex items-center justify-center">
					<div
						class="flex items-center rounded-full bg-background-primary-light p-1 ring-1 ring-border-light"
					>
						<button
							onclick={() => (isAnnual = false)}
							class="rounded-full px-4 py-2 text-sm font-medium transition-all {!isAnnual
								? 'bg-background-tertiary-light text-white'
								: 'text-text-secondary-light hover:text-text-primary-light'}"
						>
							Monthly
						</button>
						<button
							onclick={() => (isAnnual = true)}
							class="rounded-full px-4 py-2 text-sm font-medium transition-all {isAnnual
								? 'bg-background-tertiary-light text-white'
								: 'text-text-secondary-light hover:text-text-primary-light'}"
						>
							Annual
							{#if !isAnnual}
								<span class="ml-1 rounded-full bg-green-500/20 px-2 py-0.5 text-xs text-green-400">
									Save $28
								</span>
							{/if}
						</button>
					</div>
				</div>

				<div
					class="isolate mx-auto mt-16 grid max-w-md grid-cols-1 gap-y-8 sm:mt-20 lg:mx-0 lg:max-w-none lg:grid-cols-3"
				>
					<!-- Free Plan -->
					<div
						class="flex flex-col justify-between rounded-3xl bg-background-primary-light p-8 ring-1 ring-border-light xl:p-10"
					>
						<div>
							<div class="flex items-center justify-between gap-x-4">
								<h3 class="text-lg font-semibold leading-8 text-text-primary-light">Curious</h3>
							</div>
							<p class="mt-4 text-sm leading-6 text-text-secondary-light">
								Perfect for coffee enthusiasts discovering the world of home roasting and exploring
								green coffee options.
							</p>
							<p class="mt-6 flex items-baseline gap-x-1">
								<span class="text-4xl font-bold tracking-tight text-text-primary-light">Free</span>
							</p>
							<ul role="list" class="mt-8 space-y-3 text-sm leading-6 text-text-secondary-light">
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
									Browse green coffee marketplace
								</li>
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
									Filter by origin, process, and flavor
								</li>
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
									Basic coffee recommendations
								</li>
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
									Community support
								</li>
							</ul>
						</div>
						<button
							onclick={() => goto('/')}
							class="mt-8 block w-full rounded-md bg-background-tertiary-light px-3 py-2 text-center text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-opacity-90"
						>
							Get started free
						</button>
					</div>

					<!-- Professional Plan -->
					{#if true}
						{@const currentPlan = isAnnual ? plans.annual : plans.monthly}
						<div
							class="flex flex-col justify-between rounded-3xl bg-background-primary-light p-8 ring-2 ring-background-tertiary-light xl:p-10"
						>
							<div>
								<div class="flex items-center justify-between gap-x-4">
									<h3 class="text-lg font-semibold leading-8 text-background-tertiary-light">
										{currentPlan.name}
									</h3>
									<p
										class="rounded-full bg-background-tertiary-light/10 px-2.5 py-1 text-xs font-semibold leading-5 text-background-tertiary-light"
									>
										Most popular
									</p>
								</div>
								<p class="mt-4 text-sm leading-6 text-text-secondary-light">
									{currentPlan.description}
								</p>
								<p class="mt-6 flex items-baseline gap-x-1">
									<span class="text-4xl font-bold tracking-tight text-text-primary-light"
										>{currentPlan.price}</span
									>
									<span class="text-sm font-semibold leading-6 text-text-secondary-light"
										>/{currentPlan.interval}</span
									>
									{#if isAnnual && 'savings' in currentPlan}
										<span
											class="ml-2 rounded-full bg-green-500/20 px-2 py-0.5 text-xs text-green-400"
											>{currentPlan.savings}</span
										>
									{/if}
								</p>
								<ul role="list" class="mt-8 space-y-3 text-sm leading-6 text-text-secondary-light">
									{#each currentPlan.features as feature}
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
							{#if data?.user}
								<button
									onclick={() => handlePlanSelect(isAnnual ? 'annual' : 'monthly')}
									class="mt-8 block w-full rounded-md bg-background-tertiary-light px-3 py-2 text-center text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-opacity-90"
								>
									Start professional trial
								</button>
							{:else}
								<button
									onclick={handleSignIn}
									class="mt-8 block w-full rounded-md bg-background-tertiary-light px-3 py-2 text-center text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-opacity-90"
								>
									Create an Account
								</button>
								<p class="mt-2 text-center text-xs text-text-secondary-light">
									Sign in to start your free trial
								</p>
							{/if}
						</div>
					{/if}

					<!-- Enterprise Plan -->
					<div
						class="flex flex-col justify-between rounded-3xl bg-background-primary-light p-8 ring-1 ring-border-light xl:p-10"
					>
						<div>
							<div class="flex items-center justify-between gap-x-4">
								<h3 class="text-lg font-semibold leading-8 text-text-primary-light">Enterprise</h3>
							</div>
							<p class="mt-4 text-sm leading-6 text-text-secondary-light">
								Business & operations consulting for coffee companies looking to scale their
								analytics, QA systems, and digital operations infrastructure.
							</p>
							<p class="mt-6 flex items-baseline gap-x-1">
								<span class="text-2xl font-bold tracking-tight text-text-primary-light"
									>Custom Solutions</span
								>
							</p>
							<ul role="list" class="mt-8 space-y-3 text-sm leading-6 text-text-secondary-light">
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
									Digital operations strategy & implementation
								</li>
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
									Quality assurance system design
								</li>
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
									Analytics & business intelligence setup
								</li>
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
									Process optimization & workflow design
								</li>
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
									Team training & knowledge transfer
								</li>
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
									Technology integration consulting
								</li>
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
									Dedicated strategic partnership
								</li>
							</ul>
						</div>
						<button
							onclick={() => goto('/')}
							class="mt-8 block w-full rounded-md bg-text-primary-light px-3 py-2 text-center text-sm font-semibold text-background-primary-light shadow-sm transition-all duration-200 hover:bg-opacity-90"
						>
							Schedule consultation
						</button>
					</div>
				</div>
			</div>
		</section>
	{/if}
</div>

<style>
	/* Add any custom styling for the checkout page here */
</style>
