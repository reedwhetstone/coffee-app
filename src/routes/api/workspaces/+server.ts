import { json } from '@sveltejs/kit';
import { requireChatAccess } from '$lib/server/auth';
import type { RequestHandler } from './$types';

type WorkspaceRow = {
	id: string;
	title: string | null;
	type: string | null;
	context_summary: string | null;
	canvas_state?: unknown;
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

async function selectCanonicalWorkspace(
	supabase: App.Locals['supabase'],
	userId: string,
	selection: string
) {
	const { data: workspaces, error } = await supabase
		.from('workspaces')
		.select(selection)
		.eq('user_id', userId);

	if (error) return { workspace: null, error };
	if (!workspaces || workspaces.length === 0) return { workspace: null, error: null };
	if (workspaces.length === 1) return { workspace: workspaces[0], error: null };

	const workspaceIds = workspaces.map((workspace) => workspace.id);
	const { data: messages, error: messageError } = await supabase
		.from('workspace_messages')
		.select('workspace_id, created_at')
		.in('workspace_id', workspaceIds);

	if (messageError) return { workspace: null, error: messageError };

	const activityByWorkspace = new Map<string, WorkspaceActivity>();
	for (const workspace of workspaces as WorkspaceRow[]) {
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

	return {
		workspace: [...(workspaces as WorkspaceRow[])].sort((left, right) => {
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
		})[0],
		error: null
	};
}

// GET /api/workspaces - List user's workspaces
export const GET: RequestHandler = async (event) => {
	try {
		const { user } = await requireChatAccess(event);

		const { data, error } = await event.locals.supabase
			.from('workspaces')
			.select('id, title, type, context_summary, last_accessed_at, created_at')
			.eq('user_id', user.id)
			.order('last_accessed_at', { ascending: false })
			.limit(1);

		if (error) {
			return json({ error: error.message }, { status: 500 });
		}

		return json({ workspaces: data || [] });
	} catch (err) {
		const status = (err as { status?: number }).status || 500;
		return json({ error: (err as Error).message }, { status });
	}
};

// POST /api/workspaces - Get or create the user's single chat workspace
export const POST: RequestHandler = async (event) => {
	try {
		const { user } = await requireChatAccess(event);
		const body = await event.request.json().catch(() => ({}));
		const selection =
			'id, title, type, context_summary, canvas_state, last_accessed_at, created_at';

		const { workspace: existing, error: existingError } = await selectCanonicalWorkspace(
			event.locals.supabase,
			user.id,
			selection
		);

		if (existingError) {
			return json({ error: existingError.message }, { status: 500 });
		}

		if (existing) {
			return json({ workspace: existing });
		}

		const { data, error } = await event.locals.supabase
			.from('workspaces')
			.insert({
				user_id: user.id,
				title: body.title || 'Coffee',
				type: body.type || 'general'
			})
			.select(selection)
			.single();

		if (error) {
			// Race-safe fallback for the one-workspace-per-user constraint.
			if (error.code === '23505') {
				const { workspace: racedExisting, error: racedError } = await selectCanonicalWorkspace(
					event.locals.supabase,
					user.id,
					selection
				);
				if (racedError) return json({ error: racedError.message }, { status: 500 });
				if (racedExisting) return json({ workspace: racedExisting });
			}
			return json({ error: error.message }, { status: 500 });
		}

		return json({ workspace: data }, { status: 201 });
	} catch (err) {
		const status = (err as { status?: number }).status || 500;
		return json({ error: (err as Error).message }, { status });
	}
};
