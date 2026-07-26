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

type MutationEntry = {
	confirmed: boolean;
	desired: boolean;
	generation: number;
	run: Promise<void> | null;
};

export type TrackedLotStateController = {
	setDesiredState(catalogId: number, currentState: boolean, desiredState: boolean): Promise<void>;
};

export function createTrackedLotStateController(
	fetcher: typeof fetch,
	applyState: (catalogId: number, tracked: boolean) => void
): TrackedLotStateController {
	const mutations = new Map<number, MutationEntry>();

	async function drain(catalogId: number, entry: MutationEntry): Promise<void> {
		while (mutations.get(catalogId) === entry) {
			const generation = entry.generation;
			const desired = entry.desired;

			try {
				const response = await setTrackedLotState(fetcher, catalogId, desired);
				entry.confirmed = response.tracked;

				if (entry.generation === generation) {
					applyState(catalogId, response.tracked);
					mutations.delete(catalogId);
					return;
				}
			} catch {
				if (entry.generation === generation) {
					applyState(catalogId, entry.confirmed);
					mutations.delete(catalogId);
					return;
				}
			}
		}
	}

	return {
		setDesiredState(catalogId, currentState, desiredState) {
			let entry = mutations.get(catalogId);
			if (!entry) {
				entry = {
					confirmed: currentState,
					desired: desiredState,
					generation: 0,
					run: null
				};
				mutations.set(catalogId, entry);
			}

			entry.desired = desiredState;
			entry.generation += 1;
			applyState(catalogId, desiredState);

			entry.run ??= drain(catalogId, entry);
			return entry.run;
		}
	};
}
