<script lang="ts">
	let {
		slug,
		alt,
		class: className = '',
		eager = false
	} = $props<{
		slug: string;
		alt: string;
		class?: string;
		eager?: boolean;
	}>();
</script>

<img
	src={`/blog/images/${slug}/hero.webp`}
	srcset={`/blog/images/${slug}/hero-card.webp 640w, /blog/images/${slug}/hero.webp 1024w`}
	sizes="(min-width: 1280px) 1152px, (min-width: 1024px) calc(100vw - 8rem), calc(100vw - 3rem)"
	{alt}
	class={className}
	loading={eager ? 'eager' : 'lazy'}
	fetchpriority={eager ? 'high' : 'auto'}
	decoding="async"
	onerror={(event) => ((event.currentTarget as HTMLImageElement).style.display = 'none')}
/>
