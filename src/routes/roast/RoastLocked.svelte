<script lang="ts">
	import AccentSpine from '$lib/components/ui/AccentSpine.svelte';
</script>

<section
	class="relative overflow-hidden rounded-lg border border-accent/20 bg-accent-subtle/10 p-6 pl-8 sm:p-8 sm:pl-10"
	aria-labelledby="roast-locked-title"
>
	<AccentSpine />
	<div class="max-w-2xl">
		<h1
			id="roast-locked-title"
			class="font-serif text-2xl font-medium tracking-tight text-ink sm:text-3xl"
		>
			Log, compare, and plan your roasts
		</h1>
		<p class="mt-3 leading-7 text-muted">
			Roasts are part of Mallard Studio. Keep every roast's curve, compare any two, plan the next
			one, and take the plan into Artisan.
		</p>
		<a
			href="/subscription?plan=studio-monthly"
			class="mt-6 inline-flex rounded-md bg-accent px-6 py-2.5 text-sm font-semibold text-ink transition-all duration-200 hover:bg-accent/85 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
		>
			Unlock Mallard Studio
		</a>
	</div>
</section>
