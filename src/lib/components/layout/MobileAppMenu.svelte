<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { checkRole, type UserRole } from '$lib/types/auth.types';
	import {
		getAuthenticatedNavSections,
		isNavItemActive
	} from '$lib/components/layout/appNavigation';

	let { data, onClose = () => {} } = $props<{
		data: Record<string, unknown>;
		onClose?: () => void;
	}>();

	let pathname = $derived(page.url.pathname);
	let userRole = $derived(((data?.role as UserRole | undefined) ?? 'viewer') as UserRole);
	let userEmail = $derived(((data?.user as { email?: string } | undefined)?.email ?? '') as string);
	let supabase = $derived(
		(
			data as {
				supabase?: {
					auth: {
						signOut: () => Promise<{ error?: Error | null }>;
					};
				};
			}
		).supabase
	);
	let isMember = $derived(checkRole(userRole, 'member'));
	let ppiAccess = $derived(Boolean((data as { ppiAccess?: boolean }).ppiAccess));
	let navSections = $derived(getAuthenticatedNavSections(userRole, { ppiAccess }));

	async function navigateTo(href: string) {
		onClose();
		await goto(href);
	}

	async function handleSignOut() {
		try {
			if (!supabase) {
				window.location.href = '/';
				return;
			}

			const { error } = await supabase.auth.signOut();
			if (error) throw error;
			window.location.href = '/';
		} catch (error) {
			console.error('Error signing out:', error);
		}
	}
</script>

<div class="flex h-full flex-col">
	<header class="flex items-center justify-between border-b border-line px-4 py-4">
		<div>
			<p class="text-xs font-semibold text-muted">Purveyors</p>
			<h2 class="mt-1 text-lg font-semibold text-ink" id="app-menu-dialog-title">App menu</h2>
		</div>
		<button
			type="button"
			onclick={onClose}
			class="rounded-full p-2 text-muted transition-colors hover:bg-surface-panel hover:text-ink"
			aria-label="Close app menu"
		>
			<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="1.5"
					d="M6 18 18 6M6 6l12 12"
				></path>
			</svg>
		</button>
	</header>

	<div class="flex-1 overflow-y-auto px-4 pb-6 pt-4">
		<div class="space-y-6">
			<section class="rounded-xl border border-line bg-surface-panel/60 p-4">
				<div class="flex items-start justify-between gap-4">
					<div>
						<p class="text-xs font-semibold text-muted">Signed in</p>
						<p class="mt-1 text-sm font-medium text-ink">
							{userEmail || 'Purveyors member'}
						</p>
					</div>
					<button
						type="button"
						onclick={handleSignOut}
						class="rounded-full border border-line px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-danger/40 hover:text-danger"
					>
						Sign out
					</button>
				</div>

				<div class="mt-4 grid grid-cols-2 gap-2">
					<button
						type="button"
						onclick={() => navigateTo('/subscription')}
						class="rounded-md bg-surface-canvas px-3 py-3 text-left text-sm font-medium text-ink ring-1 ring-line transition-colors hover:bg-surface-panel"
					>
						Subscription
					</button>
					<button
						type="button"
						onclick={() => navigateTo('/contact')}
						class="rounded-md bg-surface-canvas px-3 py-3 text-left text-sm font-medium text-ink ring-1 ring-line transition-colors hover:bg-surface-panel"
					>
						Contact
					</button>
				</div>
			</section>

			{#if isMember}
				<section class="space-y-3 rounded-xl border border-line bg-surface-panel/40 p-4">
					<div class="flex items-center justify-between gap-3">
						<div>
							<h3 class="text-sm font-semibold text-ink">Coffee Chat</h3>
							<p class="mt-1 text-xs text-muted">
								One continuous conversation that remembers your context.
							</p>
						</div>
						<button
							type="button"
							onclick={() => navigateTo('/chat')}
							class="rounded-full border border-line px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:text-ink"
						>
							Open chat
						</button>
					</div>
				</section>
			{/if}

			{#each navSections as section (section.id)}
				<section class="space-y-3">
					<div>
						<h3 class="text-xs font-semibold text-muted">
							{section.label}
						</h3>
					</div>
					<div class="space-y-2">
						{#each section.items as item (item.href)}
							<button
								type="button"
								onclick={() =>
									navigateTo(item.locked ? (item.upgradeHref ?? '/subscription') : item.href)}
								class="block w-full rounded-xl border px-4 py-3 text-left transition-colors {isNavItemActive(
									item,
									pathname
								)
									? 'border-accent bg-accent/10 text-ink'
									: item.locked
										? 'border-line bg-surface-panel/40 text-muted opacity-75'
										: 'border-line bg-surface-panel/50 text-ink hover:bg-surface-panel'}"
							>
								<div class="flex items-start justify-between gap-3">
									<div>
										<div class="flex items-center gap-2 text-sm font-medium">
											<span>{item.label}</span>
											{#if item.locked}<svg
													class="h-3.5 w-3.5"
													fill="none"
													viewBox="0 0 24 24"
													stroke-width="1.5"
													stroke="currentColor"
													aria-label="Locked"
													role="img"
													><path
														stroke-linecap="round"
														stroke-linejoin="round"
														d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
													/></svg
												>{/if}
										</div>
										{#if item.description}
											<p class="mt-1 text-xs text-muted">{item.description}</p>
										{/if}
										{#if item.locked && item.lockedReason}
											<p class="mt-1 text-[11px] text-muted">{item.lockedReason}</p>
										{/if}
									</div>
									<svg
										class="mt-0.5 h-4 w-4 shrink-0 text-muted"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="1.5"
											d="m9 6 6 6-6 6"
										></path>
									</svg>
								</div>
							</button>
						{/each}
					</div>
				</section>
			{/each}
		</div>
	</div>
</div>
