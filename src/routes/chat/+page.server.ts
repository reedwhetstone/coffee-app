import type { SupabaseClient } from '@supabase/supabase-js';
import { checkRole, type UserRole } from '$lib/types/auth.types';
import type { Workspace, WorkspaceMessage } from '$lib/stores/workspaceStore.svelte';
import type { PageServerLoad } from './$types';

export interface InitialWorkspaceData {
	workspaces: Workspace[];
	workspace: Workspace | null;
	messages: WorkspaceMessage[];
}

/**
 * Prefetch the workspace list and the active conversation server-side so the
 * chat shell hydrates with history immediately, instead of running the
 * list-then-load fetch waterfall after mount.
 */
async function loadInitialWorkspaceData(
	supabase: SupabaseClient,
	userId: string
): Promise<InitialWorkspaceData | null> {
	try {
		const { data: workspaces, error } = await supabase
			.from('workspaces')
			.select('id, title, type, context_summary, last_accessed_at, created_at')
			.eq('user_id', userId)
			.order('last_accessed_at', { ascending: false });

		if (error) return null;
		const list = (workspaces ?? []) as Workspace[];
		if (list.length === 0) return { workspaces: [], workspace: null, messages: [] };

		const activeId = list[0].id;
		const [workspaceResult, messagesResult] = await Promise.all([
			supabase.from('workspaces').select('*').eq('id', activeId).eq('user_id', userId).single(),
			supabase
				.from('workspace_messages')
				.select('*')
				.eq('workspace_id', activeId)
				.order('created_at', { ascending: true })
				.limit(50)
		]);

		if (workspaceResult.error || !workspaceResult.data) {
			return { workspaces: list, workspace: null, messages: [] };
		}

		// Mirror GET /api/workspaces/[id]: touch last_accessed_at on open.
		await supabase
			.from('workspaces')
			.update({ last_accessed_at: new Date().toISOString() })
			.eq('id', activeId);

		return {
			workspaces: list,
			workspace: workspaceResult.data as Workspace,
			messages: (messagesResult.data ?? []) as WorkspaceMessage[]
		};
	} catch {
		// Prefetch is an optimization — the client fetch path still works.
		return null;
	}
}

export const load: PageServerLoad = async ({ locals }) => {
	// Get session and user data using the existing pattern from other routes
	const { session, user, role } = await locals.safeGetSession();
	const ppiAccess =
		locals.principal?.isAuthenticated === true ? locals.principal.ppiAccess === true : false;

	const initialWorkspaceData =
		session && user && checkRole(role as UserRole, 'member')
			? await loadInitialWorkspaceData(locals.supabase, user.id)
			: null;

	return {
		session,
		user,
		role,
		ppiAccess,
		initialWorkspaceData
	};
};
