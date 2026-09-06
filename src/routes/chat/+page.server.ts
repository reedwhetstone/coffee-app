import { checkRole, type UserRole } from '$lib/types/auth.types';
import type { Workspace, WorkspaceMessage } from '$lib/stores/workspaceStore.svelte';
import { getPageAuthState } from '$lib/server/pageAuth';
import { createParchmentServerClient } from '$lib/server/parchmentClient';
import {
	getConversationWorkspace,
	getOrCreateConversationWorkspace
} from '$lib/server/parchmentConversation';
import type { PageServerLoad } from './$types';

export interface InitialWorkspaceData {
	workspaces: Workspace[];
	workspace: Workspace | null;
	messages: WorkspaceMessage[];
}

async function loadInitialWorkspaceData(
	event: Parameters<PageServerLoad>[0]
): Promise<InitialWorkspaceData | null> {
	try {
		const client = await createParchmentServerClient(event, { mode: 'session' });
		const canonical = (await getOrCreateConversationWorkspace(client, {
			title: 'Coffee',
			type: 'general'
		})) as Workspace;
		const state = await getConversationWorkspace(client, canonical.id, 50);
		return {
			workspaces: [state.workspace as Workspace],
			workspace: state.workspace as Workspace,
			messages: state.messages as WorkspaceMessage[]
		};
	} catch {
		return null;
	}
}

export const load: PageServerLoad = async (event) => {
	const { session, user, role } = getPageAuthState(event.locals.principal);
	const ppiAccess = event.locals.principal.isAuthenticated
		? event.locals.principal.ppiAccess === true
		: false;
	const canUseChat = session && user && (ppiAccess || checkRole(role as UserRole, 'member'));
	return {
		initialWorkspaceData: canUseChat ? await loadInitialWorkspaceData(event) : null
	};
};
