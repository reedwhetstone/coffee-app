<script lang="ts">
	import type { InsightModuleContract } from '$lib/analytics/insightModules';

	interface Props {
		module: InsightModuleContract;
		class?: string;
	}

	let { module, class: className = '' }: Props = $props();
</script>

<dl
	class="grid gap-3 rounded-lg border border-line bg-surface-panel p-4 text-xs sm:grid-cols-3 {className}"
	aria-label="{module.id} task parity contract"
	data-insight-module={module.id}
>
	<div>
		<dt class="font-semibold text-ink">Overview</dt>
		<dd class="mt-1 leading-5 text-muted">{module.overview}</dd>
	</div>
	<div>
		<dt class="font-semibold text-ink">Source</dt>
		<dd class="mt-1 leading-5 text-muted">{module.source}</dd>
	</div>
	<div>
		<dt class="font-semibold text-ink">Action</dt>
		<dd class="mt-1 leading-5 text-muted">{module.primaryAction}</dd>
	</div>
</dl>
