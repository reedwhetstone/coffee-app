<script lang="ts">
	import UINodeView from './UINodeView.svelte';
	import GenUIBlockRenderer from '../GenUIBlockRenderer.svelte';
	import { coerceStateValue, getComponent, FALLBACK_NODE_TYPE } from '$lib/genui/catalog';
	import type { BlockState, BlockStateValue, UINode } from '$lib/genui/catalog';
	import type { BlockAction, UIBlock } from '$lib/types/genui';

	let { node, blockState, onState, onAction } = $props<{
		node: UINode;
		/** Shared block state; omit to render interactive nodes read-only. */
		blockState?: BlockState;
		onState?: (key: string, value: BlockStateValue) => void;
		onAction?: (action: BlockAction) => void;
	}>();

	const gaps = { sm: 'gap-2', md: 'gap-3', lg: 'gap-5' } as const;
	const tones = {
		info: 'bg-info-subtle text-info',
		success: 'bg-success-subtle text-success-strong',
		warning: 'bg-warning-subtle text-warning-strong',
		danger: 'bg-danger-subtle text-danger-strong'
	} as const;
	const cols = {
		1: 'grid-cols-1',
		2: 'sm:grid-cols-2',
		3: 'sm:grid-cols-3',
		4: 'sm:grid-cols-4'
	} as const;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let p = $derived((node.props ?? {}) as any);
	let kind = $derived(getComponent(node.type)?.kind);
	let readOnly = $derived(!onState);
	let activeTab = $state(0);
	let stateValue = $derived(node.id ? coerceStateValue(node, blockState?.[node.id]) : undefined);
	let checked = $derived(new Set((stateValue as string[] | undefined) ?? []));

	function toggle(itemId: string) {
		if (!node.id || !onState) return;
		const next = new Set(checked);
		if (next.has(itemId)) next.delete(itemId);
		else next.add(itemId);
		const order = (p.items as Array<{ id: string }>).map((i) => i.id);
		onState(
			node.id,
			order.filter((id) => next.has(id))
		);
	}

	function setField(value: BlockStateValue) {
		if (node.id && onState) onState(node.id, value);
	}
</script>

