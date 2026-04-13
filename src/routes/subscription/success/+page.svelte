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

	interface ReceiptAction {
		href: string;
		label: string;
		description: string;
	}

	interface ReceiptProduct {
		purchaseKey: string;
		productFamily: string;
		productName: string;
		planName: string;
		intervalLabel: string;
		summary: string;
		nextAction: ReceiptAction;
	}

	interface ReceiptEntitlement {
		label: string;
		value: string;
		detail: string;
		tone: 'success' | 'muted' | 'info';
	}

	interface BillingSuccessReceipt {
		title: string;
		summary: string;
		products: ReceiptProduct[];
		primaryAction: ReceiptAction;
		secondaryActions: ReceiptAction[];
		entitlementSummary: ReceiptEntitlement[];
	}

	let { data } = $props<{ data: PageData }>();
	let loading = $state(true);
	let error = $state<string | null>(null);
	let sessionStatus = $state<'complete' | 'open' | 'expired' | null>(null);
	let reconciliationComplete = $state(false);
	let reconciliationMessage = $state('');
	let resolvedEntitlements = $state<ReconciledEntitlements | null>(null);
	let receipt = $state<BillingSuccessReceipt | null>(null);

	const entitlementToneClasses = (tone: ReceiptEntitlement['tone']) => {
		switch (tone) {
			case 'success':
				return 'border-green-500/30 bg-green-500/10';
			case 'info':
				return 'border-blue-500/30 bg-blue-500/10';
			default:
				return 'border-border-light bg-background-secondary-light';
		}
	};

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
						receipt = reconciliationResult.receipt ?? null;

						if (reconciliationResult.entitlementsChanged) {
							reconciliationMessage =
								'Final entitlement state reconciled from the completed checkout session.';
						} else if (reconciliationResult.alreadyProcessed) {
							reconciliationMessage =
								'This checkout session was already reconciled. The receipt below reflects the current entitlement state.';
						} else {
							reconciliationMessage =
								reconciliationResult.message ||
								'Checkout verified and the final entitlement state is already up to date.';
						}
					} else {
						console.warn(
							'⚠️ Session reconciliation failed, relying on webhook completion:',
							await reconciliationResponse.text()
						);
						reconciliationMessage =
							'Checkout confirmed. Billing reconciliation is still finishing in the background.';
					}
				} catch (reconciliationError) {
					console.warn(
						'⚠️ Session reconciliation error, relying on webhook completion:',
						reconciliationError
					);
					reconciliationMessage =
						'Checkout confirmed. Billing reconciliation is still finishing in the background.';
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

<div class="flex min-h-[calc(100vh-80px)] flex-col items-center justify-center px-4 py-10">
	<div
		class="w-full max-w-3xl rounded-2xl border border-background-tertiary-light bg-background-secondary-light p-8 shadow-md"
	>
		{#if loading}
			<div class="flex flex-col items-center justify-center py-10">
				<div
					class="h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"
				></div>
				<p class="text-primary-light mt-4">Reconciling your checkout receipt...</p>
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
				<h2 class="text-primary-light mt-4 text-xl font-bold">Something went wrong</h2>
				<p class="text-primary-light mt-2">{error}</p>
				<button
					onclick={() => goto('/subscription')}
					class="mt-6 rounded-lg bg-blue-500 px-4 py-2 text-white transition-colors hover:bg-blue-600"
				>
					Try Again
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
				<h2 class="text-primary-light mt-4 text-xl font-bold">
					{receipt?.title ?? 'Purchase confirmed'}
				</h2>
				<p class="text-primary-light mt-2 max-w-2xl">
					{receipt?.summary ?? 'Your checkout completed successfully.'}
				</p>
				<p class="text-primary-light mt-2 text-sm">{reconciliationMessage}</p>
				{#if reconciliationComplete}
					<p class="mt-1 text-sm text-green-600">✅ Final entitlement state reconciled</p>
				{:else}
					<p class="mt-1 text-sm text-blue-600">⏳ Billing reconciliation in progress...</p>
				{/if}

				{#if receipt?.products?.length}
					<div
						class="mt-5 w-full rounded-xl border border-border-light bg-background-primary-light p-5 text-left text-sm text-text-secondary-light"
					>
						<p class="font-semibold text-text-primary-light">Products in this checkout</p>
						<div class="mt-4 grid gap-3 md:grid-cols-2">
							{#each receipt.products as product}
								<div
									class="rounded-xl border border-border-light bg-background-secondary-light p-4"
								>
									<p class="font-semibold text-text-primary-light">{product.productName}</p>
									<p class="mt-1 text-xs uppercase tracking-wide text-text-secondary-light">
										{product.planName} · {product.intervalLabel}
									</p>
									<p class="mt-3 text-sm text-text-secondary-light">{product.summary}</p>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				{#if receipt?.entitlementSummary?.length}
					<div
						class="mt-5 w-full rounded-xl border border-border-light bg-background-primary-light p-5 text-left text-sm text-text-secondary-light"
					>
						<p class="font-semibold text-text-primary-light">Final reconciled access</p>
						<div class="mt-4 grid gap-3 md:grid-cols-3">
							{#each receipt.entitlementSummary as item}
								<div class={`rounded-xl border p-4 ${entitlementToneClasses(item.tone)}`}>
									<p
										class="text-xs font-semibold uppercase tracking-wide text-text-secondary-light"
									>
										{item.label}
									</p>
									<p class="mt-2 text-base font-semibold text-text-primary-light">{item.value}</p>
									<p class="mt-2 text-sm text-text-secondary-light">{item.detail}</p>
								</div>
							{/each}
						</div>
					</div>
				{:else if resolvedEntitlements}
					<div
						class="mt-5 w-full rounded-xl border border-border-light bg-background-primary-light p-4 text-left text-sm text-text-secondary-light"
					>
						<p class="font-semibold text-text-primary-light">Final reconciled access</p>
						<ul class="mt-3 space-y-2">
							<li>
								<span class="font-medium text-text-primary-light">Mallard Studio role:</span>
								{resolvedEntitlements.role}
							</li>
							<li>
								<span class="font-medium text-text-primary-light">Parchment API plan:</span>
								{resolvedEntitlements.apiPlan}
							</li>
							<li>
								<span class="font-medium text-text-primary-light">Parchment Intelligence:</span>
								{resolvedEntitlements.ppiAccess ? 'unlocked' : 'locked'}
							</li>
						</ul>
					</div>
				{/if}

				<div class="mt-6 flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
					{#if receipt?.primaryAction}
						<a
							href={receipt.primaryAction.href}
							class="inline-flex items-center justify-center rounded-lg bg-blue-500 px-4 py-2 text-white transition-colors hover:bg-blue-600"
						>
							{receipt.primaryAction.label}
						</a>
					{/if}

					{#if receipt?.secondaryActions?.length}
						{#each receipt.secondaryActions as action}
							<a
								href={action.href}
								class="inline-flex items-center justify-center rounded-lg border border-border-light px-4 py-2 text-sm font-semibold text-text-primary-light transition-colors hover:bg-background-primary-light"
							>
								{action.label}
							</a>
						{/each}
					{:else if !receipt?.primaryAction}
						<button
							onclick={returnToSubscription}
							class="rounded-lg bg-blue-500 px-4 py-2 text-white transition-colors hover:bg-blue-600"
						>
							Return to Subscription Control Plane
						</button>
					{/if}
				</div>
			</div>
		{:else}
			<div class="flex flex-col items-center justify-center text-center">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-16 w-16 text-yellow-500"
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
				<h2 class="text-primary-light mt-4 text-xl font-bold">Checkout pending</h2>
				<p class="text-primary-light mt-2">
					Your checkout is still being processed. We will reconcile the final entitlement state as
					soon as Stripe marks the session complete.
				</p>
				<button
					onclick={returnToSubscription}
					class="mt-6 rounded-lg bg-blue-500 px-4 py-2 text-white transition-colors hover:bg-blue-600"
				>
					Return to Subscription Control Plane
				</button>
			</div>
		{/if}
	</div>
</div>
