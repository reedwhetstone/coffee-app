<script lang="ts">
	import { PILLARS } from '$lib/types/blog.types';
	import type { BlogPost } from '$lib/types/blog.types';

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
	class="mb-8 inline-flex items-center gap-1 text-sm text-text-secondary-light hover:text-text-primary-light transition-colors"
>
	← All posts
</a>

<article>
	<!-- Post header -->
	<header class="mb-10">
		<div class="mb-3 flex items-center gap-3 text-sm text-text-secondary-light">
			<time datetime={data.metadata.date}>{formatDate(data.metadata.date)}</time>
			<span>·</span>
			<span>{data.metadata.readingTime ?? 5} min read</span>
			{#if pillarInfo}
				<span>·</span>
				<span class="text-link-light">{pillarInfo.label}</span>
			{/if}
		</div>

		<h1 class="mb-4 text-4xl font-bold leading-tight text-text-primary-light">
			{data.metadata.title}
		</h1>

		<p class="text-lg text-text-secondary-light">{data.metadata.description}</p>

		{#if data.metadata.tags.length > 0}
			<div class="mt-4 flex flex-wrap gap-1.5">
				{#each data.metadata.tags as tag}
					<a
						href="/blog/tag/{tag}"
						class="rounded-full bg-background-secondary-light px-2.5 py-0.5 text-xs text-text-secondary-light hover:text-text-primary-light transition-colors"
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
		prose-p:text-text-secondary-light prose-p:leading-relaxed
		prose-a:text-link-light prose-a:no-underline hover:prose-a:underline
		prose-strong:text-text-primary-light
		prose-code:text-text-primary-light prose-code:bg-background-secondary-light prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:before:content-none prose-code:after:content-none
		prose-pre:bg-background-primary-dark prose-pre:text-text-primary-dark
		prose-blockquote:border-link-light prose-blockquote:text-text-secondary-light
		prose-li:text-text-secondary-light
		prose-img:rounded-lg"
	>
		<data.content />
	</div>
</article>

<!-- Giscus comments -->
<div class="mt-16 border-t border-border-light pt-10">
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
			Enable JavaScript to view <a href="https://giscus.app" class="text-link-light">comments</a>.
		</p>
	</noscript>
</div>
