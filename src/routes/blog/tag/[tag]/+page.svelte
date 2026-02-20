<script lang="ts">
	import type { BlogPost } from '$lib/types/blog.types';

	let { data } = $props<{ data: { posts: BlogPost[]; tag: string } }>();

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}
</script>

<svelte:head>
	<title>Posts tagged "{data.tag}" | Purveyors Blog</title>
</svelte:head>

<a
	href="/blog"
	class="mb-8 inline-flex items-center gap-1 text-sm text-text-secondary-light hover:text-text-primary-light transition-colors"
>
	← All posts
</a>

<div class="mb-12">
	<h1 class="mb-3 text-3xl font-bold text-text-primary-light">
		Posts tagged <span class="text-link-light">"{data.tag}"</span>
	</h1>
	<p class="text-text-secondary-light">{data.posts.length} post{data.posts.length !== 1 ? 's' : ''}</p>
</div>

{#if data.posts.length === 0}
	<p class="text-text-secondary-light">No posts with this tag yet.</p>
{:else}
	<div class="space-y-10">
		{#each data.posts as post}
			<article class="border-b border-border-light pb-10 last:border-0">
				<div class="mb-2 flex items-center gap-3 text-sm text-text-secondary-light">
					<time datetime={post.date}>{formatDate(post.date)}</time>
					<span>·</span>
					<span>{post.readingTime} min read</span>
				</div>
				<a href="/blog/{post.slug}" class="group block">
					<h2 class="mb-2 text-2xl font-semibold text-text-primary-light group-hover:text-link-light transition-colors">
						{post.title}
					</h2>
					<p class="text-text-secondary-light">{post.description}</p>
				</a>
			</article>
		{/each}
	</div>
{/if}
