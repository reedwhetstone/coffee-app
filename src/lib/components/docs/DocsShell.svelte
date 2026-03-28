<script lang="ts">
	import { DOCS_NAV, getPrevNextDocs, type DocsPage, type DocsSectionKey } from '$lib/docs/content';

	let { page, section, slug } = $props<{
		page: DocsPage;
		section: DocsSectionKey;
		slug: string;
	}>();

	let navSection = $derived(DOCS_NAV.find((item) => item.key === section));
	let prevNext = $derived(getPrevNextDocs(section, slug));

	function calloutClasses(tone: 'note' | 'warning' | 'success') {
		if (tone === 'warning') {
			return 'border-amber-200 bg-amber-50 text-amber-950';
		}
		if (tone === 'success') {
			return 'border-emerald-200 bg-emerald-50 text-emerald-950';
		}
		return 'border-blue-200 bg-blue-50 text-blue-950';
	}
</script>

<div class="grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
	<aside class="space-y-4 lg:sticky lg:top-24 lg:self-start">
		<div class="rounded-2xl border border-border-light bg-background-secondary-light p-5">
			<p class="text-xs font-semibold uppercase tracking-[0.18em] text-background-tertiary-light">
				Documentation
			</p>
			<h2 class="mt-2 text-lg font-semibold text-text-primary-light">{navSection?.title}</h2>
			<p class="mt-2 text-sm leading-relaxed text-text-secondary-light">
				{navSection?.description}
			</p>
		</div>

		<nav class="rounded-2xl border border-border-light bg-background-primary-light p-3">
			<ul class="space-y-1">
				{#each navSection?.items ?? [] as item}
					<li>
						<a
							href={`${navSection?.basePath}/${item.slug}`}
							class={`block rounded-xl px-3 py-2 transition-colors ${
								item.slug === slug
									? 'bg-background-tertiary-light/10 text-background-tertiary-light'
									: 'text-text-secondary-light hover:bg-background-secondary-light hover:text-text-primary-light'
							}`}
						>
							<div class="text-sm font-medium">{item.title}</div>
							<div class="mt-1 text-xs leading-relaxed opacity-80">{item.summary}</div>
						</a>
					</li>
				{/each}
			</ul>
		</nav>
	</aside>

	<article class="min-w-0 space-y-8">
		<header
			class="rounded-3xl border border-border-light bg-background-primary-light p-6 shadow-sm sm:p-8"
		>
			<p class="text-xs font-semibold uppercase tracking-[0.18em] text-background-tertiary-light">
				{page.eyebrow}
			</p>
			<h1 class="mt-3 text-3xl font-bold tracking-tight text-text-primary-light sm:text-4xl">
				{page.title}
			</h1>
			<p class="mt-3 max-w-3xl text-base leading-relaxed text-text-secondary-light sm:text-lg">
				{page.summary}
			</p>

			<div class="mt-6 space-y-3 text-sm leading-relaxed text-text-primary-light">
				{#each page.intro as paragraph}
					<p>{paragraph}</p>
				{/each}
			</div>
		</header>

		{#each page.sections as sectionBlock}
			<section
				class="rounded-3xl border border-border-light bg-background-primary-light p-6 shadow-sm sm:p-8"
			>
				<h2 class="text-2xl font-semibold text-text-primary-light">{sectionBlock.title}</h2>

				{#if sectionBlock.body}
					<div class="mt-4 space-y-3 text-sm leading-relaxed text-text-primary-light sm:text-base">
						{#each sectionBlock.body as paragraph}
							<p>{paragraph}</p>
						{/each}
					</div>
				{/if}

				{#if sectionBlock.bullets}
					<ul class="mt-4 space-y-3 text-sm leading-relaxed text-text-primary-light sm:text-base">
						{#each sectionBlock.bullets as bullet}
							<li class="flex gap-3">
								<span class="mt-1 h-2.5 w-2.5 rounded-full bg-background-tertiary-light"></span>
								<span>{bullet}</span>
							</li>
						{/each}
					</ul>
				{/if}

				{#if sectionBlock.table}
					<div class="mt-5 overflow-x-auto rounded-2xl border border-border-light">
						<table class="min-w-full divide-y divide-border-light text-sm">
							<thead class="bg-background-secondary-light text-left text-text-primary-light">
								<tr>
									{#each sectionBlock.table.headers as header}
										<th class="px-4 py-3 font-semibold">{header}</th>
									{/each}
								</tr>
							</thead>
							<tbody
								class="divide-y divide-border-light bg-background-primary-light text-text-secondary-light"
							>
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
							<div
								class="overflow-hidden rounded-2xl border border-border-light bg-background-secondary-light"
							>
								{#if block.label}
									<div
										class="border-b border-border-light px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary-light"
									>
										{block.label}
									</div>
								{/if}
								<pre
									class="overflow-x-auto px-4 py-4 text-xs leading-relaxed text-text-primary-light sm:text-sm"><code
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

		<section
			class="rounded-3xl border border-border-light bg-background-primary-light p-6 shadow-sm sm:p-8"
		>
			<h2 class="text-2xl font-semibold text-text-primary-light">Related links</h2>
			<div class="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
				{#each page.related as link}
					<a
						href={link.href}
						class="rounded-2xl border border-border-light bg-background-secondary-light p-4 transition-colors hover:border-background-tertiary-light/40 hover:bg-background-primary-light"
					>
						<div class="text-sm font-semibold text-text-primary-light">{link.label}</div>
						<p class="mt-2 text-sm leading-relaxed text-text-secondary-light">
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
					class="rounded-2xl border border-border-light bg-background-primary-light px-5 py-4 text-left shadow-sm transition-colors hover:border-background-tertiary-light/40 hover:bg-background-secondary-light"
				>
					<p class="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary-light">
						Previous
					</p>
					<p class="mt-2 text-sm font-semibold text-text-primary-light">{prevNext.prev.title}</p>
				</a>
			{:else}
				<div></div>
			{/if}

			{#if prevNext.next}
				<a
					href={`${navSection?.basePath}/${prevNext.next.slug}`}
					class="rounded-2xl border border-border-light bg-background-primary-light px-5 py-4 text-left shadow-sm transition-colors hover:border-background-tertiary-light/40 hover:bg-background-secondary-light sm:text-right"
				>
					<p class="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary-light">
						Next
					</p>
					<p class="mt-2 text-sm font-semibold text-text-primary-light">{prevNext.next.title}</p>
				</a>
			{/if}
		</nav>
	</article>
</div>
