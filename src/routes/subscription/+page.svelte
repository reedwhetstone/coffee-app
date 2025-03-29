<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import StripeCheckout from './StripeCheckout.svelte';

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
	let cancelLoading = $state(false);
	let cancelError = $state('');
	let cancelSuccess = $state(false);
	let resumeLoading = $state(false);
	let resumeError = $state('');
	let resumeSuccess = $state(false);

	// Available subscription plans
	const plans = [
		{
			id: 'price_1R3q5OKwI9NkGqAnQfBhW83g',
			name: 'Monthly Subscription',
			price: '$5.00',
			interval: 'month',
			description: 'Full access to all premium features'
		}
	];

	const handlePlanSelect = (plan: (typeof plans)[0]) => {
		selectedPriceId = plan.id;
		selectedPlanName = plan.name;
		showCheckout = true;
	};

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
		if (!data?.session?.user) {
			// Redirect to home page if not authenticated
			goto('/');
		}

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

<div class="min-h-[calc(100vh-80px)] px-4 py-10 md:px-6">
	<div class="mx-auto max-w-3xl">
		<div
			class="rounded-2xl border border-background-tertiary-light bg-background-secondary-light p-6 shadow-md"
		>
			{#if data?.session?.user}
				{#if data.role === 'member' || data.role === 'admin'}
					<!-- Show subscription management UI for existing members -->
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
				{:else if showCheckout && selectedPriceId}
					<!-- Checkout Form (replaces plan selection when a plan is selected) -->
					<div>
						<div class="mb-4 flex items-center justify-between">
							<h2 class="text-primary-light text-xl font-semibold">
								Subscribe to {selectedPlanName}
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
							clientReferenceId={data.session.user.id}
							customerEmail={data.session.user.email}
							onSuccess={handleCheckoutSuccess}
							onCancel={handleCheckoutCancel}
						/>
					</div>
				{:else}
					<!-- Plan Selection UI -->
					<div class="flex flex-col items-center">
						<div class="mb-4">
							<h2 class="text-primary-light mb-2 text-xl font-semibold">Choose Your Plan</h2>
							<p class="text-primary-light text-sm">
								Select the plan that works best for you. All plans include a 30 day free trial.
							</p>
						</div>

						<!-- Plan Selection Cards -->
						<div class="flex flex-col items-center">
							{#each plans as plan}
								<div
									class="flex flex-col rounded-lg border border-background-tertiary-light p-4 shadow-md hover:border-blue-400"
								>
									<h3 class="text-primary-light mb-1 text-lg font-semibold">{plan.name}</h3>
									<div class="text-primary-light mb-2 flex items-end">
										<span class="text-2xl font-bold">{plan.price}</span>
										<span class="ml-1 text-sm">/{plan.interval}</span>
									</div>
									<p class="text-primary-light mb-4 text-sm">{plan.description}</p>
									<button
										onclick={() => handlePlanSelect(plan)}
										class="mt-auto rounded-lg bg-blue-500 px-4 py-2 text-white transition-colors hover:bg-blue-600"
									>
										Select Plan
									</button>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			{:else}
				<!-- Loading or redirect state -->
				<div class="rounded-lg bg-background-tertiary-light p-6 text-center">
					<p class="text-primary-light mb-4">Please sign in to view subscription options</p>
					<button
						onclick={() => goto('/')}
						class="rounded bg-blue-500/10 px-4 py-2 text-sm text-blue-400 hover:bg-blue-500/20"
					>
						Return to Home
					</button>
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	/* Add any custom styling for the checkout page here */
</style>
