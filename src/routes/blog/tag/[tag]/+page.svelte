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
	class="mb-8 inline-flex items-center gap-1 text-sm text-text-secondary-light transition-colors hover:text-background-tertiary-light"
>
	← All posts
</a>

<div class="mb-10 border-l-4 border-background-tertiary-light pl-6">
	<h1 class="mb-2 text-3xl font-bold text-text-primary-light">
		Posts tagged <span class="text-background-tertiary-light">"{data.tag}"</span>
	</h1>
	<p class="text-text-secondary-light">
		{data.posts.length} post{data.posts.length !== 1 ? 's' : ''}
	</p>
</div>

{#if data.posts.length === 0}
	<p class="text-text-secondary-light">No posts with this tag yet.</p>
{:else}
	<div class="space-y-8">
		{#each data.posts as post}
			<article
				class="group rounded-lg border border-border-light bg-background-primary-light p-6 shadow-sm transition-all hover:border-background-tertiary-light/40 hover:shadow-md"
			>
				<div class="mb-3 flex items-center gap-3 text-sm text-text-secondary-light">
					<time datetime={post.date}>{formatDate(post.date)}</time>
					<span class="text-border-light">·</span>
					<span>{post.readingTime} min read</span>
				</div>
				<a href="/blog/{post.slug}" class="block">
					<h2
						class="mb-2 text-2xl font-semibold text-text-primary-light transition-colors group-hover:text-background-tertiary-light"
					>
						{post.title}
					</h2>
					<p class="leading-relaxed text-text-secondary-light">{post.description}</p>
				</a>
			</article>
		{/each}
	</div>
{/if}
