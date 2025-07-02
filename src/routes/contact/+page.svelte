<script lang="ts">
	import type { PageData } from './$types';

	let { data } = $props<{ data: PageData }>();
</script>

<svelte:head>
	<title>Meet the Founder - Purveyors</title>
	<meta
		name="description"
		content="Get in touch with the Purveyors team. We're here to help with questions about our coffee roasting platform."
	/>
</svelte:head>

<div class="min-h-screen bg-background-primary-light">
	<div class="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
		<!-- Header -->
		<div class="text-center">
			<h1 class="text-3xl font-bold tracking-tight text-text-primary-light sm:text-4xl">
				Contact Us
			</h1>
			<p class="mt-4 text-lg text-text-secondary-light">
				We'd love to hear from you. Send us a message and we'll respond as soon as possible.
			</p>
		</div>

		<div class="mt-12 grid grid-cols-1 gap-y-12 lg:grid-cols-2 lg:gap-x-16">
			<!-- Contact Information -->
			<div>
				<h2 class="text-2xl font-bold text-text-primary-light">Get in Touch</h2>
				<p class="mt-4 text-text-secondary-light">
					Have questions about our coffee roasting platform? Want to learn more about our features?
					I'd love to hear from you.
				</p>

				<div class="mt-8 space-y-6">
					<!-- Email -->
					<div class="flex items-start">
						<div class="flex-shrink-0">
							<svg
								class="h-6 w-6 text-background-tertiary-light"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
								/>
							</svg>
						</div>
						<div class="ml-3">
							<p class="text-sm font-medium text-text-primary-light">Email</p>
							<p class="mt-1 text-sm text-text-secondary-light">
								<a
									href="mailto:hello@purveyors.io"
									class="text-background-tertiary-light transition-colors hover:text-background-tertiary-light/80"
								>
									hello@purveyors.io
								</a>
							</p>
						</div>
					</div>

					<!-- Response Time -->
					<div class="flex items-start">
						<div class="flex-shrink-0">
							<svg
								class="h-6 w-6 text-background-tertiary-light"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
								/>
							</svg>
						</div>
						<div class="ml-3">
							<p class="text-sm font-medium text-text-primary-light">Response Time</p>
							<p class="mt-1 text-sm text-text-secondary-light">
								I typically respond within 24 hours
							</p>
						</div>
					</div>

					<!-- Support -->
					<div class="flex items-start">
						<div class="flex-shrink-0">
							<svg
								class="h-6 w-6 text-background-tertiary-light"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
								/>
							</svg>
						</div>
						<div class="ml-3">
							<p class="text-sm font-medium text-text-primary-light">Best Times to Reach Me</p>
							<p class="mt-1 text-sm text-text-secondary-light">Monday - Friday, 9AM - 5PM PST</p>
						</div>
					</div>
				</div>
			</div>

			<!-- Founder Section -->
			<div>
				<div class="space-y-6">
					<!-- Founder Image -->
					<div class="flex justify-center">
						<div class="relative">
							<img
								src="/founder.JPG"
								alt="Reed Whetstone, Founder of Purveyors"
								class="h-64 w-64 rounded-2xl object-cover shadow-lg ring-4 ring-background-tertiary-light/20"
							/>
							<div
								class="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-background-tertiary-light"
							>
								<svg class="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 20 20">
									<path
										d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
									/>
								</svg>
							</div>
						</div>
					</div>

					<!-- Founder Bio -->
					<div class="text-center">
						<h3 class="text-xl font-bold text-text-primary-light">Reed Whetstone</h3>
						<p class="text-sm font-medium text-background-tertiary-light">
							Founder & Coffee Enthusiast
						</p>
					</div>

					<div class="space-y-4 text-text-secondary-light">
						<p>
							Hi, I’m Reed — a coffee lover, home roaster, and the creator of Purveyors. With a
							background in engineering, product, and analytics, I built this platform to make
							sourcing incredible green coffee easier, smarter, and more fun. Purveyors combines my
							passion for great coffee with years of experience building systems, tools, and data
							products that help people make better decisions.
						</p>
					</div>
					<!-- 
					<!-- Skills/Expertise 
					<div class="space-y-3">
						<h4 class="text-lg font-semibold text-text-primary-light">Expertise</h4>
						<div class="flex flex-wrap gap-2">
							<span
								class="inline-flex items-center rounded-full bg-background-tertiary-light/10 px-3 py-1 text-xs font-medium text-background-tertiary-light"
							>
								Coffee & Roasting
							</span>
							<span
								class="inline-flex items-center rounded-full bg-background-tertiary-light/10 px-3 py-1 text-xs font-medium text-background-tertiary-light"
							>
								Green Coffee Sourcing
							</span>
							<span
								class="inline-flex items-center rounded-full bg-background-tertiary-light/10 px-3 py-1 text-xs font-medium text-background-tertiary-light"
							>
								Product Strategy
							</span>
							<span
								class="inline-flex items-center rounded-full bg-background-tertiary-light/10 px-3 py-1 text-xs font-medium text-background-tertiary-light"
							>
								Data & Analytics
							</span>
							<span
								class="inline-flex items-center rounded-full bg-background-tertiary-light/10 px-3 py-1 text-xs font-medium text-background-tertiary-light"
							>
								Software & Systems Design
							</span>
							<span
								class="inline-flex items-center rounded-full bg-background-tertiary-light/10 px-3 py-1 text-xs font-medium text-background-tertiary-light"
							>
								UX for Tools & Platforms
							</span>
							<span
								class="inline-flex items-center rounded-full bg-background-tertiary-light/10 px-3 py-1 text-xs font-medium text-background-tertiary-light"
							>
								Operations & Process Optimization
							</span><span
								class="inline-flex items-center rounded-full bg-background-tertiary-light/10 px-3 py-1 text-xs font-medium text-background-tertiary-light"
							>
								Coffee Tech & Tooling
							</span><span
								class="inline-flex items-center rounded-full bg-background-tertiary-light/10 px-3 py-1 text-xs font-medium text-background-tertiary-light"
							>
								AI-Enhanced Workflows
							</span>
						</div> 
					</div>-->
				</div>
			</div>
		</div>
	</div>
</div>
