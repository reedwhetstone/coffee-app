export interface ReferenceAttachment {
	id: string;
	title: string;
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
