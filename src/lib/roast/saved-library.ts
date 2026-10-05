import { referenceFileHref } from './artisan-download';
import { parseCompareSide } from './compare-sides';
import { referenceOption, type ProfileOption } from './profile-picker-model';
import { canPlanFromReference, planDownloadHref, type SavedReference } from './roast-plan';

/** The link to the saved library, with one reference's curve open when `openId` is given. */
export function savedHref(openId?: string | null): string {
	return openId ? `/roast/saved?ref=${openId}` : '/roast/saved';
}

/** The saved reference whose curve a `/roast/saved?ref=<uuid>` link opens. */
export function readOpenReference(searchParams: URLSearchParams): string | null {
	const side = parseCompareSide(`ref:${searchParams.get('ref')?.trim() ?? ''}`);
	return side?.type === 'ref' ? side.id : null;
}

/** One saved reference or plan as the library lists it. */
export interface LibraryRow {
	id: string;
	profile: SavedReference;
	/** Its name, and its source and date: "Artisan file · Saved Sep 28, 2026". */
	option: ProfileOption;
	isPlan: boolean;
	/** A plan can be built on it: it still has a file Artisan can read. */
	canPlan: boolean;
	/** Only a file the member uploaded can be recorded as a roast they ran. */
	canRecordAsRoast: boolean;
	/** A plan downloads its own file; a reference downloads the file it was added from. */
	downloadHref: string;
}

/** Every saved reference and plan, newest first; the name breaks ties. */
export function libraryRows(profiles: SavedReference[]): LibraryRow[] {
	return [...profiles]
		.sort(
			(left, right) =>
				Date.parse(right.createdAt) - Date.parse(left.createdAt) ||
				left.title.localeCompare(right.title)
		)
		.map((profile) => {
			const isPlan = profile.sourceClass === 'generated_revision';
			return {
				id: profile.id,
				profile,
				option: referenceOption(profile),
				isPlan,
				canPlan: canPlanFromReference(profile),
				canRecordAsRoast: profile.sourceClass === 'artisan_upload' && profile.artisanFileAvailable,
				downloadHref: isPlan ? planDownloadHref(profile) : referenceFileHref(profile.id)
			};
		});
}

/** The name an uploaded file is saved under when the member has not typed one. */
export function referenceNameFromFile(fileName: string): string {
	return (
		fileName
			.replace(/\.(alog\.json|alog|json)$/i, '')
			.replace(/[_\s]+/g, ' ')
			.trim()
			.slice(0, 120) || 'Artisan reference'
	);
}
