<script lang="ts">
	import type { PageData } from './$types';
	import MarketBriefHeroFallback from '$lib/components/blog/MarketBriefHeroFallback.svelte';
	import { formatMarketBriefEdition } from '$lib/types/blog.types';

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
				class="group rounded-lg border p-6 shadow-sm transition-all hover:border-accent/40 hover:shadow-md {post.format ===
				'market-brief'
					? 'border-ink bg-ink'
					: 'border-line bg-surface-canvas'}"
			>
				<div
					class="mb-3 flex flex-wrap items-center gap-3 text-sm {post.format === 'market-brief'
						? 'text-on-dark/65'
						: 'text-muted'}"
				>
					<time datetime={post.date}>{formatDate(post.date)}</time>
					<span class={post.format === 'market-brief' ? 'text-on-dark/20' : 'text-line'}>·</span>
					<span>{post.readingTime} min read</span>
					{#if post.format === 'market-brief'}
						<span class="text-on-dark/20">·</span>
						<span class="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">
							Market Brief · Edition {formatMarketBriefEdition(post.edition!)}
						</span>
					{/if}
				</div>
				<a href="/blog/{post.slug}" class="block">
					{#if post.format === 'market-brief'}
						<div
							class="relative mb-4 aspect-[3/2] overflow-hidden rounded-md border border-on-dark/15"
						>
							<MarketBriefHeroFallback title={post.title} edition={post.edition!} compact />
							<img
								src={getHeroImage(post.slug)}
								alt={post.title}
								class="absolute inset-0 h-full w-full object-cover"
								onerror={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')}
							/>
						</div>
					{:else}
						<img
							src={getHeroImage(post.slug)}
							alt={post.title}
							class="mb-4 aspect-[3/2] w-full rounded-md border border-line object-cover"
							onerror={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')}
						/>
					{/if}
					<h2
						class="mb-2 font-serif text-2xl font-medium tracking-tight transition-colors group-hover:text-accent {post.format ===
						'market-brief'
							? 'text-on-dark'
							: 'text-ink'}"
					>
						{post.title}
					</h2>
					<p
						class="leading-relaxed {post.format === 'market-brief'
							? 'text-on-dark/75'
							: 'text-muted'}"
					>
						{post.description}
					</p>
				</a>
			</article>
		{/each}
	</div>
{/if}
