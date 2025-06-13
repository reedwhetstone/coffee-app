import type { SupabaseClient } from '@supabase/supabase-js';
import { EmbeddingService } from './embeddingService';

interface RetrievalResult {
	currentInventory: any[];
}

export class RAGService {
	private supabase: SupabaseClient;
	private embeddingService: EmbeddingService;

	constructor(supabase: SupabaseClient, openaiApiKey: string) {
		this.supabase = supabase;
		this.embeddingService = new EmbeddingService(openaiApiKey);
	}

	/**
	 * Remove embedding from coffee data to avoid sending large vectors to LLM
	 */
	private cleanCoffeeData(coffees: any[]): any[] {
		return coffees.map(({ embedding, ...coffee }) => coffee);
	}

	/**
	 * Retrieve relevant coffee data using semantic search
	 */
	async retrieveRelevantCoffees(
		query: string,
		options: {
			maxCurrentInventory?: number;
			similarityThreshold?: number;
		} = {}
	): Promise<RetrievalResult> {
		const { maxCurrentInventory = 10, similarityThreshold = 0.7 } = options;

		// Generate embedding for the user query
		const queryEmbedding = await this.embeddingService.generateQueryEmbedding(query);

		// Debug: Check database state first
		const { data: dbStats } = await this.supabase
			.from('coffee_catalog')
			.select('id, stocked, embedding')
			.limit(1000);

		console.log('Database stats:', {
			total: dbStats?.length || 0,
			stocked: dbStats?.filter((c) => c.stocked).length || 0,
			withEmbeddings: dbStats?.filter((c) => c.embedding).length || 0,
			stockedWithEmbeddings: dbStats?.filter((c) => c.stocked && c.embedding).length || 0
		});

		// Search current inventory (stocked items) with similarity search
		const { data: currentInventory, error: currentError } = await this.supabase.rpc(
			'match_coffee_current_inventory',
			{
				query_embedding: queryEmbedding,
				match_threshold: similarityThreshold,
				match_count: maxCurrentInventory
			}
		);

		console.log('Current inventory search result:', {
			data: currentInventory?.length || 0,
			error: currentError,
			threshold: similarityThreshold
		});

		// If no results with semantic search, fall back to simple stocked query
		if (!currentInventory || currentInventory.length === 0) {
			console.log('No semantic results, falling back to simple stocked query');
			const { data: fallbackInventory } = await this.supabase
				.from('coffee_catalog')
				.select('*, embedding')
				.eq('stocked', true)
				.limit(maxCurrentInventory);

			console.log('Fallback inventory:', fallbackInventory?.length || 0);

			return {
				currentInventory: this.cleanCoffeeData(fallbackInventory || [])
			};
		}

		return {
			currentInventory: this.cleanCoffeeData(currentInventory || [])
		};
	}
}
