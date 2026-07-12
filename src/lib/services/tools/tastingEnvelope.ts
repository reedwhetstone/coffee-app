import type { components } from '@purveyors/sdk';

type TastingData = components['schemas']['TastingData'];
export type TastingFilter = 'user' | 'supplier' | 'both';

/** Preserve the app-owned chat/canvas contract while reading canonical data through the SDK. */
export function toLegacyTastingEnvelope(
	data: TastingData,
	filter: TastingFilter,
	includeRadarData: boolean
) {
	const supplier = data.supplier;
	if (!supplier) {
		throw Object.assign(new Error(`No coffee found with bean_id: ${data.beanId}`), { status: 404 });
	}
	const user = data.user;
	const aiNotes = supplier.ai_tasting_notes;
	let radarData: Record<string, number> | undefined;
	if (includeRadarData && aiNotes) {
		try {
			const parsed = typeof aiNotes === 'string' ? JSON.parse(aiNotes) : aiNotes;
			if (parsed && typeof parsed === 'object') {
				const scores = parsed as Record<string, unknown>;
				radarData = Object.fromEntries(
					['body', 'flavor', 'acidity', 'sweetness', 'fragrance_aroma'].map((key) => [
						key,
						typeof scores[key] === 'number' ? scores[key] : 0
					])
				);
			}
		} catch {
			// Preserve the legacy behavior: malformed AI notes omit radar data.
		}
	}

	const userNotes = user ? { notes: user.notes, cupping_notes: user.cupping_notes } : null;
	const tastingNotes: Record<string, unknown> = {
		ai_notes: {
			description: supplier.ai_description ?? null,
			tasting_notes: supplier.ai_tasting_notes ?? null
		}
	};
	if (filter === 'user' || filter === 'both') tastingNotes.user_notes = userNotes;
	if (filter === 'supplier' || filter === 'both') {
		tastingNotes.supplier_notes = {
			cupping_notes: supplier.cupping_notes ?? null,
			source: supplier.sourceName ?? null
		};
	}
	if (filter === 'both') {
		const descriptions = [supplier.ai_description, supplier.cupping_notes, user?.notes].filter(
			(value): value is string => typeof value === 'string' && value.length > 0
		);
		tastingNotes.combined_notes = {
			descriptions,
			sources: ['AI Analysis', 'Supplier Notes', 'Your Notes'].slice(0, descriptions.length)
		};
	}

	let message = `Tasting notes for ${supplier.name ?? `coffee #${data.beanId}`}`;
	if (user && (filter === 'user' || filter === 'both'))
		message += ' (including your personal notes)';
	else if (filter === 'user') message += ' (you have not added this coffee to your inventory yet)';

	return {
		bean_info: {
			id: data.beanId,
			name: supplier.name ?? null,
			processing: supplier.processing ?? null,
			region: supplier.region ?? null,
			source: supplier.sourceName ?? null
		},
		tasting_notes: tastingNotes,
		radar_data: radarData,
		filter_applied: filter,
		message
	};
}
