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

export function buildReferenceAttachmentPrompt(
	draft: string,
	attachment: ReferenceAttachment
): string {
	return [
		draft.trim() || 'Compare this Artisan reference and help me decide what to preserve or change.',
		`Attached Artisan reference: ${attachment.title}. Reference profile ID: ${attachment.id}. Treat it as a reference profile, not an executed roast.`
	].join('\n\n');
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

/** Add opaque selected identities to the transport message, never to the visible seed draft. */
export function buildProfileStudioHandoffPrompt(
	draft: string,
	handoff: ProfileStudioHandoff
): string {
	return [
		draft.trim() || 'Discuss this measured Profile Studio comparison.',
		'',
		`Profile Studio selection context: left ${handoff.leftKind} ${handoff.leftId}; right ${handoff.rightKind} ${handoff.rightId}.`
	].join('\n');
}
