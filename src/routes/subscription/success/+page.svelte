<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';
	import type { PageData } from './$types';
	import {
		clearCheckoutAttempt,
		isTerminalCheckoutStatus,
		parseCheckoutFailure,
		readCheckoutAttempt
	} from '$lib/billing/checkoutRequest';
	import { trackBillingOfferEvent } from '$lib/billing/offerAnalytics';

	let { data } = $props<{ data: PageData }>();
	let loading = $state(true);
	let status = $state<string | null>(null);
	let error = $state<string | null>(null);

	async function reconcile() {
		if (!data.auth.isSignedIn) {
			await goto('/auth?next=/subscription/success');
			return;
		}

		const attempt = readCheckoutAttempt(sessionStorage);
		if (!attempt?.admissionId) {
			error = 'No pending checkout admission was found in this browser.';
			loading = false;
			return;
		}

		try {
			const response = await fetch(
				`/api/billing/checkout-sessions/${encodeURIComponent(attempt.admissionId)}`,
				{ method: 'POST' }
			);
			const body = await response.json().catch(() => null);
			if (!response.ok) throw new Error(parseCheckoutFailure(body).message);
			if (!body || typeof body.status !== 'string') {
				throw new Error('Checkout reconciliation returned an invalid response.');
			}

			status = body.status;
			if (body.status === 'settled') {
				trackBillingOfferEvent('billing_checkout_settled', attempt.offerId);
				clearCheckoutAttempt(sessionStorage);
				await invalidateAll();
			} else if (isTerminalCheckoutStatus(body.status)) clearCheckoutAttempt(sessionStorage);
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Unable to reconcile checkout.';
		} finally {
			loading = false;
		}
	}

	onMount(reconcile);
</script>

<div class="flex min-h-[calc(100vh-80px)] flex-col items-center justify-center px-4 py-10">
	<div
		class="w-full max-w-md rounded-2xl border border-line bg-surface-panel p-8 text-center shadow-md"
	>
		{#if loading}
			<div
				class="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-accent border-t-transparent"
			></div>
			<p class="mt-4 text-ink">Confirming your checkout...</p>
		{:else if error || status === 'conflict' || status === 'closed'}
			<h1 class="text-2xl font-semibold text-ink">Checkout needs attention</h1>
			<p class="mt-3 text-muted">
				{error ??
					(status === 'conflict'
						? 'We found a conflicting checkout. Start a new checkout or contact support.'
						: 'This checkout is closed.')}
			</p>
			<button
				onclick={() => goto('/subscription')}
				class="mt-6 rounded-lg bg-accent px-4 py-2 font-semibold text-ink"
			>
				Back to plans
			</button>
		{:else if status === 'settled'}
			<h1 class="text-2xl font-semibold text-ink">Payment successful</h1>
			<p class="mt-3 text-muted">
				Your purchase is confirmed and your account access is up to date.
			</p>
			<button
				onclick={() => goto('/subscription')}
				class="mt-6 rounded-lg bg-accent px-4 py-2 font-semibold text-ink"
			>
				View subscriptions
			</button>
		{:else}
			<h1 class="text-2xl font-semibold text-ink">Payment is processing</h1>
			<p class="mt-3 text-muted">
				Your checkout is still settling. Keep this browser state and try again in a moment.
			</p>
			<div class="mt-6 flex justify-center gap-3">
				<button onclick={reconcile} class="rounded-lg bg-accent px-4 py-2 font-semibold text-ink"
					>Check again</button
				>
				<button
					onclick={() => goto('/subscription')}
					class="rounded-lg border border-line px-4 py-2 font-medium text-ink">Back</button
				>
			</div>
		{/if}
	</div>
</div>
