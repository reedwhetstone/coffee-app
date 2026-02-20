<script lang="ts">
	import { PILLARS } from '$lib/types/blog.types';
	import type { BlogPost } from '$lib/types/blog.types';

	let { data } = $props<{ data: { posts: BlogPost[]; tags: string[] } }>();

	let selectedTag = $state<string | null>(null);

	let filteredPosts = $derived(
		selectedTag
			? data.posts.filter((p: BlogPost) => p.tags.includes(selectedTag!))
			: data.posts
	);

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}
</script>

<svelte:head>
	<title>Blog | Purveyors</title>
	<meta
		name="description"
		content="Insights on coffee intelligence, AI-first product development, and supply chain technology."
	/>
</svelte:head>

<!-- Header with accent border -->
<div class="mb-10 border-l-4 border-background-tertiary-light pl-6">
	<h1 class="mb-2 text-4xl font-bold text-text-primary-light">Blog</h1>
	<p class="text-lg text-text-secondary-light">
		Coffee intelligence, AI-first development, and the systems behind purveyors.io
	</p>
</div>

<!-- Tag filter -->
{#if data.tags.length > 0}
	<div class="mb-10 flex flex-wrap gap-2">
		<button
			class="rounded-full px-3 py-1 text-sm font-medium transition-colors {selectedTag === null
				? 'bg-background-tertiary-light text-white'
				: 'bg-background-tertiary-light/10 text-text-secondary-light hover:bg-background-tertiary-light/20 hover:text-text-primary-light'}"
			onclick={() => (selectedTag = null)}
		>
			All
		</button>
		{#each data.tags as tag}
			<button
				class="rounded-full px-3 py-1 text-sm font-medium transition-colors {selectedTag === tag
					? 'bg-background-tertiary-light text-white'
					: 'bg-background-tertiary-light/10 text-text-secondary-light hover:bg-background-tertiary-light/20 hover:text-text-primary-light'}"
				onclick={() => (selectedTag = selectedTag === tag ? null : tag)}
			>
				{tag}
			</button>
		{/each}
	</div>
{/if}

<!-- Posts -->
{#if filteredPosts.length === 0}
	<div class="py-16 text-center">
		<p class="text-text-secondary-light">No posts yet. Check back soon.</p>
	</div>
{:else}
	<div class="space-y-8">
		{#each filteredPosts as post}
			<article
				class="group rounded-lg border border-border-light bg-background-primary-light p-6 shadow-sm transition-all hover:border-background-tertiary-light/40 hover:shadow-md"
			>
				<div class="mb-3 flex items-center gap-3 text-sm text-text-secondary-light">
					<time datetime={post.date}>{formatDate(post.date)}</time>
					<span class="text-border-light">·</span>
					<span>{post.readingTime} min read</span>
					{#if post.pillar && PILLARS[post.pillar as keyof typeof PILLARS]}
						<span class="text-border-light">·</span>
						<span
							class="rounded-full bg-background-tertiary-light/10 px-2 py-0.5 text-xs font-medium text-background-tertiary-light"
						>
							{PILLARS[post.pillar as keyof typeof PILLARS].label}
						</span>
					{/if}
				</div>

				<a href="/blog/{post.slug}" class="block">
					<h2
						class="mb-2 text-2xl font-semibold text-text-primary-light transition-colors group-hover:text-background-tertiary-light"
					>
						{post.title}
						{#if post.draft}
							<span
								class="ml-2 inline-block rounded bg-background-tertiary-light/15 px-2 py-0.5 text-xs font-normal text-background-tertiary-light"
							>
								Draft
							</span>
						{/if}
					</h2>
					<p class="leading-relaxed text-text-secondary-light">{post.description}</p>
				</a>

				{#if post.tags.length > 0}
					<div class="mt-4 flex flex-wrap gap-1.5">
						{#each post.tags as tag}
							<span
								class="rounded-full border border-border-light px-2.5 py-0.5 text-xs text-text-secondary-light"
							>
								{tag}
							</span>
						{/each}
					</div>
				{/if}
			</article>
		{/each}
	</div>
{/if}
