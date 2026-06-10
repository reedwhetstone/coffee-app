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
	<header class="flex items-center justify-between border-b border-border-light px-4 py-4">
		<div>
			<p class="text-xs font-semibold uppercase tracking-[0.2em] text-text-secondary-light">
				Purveyors
			</p>
			<h2 class="mt-1 text-lg font-semibold text-text-primary-light" id="app-menu-dialog-title">
				App menu
			</h2>
		</div>
		<button
			type="button"
			onclick={onClose}
			class="rounded-full p-2 text-text-secondary-light transition-colors hover:bg-background-secondary-light hover:text-text-primary-light"
			aria-label="Close app menu"
		>
			<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="1.8"
					d="M6 18 18 6M6 6l12 12"
				></path>
			</svg>
		</button>
	</header>

	<div class="flex-1 overflow-y-auto px-4 pb-6 pt-4">
		<div class="space-y-6">
			<section class="rounded-2xl border border-border-light bg-background-secondary-light/60 p-4">
				<div class="flex items-start justify-between gap-4">
					<div>
						<p class="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary-light">
							Signed in
						</p>
						<p class="mt-1 text-sm font-medium text-text-primary-light">
							{userEmail || 'Purveyors member'}
						</p>
					</div>
					<button
						type="button"
						onclick={handleSignOut}
						class="rounded-full border border-border-light px-3 py-1.5 text-xs font-medium text-text-secondary-light transition-colors hover:border-red-300 hover:text-red-500"
					>
						Sign out
					</button>
				</div>

				<div class="mt-4 grid grid-cols-2 gap-2">
					<button
						type="button"
						onclick={() => navigateTo('/subscription')}
						class="rounded-xl bg-background-primary-light px-3 py-3 text-left text-sm font-medium text-text-primary-light ring-1 ring-border-light transition-colors hover:bg-background-secondary-light"
					>
						Subscription
					</button>
					<button
						type="button"
						onclick={() => navigateTo('/contact')}
						class="rounded-xl bg-background-primary-light px-3 py-3 text-left text-sm font-medium text-text-primary-light ring-1 ring-border-light transition-colors hover:bg-background-secondary-light"
					>
						Contact
					</button>
				</div>
			</section>

			{#if isMember}
				<section
					class="space-y-3 rounded-2xl border border-border-light bg-background-secondary-light/40 p-4"
				>
					<div class="flex items-center justify-between gap-3">
						<div>
							<h3 class="text-sm font-semibold text-text-primary-light">Coffee Chat</h3>
							<p class="mt-1 text-xs text-text-secondary-light">
								One continuous conversation that remembers your context.
							</p>
						</div>
						<button
							type="button"
							onclick={() => navigateTo('/chat')}
							class="rounded-full border border-border-light px-3 py-1.5 text-xs font-medium text-text-secondary-light transition-colors hover:text-text-primary-light"
						>
							Open Chat
						</button>
					</div>
				</section>
			{/if}

			{#each navSections as section (section.id)}
				<section class="space-y-3">
					<div>
						<h3 class="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary-light">
							{section.label}
						</h3>
					</div>
					<div class="space-y-2">
						{#each section.items as item (item.href)}
							<button
								type="button"
								onclick={() =>
									navigateTo(item.locked ? (item.upgradeHref ?? '/subscription') : item.href)}
								class="block w-full rounded-2xl border px-4 py-3 text-left transition-colors {isNavItemActive(
									item,
									pathname
								)
									? 'border-background-tertiary-light bg-background-tertiary-light/10 text-text-primary-light'
									: item.locked
										? 'border-border-light bg-background-secondary-light/40 text-text-secondary-light opacity-75'
										: 'border-border-light bg-background-secondary-light/50 text-text-primary-light hover:bg-background-secondary-light'}"
							>
								<div class="flex items-start justify-between gap-3">
									<div>
										<div class="flex items-center gap-2 text-sm font-medium">
											<span>{item.label}</span>
											{#if item.locked}<span aria-label="Locked">🔒</span>{/if}
										</div>
										{#if item.description}
											<p class="mt-1 text-xs text-text-secondary-light">{item.description}</p>
										{/if}
										{#if item.locked && item.lockedReason}
											<p class="mt-1 text-[11px] text-text-secondary-light">{item.lockedReason}</p>
										{/if}
									</div>
									<svg
										class="mt-0.5 h-4 w-4 shrink-0 text-text-secondary-light"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="1.8"
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
