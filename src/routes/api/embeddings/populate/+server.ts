import { json } from '@sveltejs/kit';
import { EmbeddingService } from '$lib/services/embeddingService';
import { OPENAI_API_KEY } from '$env/static/private';
import { createAdminClient } from '$lib/supabase-admin';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async () => {
	// Use admin client to bypass RLS
	const supabase = createAdminClient();
	try {
		const embeddingService = new EmbeddingService(OPENAI_API_KEY);

		// Get all coffee_catalog records to regenerate embeddings
		const { data: catalogCoffees, error: fetchError } = await supabase
			.from('coffee_catalog')
			.select('*');

		if (fetchError) {
			throw new Error(`Failed to fetch coffees: ${fetchError.message}`);
		}

		if (!catalogCoffees || catalogCoffees.length === 0) {
			return json({
				success: true,
				message: 'No coffees need embeddings',
				processed: { catalog: 0 }
			});
		}

		let processedCatalog = 0;
		const errors: string[] = [];

		for (const coffee of catalogCoffees) {
			try {
				console.log(`Processing coffee: ${coffee.name} (${coffee.id})`);

				const embedding = await embeddingService.generateEmbedding(coffee);

				const { error: updateError } = await supabase
					.from('coffee_catalog')
					.update({ embedding })
					.eq('id', coffee.id);

				if (updateError) {
					errors.push(`Failed to update ${coffee.name}: ${updateError.message}`);
					continue;
				}

				processedCatalog++;

				// Rate limiting - wait 100ms between requests to avoid hitting OpenAI limits
				await new Promise((resolve) => setTimeout(resolve, 100));
			} catch (error) {
				const errorMsg = `Error processing ${coffee.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
				console.error(errorMsg);
				errors.push(errorMsg);
			}
		}

		return json({
			success: true,
			processed: { catalog: processedCatalog },
			errors: errors.length > 0 ? errors : undefined,
			message: `Successfully processed ${processedCatalog} coffees${errors.length > 0 ? ` with ${errors.length} errors` : ''}`
		});
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
