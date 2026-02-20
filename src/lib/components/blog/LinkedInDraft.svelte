<script lang="ts">
	let { title, description, slug, onclose } = $props<{
		title: string;
		description: string;
		slug: string;
		onclose?: () => void;
	}>();

	let postUrl = $derived(`https://purveyors.io/blog/${slug}`);

	let linkedInText = $derived(
		`${title}\n\n${description}\n\nRead the full post:\n${postUrl}\n\n#coffee #specialtycoffee #coffeeroasting #coffeeindustry #purveyors`
	);

	let copied = $state(false);

	function copyToClipboard() {
		navigator.clipboard.writeText(linkedInText).then(() => {
			copied = true;
			setTimeout(() => (copied = false), 2000);
		});
	}

	let linkedInShareUrl = $derived(
		`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(postUrl)}`
	);
</script>

<div class="rounded-lg border border-border-light bg-background-primary-light p-6 shadow-sm">
	<div class="mb-4 flex items-center justify-between">
		<div class="flex items-center gap-2">
			<svg class="h-5 w-5 text-[#0A66C2]" viewBox="0 0 24 24" fill="currentColor">
				<path
					d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"
				/>
			</svg>
			<h3 class="text-sm font-semibold text-text-primary-light">LinkedIn Draft</h3>
		</div>
		{#if onclose}
			<button
				onclick={onclose}
				aria-label="Close LinkedIn draft"
				class="text-text-secondary-light transition-colors hover:text-text-primary-light"
			>
				<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		{/if}
	</div>

	<div class="mb-4 rounded border border-border-light bg-background-secondary-light p-4">
		<p class="whitespace-pre-line text-sm text-text-primary-light">{linkedInText}</p>
	</div>

	<div class="flex items-center gap-3">
		<button
			onclick={copyToClipboard}
			class="inline-flex items-center gap-1.5 rounded-md border border-border-light px-3 py-1.5 text-sm font-medium text-text-primary-light transition-all hover:border-background-tertiary-light hover:text-background-tertiary-light"
		>
			{#if copied}
				<svg
					class="h-4 w-4 text-growth-green"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
				</svg>
				Copied
			{:else}
				<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
					/>
				</svg>
				Copy text
			{/if}
		</button>

		<a
			href={linkedInShareUrl}
			target="_blank"
			rel="noopener noreferrer"
			class="inline-flex items-center gap-1.5 rounded-md bg-[#0A66C2] px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
		>
			<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
				<path
					d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"
				/>
			</svg>
			Share on LinkedIn
		</a>
	</div>
</div>
