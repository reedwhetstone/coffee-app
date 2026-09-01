<script lang="ts">
	import { formatMarketBriefEdition } from '$lib/types/blog.types';

	let {
		title,
		edition,
		compact = false
	} = $props<{
		title: string;
		edition: number;
		compact?: boolean;
	}>();
</script>

<div class="relative isolate h-full w-full overflow-hidden bg-ink text-on-dark" aria-hidden="true">
	<div class="absolute inset-0" aria-hidden="true">
		<div
			class="absolute -left-[8%] top-[12%] h-[58%] w-[44%] -rotate-6 rounded-[45%] bg-accent/65"
		></div>
		<div
			class="absolute -right-[6%] -top-[16%] h-[62%] w-[52%] rotate-12 rounded-[42%] bg-on-dark/10"
		></div>
		<div
			class="absolute bottom-[-24%] right-[18%] h-[56%] w-[48%] -rotate-12 rounded-[48%] border border-on-dark/15 bg-accent/15"
		></div>
		<svg class="absolute inset-x-0 top-[43%] h-[22%] w-full text-accent" viewBox="0 0 800 120">
			<path
				d="M-20 86 C96 84 111 31 207 52 S337 100 425 58 S579 18 820 35"
				fill="none"
				stroke="currentColor"
				stroke-width="3"
				stroke-linecap="round"
				opacity="0.9"
			></path>
		</svg>
	</div>

	<div
		class="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-ink via-ink/90 to-transparent p-5 sm:p-7"
	>
		<p class="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-accent">
			Market Brief · Edition {formatMarketBriefEdition(edition)}
		</p>
		<p
			class="mt-2 max-w-3xl font-serif font-medium leading-tight {compact
				? 'text-xl'
				: 'text-3xl sm:text-4xl'}"
		>
			{title}
		</p>
	</div>
</div>
