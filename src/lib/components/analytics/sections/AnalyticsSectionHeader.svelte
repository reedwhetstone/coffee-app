<!--
  Shared group header for the Market Index page. Groups the dashboard into
  named chapters (signals, evidence, intelligence) so the page reads as a
  structured report instead of a wall of panels.
-->
<script lang="ts">
	interface Props {
		title: string;
		description?: string;
	}

	let { title, description }: Props = $props();
</script>

<div class="mb-4 mt-10 border-t border-line pt-6 first:mt-0 first:border-t-0 first:pt-0">
	<h2 class="font-serif text-xl font-medium tracking-tight text-ink sm:text-2xl">{title}</h2>
	{#if description}
		<p class="mt-1 max-w-3xl text-sm text-muted">{description}</p>
	{/if}
</div>