{#if node.type === FALLBACK_NODE_TYPE}
	<div class="rounded-md border border-dashed border-line px-3 py-2 text-xs text-muted">
		This component is unavailable.
	</div>
{:else if node.type === 'stack'}
	<div
		class="flex {p.direction === 'horizontal' ? 'flex-row flex-wrap' : 'flex-col'} {gaps[
			p.gap as keyof typeof gaps
		] ?? gaps.md}"
	>
		{#each node.children ?? [] as child, i (child.id ?? i)}
			<UINodeView node={child} {blockState} {onState} {onAction} />
		{/each}
	</div>
{:else if node.type === 'grid'}
	<div
		class="grid grid-cols-1 {cols[(p.columns ?? 2) as keyof typeof cols]} {gaps[
			p.gap as keyof typeof gaps
		] ?? gaps.md}"
	>
		{#each node.children ?? [] as child, i (child.id ?? i)}
			<UINodeView node={child} {blockState} {onState} {onAction} />
		{/each}
	</div>
{:else if node.type === 'tabs'}
	<div class="flex flex-col gap-3">
		<div class="flex flex-wrap gap-1 border-b border-line" role="tablist">
			{#each p.labels as label, i (i)}
				<button
					type="button"
					role="tab"
					aria-selected={activeTab === i}
					class="px-3 py-1.5 text-sm {activeTab === i
						? 'border-b-2 border-accent font-medium text-ink'
						: 'text-muted hover:text-ink'}"
					onclick={() => (activeTab = i)}>{label}</button
				>
			{/each}
		</div>
		{#if node.children?.[activeTab]}
			<UINodeView node={node.children[activeTab]} {blockState} {onState} {onAction} />
		{/if}
	</div>
{:else if node.type === 'card'}
	<section class="rounded-lg bg-surface-panel p-4 ring-1 ring-line">
		{#if p.title}<h3 class="text-sm font-semibold text-ink">{p.title}</h3>{/if}
		{#if p.subtitle}<p class="text-xs text-muted">{p.subtitle}</p>{/if}
		<div class="mt-3 flex flex-col gap-3 first:mt-0">
			{#each node.children ?? [] as child, i (child.id ?? i)}
				<UINodeView node={child} {blockState} {onState} {onAction} />
			{/each}
		</div>
	</section>
{:else if node.type === 'callout'}
	<div class="rounded-md px-3 py-2 text-sm {tones[p.tone as keyof typeof tones] ?? tones.info}">
		{#if p.title}<p class="font-medium">{p.title}</p>{/if}
		<p>{p.text}</p>
	</div>
{:else if node.type === 'text'}
	{#if p.variant === 'heading'}
		<h3 class="text-base font-semibold text-ink">{p.text}</h3>
	{:else if p.variant === 'caption'}
		<p class="text-xs text-muted">{p.text}</p>
	{:else}
		<p class="text-sm text-ink">{p.text}</p>
	{/if}
{:else if node.type === 'checklist'}
	<fieldset class="m-0 border-0 p-0" data-testid="ui-checklist">
		{#if p.title}
			<legend
				class="mb-2 flex w-full items-baseline justify-between text-sm font-semibold text-ink"
			>
				<span>{p.title}</span>
				<span class="text-xs font-normal text-muted">{checked.size}/{p.items.length}</span>
			</legend>
		{/if}
		<ul class="flex flex-col gap-1.5">
			{#each p.items as item (item.id)}
				<li>
					<label
						class="flex items-start gap-2.5 text-sm {readOnly ? 'opacity-70' : 'cursor-pointer'}"
					>
						<input
							type="checkbox"
							class="mt-0.5 h-4 w-4 accent-[var(--color-accent,currentColor)]"
							checked={checked.has(item.id)}
							disabled={readOnly}
							onchange={() => toggle(item.id)}
						/>
						<span class={checked.has(item.id) ? 'text-muted line-through' : 'text-ink'}>
							{item.label}
							{#if item.detail}<span class="block text-xs text-muted no-underline"
									>{item.detail}</span
								>{/if}
						</span>
					</label>
				</li>
			{/each}
		</ul>
	</fieldset>
{:else if node.type === 'text-field'}
	<label class="flex flex-col gap-1 text-sm text-ink">
		<span class="text-xs font-medium text-muted">{p.label}</span>
		{#if p.multiline}
			<textarea
				class="bg-surface rounded-md border border-line px-2.5 py-1.5"
				rows="3"
				placeholder={p.placeholder}
				disabled={readOnly}
				value={(stateValue as string | undefined) ?? ''}
				oninput={(e) => setField(e.currentTarget.value)}
			></textarea>
		{:else}
			<input
				type="text"
				class="bg-surface rounded-md border border-line px-2.5 py-1.5"
				placeholder={p.placeholder}
				disabled={readOnly}
				value={(stateValue as string | undefined) ?? ''}
				oninput={(e) => setField(e.currentTarget.value)}
			/>
		{/if}
	</label>
{:else if node.type === 'number-field'}
	<label class="flex flex-col gap-1 text-sm text-ink">
		<span class="text-xs font-medium text-muted">
			{p.label}{#if p.unit}&nbsp;({p.unit}){/if}
		</span>
		<input
			type="number"
			class="bg-surface rounded-md border border-line px-2.5 py-1.5"
			min={p.min}
			max={p.max}
			step={p.step}
			disabled={readOnly}
			value={(stateValue as number | null | undefined) ?? ''}
			oninput={(e) => {
				const raw = e.currentTarget.value;
				setField(raw === '' || !Number.isFinite(Number(raw)) ? null : Number(raw));
			}}
		/>
	</label>
{:else if node.type === 'select-field'}
	<label class="flex flex-col gap-1 text-sm text-ink">
		<span class="text-xs font-medium text-muted">{p.label}</span>
		<select
			class="bg-surface rounded-md border border-line px-2.5 py-1.5"
			disabled={readOnly}
			value={(stateValue as string | null | undefined) ?? ''}
			onchange={(e) => setField(e.currentTarget.value || null)}
		>
			<option value="">Select…</option>
			{#each p.options as option (option.value)}
				<option value={option.value}>{option.label}</option>
			{/each}
		</select>
	</label>
{:else if node.type === 'table'}
	<div class="overflow-x-auto rounded-lg ring-1 ring-line">
		<table class="w-full text-sm">
			<thead>
				<tr class="border-b border-line bg-surface-panel text-xs font-medium text-muted">
					{#each p.columns as col (col.key)}
						<th class="px-3 py-2 text-{col.align ?? 'left'}">{col.label}</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each p.rows as row, i (i)}
					<tr class="border-b border-line last:border-0">
						{#each p.columns as col (col.key)}
							<td class="px-3 py-2 text-ink text-{col.align ?? 'left'}">{row[col.key] ?? '-'}</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{:else if kind === 'block'}
	<GenUIBlockRenderer
		block={{ type: node.type, version: 1, data: node.props } as unknown as UIBlock}
		{onAction}
	/>
{:else}
	<div class="rounded-md border border-dashed border-line px-3 py-2 text-xs text-muted">
		This component is unavailable.
	</div>
{/if}
