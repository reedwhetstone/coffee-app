import { OPENAI_API_KEY } from '$env/static/private';

interface CoffeeData {
	id: number;
	name: string;
	score_value?: number;
	arrival_date?: string;
	region?: string;
	processing?: string;
	drying_method?: string;
	roast_recs?: string;
	lot_size?: string;
	bag_size?: string;
	packaging?: string;
	cultivar_detail?: string;
	grade?: string;
	appearance?: string;
	description_short?: string;
	farm_notes?: string;
	type?: string;
	description_long?: string;
	link?: string;
	cost_lb?: number;
	last_updated?: string;
	source?: string;
	stocked?: boolean;
	cupping_notes?: string;
	unstocked_date?: string;
	stocked_date?: string;
	// Note: embedding column excluded as it's the output, not input
}

export class EmbeddingService {
	private openaiApiKey: string;

	constructor(apiKey: string) {
		this.openaiApiKey = apiKey;
	}

	/**
	 * Create a rich text representation for embedding
	 * Includes all relevant coffee data for comprehensive semantic search
	 */
	private createEmbeddingText(coffee: CoffeeData): string {
		const parts = [
			// Core identification
			`Coffee: ${coffee.name}`,
			coffee.type && `Type: ${coffee.type}`,

			// Origin and processing
			coffee.region && `Region: ${coffee.region}`,
			coffee.processing && `Processing: ${coffee.processing}`,
			coffee.drying_method && `Drying Method: ${coffee.drying_method}`,
			coffee.cultivar_detail && `Variety: ${coffee.cultivar_detail}`,

			// Quality and characteristics
			coffee.score_value && `Score: ${coffee.score_value}`,
			coffee.grade && `Grade: ${coffee.grade}`,
			coffee.appearance && `Appearance: ${coffee.appearance}`,

			// Flavor and tasting notes
			coffee.cupping_notes && `Cupping Notes: ${coffee.cupping_notes}`,
			coffee.description_short && `Description: ${coffee.description_short}`,
			coffee.description_long && `Details: ${coffee.description_long}`,
			coffee.roast_recs && `Roast Recommendations: ${coffee.roast_recs}`,

			// Farm and sourcing
			coffee.farm_notes && `Farm Notes: ${coffee.farm_notes}`,
			coffee.source && `Source: ${coffee.source}`,

			// Commercial details
			coffee.lot_size && `Lot Size: ${coffee.lot_size}`,
			coffee.bag_size && `Bag Size: ${coffee.bag_size}`,
			coffee.packaging && `Packaging: ${coffee.packaging}`,
			coffee.cost_lb && `Cost per lb: $${coffee.cost_lb}`,

			// Availability
			coffee.stocked !== undefined && `Stocked: ${coffee.stocked ? 'Yes' : 'No'}`,
			coffee.arrival_date && `Arrival Date: ${coffee.arrival_date}`,
			coffee.stocked_date && `Stocked Date: ${coffee.stocked_date}`,
			coffee.unstocked_date && `Unstocked Date: ${coffee.unstocked_date}`,
			coffee.last_updated && `Last Updated: ${coffee.last_updated}`
		].filter(Boolean);

		return parts.join('. ');
	}

	/**
	 * Generate embedding for a single coffee
	 */
	async generateEmbedding(coffee: CoffeeData): Promise<number[]> {
		const text = this.createEmbeddingText(coffee);

		const response = await fetch('https://api.openai.com/v1/embeddings', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${this.openaiApiKey}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				input: text,
				model: 'text-embedding-3-small'
			})
		});

		if (!response.ok) {
			throw new Error(`OpenAI API error: ${response.statusText}`);
		}

		const data = await response.json();
		return data.data[0].embedding;
	}

	/**
	 * Generate embedding for user query
	 */
	async generateQueryEmbedding(query: string): Promise<number[]> {
		const response = await fetch('https://api.openai.com/v1/embeddings', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${this.openaiApiKey}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				input: query,
				model: 'text-embedding-3-small'
			})
		});

		if (!response.ok) {
			throw new Error(`OpenAI API error: ${response.statusText}`);
		}

		const data = await response.json();
		return data.data[0].embedding;
	}
}
