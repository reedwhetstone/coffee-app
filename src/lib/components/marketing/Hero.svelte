<script lang="ts">
	import { goto } from '$app/navigation';

	function handleGetStarted() {
		goto('/auth');
	}

	function handleLearnMore() {
		document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
	}
</script>

<section
	class="relative overflow-hidden bg-gradient-to-br from-background-primary-light to-background-secondary-light"
>
	<div class="mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
		<div class="mx-auto max-w-2xl text-center">
			<h1 class="text-4xl font-bold tracking-tight text-text-primary-light sm:text-6xl">
				Discover. Roast. Perfect.
			</h1>
			<p class="mt-6 text-lg leading-8 text-text-secondary-light">
				The only platform built for modern home roasters. Find top-tier green coffees in hobbyist
				quantities, track your roasting journey, and improve your craft—all from one beautifully
				integrated tool.
			</p>
			<div class="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-x-6">
				<button
					onclick={handleGetStarted}
					class="w-full rounded-md bg-background-tertiary-light px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-background-tertiary-light sm:w-auto"
				>
					Get started free
				</button>
				<button
					onclick={() => goto('/auth')}
					class="w-full rounded-md border border-background-tertiary-light px-6 py-3 text-sm font-semibold text-background-tertiary-light transition-all duration-200 hover:bg-background-tertiary-light hover:text-white sm:w-auto"
				>
					Sign In
				</button>
				<button
					onclick={handleLearnMore}
					class="text-sm font-semibold leading-6 text-text-primary-light transition-colors duration-200 hover:text-background-tertiary-light"
				>
					Learn more <span aria-hidden="true">→</span>
				</button>
			</div>
		</div>

		<!-- Hero Visual -->
		<div class="mt-16 flow-root sm:mt-24">
			<div
				class="-m-2 rounded-xl bg-background-tertiary-light/5 p-2 ring-1 ring-inset ring-background-tertiary-light/10 lg:-m-4 lg:rounded-2xl lg:p-4"
			>
				<div
					class="rounded-md bg-background-secondary-light p-8 shadow-2xl ring-1 ring-border-light"
				>
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
						<!-- Coffee Card Preview -->
						<div
							class="rounded-lg bg-background-primary-light p-4 shadow-sm ring-1 ring-border-light"
						>
							<div class="flex items-center justify-between">
								<h3 class="font-semibold text-text-primary-light">Ethiopian Sidamo</h3>
								<div class="font-bold text-background-tertiary-light">$7.50/lb</div>
							</div>
							<p class="mt-1 text-sm text-text-secondary-light">Sweet Shop Coffee</p>
							<div class="mt-2 flex items-center justify-between text-xs text-text-secondary-light">
								<span>Score: 88</span>
								<span>Washed</span>
							</div>
						</div>

						<!-- AI Chat Preview -->
						<div
							class="rounded-lg bg-background-primary-light p-4 shadow-sm ring-1 ring-border-light sm:col-span-2"
						>
							<div class="mb-2 flex items-center gap-2">
								<div class="h-2 w-2 rounded-full bg-growth-green"></div>
								<span class="text-xs text-text-secondary-light">Coffee AI Concierge</span>
							</div>
							<p class="text-sm text-text-primary-light">
								"I found 3 washed Ethiopians under $8/lb with floral notes perfect for light
								roasting. The Sidamo from Sweet Shop Coffee is available in 2lb bags and has amazing
								citrus brightness."
							</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Background decoration -->
	<div
		class="absolute inset-x-0 top-[calc(100%-13rem)] -z-10 transform-gpu overflow-hidden blur-3xl sm:top-[calc(100%-30rem)]"
	>
		<div
			class="relative left-[calc(50%+3rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 bg-gradient-to-tr from-background-tertiary-light to-harvest-gold opacity-20 sm:left-[calc(50%+36rem)] sm:w-[72.1875rem]"
			style="clip-path: polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)"
		></div>
	</div>
</section>
