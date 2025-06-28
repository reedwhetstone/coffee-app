import { json } from '@sveltejs/kit';
import { EnhancedEmbeddingService } from '$lib/services/enhancedEmbeddingService';
import { OPENAI_API_KEY } from '$env/static/private';
import { createAdminClient } from '$lib/supabase-admin';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ url }) => {
	// Use admin client to bypass RLS
	const supabase = createAdminClient();

	// Check query params for force regenerate option
	const forceRegenerate = url.searchParams.get('force') === 'true';

	try {
		return await generateChunkedEmbeddings(supabase, forceRegenerate);
	} catch (error) {
		console.error('Embedding population error:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};

async function generateChunkedEmbeddings(supabase: any, forceRegenerate: boolean) {
	const enhancedEmbeddingService = new EnhancedEmbeddingService(OPENAI_API_KEY);

	// Get all coffee_catalog records
	const { data: catalogCoffees, error: fetchError } = await supabase
		.from('coffee_catalog')
		.select('*');

	if (fetchError) {
		throw new Error(`Failed to fetch coffees: ${fetchError.message}`);
	}

	if (!catalogCoffees || catalogCoffees.length === 0) {
		return json({
			success: true,
			message: 'No coffees found to process',
			processed: { chunks: 0, coffees: 0 }
		});
	}

	let processedCoffees = 0;
	let totalChunks = 0;
	const errors: string[] = [];

	for (const coffee of catalogCoffees) {
		try {
			console.log(`Processing coffee: ${coffee.name} (${coffee.id})`);

			// Check if chunks already exist (unless force regenerating)
			if (!forceRegenerate) {
				const { data: existingChunks } = await supabase
					.from('coffee_chunks')
					.select('id')
					.eq('coffee_id', coffee.id)
					.limit(1);

				if (existingChunks && existingChunks.length > 0) {
					console.log(`Skipping ${coffee.name} - chunks already exist`);
					continue;
				}
			} else {
				// Delete existing chunks if force regenerating
				await supabase.from('coffee_chunks').delete().eq('coffee_id', coffee.id);
			}

			// Create semantic chunks
			const chunks = enhancedEmbeddingService.createSemanticChunks(coffee);

			if (chunks.length === 0) {
				console.log(`Skipping ${coffee.name} - no meaningful chunks created`);
				continue;
			}

			// Generate embeddings for chunks
			const chunksWithEmbeddings = await enhancedEmbeddingService.generateChunkEmbeddings(chunks);

			if (chunksWithEmbeddings.length === 0) {
				errors.push(`Failed to generate embeddings for ${coffee.name}`);
				continue;
			}

			// Insert chunks into database
			const { error: insertError } = await supabase.from('coffee_chunks').insert(
				chunksWithEmbeddings.map((chunk) => ({
					id: chunk.id,
					coffee_id: chunk.coffee_id,
					chunk_type: chunk.chunk_type,
					content: chunk.content,
					metadata: chunk.metadata,
					embedding: chunk.embedding
				}))
			);

			if (insertError) {
				errors.push(`Failed to insert chunks for ${coffee.name}: ${insertError.message}`);
				continue;
			}

			processedCoffees++;
			totalChunks += chunksWithEmbeddings.length;

			console.log(`✓ Processed ${coffee.name}: ${chunksWithEmbeddings.length} chunks`);
		} catch (error) {
			const errorMsg = `Error processing ${coffee.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
			console.error(errorMsg);
			errors.push(errorMsg);
		}
	}

	return json({
		success: true,
		processed: {
			coffees: processedCoffees,
			chunks: totalChunks
		},
		errors: errors.length > 0 ? errors : undefined,
		message: `Successfully processed ${processedCoffees} coffees with ${totalChunks} chunks${errors.length > 0 ? ` with ${errors.length} errors` : ''}`
	});
}
