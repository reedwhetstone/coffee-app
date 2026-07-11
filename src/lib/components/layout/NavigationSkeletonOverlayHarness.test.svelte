<script lang="ts">
	import NavigationSkeletonOverlay from './NavigationSkeletonOverlay.svelte';
	import RouteSkeleton from './RouteSkeleton.svelte';

	let { active }: { active: boolean } = $props();
</script>

<NavigationSkeletonOverlay {active} pathname="/catalog" Skeleton={RouteSkeleton} role="viewer">
	<label>
		Draft name
		<input />
	</label>
</NavigationSkeletonOverlay>
