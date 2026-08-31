<script lang="ts">
	import Footer from '$lib/components/marketing/Footer.svelte';
	import type { MarketReadPreference } from '$lib/marketWire';
	import { formatMarketBriefEdition, getBlogPostPath } from '$lib/types/blog.types';
	import { formatBlogDate } from '$lib/utils/dates';
	import type { PageData } from './$types';

	let { data } = $props<{ data: PageData }>();
	let preference = $derived<MarketReadPreference | null>(data.marketReadPreference);
	let updating = $state(false);
	let message = $state('');
	let updateError = $state('');

	async function subscribe() {
		if (updating || preference?.subscribed) return;

		updating = true;
		message = '';
		updateError = '';

		try {
			const response = await fetch('/api/email-subscriptions/market-read', { method: 'POST' });
			const result = await response.json().catch(() => null);
			if (!response.ok || !result?.data) {
				throw new Error(result?.error?.message ?? 'Market Wire signup could not be completed.');
			}

			preference = result.data as MarketReadPreference;
			message = 'You’re subscribed. The next Market Wire will go to your account email.';
		} catch (error) {
			updateError =
				error instanceof Error
					? error.message
					: 'Market Wire signup could not be completed. Please try again.';
		} finally {
			updating = false;
		}
	}
</script>

<div class="bg-surface-canvas">
	<main>
		<header class="border-b border-line bg-surface-panel">
			<div
				class="mx-auto grid max-w-7xl gap-12 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-center lg:px-8"
			>
				<div class="max-w-3xl">
					<p class="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
						Purveyors Market Wire
					</p>
					<h1 class="mt-4 font-serif text-4xl font-medium tracking-tight text-ink sm:text-6xl">
						The market moved. Here’s what matters.
					</h1>
					<p class="mt-6 max-w-2xl text-lg leading-8 text-muted">
						A concise weekly read on green coffee pricing, availability, and movement, grounded in
						source-linked market evidence.
					</p>
					<div class="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
						<span>Free</span>
						<span aria-hidden="true">·</span>
						<span>One email a week</span>
						<span aria-hidden="true">·</span>
						<span>Unsubscribe anytime</span>
					</div>
				</div>

				<section
					class="rounded-2xl border border-line bg-surface-canvas p-6 shadow-sm"
					aria-labelledby="signup-heading"
				>
					{#if preference?.subscribed}
						<p class="text-xs font-semibold uppercase tracking-[0.16em] text-success">Subscribed</p>
						<h2 id="signup-heading" class="mt-2 font-serif text-2xl font-medium text-ink">
							You’re on the wire.
						</h2>
						<p class="mt-3 text-sm leading-6 text-muted">
							Market Wire will be sent to {data.email}. You can change this anytime in Account
							settings.
						</p>
						<a
							href="/account"
							class="mt-5 inline-flex text-sm font-semibold text-accent hover:underline"
						>
							Manage email preference →
						</a>
					{:else if data.isSignedIn}
						<p class="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
							Weekly delivery
						</p>
						<h2 id="signup-heading" class="mt-2 font-serif text-2xl font-medium text-ink">
							Send it to {data.email}
						</h2>
						<p class="mt-3 text-sm leading-6 text-muted">
							Your Purveyors account keeps your preference and delivery address together.
						</p>
						<button
							type="button"
							onclick={subscribe}
							disabled={updating || Boolean(data.marketReadError)}
							class="mt-5 inline-flex w-full items-center justify-center rounded-md bg-accent px-4 py-3 text-sm font-semibold text-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
						>
							{updating ? 'Subscribing…' : 'Subscribe to Market Wire'}
						</button>
					{:else}
						<p class="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
							Weekly delivery
						</p>
						<h2 id="signup-heading" class="mt-2 font-serif text-2xl font-medium text-ink">
							Subscribe with your Purveyors account
						</h2>
						<p class="mt-3 text-sm leading-6 text-muted">
							Sign in, then confirm delivery to the email on your account.
						</p>
						<a
							href="/auth?next=%2Fmarket-wire"
							class="mt-5 inline-flex w-full items-center justify-center rounded-md bg-accent px-4 py-3 text-sm font-semibold text-ink transition-opacity hover:opacity-90"
						>
							Sign in to subscribe
						</a>
					{/if}

					{#if data.marketReadError || updateError}
						<p
							class="mt-4 rounded-md border border-danger/20 bg-danger-subtle p-3 text-sm text-danger"
							role="alert"
						>
							{updateError || data.marketReadError}
						</p>
					{:else if message}
						<p
							class="mt-4 rounded-md border border-success/20 bg-success-subtle p-3 text-sm text-success"
							role="status"
						>
							{message}
						</p>
					{/if}
				</section>
			</div>
		</header>

		<div class="mx-auto max-w-7xl space-y-20 px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
			<section aria-labelledby="inside-heading">
				<div class="max-w-3xl">
					<p class="text-sm font-semibold text-accent">Inside each edition</p>
					<h2 id="inside-heading" class="mt-2 font-serif text-4xl font-medium text-ink">
						A decision-ready read, not another data dump.
					</h2>
				</div>
				<div class="mt-10 grid gap-8 border-y border-line py-8 md:grid-cols-3">
					<article>
						<p class="text-sm font-semibold text-chart-rust">01</p>
						<h3 class="mt-3 text-xl font-semibold text-ink">What changed</h3>
						<p class="mt-3 text-sm leading-6 text-muted">
							The week’s meaningful shifts in pricing, availability, arrivals, and supplier
							coverage.
						</p>
					</article>
					<article>
						<p class="text-sm font-semibold text-chart-teal">02</p>
						<h3 class="mt-3 text-xl font-semibold text-ink">Why it matters</h3>
						<p class="mt-3 text-sm leading-6 text-muted">
							A procurement lens that separates durable market movement from ordinary catalog noise.
						</p>
					</article>
					<article>
						<p class="text-sm font-semibold text-chart-plum">03</p>
						<h3 class="mt-3 text-xl font-semibold text-ink">Where it came from</h3>
						<p class="mt-3 text-sm leading-6 text-muted">
							Source-linked observations make the read inspectable when a signal deserves a closer
							look.
						</p>
					</article>
				</div>
			</section>

			{#if data.latestEditions.length > 0}
				<section aria-labelledby="latest-heading">
					<div class="flex flex-wrap items-end justify-between gap-4">
						<div>
							<p class="text-sm font-semibold text-accent">Recent editions</p>
							<h2 id="latest-heading" class="mt-2 font-serif text-4xl font-medium text-ink">
								Read before you subscribe.
							</h2>
						</div>
						<a
							href="/blog?format=market-brief"
							class="text-sm font-semibold text-accent hover:underline"
						>
							All Market Brief editions →
						</a>
					</div>
					<div class="mt-8 grid gap-5 lg:grid-cols-3">
						{#each data.latestEditions as edition}
							<a
								href={getBlogPostPath(edition.slug)}
								class="group rounded-xl border border-line bg-surface-panel p-6 transition-all hover:border-accent/40 hover:shadow-sm"
							>
								<p class="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
									Edition {formatMarketBriefEdition(edition.edition)} · {formatBlogDate(
										edition.date
									)}
								</p>
								<h3
									class="mt-3 font-serif text-2xl font-medium text-ink transition-colors group-hover:text-accent"
								>
									{edition.title}
								</h3>
								<p class="mt-3 text-sm leading-6 text-muted">{edition.description}</p>
							</a>
						{/each}
					</div>
				</section>
			{/if}
		</div>
	</main>

	<Footer />
</div>
