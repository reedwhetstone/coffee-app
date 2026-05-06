<script lang="ts">
	import { onMount } from 'svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';

	interface ReconciledEntitlements {
		role: string;
		userRole: string[];
		apiPlan: string;
		ppiAccess: boolean;
	}

	let { data } = $props<{ data: PageData }>();
	let loading = $state(true);
	let error = $state<string | null>(null);
	let sessionStatus = $state<'complete' | 'open' | 'expired' | null>(null);
	let reconciliationComplete = $state(false);
	let reconciliationMessage = $state('');
	let resolvedEntitlements = $state<ReconciledEntitlements | null>(null);

	onMount(async () => {
		try {
			if (!data?.user) {
				goto('/');
				return;
			}

			const url = new URL(window.location.href);
			const sessionId = url.searchParams.get('session_id');

			if (!sessionId) {
				error = 'No session ID found';
				loading = false;
				return;
			}

			const response = await fetch(`/api/stripe/check-session?session_id=${sessionId}`, {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json'
				}
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.message || 'Failed to verify payment status');
			}

			const { status } = await response.json();
			sessionStatus = status;

			if (status === 'complete') {
				try {
					const reconciliationResponse = await fetch('/api/stripe/reconcile-session', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json'
						},
						body: JSON.stringify({ sessionId })
					});

					if (reconciliationResponse.ok) {
						const reconciliationResult = await reconciliationResponse.json();
						reconciliationComplete = true;
						resolvedEntitlements = reconciliationResult.entitlements ?? null;

						if (reconciliationResult.entitlementsChanged) {
							reconciliationMessage =
								'Your checkout was reconciled and your latest entitlements are now active.';
						} else if (reconciliationResult.alreadyProcessed) {
							reconciliationMessage =
								'This checkout session was already reconciled. Your entitlements are current.';
						} else {
							reconciliationMessage =
								reconciliationResult.message ||
								'Payment verified and entitlements are already up to date.';
						}
					} else {
						console.warn(
							'⚠️ Session reconciliation failed, relying on webhook completion:',
							await reconciliationResponse.text()
						);
						reconciliationMessage =
							'Payment confirmed. Billing reconciliation is still finishing in the background.';
					}
				} catch (reconciliationError) {
					console.warn(
						'⚠️ Session reconciliation error, relying on webhook completion:',
						reconciliationError
					);
					reconciliationMessage =
						'Payment confirmed. Billing reconciliation is still finishing in the background.';
				}

				await invalidateAll();
			}
		} catch (err: unknown) {
			error = err instanceof Error ? err.message : 'Something went wrong';
			console.error('Error verifying payment:', err);
		} finally {
			loading = false;
		}
	});

	const returnToSubscription = async () => {
		await invalidateAll();
		goto('/subscription');
	};
</script>

<div class="flex min-h-[calc(100vh-80px)] flex-col items-center justify-center py-10">
	<div
		class="max-w-md rounded-lg border border-background-tertiary-light bg-background-secondary-light p-8 shadow-md"
	>
		{#if loading}
			<div class="flex flex-col items-center justify-center py-10">
				<div
					class="h-12 w-12 animate-spin rounded-full border-4 border-accent border-t-transparent"
				></div>
				<p class="mt-4 text-text-primary-light">Reconciling your checkout session...</p>
			</div>
		{:else if error}
			<div class="flex flex-col items-center justify-center text-center">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-16 w-16 text-red-500"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
				<h2 class="mt-4 text-xl font-bold text-text-primary-light">Something went wrong</h2>
				<p class="mt-2 text-text-primary-light">{error}</p>
				<button
					onclick={() => goto('/subscription')}
					class="mt-6 rounded-md bg-accent px-4 py-2 font-medium text-ink transition-opacity hover:opacity-90"
				>
					Try again
				</button>
			</div>
		{:else if sessionStatus === 'complete'}
			<div class="flex flex-col items-center justify-center text-center">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-16 w-16 text-green-500"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M5 13l4 4L19 7"
					/>
				</svg>
				<h2 class="mt-4 text-xl font-bold text-text-primary-light">Payment successful</h2>
				<p class="mt-2 text-text-primary-light">
					Thank you. {reconciliationMessage || 'Your payment has been confirmed.'}
				</p>
				{#if reconciliationComplete}
					<p class="mt-1 text-sm text-success-strong">Entitlement reconciliation completed</p>
				{:else}
					<p class="mt-1 text-sm text-info">Billing reconciliation in progress...</p>
				{/if}

				{#if resolvedEntitlements}
					<div
						class="mt-5 w-full rounded-xl border border-border-light bg-background-primary-light p-4 text-left text-sm text-text-secondary-light"
					>
						<p class="font-semibold text-text-primary-light">Current product access</p>
						<ul class="mt-3 space-y-2">
							<li>
								<span class="font-medium text-text-primary-light">App role:</span>
								{resolvedEntitlements.role}
							</li>
							<li>
								<span class="font-medium text-text-primary-light">API plan:</span>
								{resolvedEntitlements.apiPlan}
							</li>
							<li>
								<span class="font-medium text-text-primary-light">Parchment Intelligence:</span>
								{resolvedEntitlements.ppiAccess ? 'enabled' : 'not enabled'}
							</li>
						</ul>
					</div>
				{/if}

				<button
					onclick={returnToSubscription}
					class="mt-6 rounded-md bg-accent px-4 py-2 font-medium text-ink transition-opacity hover:opacity-90"
				>
					Return to subscription control plane
				</button>
			</div>
		{:else}
			<div class="flex flex-col items-center justify-center text-center">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-16 w-16 text-warning"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
				<h2 class="mt-4 text-xl font-bold text-text-primary-light">Payment pending</h2>
				<p class="mt-2 text-text-primary-light">
					Your payment is still being processed. We'll reconcile entitlements as soon as Stripe
					marks the checkout complete.
				</p>
				<button
					onclick={returnToSubscription}
					class="mt-6 rounded-md bg-accent px-4 py-2 font-medium text-ink transition-opacity hover:opacity-90"
				>
					Return to subscription control plane
				</button>
			</div>
		{/if}
	</div>
</div>
