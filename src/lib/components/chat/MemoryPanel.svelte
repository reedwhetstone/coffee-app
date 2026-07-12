<script lang="ts">
	let { open = $bindable(false) } = $props<{ open?: boolean }>();

	let content = $state('');
	let updatedAt = $state<string | null>(null);
	let updatedBy = $state<string | null>(null);
	let loading = $state(false);
	let saving = $state(false);
	let error = $state<string | null>(null);
	let loadedOnce = $state(false);

	$effect(() => {
		if (open && !loadedOnce) {
			loadedOnce = true;
			loadMemory();
		}
	});

	async function loadMemory() {
		loading = true;
		error = null;
		try {
			const res = await fetch('/api/memory');
			if (!res.ok) throw new Error('Failed to load memory');
			const data = await res.json();
			content = data.content ?? '';
			updatedAt = data.updated_at;
			updatedBy = data.updated_by;
		} catch {
			error = 'Could not load your memory document.';
		} finally {
			loading = false;
		}
	}

	async function saveMemory() {
		saving = true;
		error = null;
		try {
			const res = await fetch('/api/memory', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ content })
			});
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				throw new Error(data.error || 'Save failed');
			}
			updatedAt = new Date().toISOString();
			updatedBy = 'user';
			open = false;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Could not save your memory document.';
		} finally {
			saving = false;
		}
	}
</script>

{#if open}
	<div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4">
		<div
			class="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-lg bg-surface-canvas shadow-xl"
			role="dialog"
			aria-label="Memory document"
		>
			<div class="flex items-start justify-between border-b border-line px-5 py-3">
				<div>
					<h2 class="text-base font-semibold text-ink">Memory</h2>
					<p class="text-xs text-muted">
						A persistent document the assistant sees in every conversation. It updates this
						automatically as you chat; edit it directly any time.
						{#if updatedAt}
							Last updated {new Date(updatedAt).toLocaleString()}
							({updatedBy === 'agent' ? 'by the assistant' : 'by you'}).
						{/if}
					</p>
				</div>
				<button
					type="button"
					onclick={() => (open = false)}
					class="ml-3 shrink-0 rounded-md p-1.5 text-muted transition-colors hover:bg-surface-panel hover:text-ink"
					aria-label="Close memory"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="1.5"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</div>

			<div class="flex min-h-0 flex-1 flex-col p-5">
				{#if loading}
					<p class="text-sm text-muted">Loading…</p>
				{:else}
					<textarea
						bind:value={content}
						rows="14"
						placeholder="Nothing here yet. The assistant will start filling this in as you chat — or write your own notes: preferences, equipment, suppliers you work with, goals."
						class="min-h-[16rem] flex-1 resize-y rounded-lg border border-line bg-surface-canvas px-3 py-2 font-mono text-sm text-ink placeholder-muted focus:border-accent focus:outline-none"
					></textarea>
				{/if}
				{#if error}
					<p class="mt-2 text-sm text-danger">{error}</p>
				{/if}
			</div>

			<div class="flex items-center justify-end gap-2 border-t border-line px-5 py-3">
				<button
					type="button"
					onclick={() => (open = false)}
					class="rounded-md border border-line px-3 py-1.5 text-sm text-muted transition-colors hover:text-ink"
				>
					Cancel
				</button>
				<button
					type="button"
					onclick={saveMemory}
					disabled={saving || loading}
					class="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{saving ? 'Saving…' : 'Save'}
				</button>
			</div>
		</div>
	</div>
{/if}
