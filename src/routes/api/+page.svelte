<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	function handleContactUs() {
		goto('/contact');
	}

	function handleGetStarted() {
		goto('/auth');
	}

	function scrollToSection(sectionId: string) {
		document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
	}

	onMount(() => {
		// Set page title for API page
		document.title = 'Purveyors.io Green Coffee API - Transform Your Roasting Platform';
	});
</script>

<svelte:head>
	<title>Purveyors.io Green Coffee API - Transform Your Roasting Platform</title>
	<meta
		name="description"
		content="The first normalized, daily-updated API for specialty green coffee. Integrate real-time green coffee data into your roasting software with our comprehensive REST API."
	/>
</svelte:head>

<div class="min-h-screen bg-background-primary-light">
	<!-- Hero Section -->
	<section
		class="relative overflow-hidden bg-gradient-to-br from-background-primary-light to-background-secondary-light"
	>
		<div class="mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
			<div class="flex flex-col items-center justify-center">
				<h1 class="text-4xl font-bold tracking-tight text-text-primary-light sm:text-6xl">
					Green Coffee API
				</h1>
				<div class="mt-2 text-xl font-medium text-background-tertiary-light">
					Transform how your platform accesses coffee data
				</div>
			</div>
			<div class="mx-auto max-w-3xl text-center">
				<p class="mt-6 text-lg leading-8 text-text-secondary-light">
					The first normalized, daily-updated API for specialty green coffee. Integrate real-time
					inventory data from top U.S. suppliers into your roasting software, ecommerce platform, or
					business application.
				</p>
				<div class="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-x-6">
					<button
						onclick={() => scrollToSection('pricing')}
						class="w-full rounded-md bg-background-tertiary-light px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-background-tertiary-light sm:w-auto"
					>
						View API Pricing
					</button>
					<button
						onclick={handleContactUs}
						class="w-full rounded-md border border-background-tertiary-light px-6 py-3 text-sm font-semibold text-background-tertiary-light transition-all duration-200 hover:bg-background-tertiary-light hover:text-white sm:w-auto"
					>
						Request Demo
					</button>
					<button
						onclick={() => scrollToSection('use-cases')}
						class="text-sm font-semibold leading-6 text-text-primary-light transition-colors duration-200 hover:text-background-tertiary-light"
					>
						Learn more <span aria-hidden="true">→</span>
					</button>
				</div>
			</div>

			<!-- API Preview -->
			<div class="mt-16 flow-root sm:mt-24">
				<div
					class="-m-2 rounded-xl bg-background-tertiary-light/5 p-2 ring-1 ring-inset ring-background-tertiary-light/10 lg:-m-4 lg:rounded-2xl lg:p-4"
				>
					<div
						class="rounded-md bg-background-secondary-light p-8 shadow-2xl ring-1 ring-border-light"
					>
						<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
							<!-- API Request Preview -->
							<div
								class="rounded-lg bg-background-primary-light p-6 shadow-sm ring-1 ring-border-light"
							>
								<div class="mb-4 flex items-center gap-2">
									<div class="h-2 w-2 rounded-full bg-growth-green"></div>
									<span class="text-sm font-medium text-text-secondary-light">GET Request</span>
								</div>
								<pre class="text-xs text-text-primary-light"><code
										>GET /api/v1/coffee?origin=ethiopia&process=washed&in_stock=true

