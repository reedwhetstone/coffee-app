import type { SupabaseClient } from '@supabase/supabase-js';
import { EnhancedEmbeddingService } from './enhancedEmbeddingService';

interface RetrievalResult {
	currentInventory: any[];
}

interface SearchOptions {
	maxCurrentInventory?: number;
	similarityThreshold?: number;
	chunkTypes?: ('profile' | 'tasting' | 'origin' | 'commercial' | 'processing')[];
}

export class RAGService {
	private supabase: SupabaseClient;
	private enhancedEmbeddingService: EnhancedEmbeddingService;

	constructor(supabase: SupabaseClient, openaiApiKey: string) {
		this.supabase = supabase;
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
	 * Preprocess query to enhance coffee-specific term recognition
	 */
	private preprocessQuery(query: string): string {
		let processedQuery = query.toLowerCase();

		// Coffee processing method mappings
		const processingMappings = {
			'wet hulled': 'wet-hulled giling basah processing',
			'wet-hulled': 'wet-hulled giling basah processing',
			'giling basah': 'wet-hulled giling basah processing',
			anaerobic: 'anaerobic fermentation processing',
			carbonic: 'carbonic maceration anaerobic fermentation',
			'black honey': 'black honey process natural processing',
			'red honey': 'red honey process semi-washed',
			'yellow honey': 'yellow honey process honey processing',
			'white honey': 'white honey process washed honey',
			natural: 'natural dry process processing',
			washed: 'washed wet process processing',
			honey: 'honey process semi-washed processing'
		};

		// Variety/cultivar mappings
		const varietyMappings = {
			geisha: 'gesha geisha variety cultivar',
			bourbon: 'bourbon variety cultivar heirloom',
			typica: 'typica variety cultivar heirloom',
			caturra: 'caturra variety cultivar bourbon mutation',
			catuai: 'catuai variety cultivar bourbon caturra hybrid',
			pacamara: 'pacamara variety cultivar pacas maragogipe hybrid'
		};

		// Origin/region mappings
		const regionMappings = {
			yirgacheffe: 'yirgacheffe ethiopia sidamo gedeo',
			huehuetenango: 'huehuetenango guatemala antigua highlands',
			'blue mountain': 'blue mountain jamaica caribbean',
			kona: 'kona hawaii volcanic'
		};

		// Apply mappings
		for (const [term, expansion] of Object.entries(processingMappings)) {
			if (processedQuery.includes(term)) {
				processedQuery = processedQuery.replace(new RegExp(term, 'g'), expansion);
			}
		}

		for (const [term, expansion] of Object.entries(varietyMappings)) {
			if (processedQuery.includes(term)) {
				processedQuery = processedQuery.replace(new RegExp(term, 'g'), expansion);
			}
		}

		for (const [term, expansion] of Object.entries(regionMappings)) {
			if (processedQuery.includes(term)) {
				processedQuery = processedQuery.replace(new RegExp(term, 'g'), expansion);
			}
		}

		return processedQuery;
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
			.filter((pattern) => pattern.names.some((name) => lowerQuery.includes(name)))
			.map((pattern) => pattern.normalized);

		// Flavor/tasting keywords
		const flavorKeywords = [
			'fruity',
			'chocolate',
			'chocolat',
			'floral',
			'bright',
			'sweet',
			'acidic',
			'citrus',
			'berry',
			'caramel',
			'nuts',
			'nutty',
			'cocoa',
			'vanilla',
			'spice',
			'wine',
			'fruit',
			'tasting',
			'flavor',
			'notes',
			'cupping'
		];

		// Origin/geographic keywords
		const originKeywords = [
			'ethiopia',
			'ethiopian',
			'colombia',
			'colombian',
			'brazil',
			'brazilian',
			'kenya',
			'guatemala',
			'panama',
			'region',
			'altitude',
			'farm',
			'estate',
			'cooperative'
		];

		// Processing keywords
		const processingKeywords = [
			'natural',
			'washed',
			'honey',
			'anaerobic',
			'fermentation',
			'dry process',
			'wet process',
			'pulped natural',
			'processing',
			'method',
			'wet hulled',
			'wet-hulled',
			'giling basah',
			'semi-washed',
			'semi washed',
			'carbonic maceration',
			'extended fermentation',
			'black honey',
			'red honey',
			'yellow honey',
			'white honey'
		];

		// Commercial keywords
		const commercialKeywords = [
			'price',
			'cost',
			'cheap',
			'expensive',
			'budget',
			'value',
			'affordable',
			'under',
			'over',
			'$',
			'dollar',
			'lot size',
			'availability'
		];

		// Description/story keywords - trigger tasting chunk search for rich descriptions
		const descriptionKeywords = [
			'smallholder',
			'producers',
			'station',
			'farm',
			'farmer',
			'family',
			'community',
			'story',
			'history',
			'tradition',
			'cooperative',
			'washing station',
			'mill',
			'hectare',
			'elevation',
			'village',
			'local',
			'generations',
			'heritage'
		];

		// Count matches for each category
		const flavorMatches = flavorKeywords.filter((keyword) => lowerQuery.includes(keyword)).length;
		const originMatches = originKeywords.filter((keyword) => lowerQuery.includes(keyword)).length;
		const processingMatches = processingKeywords.filter((keyword) =>
			lowerQuery.includes(keyword)
		).length;
		const commercialMatches = commercialKeywords.filter((keyword) =>
			lowerQuery.includes(keyword)
		).length;
		const descriptionMatches = descriptionKeywords.filter((keyword) =>
			lowerQuery.includes(keyword)
		).length;

		// Determine optimal chunk types based on strongest signals
		let chunkTypes: ('profile' | 'tasting' | 'origin' | 'commercial' | 'processing')[] | null =
			null;

		if (flavorMatches > 0) {
			chunkTypes = ['tasting'];
		} else if (descriptionMatches > 0) {
			// For description/story queries, search tasting chunks (contains descriptions)
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
	 * Retrieve relevant coffee data using semantic search
	 */
	async retrieveRelevantCoffees(
		query: string,
		options: SearchOptions = {}
	): Promise<RetrievalResult> {
		const {
			maxCurrentInventory = 10,
			similarityThreshold = 0.3,
			chunkTypes: explicitChunkTypes
		} = options;

		// Analyze query intent if chunk types not explicitly provided
		const queryIntent = this.analyzeQueryIntent(query);
		const chunkTypes = explicitChunkTypes || queryIntent.chunkTypes;

		return await this.performSemanticSearch(query, {
			maxCurrentInventory,
			similarityThreshold,
			chunkTypes: chunkTypes || undefined
		});
	}

	/**
	 * Perform semantic search using chunked embeddings
	 */
	private async performSemanticSearch(
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

		// Preprocess and generate embedding for the user query
		const processedQuery = this.preprocessQuery(query);
		const queryEmbedding =
			await this.enhancedEmbeddingService.generateQueryEmbedding(processedQuery);

		// Search chunks with optional type filtering
		// For supplier queries, lower the threshold to be more inclusive since supplier name is now prominent
		const adjustedThreshold = queryIntent.isSupplierQuery
			? Math.max(0.1, similarityThreshold - 0.1)
			: similarityThreshold;

		const { data: chunks, error: chunksError } = await this.supabase.rpc('match_coffee_chunks', {
			query_embedding: queryEmbedding,
			match_threshold: adjustedThreshold,
			match_count: maxCurrentInventory * 3, // Get more results for supplier queries
			chunk_types: chunkTypes || null
		});

		if (chunksError) {
			throw new Error(`Chunk search error: ${chunksError.message}`);
		}

		// If no results and we weren't already searching tasting chunks, try fallback to tasting
		if ((!chunks || chunks.length === 0) && chunkTypes && !chunkTypes.includes('tasting')) {
			console.log('No results found, falling back to tasting chunks for richer descriptions');

			const { data: fallbackChunks } = await this.supabase.rpc('match_coffee_chunks', {
				query_embedding: queryEmbedding,
				match_threshold: Math.max(0.1, adjustedThreshold - 0.1), // Lower threshold for fallback
				match_count: maxCurrentInventory * 3,
				chunk_types: ['tasting']
			});

			if (fallbackChunks && fallbackChunks.length > 0) {
				chunks = fallbackChunks;
			}
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
			.map((coffee) => ({
				...coffee,
				similarity: coffeeScores.get(coffee.id) || 0
			}))
			.sort((a, b) => b.similarity - a.similarity);

		console.log('Chunked search results:', {
			originalQuery: query,
			processedQuery,
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
			topSimilarities: coffeesWithSimilarity.slice(0, 5).map((c) => ({
				name: c.name,
				source: c.source,
				similarity: c.similarity
			}))
		});

		return {
			currentInventory: this.cleanCoffeeData(coffeesWithSimilarity)
		};
	}
}
