<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';
	import { onMount } from 'svelte';
	import StripeCheckout from './StripeCheckout.svelte';
	import { signInWithGoogle } from '$lib/supabase';
	import type { BillingPurchaseKey } from '$lib/billing/purchaseKeys';

	let { data } = $props<{ data: PageData }>();

	let showCheckout = $state(false);
	let selectedPlan = $state<{
		purchaseKey: BillingPurchaseKey;
		planName: string;
		priceLabel: string;
	} | null>(null);
	let cancelLoading = $state(false);
	let cancelError = $state('');
	let cancelSuccess = $state(false);
	let resumeLoading = $state(false);
	let resumeError = $state('');
	let resumeSuccess = $state(false);

	const openCheckout = (plan: {
		purchaseKey: BillingPurchaseKey;
		planName: string;
		priceLabel: string;
	}) => {
		selectedPlan = plan;
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
		await invalidateAll();
	};

	const handleCheckoutCancel = () => {
		showCheckout = false;
		selectedPlan = null;
	};

	const formatPeriodEnd = (value: number | string | null | undefined) => {
		if (!value) return 'N/A';

		const date =
			typeof value === 'number'
				? new Date(value * 1000)
				: new Date(typeof value === 'string' ? value : String(value));

		if (Number.isNaN(date.getTime())) return 'N/A';

		return date.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
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
		const subscriptionId = data.controlPlane?.membership.currentPlan?.subscriptionId;
		if (!subscriptionId) return;

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
					subscriptionId
				})
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.error || 'Failed to cancel subscription');
			}

			cancelSuccess = true;
			await invalidateAll();
		} catch (error) {
			cancelError = error instanceof Error ? error.message : 'An unknown error occurred';
		} finally {
			cancelLoading = false;
		}
	};

	const resumeSubscription = async () => {
		const subscriptionId = data.controlPlane?.membership.currentPlan?.subscriptionId;
		if (!subscriptionId) return;

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
					subscriptionId
				})
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.error || 'Failed to resume subscription');
			}

			resumeSuccess = true;
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
	{#if data?.user && showCheckout && selectedPlan}
		<div class="px-4 py-10 md:px-6">
			<div class="mx-auto max-w-3xl">
				<div class="mb-4 flex items-center justify-between gap-4">
					<div>
						<p class="text-sm font-semibold uppercase tracking-wide text-text-secondary-light">
							Checkout
						</p>
						<h2 class="text-primary-light text-xl font-semibold">
							{selectedPlan.planName} · {selectedPlan.priceLabel}
						</h2>
					</div>
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
					purchaseKey={selectedPlan.purchaseKey}
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
						Subscription control plane
					</p>
					<h1 class="text-3xl font-bold text-text-primary-light sm:text-4xl">
						Manage Purveyors product access by product family
					</h1>
					<p class="max-w-3xl text-base text-text-secondary-light">
						This page is your canonical billing surface for Mallard Studio, Parchment API, Parchment
						Intelligence, and enterprise custom work. Each section shows what you currently have,
						what is available next, and which actions are safe to take.
					</p>
				</div>

				<div class="grid gap-6 xl:grid-cols-2">
					<section
						class="rounded-3xl border border-border-light bg-background-primary-light p-6 shadow-sm"
					>
						<div class="flex items-start justify-between gap-4">
							<div>
								<p class="text-sm font-semibold uppercase tracking-wide text-text-secondary-light">
									Mallard Studio
								</p>
								<h2 class="mt-2 text-2xl font-semibold text-text-primary-light">
									Workflow and operating environment
								</h2>
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

						{#if data.controlPlane.membership.currentPlan}
							<div
								class="mt-5 rounded-2xl border border-border-light bg-background-secondary-light p-4 text-sm text-text-secondary-light"
							>
								<div class="grid grid-cols-2 gap-3">
									<span>Current plan</span>
									<span class="text-right font-medium text-text-primary-light">
										{data.controlPlane.membership.currentPlan.name}
									</span>

									<span>Price</span>
									<span class="text-right font-medium text-text-primary-light">
										{data.controlPlane.membership.currentPlan.priceLabel ?? 'N/A'}
									</span>

									<span>Billing cadence</span>
									<span class="text-right font-medium text-text-primary-light">
										{data.controlPlane.membership.currentPlan.intervalLabel ?? 'N/A'}
									</span>

									<span>
										{data.controlPlane.membership.currentPlan.cancelAtPeriodEnd
											? 'Access ends'
											: 'Renews'}
									</span>
									<span class="text-right font-medium text-text-primary-light">
										{formatPeriodEnd(data.controlPlane.membership.currentPlan.currentPeriodEnd)}
									</span>
								</div>
							</div>
						{/if}

						{#if data.controlPlane.membership.managementBlockedReason}
							<div
								class="mt-5 rounded-2xl border border-orange-500/30 bg-orange-500/10 p-4 text-sm text-orange-300"
							>
								{data.controlPlane.membership.managementBlockedReason}
							</div>
						{/if}

						{#if data.controlPlane.membership.canManageSubscription}
							<div class="mt-5 space-y-3">
								{#if data.controlPlane.membership.currentPlan?.cancelAtPeriodEnd}
									<button
										onclick={() => resumeSubscription()}
										disabled={resumeLoading}
										class="w-full rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-300 transition-colors hover:bg-blue-500/20 disabled:opacity-50"
									>
										{resumeLoading ? 'Processing...' : 'Resume Mallard Studio'}
									</button>
									{#if resumeSuccess}
										<p class="text-sm text-green-400">
											Mallard Studio will keep renewing automatically.
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
										{cancelLoading ? 'Processing...' : 'Cancel Mallard Studio at period end'}
									</button>
									<p class="text-xs text-text-secondary-light">
										Your access will continue until the current billing period ends.
									</p>
									{#if cancelSuccess}
										<p class="text-sm text-green-400">
											Mallard Studio cancellation has been scheduled.
										</p>
									{/if}
									{#if cancelError}
										<p class="text-sm text-red-400">Error: {cancelError}</p>
									{/if}
								{/if}
							</div>
						{/if}

						{#if !data.controlPlane.membership.hasAccess}
							<div class="mt-6 space-y-4">
								<h3 class="text-lg font-semibold text-text-primary-light">Available plans</h3>
								<div class="grid gap-4 sm:grid-cols-2">
									{#each data.controlPlane.membership.availablePlans as plan}
										<div
											class="rounded-2xl border border-border-light bg-background-secondary-light p-5"
										>
											<div class="flex items-start justify-between gap-3">
												<div>
													<h4 class="text-lg font-semibold text-text-primary-light">
														{plan.planName}
													</h4>
													<p class="mt-1 text-sm text-text-secondary-light">{plan.intervalLabel}</p>
												</div>
												{#if plan.badge}
													<span
														class="rounded-full bg-green-500/15 px-3 py-1 text-xs font-semibold text-green-300"
													>
														{plan.badge}
													</span>
												{/if}
											</div>
											<p class="mt-4 text-3xl font-bold text-text-primary-light">
												{plan.priceLabel}
											</p>
											<button
												onclick={() => openCheckout(plan)}
												class="mt-5 w-full rounded-lg bg-background-tertiary-light px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
											>
												{plan.ctaLabel}
											</button>
										</div>
									{/each}
								</div>
							</div>
						{/if}
					</section>

					<section
						class="rounded-3xl border border-border-light bg-background-primary-light p-6 shadow-sm"
					>
						<div class="flex items-start justify-between gap-4">
							<div>
								<p class="text-sm font-semibold uppercase tracking-wide text-text-secondary-light">
									Parchment API
								</p>
								<h2 class="mt-2 text-2xl font-semibold text-text-primary-light">
									Machine-readable coffee data
								</h2>
							</div>
							<span
								class={`rounded-full border px-3 py-1 text-xs font-semibold ${toneClasses(data.controlPlane.api.tone)}`}
							>
								{data.controlPlane.api.statusLabel}
							</span>
						</div>

						<div class="mt-5 space-y-3 text-sm text-text-secondary-light">
							<p>{data.controlPlane.api.description}</p>
							<p>{data.controlPlane.api.sourceLabel}</p>
						</div>

						{#if data.controlPlane.api.currentPlan}
							<div
								class="mt-5 rounded-2xl border border-border-light bg-background-secondary-light p-4 text-sm text-text-secondary-light"
							>
								<div class="grid grid-cols-2 gap-3">
									<span>Current tier</span>
									<span class="text-right font-medium text-text-primary-light">
										{data.controlPlane.api.currentPlan.name}
									</span>

									<span>Price</span>
									<span class="text-right font-medium text-text-primary-light">
										{data.controlPlane.api.currentPlan.priceLabel ?? 'Included'}
									</span>

									<span>Billing cadence</span>
									<span class="text-right font-medium text-text-primary-light">
										{data.controlPlane.api.currentPlan.intervalLabel ?? 'Included'}
									</span>

									<span>
										{data.controlPlane.api.currentPlan.cancelAtPeriodEnd ? 'Access ends' : 'Renews'}
									</span>
									<span class="text-right font-medium text-text-primary-light">
										{formatPeriodEnd(data.controlPlane.api.currentPlan.currentPeriodEnd)}
									</span>
								</div>
							</div>
						{/if}

						<div class="mt-5 flex flex-col gap-3 sm:flex-row">
							<a
								href={data.controlPlane.api.consoleHref}
								class="inline-flex items-center justify-center rounded-lg border border-border-light px-4 py-2 text-sm font-semibold text-text-primary-light transition-colors hover:bg-background-secondary-light"
							>
								Open Parchment Console
							</a>
							<a
								href={data.controlPlane.enterprise.contactHref}
								class="inline-flex items-center justify-center rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-300 transition-colors hover:bg-blue-500/20"
							>
								Talk to us about enterprise API needs
							</a>
						</div>

						{#if !data.controlPlane.api.hasPaidPlan}
							<div class="mt-6 space-y-4">
								<h3 class="text-lg font-semibold text-text-primary-light">Upgrade path</h3>
								{#each data.controlPlane.api.upgradePlans as plan}
									<div
										class="rounded-2xl border border-border-light bg-background-secondary-light p-5"
									>
										<div class="flex items-start justify-between gap-3">
											<div>
												<h4 class="text-lg font-semibold text-text-primary-light">
													{plan.planName}
												</h4>
												<p class="mt-1 text-sm text-text-secondary-light">
													Production-ready access for apps, agents, and internal tools.
												</p>
											</div>
											<p class="text-2xl font-bold text-text-primary-light">{plan.priceLabel}</p>
										</div>
										<button
											onclick={() => openCheckout(plan)}
											class="mt-5 w-full rounded-lg bg-background-tertiary-light px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
										>
											{plan.ctaLabel}
										</button>
									</div>
								{/each}
							</div>
						{/if}
					</section>

					<section
						class="rounded-3xl border border-border-light bg-background-primary-light p-6 shadow-sm"
					>
						<div class="flex items-start justify-between gap-4">
							<div>
								<p class="text-sm font-semibold uppercase tracking-wide text-text-secondary-light">
									Parchment Intelligence
								</p>
								<h2 class="mt-2 text-2xl font-semibold text-text-primary-light">
									Analytics and market intelligence
								</h2>
							</div>
							<span
								class={`rounded-full border px-3 py-1 text-xs font-semibold ${toneClasses(data.controlPlane.intelligence.tone)}`}
							>
								{data.controlPlane.intelligence.statusLabel}
							</span>
						</div>

						<div class="mt-5 space-y-3 text-sm text-text-secondary-light">
							<p>{data.controlPlane.intelligence.description}</p>
							<p>{data.controlPlane.intelligence.sourceLabel}</p>
						</div>

						{#if data.controlPlane.intelligence.currentPlan}
							<div
								class="mt-5 rounded-2xl border border-border-light bg-background-secondary-light p-4 text-sm text-text-secondary-light"
							>
								<div class="grid grid-cols-2 gap-3">
									<span>Current plan</span>
									<span class="text-right font-medium text-text-primary-light">
										{data.controlPlane.intelligence.currentPlan.name}
									</span>

									<span>Price</span>
									<span class="text-right font-medium text-text-primary-light">
										{data.controlPlane.intelligence.currentPlan.priceLabel ?? 'N/A'}
									</span>

									<span>Billing cadence</span>
									<span class="text-right font-medium text-text-primary-light">
										{data.controlPlane.intelligence.currentPlan.intervalLabel ?? 'N/A'}
									</span>

									<span>
										{data.controlPlane.intelligence.currentPlan.cancelAtPeriodEnd
											? 'Access ends'
											: 'Renews'}
									</span>
									<span class="text-right font-medium text-text-primary-light">
										{formatPeriodEnd(data.controlPlane.intelligence.currentPlan.currentPeriodEnd)}
									</span>
								</div>
							</div>
						{/if}

						{#if !data.controlPlane.intelligence.enabled}
							<div class="mt-6 space-y-4">
								<h3 class="text-lg font-semibold text-text-primary-light">Available plans</h3>
								<div class="grid gap-4 sm:grid-cols-2">
									{#each data.controlPlane.intelligence.availablePlans as plan}
										<div
											class="rounded-2xl border border-border-light bg-background-secondary-light p-5"
										>
											<div class="flex items-start justify-between gap-3">
												<div>
													<h4 class="text-lg font-semibold text-text-primary-light">
														{plan.planName}
													</h4>
													<p class="mt-1 text-sm text-text-secondary-light">{plan.intervalLabel}</p>
												</div>
												{#if plan.badge}
													<span
														class="rounded-full bg-green-500/15 px-3 py-1 text-xs font-semibold text-green-300"
													>
														{plan.badge}
													</span>
												{/if}
											</div>
											<p class="mt-4 text-3xl font-bold text-text-primary-light">
												{plan.priceLabel}
											</p>
											<button
												onclick={() => openCheckout(plan)}
												class="mt-5 w-full rounded-lg bg-background-tertiary-light px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
											>
												{plan.ctaLabel}
											</button>
										</div>
									{/each}
								</div>
							</div>
						{:else}
							<div
								class="mt-5 rounded-2xl border border-border-light bg-background-secondary-light p-4 text-sm text-text-secondary-light"
							>
								Parchment Intelligence is active on this account. The analytics surface should now
								reflect the richer paid market-intelligence layer.
							</div>
						{/if}
					</section>

					<section
						class="rounded-3xl border border-border-light bg-background-primary-light p-6 shadow-sm"
					>
						<div class="flex items-start justify-between gap-4">
							<div>
								<p class="text-sm font-semibold uppercase tracking-wide text-text-secondary-light">
									Enterprise / custom integrations
								</p>
								<h2 class="mt-2 text-2xl font-semibold text-text-primary-light">
									Contact-only commercial path
								</h2>
							</div>
							<span
								class={`rounded-full border px-3 py-1 text-xs font-semibold ${toneClasses(data.controlPlane.enterprise.tone)}`}
							>
								{data.controlPlane.enterprise.statusLabel}
							</span>
						</div>

						<div class="mt-5 space-y-3 text-sm text-text-secondary-light">
							<p>{data.controlPlane.enterprise.description}</p>
							<p>{data.controlPlane.enterprise.note}</p>
						</div>

						<a
							href={data.controlPlane.enterprise.contactHref}
							class="mt-6 inline-flex items-center justify-center rounded-lg bg-text-primary-light px-4 py-2 text-sm font-semibold text-background-primary-light transition-opacity hover:opacity-90"
						>
							Talk to us
						</a>
					</section>
				</div>
			</div>
		</section>
	{:else}
		<section class="bg-background-secondary-light px-6 py-16">
			<div class="mx-auto max-w-6xl space-y-12">
				<div class="mx-auto max-w-3xl text-center">
					<p class="text-base font-semibold leading-7 text-background-tertiary-light">
						Subscription control plane
					</p>
					<h1 class="mt-2 text-4xl font-bold tracking-tight text-text-primary-light sm:text-5xl">
						One place to manage every Purveyors product family
					</h1>
					<p class="mx-auto mt-6 max-w-2xl text-lg leading-8 text-text-secondary-light">
						Mallard Studio powers operator workflows, Parchment API powers apps and agents,
						Parchment Intelligence unlocks deeper analytics, and enterprise work stays contact-only.
					</p>
				</div>

				<div class="grid gap-6 lg:grid-cols-2">
					<div class="rounded-3xl border border-border-light bg-background-primary-light p-8">
						<h2 class="text-2xl font-semibold text-text-primary-light">Mallard Studio</h2>
						<p class="mt-3 text-sm text-text-secondary-light">
							The paid workflow layer for roasting, inventory, tasting, profit visibility, chat, and
							CLI-backed operator workflows.
						</p>
						<p class="mt-6 text-3xl font-bold text-text-primary-light">$9/month or $80/year</p>
					</div>

					<div class="rounded-3xl border border-border-light bg-background-primary-light p-8">
						<h2 class="text-2xl font-semibold text-text-primary-light">Parchment API</h2>
						<p class="mt-3 text-sm text-text-secondary-light">
							Start on Explorer for free, then upgrade to paid Parchment API when you need
							production-ready data access.
						</p>
						<p class="mt-6 text-3xl font-bold text-text-primary-light">
							Explorer free, paid tier $99/month
						</p>
					</div>

					<div class="rounded-3xl border border-border-light bg-background-primary-light p-8">
						<h2 class="text-2xl font-semibold text-text-primary-light">Parchment Intelligence</h2>
						<p class="mt-3 text-sm text-text-secondary-light">
							Unlock the richer analytics and market-intelligence layer beyond the limited free
							floor.
						</p>
						<p class="mt-6 text-3xl font-bold text-text-primary-light">$39/month or $350/year</p>
					</div>

					<div class="rounded-3xl border border-border-light bg-background-primary-light p-8">
						<h2 class="text-2xl font-semibold text-text-primary-light">Enterprise</h2>
						<p class="mt-3 text-sm text-text-secondary-light">
							Custom integrations, embedded analytics, and commercial support stay contact-only.
						</p>
						<div class="mt-6 flex flex-col gap-3 sm:flex-row">
							<button
								onclick={handleSignIn}
								class="rounded-lg bg-background-tertiary-light px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
							>
								Create an account
							</button>
							<a
								href="/contact"
								class="inline-flex items-center justify-center rounded-lg border border-border-light px-4 py-2 text-sm font-semibold text-text-primary-light transition-colors hover:bg-background-secondary-light"
							>
								Talk to us
							</a>
						</div>
					</div>
				</div>
			</div>
		</section>
	{/if}
</div>
