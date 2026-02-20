<script lang="ts">
	import { PILLARS } from '$lib/types/blog.types';
	import type { BlogPost } from '$lib/types/blog.types';
	import LinkedInDraft from '$lib/components/blog/LinkedInDraft.svelte';

	let {
		data
	} = $props<{
		data: {
			content: typeof import('svelte').SvelteComponent;
			metadata: BlogPost;
		};
	}>();

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}

	let pillarInfo = $derived(
		data.metadata.pillar && PILLARS[data.metadata.pillar as keyof typeof PILLARS]
			? PILLARS[data.metadata.pillar as keyof typeof PILLARS]
			: null
	);

	let showLinkedIn = $state(false);
</script>

<svelte:head>
	<title>{data.metadata.title} | Purveyors Blog</title>
	<meta name="description" content={data.metadata.description} />
	<meta property="og:title" content={data.metadata.title} />
	<meta property="og:description" content={data.metadata.description} />
	<meta property="og:type" content="article" />
	<meta property="article:published_time" content={data.metadata.date} />
	{#each data.metadata.tags as tag}
		<meta property="article:tag" content={tag} />
	{/each}
</svelte:head>

<!-- Back link -->
<a
	href="/blog"
	class="mb-8 inline-flex items-center gap-1 text-sm text-text-secondary-light transition-colors hover:text-background-tertiary-light"
>
	← All posts
</a>

<article>
	<!-- Post header with accent background -->
	<header class="mb-10 rounded-lg border border-border-light bg-gradient-to-r from-background-tertiary-light/5 to-transparent p-6 sm:p-8">
		<div class="mb-3 flex flex-wrap items-center gap-3 text-sm text-text-secondary-light">
			<time datetime={data.metadata.date}>{formatDate(data.metadata.date)}</time>
			<span class="text-border-light">·</span>
			<span>{data.metadata.readingTime ?? 5} min read</span>
			{#if pillarInfo}
				<span class="text-border-light">·</span>
				<span class="rounded-full bg-background-tertiary-light/10 px-2 py-0.5 text-xs font-medium text-background-tertiary-light">
					{pillarInfo.label}
				</span>
			{/if}
		</div>

		<h1 class="mb-4 text-4xl font-bold leading-tight text-text-primary-light">
			{data.metadata.title}
		</h1>

		<p class="text-lg leading-relaxed text-text-secondary-light">{data.metadata.description}</p>

		{#if data.metadata.tags.length > 0}
			<div class="mt-5 flex flex-wrap gap-1.5">
				{#each data.metadata.tags as tag}
					<a
						href="/blog/tag/{tag}"
						class="rounded-full border border-background-tertiary-light/20 bg-background-tertiary-light/8 px-2.5 py-0.5 text-xs text-text-secondary-light transition-colors hover:border-background-tertiary-light/40 hover:text-background-tertiary-light"
					>
						{tag}
					</a>
				{/each}
			</div>
		{/if}
	</header>

	<!-- Post content -->
	<div
		class="prose prose-lg max-w-none
		prose-headings:text-text-primary-light prose-headings:font-semibold
		prose-h2:mt-12 prose-h2:border-b prose-h2:border-border-light prose-h2:pb-3
		prose-p:text-text-secondary-light prose-p:leading-relaxed
		prose-a:text-background-tertiary-light prose-a:no-underline hover:prose-a:underline
		prose-strong:text-text-primary-light
		prose-code:text-text-primary-light prose-code:bg-background-tertiary-light/8 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:before:content-none prose-code:after:content-none
		prose-pre:bg-background-primary-dark prose-pre:text-text-primary-dark prose-pre:rounded-lg prose-pre:border prose-pre:border-border-light
		prose-blockquote:border-l-4 prose-blockquote:border-background-tertiary-light prose-blockquote:bg-background-tertiary-light/5 prose-blockquote:rounded-r-lg prose-blockquote:py-1 prose-blockquote:text-text-secondary-light
		prose-li:text-text-secondary-light
		prose-img:rounded-lg prose-img:shadow-sm
		prose-hr:border-border-light"
	>
		<data.content />
	</div>
</article>

<!-- Post footer -->
<div class="mt-16 space-y-8">
	<!-- Share / LinkedIn section -->
	<div class="border-t border-border-light pt-8">
		{#if showLinkedIn}
			<LinkedInDraft
				title={data.metadata.title}
				description={data.metadata.description}
				slug={data.metadata.slug}
				onclose={() => (showLinkedIn = false)}
			/>
		{:else}
			<div class="flex items-center gap-4">
				<button
					onclick={() => (showLinkedIn = true)}
					class="inline-flex items-center gap-2 rounded-md border border-border-light px-4 py-2 text-sm font-medium text-text-primary-light transition-all hover:border-background-tertiary-light hover:text-background-tertiary-light"
				>
					<svg class="h-4 w-4 text-[#0A66C2]" viewBox="0 0 24 24" fill="currentColor">
						<path
							d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"
						/>
					</svg>
					Share on LinkedIn
				</button>
			</div>
		{/if}
	</div>

	<!-- Giscus comments -->
	<div class="border-t border-border-light pt-8">
		<h3 class="mb-6 text-lg font-semibold text-text-primary-light">Discussion</h3>
		<div id="giscus-container">
			<script
				src="https://giscus.app/client.js"
				data-repo="reedwhetstone/coffee-app"
				data-repo-id=""
				data-category="Blog"
				data-category-id=""
				data-mapping="pathname"
				data-strict="0"
				data-reactions-enabled="1"
				data-emit-metadata="0"
				data-input-position="top"
				data-theme="light"
				data-lang="en"
				data-loading="lazy"
				crossorigin="anonymous"
				async
			></script>
		</div>
		<noscript>
			<p class="text-sm text-text-secondary-light">
				Enable JavaScript to view <a href="https://giscus.app" class="text-background-tertiary-light">comments</a>.
			</p>
		</noscript>
	</div>
</div>
