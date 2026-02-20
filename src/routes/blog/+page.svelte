<script lang="ts">
	import { PILLARS } from '$lib/types/blog.types';
	import type { BlogPost } from '$lib/types/blog.types';

	let { data } = $props<{ data: { posts: BlogPost[]; tags: string[] } }>();

	let selectedTag = $state<string | null>(null);

	let filteredPosts = $derived(
		selectedTag ? data.posts.filter((p) => p.tags.includes(selectedTag!)) : data.posts
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

<!-- Header -->
<div class="mb-12">
	<h1 class="mb-3 text-4xl font-bold text-text-primary-light">Blog</h1>
	<p class="text-lg text-text-secondary-light">
		Coffee intelligence, AI-first development, and the systems behind purveyors.io
	</p>
</div>

<!-- Tag filter -->
{#if data.tags.length > 0}
	<div class="mb-8 flex flex-wrap gap-2">
		<button
			class="rounded-full px-3 py-1 text-sm transition-colors {selectedTag === null
				? 'bg-text-primary-light text-background-primary-light'
				: 'bg-background-secondary-light text-text-secondary-light hover:text-text-primary-light'}"
			onclick={() => (selectedTag = null)}
		>
			All
		</button>
		{#each data.tags as tag}
			<button
				class="rounded-full px-3 py-1 text-sm transition-colors {selectedTag === tag
					? 'bg-text-primary-light text-background-primary-light'
					: 'bg-background-secondary-light text-text-secondary-light hover:text-text-primary-light'}"
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
	<div class="space-y-10">
		{#each filteredPosts as post}
			<article class="border-b border-border-light pb-10 last:border-0">
				<div class="mb-2 flex items-center gap-3 text-sm text-text-secondary-light">
					<time datetime={post.date}>{formatDate(post.date)}</time>
					<span>·</span>
					<span>{post.readingTime} min read</span>
					{#if post.pillar && PILLARS[post.pillar as keyof typeof PILLARS]}
						<span>·</span>
						<span class="text-link-light"
							>{PILLARS[post.pillar as keyof typeof PILLARS].label}</span
						>
					{/if}
				</div>

				<a href="/blog/{post.slug}" class="group block">
					<h2
						class="mb-2 text-2xl font-semibold text-text-primary-light group-hover:text-link-light transition-colors"
					>
						{post.title}
						{#if post.draft}
							<span
								class="ml-2 inline-block rounded bg-background-tertiary-light/20 px-2 py-0.5 text-xs font-normal text-text-secondary-light"
								>Draft</span
							>
						{/if}
					</h2>
					<p class="text-text-secondary-light">{post.description}</p>
				</a>

				{#if post.tags.length > 0}
					<div class="mt-3 flex flex-wrap gap-1.5">
						{#each post.tags as tag}
							<span class="rounded-full bg-background-secondary-light px-2.5 py-0.5 text-xs text-text-secondary-light">
								{tag}
							</span>
						{/each}
					</div>
				{/if}
			</article>
		{/each}
	</div>
{/if}
