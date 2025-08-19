<script lang="ts">
	import { goto } from '$app/navigation';

	function handleSelectPlan(plan: string) {
		if (plan === 'free') {
			goto('/auth');
		} else if (plan === 'enterprise') {
			goto('/contact');
		} else {
			goto('/subscription');
		}
	}
</script>

<section id="pricing" class="bg-background-secondary-light py-24 sm:py-32">
	<div class="mx-auto max-w-7xl px-6 lg:px-8">
		<div class="mx-auto max-w-4xl text-center">
			<h2 class="text-base font-semibold leading-7 text-background-tertiary-light">Pricing</h2>
			<p class="mt-2 text-4xl font-bold tracking-tight text-text-primary-light sm:text-5xl">
				Grow from curious to commercial
			</p>
		</div>
		<p class="mx-auto mt-6 max-w-2xl text-center text-lg leading-8 text-text-secondary-light">
			Whether you're just starting or roasting for profit, we have the right plan for your journey.
			Start free, upgrade anytime.
		</p>

		<div
			class="isolate mx-auto mt-16 grid max-w-md grid-cols-1 gap-6 sm:mt-20 sm:gap-8 lg:mx-0 lg:max-w-none lg:grid-cols-3 lg:gap-12"
		>
			<!-- Free Plan -->
			<div
				class="flex cursor-pointer flex-col justify-between rounded-3xl bg-background-primary-light p-8 ring-1 ring-border-light transition-all duration-200 hover:scale-105 hover:ring-2 hover:ring-background-tertiary-light xl:p-10"
				onclick={() => handleSelectPlan('free')}
				onkeydown={(e) => e.key === 'Enter' && handleSelectPlan('free')}
				tabindex="0"
				role="button"
				aria-label="Select Free Plan"
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
							Browse curated green coffee catalog
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
					onclick={(e) => {
						e.stopPropagation();
						handleSelectPlan('free');
					}}
					class="mt-8 block w-full rounded-md bg-background-tertiary-light px-3 py-2 text-center text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-background-tertiary-light"
				>
					Get started free
				</button>
			</div>

			<!-- Professional Plan -->
			<div
				class="flex cursor-pointer flex-col justify-between rounded-3xl bg-background-primary-light p-8 ring-2 ring-background-tertiary-light transition-all duration-200 hover:scale-105 hover:shadow-lg hover:ring-background-tertiary-light xl:p-10"
				onclick={() => handleSelectPlan('professional')}
				onkeydown={(e) => e.key === 'Enter' && handleSelectPlan('professional')}
				tabindex="0"
				role="button"
				aria-label="Select Professional Plan"
			>
				<div>
					<div class="flex items-center justify-between gap-x-4">
						<h3 class="text-lg font-semibold leading-8 text-background-tertiary-light">Roaster</h3>
						<p
							class="rounded-full bg-background-tertiary-light/10 px-2.5 py-1 text-xs font-semibold leading-5 text-background-tertiary-light"
						>
							Most popular
						</p>
					</div>
					<p class="mt-4 text-sm leading-6 text-text-secondary-light">
						For active home roasters ready to track their journey and improve their craft with
						AI-powered insights.
					</p>
					<p class="mt-6 flex items-baseline gap-x-1">
						<span class="text-4xl font-bold tracking-tight text-text-primary-light">$9</span>
						<span class="text-sm font-semibold leading-6 text-text-secondary-light">/month</span>
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
							All Curious features
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
							Full AI Coffee Analytics Assistant
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
							Personal inventory & purchase tracking
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
							Seamless Artisan .alog integration
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
							Tasting journal & cupping notes
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
							Advanced roast analytics & QA insights
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
							Priority email support
						</li>
					</ul>
				</div>
				<button
					onclick={(e) => {
						e.stopPropagation();
						handleSelectPlan('professional');
					}}
					class="mt-8 block w-full rounded-md bg-background-tertiary-light px-3 py-2 text-center text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-background-tertiary-light"
				>
					Start professional trial
				</button>
			</div>

			<!-- Enterprise Plan -->
			<div
				class="flex cursor-pointer flex-col justify-between rounded-3xl bg-background-primary-light p-8 ring-1 ring-border-light transition-all duration-200 hover:scale-105 hover:ring-2 hover:ring-background-tertiary-light xl:p-10"
				onclick={() => handleSelectPlan('enterprise')}
				onkeydown={(e) => e.key === 'Enter' && handleSelectPlan('enterprise')}
				tabindex="0"
				role="button"
				aria-label="Select Enterprise Plan"
			>
				<div>
					<div class="flex items-center justify-between gap-x-4">
						<h3 class="text-lg font-semibold leading-8 text-text-primary-light">Enterprise</h3>
					</div>
					<p class="mt-4 text-sm leading-6 text-text-secondary-light">
						Business & operations consulting for coffee companies looking to scale their analytics,
						QA systems, and digital operations infrastructure.
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
									d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.77 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
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
					onclick={(e) => {
						e.stopPropagation();
						goto('/contact');
					}}
					class="mt-8 block w-full rounded-md bg-text-primary-light px-3 py-2 text-center text-sm font-semibold text-background-primary-light shadow-sm transition-all duration-200 hover:bg-opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary-light"
				>
					Schedule consultation
				</button>
			</div>
		</div>
	</div>
</section>
