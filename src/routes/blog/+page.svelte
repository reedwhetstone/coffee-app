<script lang="ts">
	import type { PageData } from './$types';
	import { PILLARS } from '$lib/types/blog.types';
	import type { BlogPost } from '$lib/types/blog.types';

	let { data } = $props<{ data: PageData }>();

	let selectedTag = $state<string | null>(null);

	let filteredPosts = $derived(
		selectedTag ? data.posts.filter((p: BlogPost) => p.tags.includes(selectedTag!)) : data.posts
	);

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}

	function getHeroImage(slug: string): string {
		return `/blog/images/${slug}/hero.webp`;
	}
</script>

<!-- Header with accent border -->
<div class="mb-10 border-l-4 border-accent pl-6">
	<h1 class="mb-2 font-serif text-4xl font-medium tracking-tight text-ink">Blog</h1>
	<p class="text-lg text-muted">
		Coffee intelligence, AI-first development, and the systems behind purveyors.io
	</p>
</div>

<!-- Tag filter -->
{#if data.tags.length > 0}
	<div class="mb-10 flex flex-wrap gap-2">
		<button
			class="rounded-full px-3 py-1 text-sm font-medium transition-colors {selectedTag === null
				? 'bg-accent text-ink'
				: 'bg-accent/10 text-muted hover:bg-accent/20 hover:text-ink'}"
			onclick={() => (selectedTag = null)}
		>
			All
		</button>
		{#each data.tags as tag}
			<button
				class="rounded-full px-3 py-1 text-sm font-medium transition-colors {selectedTag === tag
					? 'bg-accent text-ink'
					: 'bg-accent/10 text-muted hover:bg-accent/20 hover:text-ink'}"
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
		<p class="text-muted">No posts yet. Check back soon.</p>
	</div>
{:else}
	<div class="space-y-8">
		{#each filteredPosts as post}
			<article
				class="group rounded-lg border border-line bg-surface-canvas p-6 shadow-sm transition-all hover:border-accent/40 hover:shadow-md"
			>
				<div class="mb-3 flex items-center gap-3 text-sm text-muted">
					<time datetime={post.date}>{formatDate(post.date)}</time>
					<span class="text-line">·</span>
					<span>{post.readingTime} min read</span>
					{#if post.pillar && PILLARS[post.pillar as keyof typeof PILLARS]}
						<span class="text-line">·</span>
						<span class="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
							{PILLARS[post.pillar as keyof typeof PILLARS].label}
						</span>
					{/if}
				</div>

				<a href="/blog/{post.slug}" class="block">
					<img
						src={getHeroImage(post.slug)}
						alt={post.title}
						class="mb-4 aspect-[3/2] w-full rounded-md border border-line object-cover"
						onerror={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')}
					/>
					<h2
						class="mb-2 font-serif text-2xl font-medium tracking-tight text-ink transition-colors group-hover:text-accent"
					>
						{post.title}
						{#if post.draft}
							<span
								class="ml-2 inline-block rounded bg-accent/15 px-2 py-0.5 text-xs font-normal text-accent"
							>
								Draft
							</span>
						{/if}
					</h2>
					<p class="leading-relaxed text-muted">{post.description}</p>
				</a>

				{#if post.tags.length > 0}
					<div class="mt-4 flex flex-wrap gap-1.5">
						{#each post.tags as tag}
							<span class="rounded-full border border-line px-2.5 py-0.5 text-xs text-muted">
								{tag}
							</span>
						{/each}
					</div>
				{/if}
			</article>
		{/each}
	</div>
{/if}
