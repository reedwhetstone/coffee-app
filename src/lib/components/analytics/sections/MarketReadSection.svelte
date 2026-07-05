<script lang="ts">
	type ViewMode = 'retail' | 'wholesale' | 'all';
	type WindowMode = '7d' | '30d';

	interface Props {
		marketReadHeadline: string;
		marketReadDetail: string;
		lastUpdated: string | null;
		totalSuppliers: number;
		viewMode: ViewMode;
		windowMode: WindowMode;
		onViewModeChange: (v: ViewMode) => void;
		onWindowModeChange: (v: WindowMode) => void;
	}

	const VIEW_OPTIONS: { value: ViewMode; label: string }[] = [
		{ value: 'retail', label: 'Retail' },
		{ value: 'wholesale', label: 'Wholesale' },
		{ value: 'all', label: 'All' }
	];

	let {
		marketReadHeadline,
		marketReadDetail,
		lastUpdated,
		totalSuppliers,
		viewMode,
		windowMode,
		onViewModeChange,
		onWindowModeChange
	}: Props = $props();

	function formatDate(dateStr: string | null) {
		if (!dateStr) return 'N/A';
		return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
			month: 'long',
			day: 'numeric',
			year: 'numeric'
		});
	}
</script>

<section
	class="mb-6 rounded-2xl border border-accent/20 bg-gradient-to-br from-background-primary-light via-background-primary-light to-background-secondary-light p-5 shadow-sm sm:p-6"
	aria-labelledby="market-read-heading"
>
	<div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
		<div>
			<p class="text-xs font-semibold text-accent">Market read</p>
			<h1
				id="market-read-heading"
				class="mt-2 font-serif text-3xl font-medium tracking-tight text-ink sm:text-4xl"
			>
				Parchment Market Index
			</h1>
			<h2 class="mt-3 max-w-3xl text-xl font-semibold leading-7 text-ink sm:text-2xl">
				{marketReadHeadline}
			</h2>
			<p class="mt-3 max-w-3xl text-base leading-7 text-muted sm:text-lg">
				{marketReadDetail}
			</p>
			<p class="mt-3 text-sm text-muted">
				{#if lastUpdated}
					Last updated {formatDate(lastUpdated)}.
				{:else}
					Data collection started March 21, 2026.
				{/if}
				Daily-normalized pricing, arrivals, and supplier movement across {totalSuppliers}
				US importers.
			</p>
		</div>

		<aside
			class="rounded-xl border border-line bg-surface-canvas/90 p-4 shadow-sm"
			aria-label="Scope controls"
		>
			<div class="flex items-center justify-between gap-3">
				<div>
					<p class="text-xs font-semibold text-muted">Scope controls</p>
					<p class="mt-1 text-sm text-muted">
						Every chart on this page follows the scope you set here.
					</p>
				</div>
				<span class="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
					{viewMode}
				</span>
			</div>

			<div class="mt-4 space-y-4">
				<div>
					<p class="mb-2 text-xs font-medium text-muted">Market scope</p>
					<div
						class="flex flex-wrap rounded-full border border-line bg-surface-panel p-1 shadow-sm"
					>
						{#each VIEW_OPTIONS as opt}
							<button
								type="button"
								onclick={() => onViewModeChange(opt.value)}
								class="flex-1 rounded-full px-3 py-1.5 text-sm font-medium transition-all duration-150
								{viewMode === opt.value ? 'bg-accent text-ink shadow-sm' : 'text-muted hover:text-ink'}"
							>
								{opt.label}
							</button>
						{/each}
					</div>
				</div>

				<div>
					<p class="mb-2 text-xs font-medium text-muted">Movement window</p>
					<div class="flex rounded-full border border-line bg-surface-panel p-1 shadow-sm">
						{#each [{ value: '7d', label: '7d' }, { value: '30d', label: '30d' }] as opt}
							<button
								type="button"
								onclick={() => onWindowModeChange(opt.value as WindowMode)}
								class="flex-1 rounded-full px-3 py-1.5 text-sm font-medium transition-all duration-150 {windowMode ===
								opt.value
									? 'bg-accent text-ink shadow-sm'
									: 'text-muted hover:text-ink'}"
							>
								{opt.label}
							</button>
						{/each}
					</div>
				</div>
			</div>
		</aside>
	</div>
</section>
