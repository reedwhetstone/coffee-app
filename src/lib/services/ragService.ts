import type { SupabaseClient } from '@supabase/supabase-js';
import { EmbeddingService } from './embeddingService';
import { EnhancedEmbeddingService } from './enhancedEmbeddingService';

interface RetrievalResult {
	currentInventory: any[];
}

interface ChunkSearchOptions {
	maxCurrentInventory?: number;
	similarityThreshold?: number;
	chunkTypes?: ('profile' | 'tasting' | 'origin' | 'commercial' | 'processing')[];
	useChunkedSearch?: boolean;
}

export class RAGService {
	private supabase: SupabaseClient;
	private embeddingService: EmbeddingService;
	private enhancedEmbeddingService: EnhancedEmbeddingService;

	constructor(supabase: SupabaseClient, openaiApiKey: string) {
		this.supabase = supabase;
		this.embeddingService = new EmbeddingService(openaiApiKey);
		this.enhancedEmbeddingService = new EnhancedEmbeddingService(openaiApiKey);
	}

	/**
	 * Remove embedding from coffee data to avoid sending large vectors to LLM
	 */
	private cleanCoffeeData(coffees: any[]): any[] {
		return coffees.map(({ embedding, ...coffee }) => coffee);
	}

	/**
	 * Retrieve relevant coffee data using semantic search (chunked or legacy)
	 */
	async retrieveRelevantCoffees(
		query: string,
		options: ChunkSearchOptions = {}
	): Promise<RetrievalResult> {
		const { 
			maxCurrentInventory = 10, 
			similarityThreshold = 0.7, 
			chunkTypes,
			useChunkedSearch = true 
		} = options;

		// Use chunked search if enabled and chunks exist
		if (useChunkedSearch) {
			try {
				return await this.retrieveWithChunkedSearch(query, {
					maxCurrentInventory,
					similarityThreshold,
					chunkTypes
				});
			} catch (error) {
				console.warn('Chunked search failed, falling back to legacy search:', error);
			}
		}

		// Fallback to legacy search
		return await this.retrieveWithLegacySearch(query, {
			maxCurrentInventory,
			similarityThreshold
		});
	}

	/**
	 * New chunked search method
	 */
	private async retrieveWithChunkedSearch(
		query: string,
		options: {
			maxCurrentInventory: number;
			similarityThreshold: number;
			chunkTypes?: ('profile' | 'tasting' | 'origin' | 'commercial' | 'processing')[];
		}
	): Promise<RetrievalResult> {
		const { maxCurrentInventory, similarityThreshold, chunkTypes } = options;

		// Generate embedding for the user query
		const queryEmbedding = await this.enhancedEmbeddingService.generateQueryEmbedding(query);

		// Search chunks with optional type filtering
		const { data: chunks, error: chunksError } = await this.supabase.rpc(
			'match_coffee_chunks',
			{
				query_embedding: queryEmbedding,
				match_threshold: similarityThreshold,
				match_count: maxCurrentInventory * 2, // Get more chunks to aggregate by coffee
				chunk_types: chunkTypes || null
			}
		);

		if (chunksError) {
			throw new Error(`Chunk search error: ${chunksError.message}`);
		}

		if (!chunks || chunks.length === 0) {
			return { currentInventory: [] };
		}

		// Aggregate chunks by coffee_id and get unique coffees
		const coffeeIds = [...new Set(chunks.map((chunk: any) => chunk.coffee_id))];
		
		// Get full coffee data for the matched coffees
		const { data: coffees, error: coffeesError } = await this.supabase
			.from('coffee_catalog')
			.select('*')
			.in('id', coffeeIds.slice(0, maxCurrentInventory))
			.eq('stocked', true);

		if (coffeesError) {
			throw new Error(`Coffee fetch error: ${coffeesError.message}`);
		}

		console.log('Chunked search results:', {
			chunks: chunks.length,
			uniqueCoffees: coffeeIds.length,
			returnedCoffees: coffees?.length || 0,
			chunkTypes: chunkTypes || 'all'
		});

		return {
			currentInventory: this.cleanCoffeeData(coffees || [])
		};
	}

	/**
	 * Legacy search method (existing implementation)
	 */
	private async retrieveWithLegacySearch(
		query: string,
		options: {
			maxCurrentInventory: number;
			similarityThreshold: number;
		}
	): Promise<RetrievalResult> {
		const { maxCurrentInventory, similarityThreshold } = options;

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