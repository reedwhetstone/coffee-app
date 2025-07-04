export interface TastingNote {
	tag: string;
	color: string;
	score: number; // 1-5 scale
}

export interface TastingNotes {
	body: TastingNote;
	flavor: TastingNote;
	acidity: TastingNote;
	sweetness: TastingNote;
	fragrance_aroma: TastingNote;
}

export interface RadarDataPoint {
	axis: string;
	value: number;
	color: string;
	tag: string;
}
