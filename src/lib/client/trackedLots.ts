export type TrackedLotStateResponse = {
	catalogId: number;
	tracked: boolean;
	trackedAt: string | null;
	priceAtTracking: number | null;
};

export async function setTrackedLotState(
	fetcher: typeof fetch,
	catalogId: number,
	tracked: boolean
): Promise<TrackedLotStateResponse> {
	const response = await fetcher(`/api/catalog/${catalogId}/track`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ tracked })
	});
	if (!response.ok) {
		throw new Error(`Tracked-lot update failed with status ${response.status}`);
	}
	return (await response.json()) as TrackedLotStateResponse;
}
