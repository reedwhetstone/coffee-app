<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { signInWithGoogle } from '$lib/supabase';
	import { ACCOUNT_DELETION_CONFIRMATION } from '$lib/accountDeletion';
	import type { MarketReadPreference } from '$lib/marketWire';
	import type { PageData } from './$types';

	let { data } = $props<{ data: PageData }>();
	let confirmation = $state('');
	let deleting = $state(false);
	let reauthenticating = $state(false);
	let message = $state('');
	let needsReauthentication = $state(false);
	let marketReadPreference = $derived<MarketReadPreference | null>(data.marketReadPreference);
	let marketReadUpdating = $state(false);
	let marketReadStatusRefreshing = $state(false);
	let marketReadMessage = $state('');
	let marketReadUpdateError = $state('');
	let marketReadStatusResolved = $state(false);
	let marketReadStatusUnavailable = $derived(
		Boolean(data.marketReadError) && !marketReadStatusResolved
	);

	async function refreshMarketReadStatus() {
		if (marketReadStatusRefreshing) return;

		marketReadStatusRefreshing = true;
		marketReadMessage = '';
		marketReadUpdateError = '';

		try {
			await invalidateAll();
		} finally {
			marketReadStatusRefreshing = false;
		}
	}

	async function updateMarketRead(method: 'PUT' | 'DELETE') {
		if (marketReadUpdating) return;

		marketReadUpdating = true;
		marketReadMessage = '';
		marketReadUpdateError = '';

		try {
			const response = await fetch('/api/email-subscriptions/market-read', { method });
			const result = await response.json().catch(() => null);
			if (!response.ok || !result?.data) {
				throw new Error(result?.error?.message ?? 'Your email preference could not be updated.');
			}

			marketReadPreference = result.data as MarketReadPreference;
			marketReadStatusResolved = true;
			marketReadMessage = marketReadPreference.subscribed
				? 'Market Brief waitlist is on.'
				: 'Market Brief waitlist is off.';
		} catch (error) {
			marketReadUpdateError =
				error instanceof Error
					? error.message
					: 'Your email preference could not be updated. Please try again.';
		} finally {
			marketReadUpdating = false;
		}
	}

	async function reauthenticate() {
		reauthenticating = true;
		message = '';
		try {
			const challengeResponse = await fetch('/api/account-deletion/reauthenticate', {
				method: 'POST',
				headers: { 'content-type': 'application/json' }
			});
			if (!challengeResponse.ok) {
				const result = await challengeResponse.json().catch(() => null);
				throw new Error(result?.error?.message ?? 'Reauthentication could not be started.');
			}

			const { error } = await signInWithGoogle(data.supabase, '/account');
			if (error) throw error;
		} catch {
			message = 'Google reauthentication could not be started. Please try again.';
			reauthenticating = false;
		}
	}

	async function deleteAccount() {
		if (deleting || confirmation !== ACCOUNT_DELETION_CONFIRMATION) return;
		deleting = true;
		message = '';
		needsReauthentication = false;

		try {
			const response = await fetch('/api/account-deletion', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ confirmation })
			});
			const result = await response.json();

			if (!response.ok) {
				if (response.status === 401) {
					try {
						await data.supabase.auth.signOut({ scope: 'local' });
					} catch {
						// The upstream session is authoritative; continue to fresh authentication.
					}
					await goto('/auth?next=/account', { replaceState: true });
					return;
				}
				needsReauthentication = result?.error?.code === 'recent_sign_in_required';
				message = result?.error?.message ?? 'Account deletion could not be completed.';
				return;
			}

			try {
				sessionStorage.setItem('purveyors:account-deletion-accepted', 'true');
			} catch {
				// Completion messaging is best effort; durable acceptance still requires sign-out.
			}
			try {
				await data.supabase.auth.signOut({ scope: 'local' });
			} catch {
				// Parchment already durably accepted the deletion. Local sign-out is best effort.
			}
			await goto('/', { replaceState: true, invalidateAll: true });
		} catch {
			message = 'Account deletion could not be completed. Please try again.';
		} finally {
			deleting = false;
		}
	}
</script>

<svelte:head>
	<title>Account settings - Purveyors</title>
	<meta name="description" content="Manage your Purveyors account" />
</svelte:head>

