export interface InlineSegment {
	text: string;
	code: boolean;
}

/** Split docs text on `backtick` spans so HTML can render them as inline code. */
export function splitInlineCode(text: string): InlineSegment[] {
	const parts = text.split('`');
	// An unmatched backtick leaves an even number of parts; keep that text literal.
	if (parts.length % 2 === 0) return [{ text, code: false }];
	return parts
		.map((part, index) => ({ text: part, code: index % 2 === 1 }))
		.filter((segment) => segment.text.length > 0);
}
