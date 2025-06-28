// Note: OPENAI_API_KEY is passed via constructor parameter

interface CoffeeChunk {
	id: string;
	coffee_id: number;
	chunk_type: 'profile' | 'tasting' | 'origin' | 'commercial' | 'processing';
	content: string;
	metadata: Record<string, any>;
	embedding?: number[];
}

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
	source?: string;
	cupping_notes?: string;
	stocked_date?: string;
	stocked?: boolean;
}

export class EnhancedEmbeddingService {
	private openaiApiKey: string;

	constructor(apiKey: string) {
		this.openaiApiKey = apiKey;
	}

	/**
	 * Create semantic chunks with metadata for better RAG retrieval
	 */
	createSemanticChunks(coffee: CoffeeData): CoffeeChunk[] {
		const chunks: CoffeeChunk[] = [];

		// 1. PROFILE CHUNK - Core identification and quality (SUPPLIER NAME FIRST)
		const profileContent = [
			`${coffee.source} - Coffee: ${coffee.name}`,
			coffee.score_value && `Quality Score: ${coffee.score_value}`,
			coffee.grade && `Grade: ${coffee.grade}`,
			coffee.appearance && `Appearance: ${coffee.appearance}`,
			coffee.type && `Type: ${coffee.type}`,
			coffee.source && `Supplier: ${coffee.source}`
		]
			.filter(Boolean)
			.join('. ');

		if (profileContent.length > coffee.name.length + 10) {
			// Only create if has content beyond name
			chunks.push({
				id: `${coffee.id}_profile`,
				coffee_id: coffee.id,
				chunk_type: 'profile',
				content: profileContent,
				metadata: {
					name: coffee.name,
					source: coffee.source,
					score: coffee.score_value,
					grade: coffee.grade,
					stocked: coffee.stocked,
					arrival_date: coffee.arrival_date
				}
			});
		}

		// 2. TASTING CHUNK - Flavor profile and cupping notes (SUPPLIER PROMINENT)
		const tastingContent = [
			coffee.cupping_notes && `Cupping Notes: ${coffee.cupping_notes}`,
			coffee.description_short && `Description: ${coffee.description_short}`,
			coffee.description_long && `Detailed Description: ${coffee.description_long}`,
			coffee.roast_recs && `Roast Recommendations: ${coffee.roast_recs}`
		]
			.filter(Boolean)
			.join('. ');

		if (tastingContent) {
			chunks.push({
				id: `${coffee.id}_tasting`,
				coffee_id: coffee.id,
				chunk_type: 'tasting',
				content: `${coffee.source} - ${coffee.name} - ${tastingContent}`,
				metadata: {
					name: coffee.name,
					source: coffee.source,
					score: coffee.score_value,
					stocked: coffee.stocked,
					has_cupping_notes: !!coffee.cupping_notes,
					has_roast_recs: !!coffee.roast_recs
				}
			});
		}

		// 3. ORIGIN CHUNK - Geographic and farm information (SUPPLIER PROMINENT)
		const originContent = [
			coffee.region && `Region: ${coffee.region}`,
			coffee.cultivar_detail && `Variety: ${coffee.cultivar_detail}`,
			coffee.farm_notes && `Farm Notes: ${coffee.farm_notes}`,
			coffee.source && `Source: ${coffee.source}`
		]
			.filter(Boolean)
			.join('. ');

		if (originContent) {
			chunks.push({
				id: `${coffee.id}_origin`,
				coffee_id: coffee.id,
				chunk_type: 'origin',
				content: `${coffee.source} - ${coffee.name} - ${originContent}`,
				metadata: {
					name: coffee.name,
					source: coffee.source,
					region: coffee.region,
					cultivar: coffee.cultivar_detail,
					stocked: coffee.stocked
				}
			});
		}

		// 4. PROCESSING CHUNK - Processing methods and preparation (SUPPLIER PROMINENT)
		const processingContent = [
			coffee.processing && `Processing: ${coffee.processing}`,
			coffee.drying_method && `Drying Method: ${coffee.drying_method}`,
			coffee.packaging && `Packaging: ${coffee.packaging}`
		]
			.filter(Boolean)
			.join('. ');

		if (processingContent) {
			chunks.push({
				id: `${coffee.id}_processing`,
				coffee_id: coffee.id,
				chunk_type: 'processing',
				content: `${coffee.source} - ${coffee.name} - ${processingContent}`,
				metadata: {
					name: coffee.name,
					source: coffee.source,
					processing: coffee.processing,
					drying_method: coffee.drying_method,
					stocked: coffee.stocked
				}
			});
		}

		// 5. COMMERCIAL CHUNK - Pricing and availability (SUPPLIER MOST PROMINENT)
		const commercialContent = [
			coffee.cost_lb && `Cost per lb: $${coffee.cost_lb}`,
			coffee.lot_size && `Lot Size: ${coffee.lot_size}`,
			coffee.bag_size && `Bag Size: ${coffee.bag_size}`,
			coffee.arrival_date && `Arrival Date: ${coffee.arrival_date}`,
			coffee.stocked_date && `Stocked Date: ${coffee.stocked_date}`
		]
			.filter(Boolean)
			.join('. ');

		if (commercialContent) {
			chunks.push({
				id: `${coffee.id}_commercial`,
				coffee_id: coffee.id,
				chunk_type: 'commercial',
				content: `${coffee.source} - ${coffee.name} - Supplier: ${coffee.source} - ${commercialContent}`,
				metadata: {
					name: coffee.name,
					source: coffee.source,
					cost_lb: coffee.cost_lb,
					lot_size: coffee.lot_size,
					stocked: coffee.stocked,
					arrival_date: coffee.arrival_date
				}
			});
		}

		return chunks;
	}

	/**
	 * Generate embeddings for all chunks with rate limiting
	 */
	async generateChunkEmbeddings(chunks: CoffeeChunk[]): Promise<CoffeeChunk[]> {
		const chunksWithEmbeddings: CoffeeChunk[] = [];
		
		for (let i = 0; i < chunks.length; i++) {
			const chunk = chunks[i];
			try {
				const embedding = await this.generateEmbedding(chunk.content);
				chunksWithEmbeddings.push({
					...chunk,
					embedding
				});
				
				// Rate limiting - wait 100ms between requests
				if (i < chunks.length - 1) {
					await new Promise(resolve => setTimeout(resolve, 100));
				}
			} catch (error) {
				console.error(`Failed to generate embedding for chunk ${chunk.id}:`, error);
				// Continue with other chunks even if one fails
			}
		}
		
		return chunksWithEmbeddings;
	}

	/**
	 * Generate embedding for text
	 */
	/**
	 * Generate embedding for user query
	 */
	async generateQueryEmbedding(query: string): Promise<number[]> {
		return this.generateEmbedding(query);
	}

	private async generateEmbedding(text: string): Promise<number[]> {
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
}
