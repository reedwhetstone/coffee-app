<script lang="ts">
	import type { Component, Snippet } from 'svelte';
	import type { UserRole } from '$lib/types/auth.types';

	type RouteSkeletonProps = {
		pathname?: string | null;
		isParchmentIntelligence?: boolean;
		authenticated?: boolean;
		role?: UserRole;
	};

	let {
		active,
		pathname,
		Skeleton,
		isParchmentIntelligence = false,
		authenticated = false,
		role,
		overlayClass = '',
		skeletonClass = '',
		children
	} = $props<{
		active: boolean;
		pathname: string | null;
		Skeleton: Component<RouteSkeletonProps> | null;
		isParchmentIntelligence?: boolean;
		authenticated?: boolean;
		role?: UserRole;
		overlayClass?: string;
		skeletonClass?: string;
		children: Snippet;
	}>();
</script>

<!-- Keep the source route mounted so delayed navigation never destroys form or local state. -->
<div aria-hidden={active} inert={active || undefined} data-testid="navigation-source-route">
	{@render children()}
</div>

{#if active && Skeleton}
	<div
		class="fixed inset-0 z-40 overflow-auto bg-surface-canvas {overlayClass}"
		role="status"
		aria-live="polite"
		data-testid="navigation-skeleton-overlay"
	>
		<span class="sr-only">Loading destination page</span>
		<div class={skeletonClass} aria-hidden="true">
			<Skeleton {pathname} {isParchmentIntelligence} {authenticated} {role} />
		</div>
	</div>
{/if}