Authorization: Bearer your_api_key
Content-Type: application/json</code
									></pre>
							</div>

							<!-- API Response Preview -->
							<div
								class="rounded-lg bg-background-primary-light p-6 shadow-sm ring-1 ring-border-light"
							>
								<div class="mb-4 flex items-center gap-2">
									<div class="h-2 w-2 rounded-full bg-background-tertiary-light"></div>
									<span class="text-sm font-medium text-text-secondary-light">JSON Response</span>
								</div>
								<pre class="text-xs text-text-primary-light"><code
										>{`{
  "data": [{
    "name": "Ethiopia Sidamo",
    "supplier": "sweet_shop_coffee",
    "origin": "Ethiopia",
    "region": "Sidamo",
    "process": "Washed",
    "price_per_lb": 7.50,
    "stocked": "TRUE",
    "tasting_profile": {
      "fruity": 8, "floral": 6, "nutty": 2
    }
  }]
}`}</code
									></pre>
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

	<!-- Problem Section -->
	<section class="bg-background-secondary-light py-24 sm:py-32">
		<div class="mx-auto max-w-7xl px-6 lg:px-8">
			<div class="mx-auto max-w-2xl lg:text-center">
				<h2 class="text-base font-semibold leading-7 text-background-tertiary-light">
					The Problem
				</h2>
				<p class="mt-2 text-3xl font-bold tracking-tight text-text-primary-light sm:text-4xl">
					Roasters waste time tracking coffee across dozens of supplier sites
				</p>
				<p class="mt-6 text-lg leading-8 text-text-secondary-light">
					Software platforms and roasting businesses struggle with fragmented green coffee data,
					constant manual updates, and inconsistent product information across suppliers.
				</p>
			</div>
			<div class="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
				<dl class="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-2">
					<div class="flex flex-col">
						<dt
							class="flex items-center gap-x-3 text-base font-semibold leading-7 text-text-primary-light"
						>
							<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500">
								<svg
									class="h-6 w-6 text-white"
									fill="none"
									viewBox="0 0 24 24"
									stroke-width="1.5"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
									/>
								</svg>
							</div>
							No Standard Format
						</dt>
						<dd class="mt-4 flex flex-auto flex-col text-base leading-7 text-text-secondary-light">
							<p class="flex-auto">
								Every supplier has different product descriptions, naming conventions, and data
								structures. Integration requires custom parsing for each vendor.
							</p>
						</dd>
					</div>

					<div class="flex flex-col">
						<dt
							class="flex items-center gap-x-3 text-base font-semibold leading-7 text-text-primary-light"
						>
							<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500">
								<svg
									class="h-6 w-6 text-white"
									fill="none"
									viewBox="0 0 24 24"
									stroke-width="1.5"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
									/>
								</svg>
							</div>
							Frequent Stock Changes
						</dt>
						<dd class="mt-4 flex flex-auto flex-col text-base leading-7 text-text-secondary-light">
							<p class="flex-auto">
								Green coffee inventory changes daily. Manual tracking means outdated information and
								missed opportunities for fresh lots.
							</p>
						</dd>
					</div>

					<div class="flex flex-col">
						<dt
							class="flex items-center gap-x-3 text-base font-semibold leading-7 text-text-primary-light"
						>
							<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500">
								<svg
									class="h-6 w-6 text-white"
									fill="none"
									viewBox="0 0 24 24"
									stroke-width="1.5"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
									/>
								</svg>
							</div>
							Marketing Over Facts
						</dt>
						<dd class="mt-4 flex flex-auto flex-col text-base leading-7 text-text-secondary-light">
							<p class="flex-auto">
								Supplier descriptions focus on marketing language rather than technical
								specifications that roasters actually need for sourcing decisions.
							</p>
						</dd>
					</div>

					<div class="flex flex-col">
						<dt
							class="flex items-center gap-x-3 text-base font-semibold leading-7 text-text-primary-light"
						>
							<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500">
								<svg
									class="h-6 w-6 text-white"
									fill="none"
									viewBox="0 0 24 24"
									stroke-width="1.5"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"
									/>
								</svg>
							</div>
							Integration Friction
						</dt>
						<dd class="mt-4 flex flex-auto flex-col text-base leading-7 text-text-secondary-light">
							<p class="flex-auto">
								Software platforms spend weeks building custom integrations for each supplier
								instead of focusing on their core product features.
							</p>
						</dd>
					</div>
				</dl>
			</div>
		</div>
	</section>

	<!-- Solution Section -->
	<section class="bg-background-primary-light py-24 sm:py-32">
		<div class="mx-auto max-w-7xl px-6 lg:px-8">
			<div class="mx-auto max-w-2xl lg:text-center">
				<h2 class="text-base font-semibold leading-7 text-background-tertiary-light">
					Our Solution
				</h2>
				<p class="mt-2 text-3xl font-bold tracking-tight text-text-primary-light sm:text-4xl">
					Purveyors.io Green Coffee API
				</p>
				<p class="mt-6 text-lg leading-8 text-text-secondary-light">
					The first normalized, daily-updated API for specialty green coffee. Clean data,
					standardized format, and AI-enhanced metadata from multiple top U.S. suppliers.
				</p>
			</div>
			<div class="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
				<dl class="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-2">
					<div class="flex flex-col">
						<dt
							class="flex items-center gap-x-3 text-base font-semibold leading-7 text-text-primary-light"
						>
							<div
								class="flex h-10 w-10 items-center justify-center rounded-lg bg-background-tertiary-light"
							>
								<svg
									class="h-6 w-6 text-white"
									fill="none"
									viewBox="0 0 24 24"
									stroke-width="1.5"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125"
									/>
								</svg>
							</div>
							Aggregated Inventory
						</dt>
						<dd class="mt-4 flex flex-auto flex-col text-base leading-7 text-text-secondary-light">
							<p class="flex-auto">
								Access inventory from top U.S. suppliers through a single API endpoint. No more
								custom integrations or manual data collection.
							</p>
						</dd>
					</div>

					<div class="flex flex-col">
						<dt
							class="flex items-center gap-x-3 text-base font-semibold leading-7 text-text-primary-light"
						>
							<div
								class="flex h-10 w-10 items-center justify-center rounded-lg bg-background-tertiary-light"
							>
								<svg
									class="h-6 w-6 text-white"
									fill="none"
									viewBox="0 0 24 24"
									stroke-width="1.5"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
									/>
								</svg>
							</div>
							LLM-Cleaned Metadata
						</dt>
						<dd class="mt-4 flex flex-auto flex-col text-base leading-7 text-text-secondary-light">
							<p class="flex-auto">
								AI processes and standardizes product descriptions, extracts key facts, and
								generates consistent metadata across all suppliers.
							</p>
						</dd>
					</div>

					<div class="flex flex-col">
						<dt
							class="flex items-center gap-x-3 text-base font-semibold leading-7 text-text-primary-light"
						>
							<div
								class="flex h-10 w-10 items-center justify-center rounded-lg bg-background-tertiary-light"
							>
								<svg
									class="h-6 w-6 text-white"
									fill="none"
									viewBox="0 0 24 24"
									stroke-width="1.5"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1.5 1.5m1.5-1.5l1.5 1.5m-1.5-1.5l1.5 1.5m-1.5-1.5l1.5 1.5"
									/>
								</svg>
							</div>
							Taste Profile Generation
						</dt>
						<dd class="mt-4 flex flex-auto flex-col text-base leading-7 text-text-secondary-light">
							<p class="flex-auto">
								Supplier-agnostic taste profiles automatically generated from descriptions, enabling
								better matching and recommendation algorithms.
							</p>
						</dd>
					</div>

					<div class="flex flex-col">
						<dt
							class="flex items-center gap-x-3 text-base font-semibold leading-7 text-text-primary-light"
						>
							<div
								class="flex h-10 w-10 items-center justify-center rounded-lg bg-background-tertiary-light"
							>
								<svg
									class="h-6 w-6 text-white"
									fill="none"
									viewBox="0 0 24 24"
									stroke-width="1.5"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
									/>
								</svg>
							</div>
							REST API & File Export
						</dt>
						<dd class="mt-4 flex flex-auto flex-col text-base leading-7 text-text-secondary-light">
							<p class="flex-auto">
								Choose REST API for real-time integration or flat file exports (CSV, JSON) for batch
								processing and data warehousing.
							</p>
						</dd>
					</div>
				</dl>
			</div>
		</div>
	</section>

	<!-- Use Cases Section -->
	<section id="use-cases" class="bg-background-secondary-light py-24 sm:py-32">
		<div class="mx-auto max-w-7xl px-6 lg:px-8">
			<div class="mx-auto max-w-2xl lg:text-center">
				<h2 class="text-base font-semibold leading-7 text-background-tertiary-light">Use Cases</h2>
				<p class="mt-2 text-3xl font-bold tracking-tight text-text-primary-light sm:text-4xl">
					Seamless integration into roasting workflows
				</p>
				<p class="mt-6 text-lg leading-8 text-text-secondary-light">
					Power your platform with real-time green coffee data and enable new features for your
					roasting customers.
				</p>
			</div>
			<div class="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
				<dl class="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-2">
					<div class="flex flex-col">
						<dt
							class="flex items-center gap-x-3 text-base font-semibold leading-7 text-text-primary-light"
						>
							<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-growth-green">
								<svg
									class="h-6 w-6 text-white"
									fill="none"
									viewBox="0 0 24 24"
									stroke-width="1.5"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3l-3 3-3-3m6.375-9a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"
									/>
								</svg>
							</div>
							Roast Log Auto-Fill
						</dt>
						<dd class="mt-4 flex flex-auto flex-col text-base leading-7 text-text-secondary-light">
							<p class="flex-auto">
								Automatically populate green coffee details in roast logs. Users select from current
								inventory with accurate pricing, origins, and processing information.
							</p>
						</dd>
					</div>

					<div class="flex flex-col">
						<dt
							class="flex items-center gap-x-3 text-base font-semibold leading-7 text-text-primary-light"
						>
							<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-growth-green">
								<svg
									class="h-6 w-6 text-white"
									fill="none"
									viewBox="0 0 24 24"
									stroke-width="1.5"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
									/>
								</svg>
							</div>
							Planning Dashboards
						</dt>
						<dd class="mt-4 flex flex-auto flex-col text-base leading-7 text-text-secondary-light">
							<p class="flex-auto">
								Power roast planning dashboards with updated stock data. Show availability trends,
								price changes, and seasonal patterns to help roasters make informed sourcing
								decisions.
							</p>
						</dd>
					</div>

					<div class="flex flex-col">
						<dt
							class="flex items-center gap-x-3 text-base font-semibold leading-7 text-text-primary-light"
						>
							<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-growth-green">
								<svg
									class="h-6 w-6 text-white"
									fill="none"
									viewBox="0 0 24 24"
									stroke-width="1.5"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
									/>
								</svg>
							</div>
							Similar Bean Suggestions
						</dt>
						<dd class="mt-4 flex flex-auto flex-col text-base leading-7 text-text-secondary-light">
							<p class="flex-auto">
								Use taste profile data to suggest similar beans when a favorite coffee goes out of
								stock. Build recommendation engines based on processing, origin, and flavor
								characteristics.
							</p>
						</dd>
					</div>

					<div class="flex flex-col">
						<dt
							class="flex items-center gap-x-3 text-base font-semibold leading-7 text-text-primary-light"
						>
							<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-growth-green">
								<svg
									class="h-6 w-6 text-white"
									fill="none"
									viewBox="0 0 24 24"
									stroke-width="1.5"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.001 3.001 0 01-.094-2.43 3.001 3.001 0 01.094-2.43m0 4.86a3.001 3.001 0 01-.094-2.43m0 2.43l.025.07V19.82m-.025-.07a2.997 2.997 0 01-.654-2.325 2.997 2.997 0 01.654-2.325m0 4.65V9.349m0 10.471V19.82m0 0h.025m-.025 0a2.997 2.997 0 01-.654-2.325 2.997 2.997 0 01.654-2.325"
									/>
								</svg>
							</div>
							SKU Preloading
						</dt>
						<dd class="mt-4 flex flex-auto flex-col text-base leading-7 text-text-secondary-light">
							<p class="flex-auto">
								Preload SKU data in ecommerce and inventory management tools. Streamline product
								catalog updates and maintain accurate pricing across sales channels.
							</p>
						</dd>
					</div>
				</dl>
			</div>
		</div>
	</section>

	<!-- API Data Fields Section -->
	<section class="bg-background-primary-light py-24 sm:py-32">
		<div class="mx-auto max-w-7xl px-6 lg:px-8">
			<div class="mx-auto max-w-2xl lg:text-center">
				<h2 class="text-base font-semibold leading-7 text-background-tertiary-light">
					API Data Fields
				</h2>
				<p class="mt-2 text-3xl font-bold tracking-tight text-text-primary-light sm:text-4xl">
					Comprehensive coffee data structure
				</p>
				<p class="mt-6 text-lg leading-8 text-text-secondary-light">
					Access detailed, normalized coffee information with consistent field structure across all
					suppliers.
				</p>
			</div>
			<div class="mx-auto mt-16 max-w-4xl">
				<div
					class="overflow-hidden rounded-lg bg-background-secondary-light shadow ring-1 ring-border-light"
				>
					<div class="bg-background-tertiary-light px-6 py-4">
						<h3 class="text-lg font-semibold text-white">Available Data Fields</h3>
					</div>
					<div class="divide-y divide-border-light">
						<div class="grid grid-cols-1 gap-4 px-6 py-4 sm:grid-cols-3">
							<div class="font-medium text-text-primary-light">Name</div>
							<div class="text-text-secondary-light">Coffee lot name (cleaned)</div>
							<div class="text-sm text-text-secondary-light">String</div>
						</div>
						<div class="grid grid-cols-1 gap-4 px-6 py-4 sm:grid-cols-3">
							<div class="font-medium text-text-primary-light">Supplier</div>
							<div class="text-text-secondary-light">Direct link to purchase</div>
							<div class="text-sm text-text-secondary-light">String</div>
						</div>
						<div class="grid grid-cols-1 gap-4 px-6 py-4 sm:grid-cols-3">
							<div class="font-medium text-text-primary-light">Origin</div>
							<div class="text-text-secondary-light">Region, Country, Sub-region</div>
							<div class="text-sm text-text-secondary-light">Object</div>
						</div>
						<div class="grid grid-cols-1 gap-4 px-6 py-4 sm:grid-cols-3">
							<div class="font-medium text-text-primary-light">Process</div>
							<div class="text-text-secondary-light">Washed, Natural, Honey, etc.</div>
							<div class="text-sm text-text-secondary-light">String</div>
						</div>
						<div class="grid grid-cols-1 gap-4 px-6 py-4 sm:grid-cols-3">
							<div class="font-medium text-text-primary-light">Varietal</div>
							<div class="text-text-secondary-light">Genetic varietal information</div>
							<div class="text-sm text-text-secondary-light">String</div>
						</div>
						<div class="grid grid-cols-1 gap-4 px-6 py-4 sm:grid-cols-3">
							<div class="font-medium text-text-primary-light">Price/lb</div>
							<div class="text-text-secondary-light">USD per pound</div>
							<div class="text-sm text-text-secondary-light">Number</div>
						</div>
						<div class="grid grid-cols-1 gap-4 px-6 py-4 sm:grid-cols-3">
							<div class="font-medium text-text-primary-light">Inventory Status</div>
							<div class="text-text-secondary-light">In-stock, Low-stock, Sold-out</div>
							<div class="text-sm text-text-secondary-light">Enum</div>
						</div>
						<div class="grid grid-cols-1 gap-4 px-6 py-4 sm:grid-cols-3">
							<div class="font-medium text-text-primary-light">Tasting Matrix</div>
							<div class="text-text-secondary-light">
								Generated profile matrix (fruit, floral, nutty, etc.)
							</div>
							<div class="text-sm text-text-secondary-light">Object</div>
						</div>
						<div class="grid grid-cols-1 gap-4 px-6 py-4 sm:grid-cols-3">
							<div class="font-medium text-text-primary-light">Description</div>
							<div class="text-text-secondary-light">Cleaned factual summary</div>
							<div class="text-sm text-text-secondary-light">String</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- Pricing Section -->
	<section id="pricing" class="bg-background-secondary-light py-24 sm:py-32">
		<div class="mx-auto max-w-7xl px-6 lg:px-8">
			<div class="mx-auto max-w-4xl text-center">
				<h2 class="text-base font-semibold leading-7 text-background-tertiary-light">
					API Pricing
				</h2>
				<p class="mt-2 text-4xl font-bold tracking-tight text-text-primary-light sm:text-5xl">
					Scale with your platform
				</p>
			</div>
			<p class="mx-auto mt-6 max-w-2xl text-center text-lg leading-8 text-text-secondary-light">
				Subscription plans billed monthly. Cancel anytime. Custom enterprise solutions available.
			</p>

			<div
				class="isolate mx-auto mt-16 grid max-w-md grid-cols-1 gap-6 sm:mt-20 sm:gap-8 lg:mx-0 lg:max-w-none lg:grid-cols-3 lg:gap-12"
			>
				<!-- Developer Plan -->
				<div
					class="flex flex-col justify-between rounded-3xl bg-background-primary-light p-8 ring-1 ring-border-light xl:p-10"
				>
					<div>
						<div class="flex items-center justify-between gap-x-4">
							<h3 class="text-lg font-semibold leading-8 text-text-primary-light">Developer</h3>
						</div>
						<p class="mt-4 text-sm leading-6 text-text-secondary-light">
							Perfect for startups and small platforms testing integration capabilities.
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
								1,000 API calls/month
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
								Basic data fields
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
								REST API access
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
						onclick={handleContactUs}
						class="mt-8 block w-full rounded-md bg-background-tertiary-light px-3 py-2 text-center text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-opacity-90"
					>
						Get started
					</button>
				</div>

				<!-- Growth Plan -->
				<div
					class="flex flex-col justify-between rounded-3xl bg-background-primary-light p-8 ring-2 ring-background-tertiary-light xl:p-10"
				>
					<div>
						<div class="flex items-center justify-between gap-x-4">
							<h3 class="text-lg font-semibold leading-8 text-background-tertiary-light">Growth</h3>
							<p
								class="rounded-full bg-background-tertiary-light/10 px-2.5 py-1 text-xs font-semibold leading-5 text-background-tertiary-light"
							>
								Most popular
							</p>
						</div>
						<p class="mt-4 text-sm leading-6 text-text-secondary-light">
							For growing platforms with active user bases requiring comprehensive data access.
						</p>
						<p class="mt-6 flex items-baseline gap-x-1">
							<span class="text-4xl font-bold tracking-tight text-text-primary-light">$399</span>
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
								10,000 API calls/month
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
								All metadata & full taste matrix
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
								Priority rate limiting
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
								Email support
							</li>
						</ul>
					</div>
					<button
						onclick={handleContactUs}
						class="mt-8 block w-full rounded-md bg-background-tertiary-light px-3 py-2 text-center text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-opacity-90"
					>
						Get started
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
							For large platforms and enterprise customers requiring high-volume access and custom
							integrations.
						</p>
						<p class="mt-6 flex items-baseline gap-x-1">
							<span class="text-4xl font-bold tracking-tight text-text-primary-light">$999</span>
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
								100,000 API calls/month
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
								CSV/S3 data dumps
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
								Premium support & SLA
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
								Custom integration support
							</li>
						</ul>
					</div>
					<button
						onclick={handleContactUs}
						class="mt-8 block w-full rounded-md bg-text-primary-light px-3 py-2 text-center text-sm font-semibold text-background-primary-light shadow-sm transition-all duration-200 hover:bg-opacity-90"
					>
						Contact sales
					</button>
				</div>
			</div>

			<!-- Add-ons -->
			<div class="mx-auto mt-16 max-w-4xl">
				<div class="rounded-lg bg-background-primary-light p-8 ring-1 ring-border-light">
					<h3 class="text-lg font-semibold text-text-primary-light">Add-ons & Custom Options</h3>
					<div class="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
						<div>
							<div class="font-medium text-text-primary-light">Overage Pricing</div>
							<div class="text-sm text-text-secondary-light">$0.05 per 100 extra API calls</div>
						</div>
						<div>
							<div class="font-medium text-text-primary-light">White-label License</div>
							<div class="text-sm text-text-secondary-light">Starting at $5,000/year</div>
						</div>
						<div>
							<div class="font-medium text-text-primary-light">Flat Data Licensing</div>
							<div class="text-sm text-text-secondary-light">$2,000/year (CSV exports)</div>
						</div>
						<div>
							<div class="font-medium text-text-primary-light">Custom Plans</div>
							<div class="text-sm text-text-secondary-light">Available for unique requirements</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- Competitive Edge Section -->
	<section class="bg-background-primary-light py-24 sm:py-32">
		<div class="mx-auto max-w-7xl px-6 lg:px-8">
			<div class="mx-auto max-w-2xl lg:text-center">
				<h2 class="text-base font-semibold leading-7 text-background-tertiary-light">
					Competitive Edge
				</h2>
				<p class="mt-2 text-3xl font-bold tracking-tight text-text-primary-light sm:text-4xl">
					Why Purveyors.io is different
				</p>
				<p class="mt-6 text-lg leading-8 text-text-secondary-light">
					The only neutral, AI-enhanced green coffee data API built specifically for the specialty
					coffee industry.
				</p>
			</div>
			<div class="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
				<dl class="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-2">
					<div class="flex flex-col">
						<dt
							class="flex items-center gap-x-3 text-base font-semibold leading-7 text-text-primary-light"
						>
							<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-growth-green">
								<svg
									class="h-6 w-6 text-white"
									fill="none"
									viewBox="0 0 24 24"
									stroke-width="1.5"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
									/>
								</svg>
							</div>
							Only Normalized Green Coffee API
						</dt>
						<dd class="mt-4 flex flex-auto flex-col text-base leading-7 text-text-secondary-light">
							<p class="flex-auto">
								First and only API providing standardized green coffee data across multiple
								suppliers. No custom parsing required for each vendor.
							</p>
						</dd>
					</div>

					<div class="flex flex-col">
						<dt
							class="flex items-center gap-x-3 text-base font-semibold leading-7 text-text-primary-light"
						>
							<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-growth-green">
								<svg
									class="h-6 w-6 text-white"
									fill="none"
									viewBox="0 0 24 24"
									stroke-width="1.5"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
									/>
								</svg>
							</div>
							AI-Enhanced Data Cleaning
						</dt>
						<dd class="mt-4 flex flex-auto flex-col text-base leading-7 text-text-secondary-light">
							<p class="flex-auto">
								Advanced AI processes supplier data to extract factual information, standardize
								formats, and generate consistent taste profiles across all sources.
							</p>
						</dd>
					</div>

					<div class="flex flex-col">
						<dt
							class="flex items-center gap-x-3 text-base font-semibold leading-7 text-text-primary-light"
						>
							<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-growth-green">
								<svg
									class="h-6 w-6 text-white"
									fill="none"
									viewBox="0 0 24 24"
									stroke-width="1.5"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
									/>
								</svg>
							</div>
							Daily Updates
						</dt>
						<dd class="mt-4 flex flex-auto flex-col text-base leading-7 text-text-secondary-light">
							<p class="flex-auto">
								Fresh data every day. Never miss new coffee arrivals or stock changes. Automated
								updates ensure your platform always has the latest information.
							</p>
						</dd>
					</div>

					<div class="flex flex-col">
						<dt
							class="flex items-center gap-x-3 text-base font-semibold leading-7 text-text-primary-light"
						>
							<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-growth-green">
								<svg
									class="h-6 w-6 text-white"
									fill="none"
									viewBox="0 0 24 24"
									stroke-width="1.5"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.814 48.814 0 0012 4.5c-2.288 0-4.56.163-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.589-1.202L18.75 4.97zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499.37 1.028.589 1.202.219.174.638.352 2.031.352 1.393 0 1.812-.178 2.031-.352.219-.174.467-.703.589-1.202L5.25 4.47z"
									/>
								</svg>
							</div>
							Neutral Platform
						</dt>
						<dd class="mt-4 flex flex-auto flex-col text-base leading-7 text-text-secondary-light">
							<p class="flex-auto">
								We don't sell green coffee ourselves. Our only focus is providing the best data
								service for software platforms and roasting businesses.
							</p>
						</dd>
					</div>
				</dl>
			</div>
		</div>
	</section>

	<!-- Target Audience Section -->
	<section class="bg-background-secondary-light py-24 sm:py-32">
		<div class="mx-auto max-w-7xl px-6 lg:px-8">
			<div class="mx-auto max-w-2xl lg:text-center">
				<h2 class="text-base font-semibold leading-7 text-background-tertiary-light">
					Who It's For
				</h2>
				<p class="mt-2 text-3xl font-bold tracking-tight text-text-primary-light sm:text-4xl">
					Built for coffee technology platforms
				</p>
				<p class="mt-6 text-lg leading-8 text-text-secondary-light">
					Integrate our API into your existing software to provide better green coffee data to your
					users.
				</p>
			</div>
			<div class="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
				<dl class="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-2">
					<div class="flex flex-col">
						<dt
							class="flex items-center gap-x-3 text-base font-semibold leading-7 text-text-primary-light"
						>
							<div
								class="flex h-10 w-10 items-center justify-center rounded-lg bg-background-tertiary-light"
							>
								<svg
									class="h-6 w-6 text-white"
									fill="none"
									viewBox="0 0 24 24"
									stroke-width="1.5"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25"
									/>
								</svg>
							</div>
							Roasting Software Platforms
						</dt>
						<dd class="mt-4 flex flex-auto flex-col text-base leading-7 text-text-secondary-light">
							<p class="flex-auto">
								Cropster, Artisan, Allio, Ikawa, and other roasting software platforms looking to
								enhance their green coffee sourcing features.
							</p>
						</dd>
					</div>

					<div class="flex flex-col">
						<dt
							class="flex items-center gap-x-3 text-base font-semibold leading-7 text-text-primary-light"
						>
							<div
								class="flex h-10 w-10 items-center justify-center rounded-lg bg-background-tertiary-light"
							>
								<svg
									class="h-6 w-6 text-white"
									fill="none"
									viewBox="0 0 24 24"
									stroke-width="1.5"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3"
									/>
								</svg>
							</div>
							Green Coffee Buying Apps
						</dt>
						<dd class="mt-4 flex flex-auto flex-col text-base leading-7 text-text-secondary-light">
							<p class="flex-auto">
								Mobile and web applications focused on green coffee sourcing, comparison, and
								purchasing for home and commercial roasters.
							</p>
						</dd>
					</div>

					<div class="flex flex-col">
						<dt
							class="flex items-center gap-x-3 text-base font-semibold leading-7 text-text-primary-light"
						>
							<div
								class="flex h-10 w-10 items-center justify-center rounded-lg bg-background-tertiary-light"
							>
								<svg
									class="h-6 w-6 text-white"
									fill="none"
									viewBox="0 0 24 24"
									stroke-width="1.5"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z"
									/>
								</svg>
							</div>
							Coffee Equipment OEMs
						</dt>
						<dd class="mt-4 flex flex-auto flex-col text-base leading-7 text-text-secondary-light">
							<p class="flex-auto">
								Roaster manufacturers and equipment companies wanting to integrate green coffee
								sourcing into their hardware ecosystems.
							</p>
						</dd>
					</div>

					<div class="flex flex-col">
						<dt
							class="flex items-center gap-x-3 text-base font-semibold leading-7 text-text-primary-light"
						>
							<div
								class="flex h-10 w-10 items-center justify-center rounded-lg bg-background-tertiary-light"
							>
								<svg
									class="h-6 w-6 text-white"
									fill="none"
									viewBox="0 0 24 24"
									stroke-width="1.5"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M3.75 21h16.5M4.5 3h15l-.75 18H5.25L4.5 3zM15 9l-6 6m0-6l6 6"
									/>
								</svg>
							</div>
							Enterprise Roastery ERPs
						</dt>
						<dd class="mt-4 flex flex-auto flex-col text-base leading-7 text-text-secondary-light">
							<p class="flex-auto">
								Internal enterprise resource planning systems for larger roasteries needing
								integrated green coffee sourcing and inventory management.
							</p>
						</dd>
					</div>
				</dl>
			</div>
		</div>
	</section>

	<!-- CTA Section -->
	<section class="bg-background-primary-light py-24 sm:py-32">
		<div class="mx-auto max-w-7xl px-6 lg:px-8">
			<div class="mx-auto max-w-2xl text-center">
				<h2 class="text-3xl font-bold tracking-tight text-text-primary-light sm:text-4xl">
					Ready to integrate or want a demo?
				</h2>
				<p class="mx-auto mt-6 max-w-xl text-lg leading-8 text-text-secondary-light">
					Start building with our Green Coffee API today. Custom plans and data trials available for
					enterprise customers.
				</p>
				<div class="mt-10 flex items-center justify-center gap-x-6">
					<button
						onclick={handleContactUs}
						class="rounded-md bg-background-tertiary-light px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-background-tertiary-light"
					>
						Contact us
					</button>
					<button
						onclick={handleGetStarted}
						class="text-sm font-semibold leading-6 text-text-primary-light transition-colors duration-200 hover:text-background-tertiary-light"
					>
						View documentation <span aria-hidden="true">→</span>
					</button>
				</div>
			</div>
		</div>
	</section>

	<!-- Footer -->
	<footer class="bg-background-secondary-light">
		<div class="mx-auto max-w-7xl px-6 py-12 lg:px-8">
			<div class="text-center">
				<p class="text-sm text-text-secondary-light">
					Powered by Purveyors.io — The Data Backbone of Specialty Coffee
				</p>
				<div class="mt-4 flex items-center justify-center space-x-6">
					<a
						href="mailto:contact@purveyors.io"
						class="text-sm text-background-tertiary-light transition-colors duration-200 hover:text-text-primary-light"
					>
						contact@purveyors.io
					</a>
					<a
						href="https://purveyors.io"
						class="text-sm text-background-tertiary-light transition-colors duration-200 hover:text-text-primary-light"
					>
						purveyors.io
					</a>
				</div>
			</div>
		</div>
	</footer>
</div>
