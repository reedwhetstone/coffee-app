<script lang="ts">
	import NavigationSkeletonOverlay from './NavigationSkeletonOverlay.svelte';
	import RouteSkeleton from './RouteSkeleton.svelte';
	import { resolveLayoutShell } from './layoutShell';

	let {
		committedPathname,
		destinationPathname = null,
		active = false
	}: {
		committedPathname: string;
		destinationPathname?: string | null;
		active?: boolean;
	} = $props();

	let shell = $derived(resolveLayoutShell(committedPathname, true));
</script>

{#if shell === 'marketing'}
	<div data-testid="marketing-shell">Marketing</div>
{:else if shell === 'app'}
	<div data-testid="app-shell">
		<NavigationSkeletonOverlay
			{active}
			pathname={destinationPathname}
			Skeleton={RouteSkeleton}
			role="member"
			authenticated
		>
			<label>
				Draft roast
				<input />
			</label>
		</NavigationSkeletonOverlay>
	</div>
{:else}
	<div data-testid="public-shell">Public</div>
{/if}
