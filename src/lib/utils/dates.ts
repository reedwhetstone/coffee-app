export function formatDateForDisplay(dateStr: string | null): string {
	if (!dateStr) return '';
	return new Date(dateStr).toLocaleDateString();
}

export function formatDateForInput(dateStr: string | null): string {
	if (!dateStr) return '';
	return dateStr.split('T')[0];
}

export function prepareDateForAPI(dateStr: string): string {
	return dateStr.split('T')[0];
}
