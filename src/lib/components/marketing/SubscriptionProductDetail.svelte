<script lang="ts">
	interface DetailStep {
		title: string;
		description: string;
	}

	interface DetailLink {
		href: string;
		label: string;
	}

	let {
		anchorId,
		headingId,
		name,
		price,
		headline,
		description,
		askTitle,
		askDescription,
		supportingText,
		workflowTitle,
		workflow,
		links = []
	} = $props<{
		anchorId: string;
		headingId: string;
		name: string;
		price: string;
		headline: string;
		description: string;
		askTitle: string;
		askDescription: string;
		supportingText: string;
		workflowTitle: string;
		workflow: readonly DetailStep[];
		links?: readonly DetailLink[];
	}>();
</script>

<section id={anchorId} class="scroll-mt-24 border-t border-line pt-12" aria-labelledby={headingId}>
	<div class="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
		<div>
			<div class="flex flex-wrap items-center gap-3">
				<p class="text-sm font-semibold text-accent">{name}</p>
				<span class="text-sm font-semibold text-ink">{price}</span>
			</div>
			<h3
				id={headingId}
				class="mt-3 font-serif text-3xl font-medium tracking-tight text-ink sm:text-4xl"
			>
				{headline}
			</h3>
			<p class="mt-4 max-w-3xl text-base leading-7 text-muted">{description}</p>
			<div class="mt-7 border-l-2 border-accent pl-5">
				<p class="font-semibold text-ink">{askTitle}</p>
				<p class="mt-2 text-sm leading-6 text-muted">{askDescription}</p>
			</div>
			<p class="mt-6 text-sm leading-6 text-muted">{supportingText}</p>
			{#if links.length > 0}
				<div class="mt-5 flex flex-wrap gap-5 text-sm font-semibold">
					{#each links as link}
						<a href={link.href} class="text-link hover:text-accent">
							{link.label} <span aria-hidden="true">→</span>
						</a>
					{/each}
				</div>
			{/if}
		</div>

		<div>
			<p class="text-sm font-semibold text-accent">{workflowTitle}</p>
			<ol class="mt-5 overflow-hidden rounded-2xl bg-line ring-1 ring-line">
				{#each workflow as step, index}
					<li class="flex gap-4 border-b border-line bg-surface-panel p-4 last:border-b-0">
						<span class="text-sm font-semibold text-accent">0{index + 1}</span>
						<div>
							<h4 class="font-semibold text-ink">{step.title}</h4>
							<p class="mt-1 text-sm leading-6 text-muted">{step.description}</p>
						</div>
					</li>
				{/each}
			</ol>
		</div>
	</div>
</section>
