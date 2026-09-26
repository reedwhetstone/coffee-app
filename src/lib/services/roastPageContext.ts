import type { RoastProfile } from '$lib/types/component.types';
import type { PageChatContext } from '$lib/stores/pageContextStore.svelte';

export function buildRoastPageContext(
	visible: RoastProfile[],
	selected: RoastProfile | null,
	isLoading: boolean
): PageChatContext {
	const inView = [selected, ...visible]
		.filter((profile): profile is RoastProfile => Boolean(profile?.roast_id))
		.filter(
			(profile, index, profiles) =>
				profiles.findIndex((candidate) => candidate.roast_id === profile.roast_id) === index
		)
		.slice(0, 8);
	return {
		surface: 'roast',
		summary: selected
			? `Roast workspace: ${visible.length} profiles in view. Selected roast #${selected.roast_id}: ${selected.batch_name ?? 'Untitled batch'} (${selected.coffee_name ?? 'Unknown coffee'}). Use inspect_current_page to read canonical roast details before analysis.`
			: `Roast workspace: ${isLoading ? 'loading profiles' : `${visible.length} profiles in view`}. No roast selected.`,
		entities: inView.map((profile) => ({
			type: 'roast',
			id: profile.roast_id,
			label: `${profile.batch_name ?? 'Untitled batch'} · ${profile.coffee_name ?? 'Unknown coffee'}`
		}))
	};
}
