<script lang="ts">
	import type { PageData } from './$types';
	import { PILLARS } from '$lib/types/blog.types';
	import LinkedInDraft from '$lib/components/blog/LinkedInDraft.svelte';
	import AccentSpine from '$lib/components/ui/AccentSpine.svelte';

	let { data } = $props<{ data: PageData }>();

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

	function getHeroImage(slug: string): string {
		return `/blog/images/${slug}/hero.webp`;
	}
</script>

<!-- Back link -->
<a
	href="/blog"
	class="mb-8 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-accent"
>
	← All posts
</a>

<article>
	<!-- Post header with accent background -->
	<header
		class="relative mb-10 overflow-hidden rounded-lg border border-line bg-gradient-to-r from-accent/5 to-transparent p-6 pl-8 sm:p-8 sm:pl-10"
	>
		<AccentSpine />
		<div class="mb-3 flex flex-wrap items-center gap-3 text-sm text-muted">
			<time datetime={data.metadata.date}>{formatDate(data.metadata.date)}</time>
			<span class="text-line">·</span>
			<span>{data.metadata.readingTime ?? 5} min read</span>
			{#if pillarInfo}
				<span class="text-line">·</span>
				<span class="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
					{pillarInfo.label}
				</span>
			{/if}
		</div>

		<h1 class="mb-4 font-serif text-4xl font-medium leading-tight tracking-tight text-ink">
			{data.metadata.title}
		</h1>

		<p class="text-lg leading-relaxed text-muted">{data.metadata.description}</p>

		<img
			src={getHeroImage(data.metadata.slug)}
			alt={data.metadata.title}
			class="mt-6 aspect-[3/2] w-full rounded-md border border-line object-cover"
			onerror={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')}
		/>

		{#if data.metadata.tags.length > 0}
			<div class="mt-5 flex flex-wrap gap-1.5">
				{#each data.metadata.tags as tag}
					<a
						href="/blog/tag/{tag}"
						class="bg-accent/8 rounded-full border border-accent/20 px-2.5 py-0.5 text-xs text-muted transition-colors hover:border-accent/40 hover:text-accent"
					>
						{tag}
					</a>
				{/each}
			</div>
		{/if}
	</header>

	<!-- Post content -->
	<div
		class="prose-code:bg-accent/8 prose prose-lg
		max-w-none font-serif prose-headings:font-serif prose-headings:font-semibold
		prose-headings:text-ink prose-h2:mt-12 prose-h2:border-b prose-h2:border-line
		prose-h2:pb-3 prose-p:leading-relaxed
		prose-p:text-muted prose-a:text-link prose-a:underline prose-a:decoration-accent/50
		prose-a:underline-offset-2 hover:prose-a:decoration-accent
		prose-blockquote:rounded-r-lg prose-blockquote:border-l-4 prose-blockquote:border-accent prose-blockquote:bg-accent/5 prose-blockquote:py-1 prose-blockquote:text-muted prose-strong:text-ink prose-code:rounded
		prose-code:px-1.5 prose-code:py-0.5 prose-code:text-sm prose-code:text-ink prose-code:before:content-none
		prose-code:after:content-none prose-pre:rounded-lg prose-pre:border prose-pre:border-line prose-pre:bg-background-primary-dark prose-pre:text-on-dark
		prose-li:text-muted
		prose-img:rounded-lg prose-img:shadow-sm
		prose-hr:border-line"
	>
		<data.content />
	</div>
</article>

<!-- Post footer -->
<div class="mt-16 space-y-8">
	<!-- Share / LinkedIn section -->
	<div class="border-t border-line pt-8">
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
					class="inline-flex items-center gap-2 rounded-md border border-line px-4 py-2 text-sm font-medium text-ink transition-all hover:border-accent hover:text-accent"
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
	<div class="border-t border-line pt-8">
		<h3 class="mb-6 text-lg font-semibold text-ink">Discussion</h3>
		<div id="giscus-container">
			<script
				src="https://giscus.app/client.js"
				data-repo="reedwhetstone/coffee-app"
				data-repo-id="R_kgDONmnSPw"
				data-category="Blog"
				data-category-id="DIC_kwDONmnSP84C24EG"
				data-mapping="pathname"
				data-strict="0"
				data-reactions-enabled="1"
				data-emit-metadata="0"
				data-input-position="top"
				data-theme="noborder_light"
				data-lang="en"
				data-loading="lazy"
				crossorigin="anonymous"
				async
			></script>
		</div>
		<noscript>
			<p class="text-sm text-muted">
				Enable JavaScript to view <a href="https://giscus.app" class="text-accent">comments</a>.
			</p>
		</noscript>
	</div>
</div>
