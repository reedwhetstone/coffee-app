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
	class="from-background-primary-light to-background-secondary-light relative overflow-hidden bg-gradient-to-br"
>
	<div class="mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
		<div class="flex flex-col items-center justify-center">
			<h1 class="text-text-primary-light text-4xl font-bold tracking-tight sm:text-6xl">
				Smarter Sourcing. Better Roasting.
			</h1>
		</div>
		<div class="mx-auto max-w-2xl text-center">
			<p class="text-text-secondary-light mt-6 text-lg leading-8">
				The only roasting platform build to scale from small-batch home roasting to commercial
				operations. Discover premium green coffees and grow your roasting journey with
				enterprise-grade tools, at a fraction of the cost.
			</p>
			<div class="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-x-6">
				<button
					onclick={handleGetStarted}
					class="bg-background-tertiary-light focus-visible:outline-background-tertiary-light w-full rounded-md px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 sm:w-auto"
				>
					Get started free
				</button>
				<button
					onclick={() => goto('/auth')}
					class="border-background-tertiary-light text-background-tertiary-light hover:bg-background-tertiary-light w-full rounded-md border px-6 py-3 text-sm font-semibold transition-all duration-200 hover:text-white sm:w-auto"
				>
					Sign In
				</button>
				<button
					onclick={handleLearnMore}
					class="text-text-primary-light hover:text-background-tertiary-light text-sm font-semibold leading-6 transition-colors duration-200"
				>
					Learn more <span aria-hidden="true">→</span>
				</button>
			</div>
		</div>

		<!-- Hero Visual -->
		<div class="mt-16 flow-root sm:mt-24">
			<div
				class="bg-background-tertiary-light/5 ring-background-tertiary-light/10 -m-2 rounded-xl p-2 ring-1 ring-inset lg:-m-4 lg:rounded-2xl lg:p-4"
			>
				<div
					class="bg-background-secondary-light ring-border-light rounded-md p-8 shadow-2xl ring-1"
				>
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
						<!-- Coffee Card Preview -->
						<div
							class="bg-background-primary-light ring-border-light rounded-lg p-4 shadow-sm ring-1"
						>
							<div class="flex items-center justify-between">
								<h3 class="text-text-primary-light font-semibold">Ethiopian Sidamo</h3>
								<div class="text-background-tertiary-light font-bold">$7.50/lb</div>
							</div>
							<p class="text-text-secondary-light mt-1 text-sm">Sweet Shop Coffee</p>
							<div class="text-text-secondary-light mt-2 flex items-center justify-between text-xs">
								<span>Score: 88</span>
								<span>Washed</span>
							</div>
						</div>

						<!-- AI Chat Preview -->
						<div
							class="bg-background-primary-light ring-border-light rounded-lg p-4 shadow-sm ring-1 sm:col-span-2"
						>
							<div class="mb-2 flex items-center gap-2">
								<div class="bg-growth-green h-2 w-2 rounded-full"></div>
								<span class="text-text-secondary-light text-xs">AI Coffee Analytics Assistant</span>
							</div>
							<p class="text-text-primary-light text-sm">
								"I analyzed your recent roasts and found 3 washed Ethiopians under $8/lb with floral
								notes that match your quality standards. The Sidamo from Sweet Shop Coffee shows
								consistent cup scores above 86 and would fit your current roasting profile
								parameters."
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
			class="from-background-tertiary-light to-harvest-gold relative left-[calc(50%+3rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 bg-gradient-to-tr opacity-20 sm:left-[calc(50%+36rem)] sm:w-[72.1875rem]"
			style="clip-path: polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)"
		></div>
	</div>
</section>
