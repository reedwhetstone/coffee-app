import { OPENAI_API_KEY } from '$env/static/private';

interface CoffeeData {
	id: number;
	name: string;
	cupping_notes?: string;
	description_short?: string;
	description_long?: string;
	farm_notes?: string;
	region?: string;
	processing?: string;
	cultivar_detail?: string;
	score_value?: number;
}

export class EmbeddingService {
	private openaiApiKey: string;

	constructor(apiKey: string) {
		this.openaiApiKey = apiKey;
	}

	/**
	 * Create a rich text representation for embedding
	 */
	private createEmbeddingText(coffee: CoffeeData): string {
		const parts = [
			`Coffee: ${coffee.name}`,
			coffee.region && `Region: ${coffee.region}`,
			coffee.processing && `Processing: ${coffee.processing}`,
			coffee.cultivar_detail && `Variety: ${coffee.cultivar_detail}`,
			coffee.score_value && `Score: ${coffee.score_value}`,
			coffee.cupping_notes && `Cupping Notes: ${coffee.cupping_notes}`,
			coffee.description_short && `Description: ${coffee.description_short}`,
			coffee.description_long && `Details: ${coffee.description_long}`,
			coffee.farm_notes && `Farm Notes: ${coffee.farm_notes}`
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
