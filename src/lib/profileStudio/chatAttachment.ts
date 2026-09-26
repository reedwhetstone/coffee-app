import type { ChatRequestContext } from '$lib/cherry/requestContext';

export interface ReferenceAttachment {
	id: string;
	title: string;
}

export interface ProfileStudioHandoff {
	leftKind: 'executed_roast' | 'reference_profile';
	leftId: string;
	rightKind: 'executed_roast' | 'reference_profile';
	rightId: string;
}

/** Visible request text plus identity context that only Cherry receives. */
export interface ProfileStudioChatRequest {
	text: string;
	context: ChatRequestContext;
}

export function buildReferenceAttachmentRequest(
	draft: string,
	attachment: ReferenceAttachment
): ProfileStudioChatRequest {
	return {
		text:
			draft.trim() ||
			'I attached an Artisan reference. What should I do next: leave it saved, compare it with another profile, or import it as an executed roast?',
		context: {
			text: `Attached Artisan reference: ${attachment.title}. Reference profile ID: ${attachment.id}. Treat it as a reference profile, not an executed roast.`,
			label: `${attachment.title} · saved reference`
		}
	};
}

function validId(kind: ProfileStudioHandoff['leftKind'], id: string | null): id is string {
	if (!id || id.length > 128) return false;
	return kind === 'executed_roast' ? /^\d+$/.test(id) : /^[a-zA-Z0-9_-]+$/.test(id);
}

export function readProfileStudioHandoff(
	searchParams: URLSearchParams
): ProfileStudioHandoff | null {
	if (searchParams.get('source') !== 'profile-studio') return null;
	const leftKind = searchParams.get('left_kind');
	const rightKind = searchParams.get('right_kind');
	const leftId = searchParams.get('left_id');
	const rightId = searchParams.get('right_id');
	if (
		(leftKind !== 'executed_roast' && leftKind !== 'reference_profile') ||
		(rightKind !== 'executed_roast' && rightKind !== 'reference_profile') ||
		!validId(leftKind, leftId) ||
		!validId(rightKind, rightId)
	)
		return null;
	return { leftKind, leftId, rightKind, rightId };
}

/** Keep opaque selected identities out of both the visible seed draft and the user message. */
export function buildProfileStudioHandoffRequest(
	draft: string,
	handoff: ProfileStudioHandoff
): ProfileStudioChatRequest {
	return {
		text: draft.trim() || 'Discuss this measured Profile Studio comparison.',
		context: {
			text: `Profile Studio selection context: left ${handoff.leftKind} ${handoff.leftId}; right ${handoff.rightKind} ${handoff.rightId}.`
		}
	};
}
