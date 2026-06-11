import type { SupabaseClient } from '@supabase/supabase-js';
import { selectCanonicalWorkspace } from '$lib/server/workspaces/canonicalWorkspace';
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
		const {
			workspace: canonicalWorkspace,
			workspaces,
			error
		} = await selectCanonicalWorkspace<Workspace>(
			supabase,
			userId,
			'id, title, type, context_summary, last_accessed_at, created_at'
		);

		if (error) return null;
		const list = workspaces;
		if (!canonicalWorkspace) return { workspaces: [], workspace: null, messages: [] };

		const activeId = canonicalWorkspace.id;
		const [workspaceResult, messagesResult] = await Promise.all([
			supabase.from('workspaces').select('*').eq('id', activeId).eq('user_id', userId).single(),
			supabase
				.from('workspace_messages')
				.select('*')
				.eq('workspace_id', activeId)
				.order('created_at', { ascending: false })
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
			messages: [...(messagesResult.data ?? [])].reverse() as WorkspaceMessage[]
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

	const canUseChat = session && user && (ppiAccess || checkRole(role as UserRole, 'member'));
	const initialWorkspaceData = canUseChat
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
