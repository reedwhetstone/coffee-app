/**
 * Simple embedding service for generating query embeddings
 * Used by RAGService to embed user search queries
 */
export class QueryEmbeddingService {
	private openaiApiKey: string;

	constructor(apiKey: string) {
		this.openaiApiKey = apiKey;
	}

	/**
	 * Generate embedding for user query
	 */
	async generateQueryEmbedding(query: string): Promise<number[]> {
		return this.generateEmbedding(query);
	}

	private async generateEmbedding(text: string, retryCount: number = 0): Promise<number[]> {
		const maxRetries = 3;
		const baseDelay = 1000; // 1 second base delay

		try {
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
				// Check if it's a retryable error
				if (
					(response.status === 502 || response.status === 503 || response.status === 429) &&
					retryCount < maxRetries
				) {
					const delay = baseDelay * Math.pow(2, retryCount); // Exponential backoff
					console.warn(
						`OpenAI API error ${response.status}, retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`
					);
					await new Promise((resolve) => setTimeout(resolve, delay));
					return this.generateEmbedding(text, retryCount + 1);
				}
				throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
			}

			const data = await response.json();
			return data.data[0].embedding;
		} catch (error) {
			if (retryCount < maxRetries && error instanceof Error && error.message.includes('fetch')) {
				const delay = baseDelay * Math.pow(2, retryCount);
				console.warn(
					`Network error, retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries}): ${error.message}`
				);
				await new Promise((resolve) => setTimeout(resolve, delay));
				return this.generateEmbedding(text, retryCount + 1);
			}
			throw error;
		}
	}
}
