export interface TastingNote {
	tag: string;
	color: string;
	score: number; // 1-5 scale
}

export type BrewMethod =
	| 'espresso'
	| 'pour_over'
	| 'french_press'
	| 'aeropress'
	| 'drip'
	| 'cold_brew'
	| 'moka_pot'
	| 'siphon'
	| 'cupping'
	| 'other';

export interface TastingNotes {
	body: TastingNote;
	flavor: TastingNote;
	acidity: TastingNote;
	sweetness: TastingNote;
	fragrance_aroma: TastingNote;
	brew_method?: BrewMethod; // Optional: the brew method used for this cupping
}

export interface RadarDataPoint {
	axis: string;
	value: number;
	color: string;
	tag: string;
}
