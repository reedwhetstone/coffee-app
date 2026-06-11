import type { SupabaseClient } from '@supabase/supabase-js';

type WorkspaceRow = {
	id: string;
	last_accessed_at: string | null;
	created_at: string | null;
};

type WorkspaceActivity = {
	messageCount: number;
	latestMessageAt: string | null;
	lastActivityAt: string | null;
};

function maxTimestamp(...values: Array<string | null | undefined>): string | null {
	return (
		values
			.filter((value): value is string => Boolean(value))
			.sort()
			.at(-1) ?? null
	);
}

function compareDesc(left: string | null, right: string | null): number {
	if (left === right) return 0;
	if (left === null) return 1;
	if (right === null) return -1;
	return right.localeCompare(left);
}

export async function selectCanonicalWorkspace<T extends WorkspaceRow>(
	supabase: SupabaseClient,
	userId: string,
	selection: string
): Promise<{ workspace: T | null; workspaces: T[]; error: { message: string } | null }> {
	const { data: workspaces, error } = await supabase
		.from('workspaces')
		.select(selection)
		.eq('user_id', userId);

	if (error) return { workspace: null, workspaces: [], error };
	const workspaceList = (workspaces ?? []) as unknown as T[];
	if (workspaceList.length === 0) return { workspace: null, workspaces: [], error: null };
	if (workspaceList.length === 1) {
		return { workspace: workspaceList[0], workspaces: workspaceList, error: null };
	}

	const workspaceIds = workspaceList.map((workspace) => workspace.id);
	const { data: messages, error: messageError } = await supabase
		.from('workspace_messages')
		.select('workspace_id, created_at')
		.in('workspace_id', workspaceIds);

	if (messageError) return { workspace: null, workspaces: workspaceList, error: messageError };

	const activityByWorkspace = new Map<string, WorkspaceActivity>();
	for (const workspace of workspaceList) {
		activityByWorkspace.set(workspace.id, {
			messageCount: 0,
			latestMessageAt: null,
			lastActivityAt: maxTimestamp(workspace.last_accessed_at, workspace.created_at)
		});
	}

	for (const message of messages ?? []) {
		const activity = activityByWorkspace.get(message.workspace_id);
		if (!activity) continue;
		activity.messageCount += 1;
		activity.latestMessageAt = maxTimestamp(activity.latestMessageAt, message.created_at);
	}

	const sortedWorkspaces = [...workspaceList].sort((left, right) => {
		const leftActivity = activityByWorkspace.get(left.id)!;
		const rightActivity = activityByWorkspace.get(right.id)!;
		const messageCountDiff = rightActivity.messageCount - leftActivity.messageCount;
		if (messageCountDiff !== 0) return messageCountDiff;

		leftActivity.lastActivityAt = maxTimestamp(
			left.last_accessed_at,
			leftActivity.latestMessageAt,
			left.created_at
		);
		rightActivity.lastActivityAt = maxTimestamp(
			right.last_accessed_at,
			rightActivity.latestMessageAt,
			right.created_at
		);

		return (
			compareDesc(leftActivity.lastActivityAt, rightActivity.lastActivityAt) ||
			compareDesc(left.created_at, right.created_at) ||
			right.id.localeCompare(left.id)
		);
	});

	return { workspace: sortedWorkspaces[0], workspaces: sortedWorkspaces, error: null };
}
