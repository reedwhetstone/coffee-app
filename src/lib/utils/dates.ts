export function formatDateForDisplay(dateStr: string | null): string {
	if (!dateStr) return '';
	return new Date(dateStr).toLocaleDateString();
}

export function formatBlogDate(dateStr: string): string {
	const date = new Date(`${dateStr}T00:00:00.000Z`);
	return date.toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
		timeZone: 'UTC'
	});
}

export function formatDateForInput(dateStr: string | null): string {
	if (!dateStr) return '';
	return dateStr.split('T')[0];
}

export function prepareDateForAPI(dateStr: string): string {
	return dateStr.split('T')[0];
}
