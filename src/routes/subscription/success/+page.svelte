<script lang="ts">
	import { onMount } from 'svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';
	import AccentSpine from '$lib/components/ui/AccentSpine.svelte';

	interface ReconciledEntitlements {
		role: string;
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
							reconciliationMessage = 'Your purchase is confirmed and your new access is active.';
						} else if (reconciliationResult.alreadyProcessed) {
							reconciliationMessage =
								'This purchase was already confirmed. Your access is up to date.';
						} else {
							reconciliationMessage =
								reconciliationResult.message ||
								'Payment verified. Your access is already up to date.';
						}
					} else {
						console.warn(
							'⚠️ Session reconciliation failed, relying on webhook completion:',
							await reconciliationResponse.text()
						);
						reconciliationMessage =
							'Payment confirmed. Your access is finishing activating in the background.';
					}
				} catch (reconciliationError) {
					console.warn(
						'⚠️ Session reconciliation error, relying on webhook completion:',
						reconciliationError
					);
					reconciliationMessage =
						'Payment confirmed. Your access is finishing activating in the background.';
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
		class="relative max-w-md overflow-hidden rounded-lg border border-accent bg-surface-panel p-8 pl-10 shadow-md"
	>
		<AccentSpine />
		{#if loading}
			<div class="flex flex-col items-center justify-center py-10">
				<div
					class="h-12 w-12 animate-spin rounded-full border-4 border-accent border-t-transparent"
				></div>
				<p class="mt-4 text-ink">Confirming your payment...</p>
			</div>
		{:else if error}
			<div class="flex flex-col items-center justify-center text-center">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-16 w-16 text-danger"
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
				<h2 class="mt-4 text-xl font-bold text-ink">Something went wrong</h2>
				<p class="mt-2 text-ink">{error}</p>
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
					class="h-16 w-16 text-success"
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
				<h2 class="mt-4 text-xl font-bold text-ink">Payment successful</h2>
				<p class="mt-2 text-ink">
					Thank you. {reconciliationMessage || 'Your payment has been confirmed.'}
				</p>
				{#if reconciliationComplete}
					<p class="mt-1 text-sm text-success-strong">Your access is active</p>
				{:else}
					<p class="mt-1 text-sm text-info">Activating your access...</p>
				{/if}

				{#if resolvedEntitlements}
					<div
						class="mt-5 w-full rounded-xl border border-line bg-surface-canvas p-4 text-left text-sm text-muted"
					>
						<p class="font-semibold text-ink">Current product access</p>
						<ul class="mt-3 space-y-2">
							<li>
								<span class="font-medium text-ink">App role:</span>
								{resolvedEntitlements.role}
							</li>
							<li>
								<span class="font-medium text-ink">API plan:</span>
								{resolvedEntitlements.apiPlan}
							</li>
							<li>
								<span class="font-medium text-ink">Parchment Intelligence:</span>
								{resolvedEntitlements.ppiAccess ? 'enabled' : 'not enabled'}
							</li>
						</ul>
					</div>
				{/if}

				<button
					onclick={returnToSubscription}
					class="mt-6 rounded-md bg-accent px-4 py-2 font-medium text-ink transition-opacity hover:opacity-90"
				>
					Back to your account
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
				<h2 class="mt-4 text-xl font-bold text-ink">Payment pending</h2>
				<p class="mt-2 text-ink">
					Your payment is still being processed. Your access will activate as soon as Stripe
					confirms the checkout — usually within a few seconds.
				</p>
				<button
					onclick={returnToSubscription}
					class="mt-6 rounded-md bg-accent px-4 py-2 font-medium text-ink transition-opacity hover:opacity-90"
				>
					Back to your account
				</button>
			</div>
		{/if}
	</div>
</div>
