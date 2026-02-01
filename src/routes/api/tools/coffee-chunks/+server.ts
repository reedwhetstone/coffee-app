import { json } from '@sveltejs/kit';
import { requireMemberRole } from '$lib/server/auth';
import { RAGService } from '$lib/services/ragService';
import { OPENAI_API_KEY } from '$env/static/private';
import type { RequestHandler } from './$types';

// Interface for tool input validation
interface CoffeeChunksToolInput {
	context_string: string;
	chunk_types?: ('profile' | 'tasting' | 'origin' | 'commercial' | 'processing')[];
	max_chunks?: number;
	similarity_threshold?: number;
}

// Tool response interface
interface CoffeeChunksToolResponse {
	chunks: Array<{
		content: string;
		chunk_type: string;
		coffee_id?: number;
		coffee_name?: string;
		similarity?: number;
		document_id: string;
	}>;
	total_chunks: number;
	query_processed: string;
	similarity_threshold_used: number;
	search_strategy: string;
	message: string;
}

export const POST: RequestHandler = async (event) => {
	try {
		// Require member role for tool access
		await requireMemberRole(event);
		const { supabase } = event.locals;

		const input: CoffeeChunksToolInput = await event.request.json();

		// Validate required parameters
		const { context_string, chunk_types, max_chunks = 10, similarity_threshold = 0.3 } = input;

		if (!context_string || context_string.trim().length === 0) {
			return json({ error: 'context_string is required and cannot be empty' }, { status: 400 });
		}

		// Validate OPENAI_API_KEY
		if (!OPENAI_API_KEY) {
			return json(
				{ error: 'OpenAI API key not configured for knowledge retrieval' },
				{ status: 500 }
			);
		}

		// Initialize RAG service
		const ragService = new RAGService(supabase, OPENAI_API_KEY);

		// Perform semantic search using the existing RAG service
		const searchOptions = {
			maxCurrentInventory: max_chunks,
			similarityThreshold: similarity_threshold,
			chunkTypes: chunk_types
		};

		await ragService.retrieveRelevantCoffees(context_string, searchOptions);

		// The RAG service returns coffee catalog results, but we want chunk-level results
		// Let's make a direct call to the coffee_chunks RPC function for more granular results

		// Generate embedding for the query
		const queryEmbeddingService = ragService['queryEmbeddingService']; // Access private property
		const queryEmbedding = await queryEmbeddingService.generateQueryEmbedding(context_string);

		// Search chunks directly
		const { data: chunksData, error: chunksError } = await supabase.rpc('match_coffee_chunks', {
			query_embedding: JSON.stringify(queryEmbedding),
			match_threshold: similarity_threshold,
			match_count: max_chunks,
			chunk_types: chunk_types || undefined
		});

		if (chunksError) {
			console.error('Coffee chunks search error:', chunksError);
			return json({ error: 'Failed to search knowledge base' }, { status: 500 });
		}

		// Get coffee names for chunks that reference specific coffees
		const coffeeIds =
			chunksData
				?.filter((chunk: { coffee_id: number | null }) => chunk.coffee_id)
				.map((chunk: { coffee_id: number }) => chunk.coffee_id) || [];
		let coffeeNames: Record<number, string> = {};

		if (coffeeIds.length > 0) {
			const { data: coffeeData } = await supabase
				.from('coffee_catalog')
				.select('id, name')
				.in('id', coffeeIds);

			if (coffeeData) {
				coffeeNames = Object.fromEntries(
					coffeeData.map((coffee: { id: number; name: string }) => [coffee.id, coffee.name])
				);
			}
		}

		// Format chunks for response
		const formattedChunks =
			chunksData?.map(
				(chunk: {
					content: string;
					chunk_type: string;
					coffee_id: number | null;
					similarity: number;
					id: string;
				}) => ({
					content: chunk.content,
					chunk_type: chunk.chunk_type,
					coffee_id: chunk.coffee_id || undefined,
					coffee_name: chunk.coffee_id
						? coffeeNames[chunk.coffee_id] || 'Unknown Coffee'
						: undefined,
					similarity: chunk.similarity || 0,
					document_id: chunk.id
				})
			) || [];

		// Determine search strategy used
		let searchStrategy = 'semantic_search';
		if (chunk_types && chunk_types.length > 0) {
			searchStrategy = `filtered_semantic_search (${chunk_types.join(', ')})`;
		}

		const message =
			formattedChunks.length > 0
				? `Found ${formattedChunks.length} relevant knowledge chunks for: "${context_string}"`
				: `No relevant knowledge found for: "${context_string}". Try a different query or broader terms.`;

		const response: CoffeeChunksToolResponse = {
			chunks: formattedChunks,
			total_chunks: formattedChunks.length,
			query_processed: context_string,
			similarity_threshold_used: similarity_threshold,
			search_strategy: searchStrategy,
			message: message
		};

		return json(response);
	} catch (error) {
		console.error('Coffee chunks tool error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Unknown error' },
			{ status: 500 }
		);
	}
};
