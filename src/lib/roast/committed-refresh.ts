export const COMMITTED_REFRESH_WARNING =
	'Roast profile created successfully, but the latest data could not be loaded.';

/** Preserve committed POST success even when the read-after-write refresh fails. */
export async function refreshAfterCommittedCreate(
	roastId: number,
	reloadProfile: (roastId: number) => Promise<unknown>
): Promise<string | null> {
	try {
		const reloadedProfile = await reloadProfile(roastId);
		if (!reloadedProfile) throw new Error('Created profile was not present in refreshed data');
		return null;
	} catch (error) {
		console.error('Roast profile created, but refresh failed:', error);
		return COMMITTED_REFRESH_WARNING;
	}
}
