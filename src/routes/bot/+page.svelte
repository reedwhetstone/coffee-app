<svelte:head>
	<meta name="referrer" content="strict-origin-when-cross-origin" />
</svelte:head>

<div class="min-h-screen bg-surface-canvas">
	<main class="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
		<header class="max-w-3xl">
			<p class="text-sm font-semibold uppercase tracking-[0.18em] text-accent">Crawler operator</p>
			<h1 class="mt-3 font-serif text-4xl font-medium tracking-tight text-ink sm:text-5xl">
				PurveyorsBot
			</h1>
			<p class="mt-6 text-lg leading-8 text-muted">
				PurveyorsBot collects public green-coffee product information for the Purveyors catalog and
				market-intelligence surfaces. This page gives website operators one place to verify the
				crawler, understand its request behavior, and request changes or removal.
			</p>
		</header>

		<section class="mt-12 grid gap-5 md:grid-cols-2" aria-label="Crawler identity">
			<div class="rounded-2xl border border-line bg-surface-panel p-6">
				<h2 class="text-lg font-semibold text-ink">User-Agent</h2>
				<code class="mt-3 block overflow-x-auto rounded-lg bg-surface-canvas p-3 text-sm text-ink">
					PurveyorsBot/1.0 (+https://www.purveyors.io)
				</code>
			</div>
			<div class="rounded-2xl border border-line bg-surface-panel p-6">
				<h2 class="text-lg font-semibold text-ink">Web Bot Auth identity</h2>
				<dl class="mt-3 space-y-3 text-sm">
					<div>
						<dt class="font-medium text-ink">Signature-Agent</dt>
						<dd class="mt-1 break-all text-muted">https://api.purveyors.io</dd>
					</div>
					<div>
						<dt class="font-medium text-ink">Public key directory</dt>
						<dd class="mt-1 break-all">
							<a
								class="text-accent hover:underline"
								href="https://api.purveyors.io/.well-known/http-message-signatures-directory"
							>
								api.purveyors.io/.well-known/http-message-signatures-directory
							</a>
						</dd>
					</div>
				</dl>
			</div>
		</section>

		<div class="mt-12 grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
			<div class="space-y-10">
				<section>
					<h2 class="text-2xl font-semibold text-ink">What the crawler fetches</h2>
					<p class="mt-4 leading-7 text-muted">
						The crawler reads publicly available collection feeds and product pages from
						green-coffee suppliers. It extracts product URLs, availability, price, origin,
						processing, certifications, and other product facts used to normalize listings across
						suppliers. It does not sign in to merchant accounts, add products to carts, or access
						checkout and customer routes.
					</p>
				</section>

				<section>
					<h2 class="text-2xl font-semibold text-ink">Request policy</h2>
					<ul class="mt-4 list-disc space-y-3 pl-6 leading-7 text-muted">
						<li>
							Shopify requests use one shared queue with a maximum concurrency of one and a
							randomized 3–6 second baseline between request starts.
						</li>
						<li>
							The registered fleet is audited for an applicable <code>Crawl-delay</code> for PurveyorsBot
							or the wildcard user-agent. Any applicable delay is configured as a global minimum when
							it is more conservative than that baseline.
						</li>
						<li>
							HTTP 429 stops further Shopify traffic for the run. The crawler honors
							<code>Retry-After</code> and does not replay the same limited request through another transport.
						</li>
						<li>
							Web Bot Auth signatures are generated after queue admission and refreshed for each
							request authority.
						</li>
					</ul>
					<p class="mt-4 leading-7 text-muted">
						Broader robots.txt path-policy enforcement is being introduced in stages. Until that
						work is complete, an operator opt-out is treated as a deny rule and removed from the
						active supplier set.
					</p>
				</section>

				<section>
					<h2 class="text-2xl font-semibold text-ink">How the data is used</h2>
					<p class="mt-4 leading-7 text-muted">
						Normalized product facts may appear in the public Purveyors catalog, analytics, and API.
						Raw storefront responses remain within Purveyors infrastructure and are not
						redistributed as source documents. Purveyors does not use crawler access to place orders
						or impersonate customers.
					</p>
				</section>
			</div>

			<aside class="h-fit rounded-2xl border border-line bg-surface-panel p-6">
				<h2 class="text-lg font-semibold text-ink">Opt out or contact us</h2>
				<p class="mt-3 text-sm leading-6 text-muted">
					If you operate a storefront and want PurveyorsBot blocked, slowed, or pointed at a
					preferred data source, email us from an address associated with the domain.
				</p>
				<a
					href="mailto:hello@purveyors.io?subject=PurveyorsBot%20operator%20request"
					class="mt-5 inline-flex rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-ink transition-opacity hover:opacity-90"
				>
					hello@purveyors.io
				</a>
				<p class="mt-4 text-xs leading-5 text-muted">
					Include the affected domain and whether the request is an opt-out, rate change, or
					preferred integration path.
				</p>
			</aside>
		</div>
	</main>
</div>
