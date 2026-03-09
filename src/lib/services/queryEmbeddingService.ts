/**
 * Embedding service for generating query embeddings via OpenRouter
 * Uses Qwen3 embedding model with Matryoshka truncation for DB compatibility
 */
export class QueryEmbeddingService {
	private apiKey: string;
	private baseUrl = 'https://openrouter.ai/api/v1';
	private embeddingModel = 'qwen/qwen3-embedding-8b';
	private embeddingDimensions = 1536; // Matryoshka truncation for DB compatibility

	constructor(apiKey: string) {
		this.apiKey = apiKey;
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
			const response = await fetch(`${this.baseUrl}/embeddings`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${this.apiKey}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					input: text,
					model: this.embeddingModel,
					dimensions: this.embeddingDimensions
				})
			});

			if (!response.ok) {
				if (
					(response.status === 502 || response.status === 503 || response.status === 429) &&
					retryCount < maxRetries
				) {
					const delay = baseDelay * Math.pow(2, retryCount);
					console.warn(
						`OpenRouter embedding API error ${response.status}, retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`
					);
					await new Promise((resolve) => setTimeout(resolve, delay));
					return this.generateEmbedding(text, retryCount + 1);
				}
				throw new Error(
					`OpenRouter embedding API error: ${response.status} ${response.statusText}`
				);
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
