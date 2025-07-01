<script lang="ts">
	import { goto } from '$app/navigation';

	function handleSelectPlan(plan: string) {
		if (plan === 'free') {
			goto('/auth');
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
				Choose the right plan for your roasting business
			</p>
		</div>
		<p class="mx-auto mt-6 max-w-2xl text-center text-lg leading-8 text-text-secondary-light">
			Start free and scale as your coffee business grows. No hidden fees, cancel anytime.
		</p>

		<div
			class="isolate mx-auto mt-16 grid max-w-md grid-cols-1 gap-y-8 sm:mt-20 lg:mx-0 lg:max-w-none lg:grid-cols-3"
		>
			<!-- Free Plan -->
			<div
				class="flex flex-col justify-between rounded-3xl bg-background-primary-light p-8 ring-1 ring-border-light xl:p-10"
			>
				<div>
					<div class="flex items-center justify-between gap-x-4">
						<h3 class="text-lg font-semibold leading-8 text-text-primary-light">Explorer</h3>
					</div>
					<p class="mt-4 text-sm leading-6 text-text-secondary-light">
						Perfect for getting started with coffee catalog browsing and basic search functionality.
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
							Browse coffee catalog
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
							Basic search and filtering
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
							View coffee details and scores
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
					onclick={() => handleSelectPlan('free')}
					class="mt-8 block w-full rounded-md bg-background-tertiary-light px-3 py-2 text-center text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-background-tertiary-light"
				>
					Get started free
				</button>
			</div>

			<!-- Professional Plan -->
			<div
				class="flex flex-col justify-between rounded-3xl bg-background-primary-light p-8 ring-2 ring-background-tertiary-light xl:p-10"
			>
				<div>
					<div class="flex items-center justify-between gap-x-4">
						<h3 class="text-lg font-semibold leading-8 text-background-tertiary-light">
							Professional
						</h3>
						<p
							class="rounded-full bg-background-tertiary-light/10 px-2.5 py-1 text-xs font-semibold leading-5 text-background-tertiary-light"
						>
							Most popular
						</p>
					</div>
					<p class="mt-4 text-sm leading-6 text-text-secondary-light">
						Everything you need to run a professional coffee roasting operation with AI insights.
					</p>
					<p class="mt-6 flex items-baseline gap-x-1">
						<span class="text-4xl font-bold tracking-tight text-text-primary-light">$29</span>
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
							All Explorer features
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
							AI-powered coffee recommendations
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
							Personal inventory management
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
							Roasting profile tracking with D3.js charts
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
							Profit tracking and analytics
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
							Semantic search with vector embeddings
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
					onclick={() => handleSelectPlan('professional')}
					class="mt-8 block w-full rounded-md bg-background-tertiary-light px-3 py-2 text-center text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-background-tertiary-light"
				>
					Start professional trial
				</button>
			</div>

			<!-- Enterprise Plan -->
			<div
				class="flex flex-col justify-between rounded-3xl bg-background-primary-light p-8 ring-1 ring-border-light xl:p-10"
			>
				<div>
					<div class="flex items-center justify-between gap-x-4">
						<h3 class="text-lg font-semibold leading-8 text-text-primary-light">Enterprise</h3>
					</div>
					<p class="mt-4 text-sm leading-6 text-text-secondary-light">
						Advanced features and dedicated support for large roasting operations and distributors.
					</p>
					<p class="mt-6 flex items-baseline gap-x-1">
						<span class="text-4xl font-bold tracking-tight text-text-primary-light">$99</span>
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
							All Professional features
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
							Multi-location inventory management
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
							Advanced analytics and reporting
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
							API access for integrations
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
							Team collaboration tools
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
							24/7 phone and chat support
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
							Custom onboarding and training
						</li>
					</ul>
				</div>
				<button
					onclick={() => handleSelectPlan('enterprise')}
					class="mt-8 block w-full rounded-md bg-text-primary-light px-3 py-2 text-center text-sm font-semibold text-background-primary-light shadow-sm transition-all duration-200 hover:bg-opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary-light"
				>
					Contact sales
				</button>
			</div>
		</div>
	</div>
</section>
