<!-- src/routes/privacy/+page.svelte -->
<script lang="ts">
	import { goto } from '$app/navigation';
</script>

<svelte:head>
	<title>Privacy Policy - Purveyors</title>
	<meta name="description" content="Privacy policy for Purveyors coffee platform." />
</svelte:head>

<div class="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
	<div class="rounded-lg border border-border-light bg-background-primary-light p-6 shadow-md md:p-8">
		<!-- Header -->
		<div class="mb-8">
			<button
				onclick={() => goto('/')}
				class="mb-4 inline-flex items-center text-background-tertiary-light transition-colors duration-200 hover:text-text-primary-light focus:outline-none focus:ring-2 focus:ring-background-tertiary-light focus:ring-offset-2"
			>
				<svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
				</svg>
				Back to Home
			</button>
			<h1 class="text-3xl font-bold text-text-primary-light">Privacy Policy</h1>
			<p class="mt-2 text-text-secondary-light">Last updated: {new Date().toLocaleDateString()}</p>
		</div>

		<!-- Content -->
		<div class="prose prose-lg max-w-none">
			<div class="space-y-6 text-text-primary-light">
				<section>
					<h2 class="text-xl font-semibold text-text-primary-light">Cookies and Tracking</h2>
					<p class="text-text-secondary-light">
						We use cookies and similar tracking technologies to improve your browsing experience, 
						analyze site traffic, and understand where our visitors are coming from. Cookies are 
						small data files stored on your device when you visit our website.
					</p>
				</section>

				<section>
					<h2 class="text-xl font-semibold text-text-primary-light">Types of Cookies We Use</h2>
					<ul class="list-disc space-y-2 pl-6 text-text-secondary-light">
						<li><strong>Essential Cookies:</strong> Required for the website to function properly</li>
						<li><strong>Analytical Cookies:</strong> Help us understand how visitors interact with our website</li>
						<li><strong>Functional Cookies:</strong> Remember your preferences and settings</li>
						<li><strong>Performance Cookies:</strong> Collect information about website performance</li>
					</ul>
				</section>

				<section>
					<h2 class="text-xl font-semibold text-text-primary-light">Information We Collect</h2>
					<p class="text-text-secondary-light">
						When you use our platform, we may collect information such as your email address, 
						usage patterns, and preferences to provide you with a personalized experience and 
						improve our services.
					</p>
				</section>

				<section>
					<h2 class="text-xl font-semibold text-text-primary-light">Your Choices</h2>
					<p class="text-text-secondary-light">
						You can control cookies through your browser settings. However, disabling certain 
						cookies may affect the functionality of our website. You can update your cookie 
						preferences at any time through your browser settings.
					</p>
				</section>

				<section>
					<h2 class="text-xl font-semibold text-text-primary-light">Contact Us</h2>
					<p class="text-text-secondary-light">
						If you have any questions about this Privacy Policy or our use of cookies, 
						please contact us through our contact page.
					</p>
				</section>
			</div>
		</div>
	</div>
</div>