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
	 * Preserve similarity scores for debugging and ranking
	 */
	private cleanCoffeeData(coffees: any[]): any[] {
		return coffees.map(({ embedding, ...coffee }) => coffee);
	}

	/**
	 * Analyze query to determine intent and optimal chunk types
	 */
	private analyzeQueryIntent(query: string): {
		chunkTypes: ('profile' | 'tasting' | 'origin' | 'commercial' | 'processing')[] | null;
		isSupplierQuery: boolean;
		detectedSuppliers: string[];
	} {
		const lowerQuery = query.toLowerCase();
		
		// Known supplier patterns (add more as needed)
		const supplierPatterns = [
			{ names: ['showroom', 'showroom coffee'], normalized: 'showroom_coffee' },
			{ names: ['sweet maria', 'sweet marias', 'sweetmarias'], normalized: 'sweet_maria' },
			{ names: ['bodhi leaf', 'bodhi', 'bodhileaf'], normalized: 'bodhi_leaf' },
			{ names: ['captain coffee', 'captain'], normalized: 'captain_coffee' },
			{ names: ['theta ridge'], normalized: 'theta_ridge' }
		];
		
		const detectedSuppliers = supplierPatterns
			.filter(pattern => pattern.names.some(name => lowerQuery.includes(name)))
			.map(pattern => pattern.normalized);
		
		// Flavor/tasting keywords
		const flavorKeywords = [
			'fruity', 'chocolate', 'chocolat', 'floral', 'bright', 'sweet', 'acidic', 'citrus',
			'berry', 'caramel', 'nuts', 'nutty', 'cocoa', 'vanilla', 'spice', 'wine', 'fruit',
			'tasting', 'flavor', 'notes', 'cupping'
		];
		
		// Origin/geographic keywords  
		const originKeywords = [
			'ethiopia', 'ethiopian', 'colombia', 'colombian', 'brazil', 'brazilian', 'kenya',
			'guatemala', 'panama', 'region', 'altitude', 'farm', 'estate', 'cooperative'
		];
		
		// Processing keywords
		const processingKeywords = [
			'natural', 'washed', 'honey', 'anaerobic', 'fermentation', 'dry process', 
			'wet process', 'pulped natural', 'processing', 'method'
		];
		
		// Commercial keywords
		const commercialKeywords = [
			'price', 'cost', 'cheap', 'expensive', 'budget', 'value', 'affordable',
			'under', 'over', '$', 'dollar', 'lot size', 'availability'
		];
		
		// Count matches for each category
		const flavorMatches = flavorKeywords.filter(keyword => lowerQuery.includes(keyword)).length;
		const originMatches = originKeywords.filter(keyword => lowerQuery.includes(keyword)).length;
		const processingMatches = processingKeywords.filter(keyword => lowerQuery.includes(keyword)).length;
		const commercialMatches = commercialKeywords.filter(keyword => lowerQuery.includes(keyword)).length;
		
		// Determine optimal chunk types based on strongest signals
		let chunkTypes: ('profile' | 'tasting' | 'origin' | 'commercial' | 'processing')[] | null = null;
		
		if (flavorMatches > 0) {
			chunkTypes = ['tasting'];
		} else if (originMatches > 0) {
			chunkTypes = ['origin'];
		} else if (processingMatches > 0) {
			chunkTypes = ['processing'];  
		} else if (commercialMatches > 0) {
			chunkTypes = ['commercial'];
		}
		// If supplier query but no specific content type, search all types
		
		return {
			chunkTypes,
			isSupplierQuery: detectedSuppliers.length > 0,
			detectedSuppliers
		};
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
			chunkTypes: explicitChunkTypes,
			useChunkedSearch = true 
		} = options;

		// Analyze query intent if chunk types not explicitly provided
		const queryIntent = this.analyzeQueryIntent(query);
		const chunkTypes = explicitChunkTypes || queryIntent.chunkTypes;

		// Use chunked search if enabled and chunks exist
		if (useChunkedSearch) {
			try {
				return await this.retrieveWithChunkedSearch(query, {
					maxCurrentInventory,
					similarityThreshold,
					chunkTypes: chunkTypes || undefined
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
		
		// Analyze query intent for logging
		const queryIntent = this.analyzeQueryIntent(query);

		// Generate embedding for the user query
		const queryEmbedding = await this.enhancedEmbeddingService.generateQueryEmbedding(query);

		// Search chunks with optional type filtering
		// For supplier queries, lower the threshold to be more inclusive since supplier name is now prominent
		const adjustedThreshold = queryIntent.isSupplierQuery ? Math.max(0.3, similarityThreshold - 0.2) : similarityThreshold;
		
		const { data: chunks, error: chunksError } = await this.supabase.rpc(
			'match_coffee_chunks',
			{
				query_embedding: queryEmbedding,
				match_threshold: adjustedThreshold,
				match_count: maxCurrentInventory * 3, // Get more results for supplier queries
				chunk_types: chunkTypes || null
			}
		);

		if (chunksError) {
			throw new Error(`Chunk search error: ${chunksError.message}`);
		}

		if (!chunks || chunks.length === 0) {
			return { currentInventory: [] };
		}

		// Aggregate chunks by coffee_id and calculate max similarity per coffee
		const coffeeScores = new Map<number, number>();
		chunks.forEach((chunk: any) => {
			const currentScore = coffeeScores.get(chunk.coffee_id) || 0;
			coffeeScores.set(chunk.coffee_id, Math.max(currentScore, chunk.similarity || 0));
		});

		// Get unique coffee IDs, sorted by their best similarity score
		const sortedCoffeeIds = Array.from(coffeeScores.entries())
			.sort(([, a], [, b]) => b - a) // Sort by similarity score descending
			.slice(0, maxCurrentInventory)
			.map(([coffeeId]) => coffeeId);
		
		// Get full coffee data for the matched coffees
		const { data: coffees, error: coffeesError } = await this.supabase
			.from('coffee_catalog')
			.select('*')
			.in('id', sortedCoffeeIds)
			.eq('stocked', true);

		if (coffeesError) {
			throw new Error(`Coffee fetch error: ${coffeesError.message}`);
		}

		// Add similarity scores to coffee objects and sort by similarity
		const coffeesWithSimilarity = (coffees || [])
			.map(coffee => ({
				...coffee,
				similarity: coffeeScores.get(coffee.id) || 0
			}))
			.sort((a, b) => b.similarity - a.similarity);

		console.log('Chunked search results:', {
			query,
			queryIntent: {
				detectedChunkTypes: chunkTypes || 'all',
				isSupplierQuery: queryIntent.isSupplierQuery,
				detectedSuppliers: queryIntent.detectedSuppliers
			},
			results: {
				chunks: chunks.length,
				uniqueCoffees: coffeeScores.size,
				returnedCoffees: coffeesWithSimilarity.length
			},
			topSimilarities: coffeesWithSimilarity.slice(0, 5).map(c => ({ 
				name: c.name, 
				source: c.source, 
				similarity: c.similarity 
			}))
		});

		return {
			currentInventory: this.cleanCoffeeData(coffeesWithSimilarity)
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