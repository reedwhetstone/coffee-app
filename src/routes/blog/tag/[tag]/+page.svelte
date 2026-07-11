<script lang="ts">
	import type { PageData } from './$types';

	let { data } = $props<{ data: PageData }>();

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

<a
	href="/blog"
	class="mb-8 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-accent"
>
	← All posts
</a>

<div class="mb-10 border-l-4 border-accent pl-6">
	<h1 class="mb-2 font-serif text-3xl font-medium tracking-tight text-ink">
		Posts tagged <span class="text-accent">"{data.tag}"</span>
	</h1>
	<p class="text-muted">
		{data.posts.length} post{data.posts.length !== 1 ? 's' : ''} on this topic
	</p>
</div>

{#if data.posts.length === 0}
	<p class="text-muted">No posts with this tag yet.</p>
{:else}
	<div class="space-y-8">
		{#each data.posts as post}
			<article
				class="group rounded-lg border border-line bg-surface-canvas p-6 shadow-sm transition-all hover:border-accent/40 hover:shadow-md"
			>
				<div class="mb-3 flex items-center gap-3 text-sm text-muted">
					<time datetime={post.date}>{formatDate(post.date)}</time>
					<span class="text-line">·</span>
					<span>{post.readingTime} min read</span>
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
					</h2>
					<p class="leading-relaxed text-muted">{post.description}</p>
				</a>
			</article>
		{/each}
	</div>
{/if}
