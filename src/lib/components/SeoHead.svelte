<script lang="ts">
	import type { PageMeta } from '$lib/types/meta.types';

	let { meta } = $props<{ meta?: PageMeta }>();
</script>

<svelte:head>
	{#if meta}
		<title>{meta.title || 'Purveyors'}</title>
		{#if meta.description}
			<meta name="description" content={meta.description} />
		{/if}
		{#if meta.keywords}
			<meta name="keywords" content={meta.keywords} />
		{/if}
		{#if meta.canonical}
			<link rel="canonical" href={meta.canonical} />
		{/if}
		{#if meta.robots}
			<meta name="robots" content={meta.robots} />
		{/if}
		{#if meta.author}
			<meta name="author" content={meta.author} />
		{/if}
		{#if meta.viewport}
			<meta name="viewport" content={meta.viewport} />
		{/if}
		{#if meta.themeColor}
			<meta name="theme-color" content={meta.themeColor} />
		{/if}

		{#if meta.ogTitle}
			<meta property="og:title" content={meta.ogTitle} />
		{/if}
		{#if meta.ogDescription}
			<meta property="og:description" content={meta.ogDescription} />
		{/if}
		{#if meta.ogImage}
			<meta property="og:image" content={meta.ogImage} />
		{/if}
		{#if meta.ogImageAlt}
			<meta property="og:image:alt" content={meta.ogImageAlt} />
		{/if}
		{#if meta.ogImageWidth}
			<meta property="og:image:width" content={String(meta.ogImageWidth)} />
		{/if}
		{#if meta.ogImageHeight}
			<meta property="og:image:height" content={String(meta.ogImageHeight)} />
		{/if}
		{#if meta.ogUrl}
			<meta property="og:url" content={meta.ogUrl} />
		{/if}
		<meta property="og:type" content={meta.ogType || 'website'} />
		{#if meta.ogSiteName}
			<meta property="og:site_name" content={meta.ogSiteName} />
		{/if}
		{#if meta.ogLocale}
			<meta property="og:locale" content={meta.ogLocale} />
		{/if}

		{#if meta.twitterCard}
			<meta name="twitter:card" content={meta.twitterCard} />
		{/if}
		{#if meta.twitterTitle}
			<meta name="twitter:title" content={meta.twitterTitle} />
		{/if}
		{#if meta.twitterDescription}
			<meta name="twitter:description" content={meta.twitterDescription} />
		{/if}
		{#if meta.twitterImage}
			<meta name="twitter:image" content={meta.twitterImage} />
		{/if}
		{#if meta.twitterImageAlt}
			<meta name="twitter:image:alt" content={meta.twitterImageAlt} />
		{/if}
		{#if meta.twitterSite}
			<meta name="twitter:site" content={meta.twitterSite} />
		{/if}
		{#if meta.twitterCreator}
			<meta name="twitter:creator" content={meta.twitterCreator} />
		{/if}

		{#if meta.articlePublishedTime}
			<meta property="article:published_time" content={meta.articlePublishedTime} />
		{/if}
		{#if meta.articleModifiedTime}
			<meta property="article:modified_time" content={meta.articleModifiedTime} />
		{/if}
		{#if meta.articleAuthor}
			<meta property="article:author" content={meta.articleAuthor} />
		{/if}
		{#if meta.articleSection}
			<meta property="article:section" content={meta.articleSection} />
		{/if}
		{#if meta.articleTags}
			{#each meta.articleTags as tag}
				<meta property="article:tag" content={tag} />
			{/each}
		{/if}

		{#if meta.structuredData}
			<!-- eslint-disable-next-line svelte/no-at-html-tags, no-useless-escape -->
			{@html `<script type="application/ld+json">${JSON.stringify(meta.structuredData)}<\/script>`}
		{/if}
		{#if meta.schemaData}
			{#if Array.isArray(meta.schemaData)}
				{#each meta.schemaData as schema}
					<!-- eslint-disable-next-line svelte/no-at-html-tags, no-useless-escape -->
					{@html `<script type="application/ld+json">${JSON.stringify(schema)}<\/script>`}
				{/each}
			{:else}
				<!-- eslint-disable-next-line svelte/no-at-html-tags, no-useless-escape -->
				{@html `<script type="application/ld+json">${JSON.stringify(meta.schemaData)}<\/script>`}
			{/if}
		{/if}

		{#if meta.hreflang}
			{#each meta.hreflang as lang}
				<link rel="alternate" hreflang={lang.lang} href={lang.href} />
			{/each}
		{/if}

		{#if meta.preconnect}
			{#each meta.preconnect as url}
				<link rel="preconnect" href={url} />
			{/each}
		{/if}
		{#if meta.dnsPrefetch}
			{#each meta.dnsPrefetch as url}
				<link rel="dns-prefetch" href={url} />
			{/each}
		{/if}
	{/if}
</svelte:head>
