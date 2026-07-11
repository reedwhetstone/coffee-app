<script lang="ts">
	import { DOCS_NAV, getPrevNextDocs, type DocsPage, type DocsSectionKey } from '$lib/docs/content';

	let { page, section, slug } = $props<{
		page: DocsPage;
		section: DocsSectionKey;
		slug: string;
	}>();

	let navSection = $derived(DOCS_NAV.find((item) => item.key === section));
	let prevNext = $derived(getPrevNextDocs(section, slug));

	// Build a page-level TOC from section titles.
	// Each entry anchors to a slug derived from the title.
	function titleToAnchor(title: string): string {
		return title
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '');
	}

	let tocItems = $derived(
		page.sections.map((s: { title: string }) => ({
			title: s.title,
			anchor: titleToAnchor(s.title)
		}))
	);

	function calloutClasses(tone: 'note' | 'warning' | 'success') {
		if (tone === 'warning') {
			return 'border-warning/30 bg-warning-subtle text-warning-strong';
		}
		if (tone === 'success') {
			return 'border-success/30 bg-success-subtle text-success-strong';
		}
		return 'border-info/30 bg-info-subtle text-info-strong';
	}
</script>

<div class="grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
	<aside class="space-y-4 lg:sticky lg:top-24 lg:self-start">
		<div class="rounded-2xl border border-line bg-surface-panel p-5">
			<p class="text-xs font-semibold text-accent">Documentation</p>
			<h2 class="mt-2 text-lg font-semibold text-ink">{navSection?.title}</h2>
			<p class="mt-2 text-sm leading-relaxed text-muted">
				{navSection?.description}
			</p>
		</div>

		<nav class="rounded-2xl border border-line bg-surface-canvas p-3">
			<ul class="space-y-1">
				{#each navSection?.items ?? [] as item}
					<li>
						<a
							href={`${navSection?.basePath}/${item.slug}`}
							class={`block rounded-xl px-3 py-2 transition-colors ${
								item.slug === slug
									? 'bg-accent/10 text-accent'
									: 'text-muted hover:bg-surface-panel hover:text-ink'
							}`}
						>
							<div class="text-sm font-medium">{item.title}</div>
							<div class="mt-1 text-xs leading-relaxed opacity-80">{item.summary}</div>
						</a>
					</li>
				{/each}
			</ul>
		</nav>

		{#if tocItems.length > 1}
			<nav aria-label="On this page" class="rounded-2xl border border-line bg-surface-canvas p-4">
				<p class="text-xs font-semibold text-muted">On this page</p>
				<ul class="mt-3 space-y-1">
					{#each tocItems as toc}
						<li>
							<a
								href={`#${toc.anchor}`}
								class="block rounded-lg px-2 py-1.5 text-xs leading-snug text-muted transition-colors hover:bg-surface-panel hover:text-ink"
							>
								{toc.title}
							</a>
						</li>
					{/each}
				</ul>
			</nav>
		{/if}
	</aside>

	<article class="min-w-0 space-y-8">
		<header class="rounded-2xl border border-line bg-surface-canvas p-6 shadow-sm sm:p-8">
			<p class="text-xs font-semibold text-accent">
				{page.eyebrow}
			</p>
			<h1 class="mt-3 font-serif text-3xl font-medium tracking-tight text-ink sm:text-4xl">
				{page.title}
			</h1>
			<p class="mt-3 max-w-3xl text-base leading-relaxed text-muted sm:text-lg">
				{page.summary}
			</p>

			<div class="mt-6 space-y-3 text-sm leading-relaxed text-ink">
				{#each page.intro as paragraph}
					<p>{paragraph}</p>
				{/each}
			</div>
		</header>

		{#each page.sections as sectionBlock}
			<section
				id={titleToAnchor(sectionBlock.title)}
				class="rounded-lg border border-line bg-surface-canvas p-6 shadow-sm sm:p-8"
			>
				<h2 class="font-serif text-2xl font-medium tracking-tight text-ink">
					{sectionBlock.title}
				</h2>

				{#if sectionBlock.body}
					<div class="mt-4 space-y-3 text-sm leading-relaxed text-ink sm:text-base">
						{#each sectionBlock.body as paragraph}
							<p>{paragraph}</p>
						{/each}
					</div>
				{/if}

				{#if sectionBlock.bullets}
					<ul class="mt-4 space-y-3 text-sm leading-relaxed text-ink sm:text-base">
						{#each sectionBlock.bullets as bullet}
							<li class="flex gap-3">
								<span class="mt-1 h-2.5 w-2.5 rounded-full bg-accent"></span>
								<span>{bullet}</span>
							</li>
						{/each}
					</ul>
				{/if}

				{#if sectionBlock.table}
					<div class="mt-5 overflow-x-auto rounded-2xl border border-line">
						<table class="min-w-full divide-y divide-line text-sm">
							<thead class="bg-surface-panel text-left text-ink">
								<tr>
									{#each sectionBlock.table.headers as header}
										<th class="px-4 py-3 font-semibold">{header}</th>
									{/each}
								</tr>
							</thead>
							<tbody class="divide-y divide-line bg-surface-canvas text-muted">
								{#each sectionBlock.table.rows as row}
									<tr>
										{#each row as cell}
											<td class="px-4 py-3 align-top leading-relaxed">{cell}</td>
										{/each}
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}

				{#if sectionBlock.codeBlocks}
					<div class="mt-5 space-y-4">
						{#each sectionBlock.codeBlocks as block}
							<div class="overflow-hidden rounded-2xl border border-line bg-surface-panel">
								{#if block.label}
									<div class="border-b border-line px-4 py-2 text-xs font-semibold text-muted">
										{block.label}
									</div>
								{/if}
								<pre
									class="overflow-x-auto px-4 py-4 text-xs leading-relaxed text-ink sm:text-sm"><code
										>{block.code}</code
									></pre>
							</div>
						{/each}
					</div>
				{/if}

				{#if sectionBlock.callout}
					<div
						class={`mt-5 rounded-2xl border px-4 py-4 ${calloutClasses(sectionBlock.callout.tone)}`}
					>
						<p class="text-sm font-semibold">{sectionBlock.callout.title}</p>
						<p class="mt-2 text-sm leading-relaxed">{sectionBlock.callout.body}</p>
					</div>
				{/if}
			</section>
		{/each}

		<section class="rounded-lg border border-line bg-surface-canvas p-6 shadow-sm sm:p-8">
			<h2 class="font-serif text-2xl font-medium tracking-tight text-ink">Related links</h2>
			<div class="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
				{#each page.related as link}
					<a
						href={link.href}
						class="rounded-2xl border border-line bg-surface-panel p-4 transition-colors hover:border-accent/40 hover:bg-surface-canvas"
					>
						<div class="text-sm font-semibold text-ink">{link.label}</div>
						<p class="mt-2 text-sm leading-relaxed text-muted">
							{link.description}
						</p>
					</a>
				{/each}
			</div>
		</section>

		<nav class="flex flex-col gap-3 sm:flex-row sm:justify-between">
			{#if prevNext.prev}
				<a
					href={`${navSection?.basePath}/${prevNext.prev.slug}`}
					class="rounded-2xl border border-line bg-surface-canvas px-5 py-4 text-left shadow-sm transition-colors hover:border-accent/40 hover:bg-surface-panel"
				>
					<p class="text-xs font-semibold text-muted">Previous</p>
					<p class="mt-2 text-sm font-semibold text-ink">{prevNext.prev.title}</p>
				</a>
			{:else}
				<div></div>
			{/if}

			{#if prevNext.next}
				<a
					href={`${navSection?.basePath}/${prevNext.next.slug}`}
					class="rounded-2xl border border-line bg-surface-canvas px-5 py-4 text-left shadow-sm transition-colors hover:border-accent/40 hover:bg-surface-panel sm:text-right"
				>
					<p class="text-xs font-semibold text-muted">Next</p>
					<p class="mt-2 text-sm font-semibold text-ink">{prevNext.next.title}</p>
				</a>
			{/if}
		</nav>
	</article>
</div>
