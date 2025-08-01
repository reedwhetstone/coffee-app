<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	// Determine current page for navigation styling
	let currentPath = $derived(page.url.pathname);
	let isHomePage = $derived(currentPath === '/');
	let isApiPage = $derived(currentPath === '/api');

	function handleSignIn() {
		goto('/auth');
	}

	function handleGetStarted() {
		goto('/auth');
	}

	function navigateToHome() {
		goto('/');
	}

	function navigateToApi() {
		goto('/api');
	}
</script>

<header
	class="bg-background-primary-light/95 border-border-light sticky top-0 z-50 border-b backdrop-blur-sm"
>
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<div class="flex items-center justify-between py-4">
			<!-- Logo/Brand -->
			<div class="flex items-center space-x-4">
				<button
					onclick={navigateToHome}
					class="flex items-center transition-opacity duration-200 hover:opacity-80"
				>
					<img src="/purveyors_logo_mark.svg" alt="purveyors.io" class="h-9 w-auto" />
				</button>
			</div>

			<!-- Navigation Links -->
			<nav class="hidden items-center space-x-8 md:flex">
				<button
					onclick={navigateToHome}
					class="text-sm font-medium transition-colors duration-200 {isHomePage
						? 'text-background-tertiary-light'
						: 'text-text-secondary-light hover:text-text-primary-light'}"
				>
					Maillard Studio
				</button>
				<button
					onclick={navigateToApi}
					class="text-sm font-medium transition-colors duration-200 {isApiPage
						? 'text-background-tertiary-light'
						: 'text-text-secondary-light hover:text-text-primary-light'}"
				>
					Parchment API
				</button>
			</nav>

			<!-- Authentication Buttons -->
			<div class="flex items-center space-x-3">
				<button
					onclick={handleSignIn}
					class="border-background-tertiary-light text-background-tertiary-light hover:bg-background-tertiary-light hidden items-center rounded-md border px-4 py-2 text-sm font-medium transition-all duration-200 hover:text-white sm:inline-flex"
				>
					Sign In
				</button>
				<button
					onclick={handleGetStarted}
					class="bg-background-tertiary-light focus-visible:outline-background-tertiary-light inline-flex items-center rounded-md px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
				>
					Get Started
				</button>

				<!-- Mobile menu button -->
				<div class="md:hidden">
					<button
						type="button"
						class="text-text-secondary-light hover:bg-background-secondary-light hover:text-text-primary-light focus:ring-background-tertiary-light inline-flex items-center justify-center rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-inset"
						onclick={() => {
							const menu = document.getElementById('mobile-menu');
							if (menu) {
								menu.classList.toggle('hidden');
							}
						}}
					>
						<span class="sr-only">Open main menu</span>
						<svg
							class="h-6 w-6"
							fill="none"
							viewBox="0 0 24 24"
							stroke-width="1.5"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
							/>
						</svg>
					</button>
				</div>
			</div>
		</div>

		<!-- Mobile menu -->
		<div class="hidden md:hidden" id="mobile-menu">
			<div class="space-y-1 pb-3 pt-2">
				<button
					onclick={navigateToHome}
					class="block w-full rounded-md px-3 py-2 text-left text-sm font-medium transition-colors duration-200 {isHomePage
						? 'bg-background-tertiary-light/10 text-background-tertiary-light'
						: 'text-text-secondary-light hover:bg-background-secondary-light hover:text-text-primary-light'}"
				>
					Maillard Studio
				</button>
				<button
					onclick={navigateToApi}
					class="block w-full rounded-md px-3 py-2 text-left text-sm font-medium transition-colors duration-200 {isApiPage
						? 'bg-background-tertiary-light/10 text-background-tertiary-light'
						: 'text-text-secondary-light hover:bg-background-secondary-light hover:text-text-primary-light'}"
				>
					Parchment API
				</button>
			</div>
		</div>
	</div>
</header>