<div class="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
	<header>
		<p class="text-sm font-semibold text-accent">Account</p>
		<h1 class="mt-2 font-serif text-3xl font-medium text-ink">Account settings</h1>
		<p class="mt-2 text-sm text-muted">{data.email}</p>
	</header>

	<section
		class="mt-10 rounded-xl border border-line bg-surface-panel p-6"
		aria-labelledby="market-wire-preference-heading"
	>
		<div class="flex flex-wrap items-start justify-between gap-4">
			<div>
				<p class="text-sm font-semibold text-accent">Email preferences</p>
				<h2
					id="market-wire-preference-heading"
					class="mt-2 font-serif text-2xl font-medium text-ink"
				>
					Purveyors Market Brief
				</h2>
			</div>
			<span
				class="rounded-full px-3 py-1 text-xs font-semibold {marketReadStatusUnavailable
					? 'bg-surface-canvas text-muted ring-1 ring-line'
					: marketReadPreference?.subscribed
						? 'bg-success-subtle text-success-strong ring-1 ring-success/20'
						: 'bg-surface-canvas text-muted ring-1 ring-line'}"
			>
				{marketReadStatusUnavailable
					? 'Status unavailable'
					: marketReadPreference?.subscribed
						? 'On waitlist'
						: 'Not on waitlist'}
			</span>
		</div>

		<p class="mt-3 max-w-2xl text-sm leading-6 text-muted">
			A concise weekly read on green coffee pricing, availability, and movement. Weekly delivery is
			not live yet; your preference is saved for launch using {data.email}.
		</p>

		{#if marketReadStatusUnavailable || marketReadUpdateError}
			<div
				class="mt-4 rounded-md border border-danger/20 bg-danger-subtle p-3 text-sm text-danger"
				role="alert"
			>
				<p>{marketReadUpdateError || data.marketReadError}</p>
				{#if marketReadStatusUnavailable}
					<button
						type="button"
						onclick={refreshMarketReadStatus}
						disabled={marketReadStatusRefreshing}
						class="mt-2 font-semibold underline disabled:cursor-not-allowed disabled:opacity-50"
					>
						{marketReadStatusRefreshing ? 'Checking status…' : 'Retry status'}
					</button>
				{/if}
			</div>
		{:else if marketReadMessage}
			<p
				class="mt-4 rounded-md border border-success/20 bg-success-subtle p-3 text-sm text-success-strong"
				role="status"
			>
				{marketReadMessage}
			</p>
		{/if}

		<div class="mt-5 flex flex-wrap items-center gap-4">
			<button
				type="button"
				onclick={() =>
					updateMarketRead(
						marketReadStatusUnavailable || marketReadPreference?.subscribed ? 'DELETE' : 'PUT'
					)}
				disabled={marketReadUpdating}
				class="rounded-md border border-line px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
			>
				{marketReadUpdating
					? 'Saving…'
					: marketReadStatusUnavailable || marketReadPreference?.subscribed
						? 'Leave Market Brief waitlist'
						: 'Join Market Brief waitlist'}
			</button>
			<a href="/market-wire" class="text-sm font-medium text-accent hover:underline">
				About Market Brief
			</a>
		</div>
	</section>

	<section class="mt-10 rounded-xl border border-danger/30 bg-surface-panel p-6">
		<h2 class="text-xl font-semibold text-danger">Danger zone</h2>
		<p class="mt-3 text-sm leading-6 text-muted">
			Deleting your account immediately cancels the entire subscription attached to it, including
			any bundled products. It permanently removes your saved data and Purveyors sign-in, Market
			Wire waitlist, and archive access. Active or trialing billing is not a blocker. This cannot be
			undone.
		</p>

		<div class="mt-6 rounded-lg border border-line bg-surface-canvas p-4">
			<h3 class="font-medium text-ink">Confirm your identity</h3>
			<p class="mt-2 text-sm text-muted">
				A recent Google sign-in is required before account deletion.
			</p>
			<button
				type="button"
				onclick={reauthenticate}
				disabled={reauthenticating}
				class="mt-3 rounded-md border border-line px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface-panel disabled:opacity-50"
			>
				{reauthenticating ? 'Opening Google…' : 'Sign in with Google again'}
			</button>
		</div>

		<label class="mt-6 block text-sm font-medium text-ink" for="account-deletion-confirmation">
			Type <strong>{ACCOUNT_DELETION_CONFIRMATION}</strong> exactly to confirm
		</label>
		<input
			id="account-deletion-confirmation"
			bind:value={confirmation}
			autocomplete="off"
			spellcheck="false"
			class="mt-2 block w-full rounded-md border-line bg-surface-canvas text-ink focus:border-danger focus:ring-danger"
		/>

		{#if message}
			<p
				class="mt-4 rounded-md border border-danger/20 bg-danger-subtle p-3 text-sm text-danger"
				role="alert"
			>
				{message}
			</p>
		{/if}

		{#if needsReauthentication}
			<button
				type="button"
				onclick={reauthenticate}
				class="mt-3 text-sm font-medium text-accent underline"
			>
				Reauthenticate with Google
			</button>
		{/if}

		<button
			type="button"
			onclick={deleteAccount}
			disabled={deleting || confirmation !== ACCOUNT_DELETION_CONFIRMATION}
			class="mt-6 rounded-md bg-danger px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
		>
			{deleting ? 'Deleting account…' : 'Permanently delete account'}
		</button>
	</section>
</div>
