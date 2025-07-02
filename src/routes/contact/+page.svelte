<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { enhance } from '$app/forms';
	import { onMount } from 'svelte';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

	// Form state
	let formData = $state({
		name: '',
		email: '',
		subject: '',
		message: ''
	});

	let isSubmitting = $state(false);
	let submitted = $state(false);
	let errorMessage = $state('');

	// Form validation
	function validateForm() {
		if (!formData.name.trim()) return 'Name is required';
		if (!formData.email.trim()) return 'Email is required';
		if (!formData.email.includes('@')) return 'Please enter a valid email address';
		if (!formData.subject.trim()) return 'Subject is required';
		if (!formData.message.trim()) return 'Message is required';
		if (formData.message.length < 10) return 'Message must be at least 10 characters long';
		return '';
	}

	// Handle form response
	$effect(() => {
		if (form?.success) {
			submitted = true;
			formData = { name: '', email: '', subject: '', message: '' };
			errorMessage = '';
		} else if (form?.error) {
			errorMessage = form.error;
		}
	});
</script>

<svelte:head>
	<title>Contact Us - Purveyors</title>
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
					We're here to help.
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
									class="text-background-tertiary-light hover:text-background-tertiary-light/80"
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
								We typically respond within 24 hours
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
									d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M12 2.25a9.75 9.75 0 110 19.5 9.75 9.75 0 010-19.5zm0 0v19.5"
								/>
							</svg>
						</div>
						<div class="ml-3">
							<p class="text-sm font-medium text-text-primary-light">Support Hours</p>
							<p class="mt-1 text-sm text-text-secondary-light">Monday - Friday, 9AM - 5PM PST</p>
						</div>
					</div>
				</div>
			</div>

			<!-- Contact Form -->
			<div>
				{#if submitted}
					<div class="rounded-lg bg-green-50 p-6">
						<div class="flex">
							<div class="flex-shrink-0">
								<svg class="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
									<path
										fill-rule="evenodd"
										d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
										clip-rule="evenodd"
									/>
								</svg>
							</div>
							<div class="ml-3">
								<h3 class="text-sm font-medium text-green-800">Message Sent!</h3>
								<p class="mt-1 text-sm text-green-700">
									Thank you for your message. We'll get back to you soon.
								</p>
							</div>
						</div>
					</div>
				{:else}
					<form
						method="POST"
						use:enhance={({ cancel }) => {
							const validationError = validateForm();
							if (validationError) {
								errorMessage = validationError;
								cancel();
								return;
							}
							isSubmitting = true;
							errorMessage = '';

							return async ({ result }) => {
								isSubmitting = false;
							};
						}}
						class="space-y-6"
					>
						<!-- Name Field -->
						<div>
							<label for="name" class="block text-sm font-medium text-text-primary-light">
								Name *
							</label>
							<input
								id="name"
								name="name"
								type="text"
								bind:value={formData.name}
								required
								class="mt-1 block w-full rounded-md border border-border-light bg-background-secondary-light px-3 py-2 text-text-primary-light shadow-sm focus:border-background-tertiary-light focus:outline-none focus:ring-1 focus:ring-background-tertiary-light"
								placeholder="Your full name"
							/>
						</div>

						<!-- Email Field -->
						<div>
							<label for="email" class="block text-sm font-medium text-text-primary-light">
								Email *
							</label>
							<input
								id="email"
								name="email"
								type="email"
								bind:value={formData.email}
								required
								class="mt-1 block w-full rounded-md border border-border-light bg-background-secondary-light px-3 py-2 text-text-primary-light shadow-sm focus:outline-none focus:ring-1 focus:ring-background-tertiary-light"
								placeholder="your.email@example.com"
							/>
						</div>

						<!-- Subject Field -->
						<div>
							<label for="subject" class="block text-sm font-medium text-text-primary-light">
								Subject *
							</label>
							<input
								id="subject"
								name="subject"
								type="text"
								bind:value={formData.subject}
								required
								class="mt-1 block w-full rounded-md border border-border-light bg-background-secondary-light px-3 py-2 text-text-primary-light shadow-sm focus:border-background-tertiary-light focus:outline-none focus:ring-1 focus:ring-background-tertiary-light"
								placeholder="What's your message about?"
							/>
						</div>

						<!-- Message Field -->
						<div>
							<label for="message" class="block text-sm font-medium text-text-primary-light">
								Message *
							</label>
							<textarea
								id="message"
								name="message"
								bind:value={formData.message}
								required
								rows="6"
								class="mt-1 block w-full rounded-md border border-border-light bg-background-secondary-light px-3 py-2 text-text-primary-light shadow-sm focus:border-background-tertiary-light focus:outline-none focus:ring-1 focus:ring-background-tertiary-light"
								placeholder="Tell us more about your question or feedback..."
							></textarea>
						</div>

						<!-- Error Message -->
						{#if errorMessage}
							<div class="rounded-md bg-red-50 p-4">
								<div class="flex">
									<div class="flex-shrink-0">
										<svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
											<path
												fill-rule="evenodd"
												d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
												clip-rule="evenodd"
											/>
										</svg>
									</div>
									<div class="ml-3">
										<p class="text-sm text-red-800">{errorMessage}</p>
									</div>
								</div>
							</div>
						{/if}

						<!-- Submit Button -->
						<div>
							<button
								type="submit"
								disabled={isSubmitting}
								class="w-full rounded-md bg-background-tertiary-light px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-background-tertiary-light/90 focus:outline-none focus:ring-2 focus:ring-background-tertiary-light focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
							>
								{#if isSubmitting}
									<div class="flex items-center justify-center">
										<div
											class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
										></div>
										Sending...
									</div>
								{:else}
									Send Message
								{/if}
							</button>
						</div>

						<p class="text-xs text-text-secondary-light">* Required fields</p>
					</form>
				{/if}
			</div>
		</div>
	</div>
</div>
