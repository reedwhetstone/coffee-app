import { ChatOpenAI } from '@langchain/openai';

export type QueryIntent = 'catalog' | 'knowledge' | 'roast' | 'analysis' | 'mixed';

export interface QueryClassification {
	intent: QueryIntent;
	filters: {
		origin?: string;
		process_subtype?: string;
		variety?: string;
		price_range?: [number, number];
		flavor_keywords?: string[];
		bean_id?: number;
		roast_id?: string;
	};
	require_knowledge: boolean;
	require_catalog: boolean;
	query_terms: string;
	confidence: number;
	reasoning: string;
}

export class QueryRouter {
	private model: ChatOpenAI;

	constructor(openaiApiKey: string) {
		// Use GPT-5-nano for cost-effective query classification
		this.model = new ChatOpenAI({
			apiKey: openaiApiKey,
			model: 'gpt-5-nano-2025-08-07',
			// Note: GPT-5 models do not support temperature parameter
			maxTokens: 1000
		});
	}

	/**
	 * Classify user query and extract relevant parameters
	 */
	async classifyQuery(query: string): Promise<QueryClassification> {
		const prompt = this.buildClassificationPrompt(query);

		try {
			const response = await this.model.invoke(prompt);
			const result = this.parseClassificationResponse(response.content.toString());

			return {
				...result,
				query_terms: this.extractQueryTerms(query)
			};
		} catch (error) {
			console.error('Query classification error:', error);
			// Return fallback classification
			return this.getFallbackClassification(query);
		}
	}

	private buildClassificationPrompt(query: string): string {
		return `You are a query router for a coffee application. Classify the user's query and extract relevant filters.

User Query: "${query}"

Analyze the query and respond with ONLY a JSON object in this exact format:
{
  "intent": "catalog|knowledge|roast|analysis|mixed",
  "filters": {
    "origin": "string or null",
    "process_subtype": "string or null", 
    "variety": "string or null",
    "price_range": [min, max] or null,
    "flavor_keywords": ["keyword1", "keyword2"] or [],
    "bean_id": number or null,
    "roast_id": "string or null"
  },
  "require_knowledge": boolean,
  "require_catalog": boolean,
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}

Intent Classification:
- "catalog": User wants to find/search coffee beans (recommendations, specific coffees)
- "knowledge": User wants coffee education, brewing tips, roasting guides
- "roast": User asks about roasting profiles, roast data, roast analysis
- "analysis": User wants data analysis, trends, comparisons
- "mixed": Query involves multiple intents

Filter Extraction:
- origin: Country, region, or continent (e.g., "Ethiopia", "Central America")
- process_subtype: Processing method (e.g., "natural", "washed", "honey")
- variety: Coffee variety/cultivar (e.g., "bourbon", "geisha", "typica")
- price_range: Extract price ranges mentioned (e.g., "under $8" = [0, 8])
- flavor_keywords: Flavor descriptors (e.g., ["fruity", "chocolate", "floral"])
- bean_id: Specific coffee ID if mentioned
- roast_id: Specific roast profile ID if mentioned

Examples:
"I need a natural Ethiopian under $10" → intent: "catalog", origin: "Ethiopia", process_subtype: "natural", price_range: [0, 10]
"How do I roast a washed Colombian coffee?" → intent: "mixed", origin: "Colombia", process_subtype: "washed", require_knowledge: true
"Show me my recent roasts" → intent: "roast", require_catalog: false
"What's the best brewing method for fruity coffees?" → intent: "knowledge", flavor_keywords: ["fruity"]`;
	}

	private parseClassificationResponse(response: string): Omit<QueryClassification, 'query_terms'> {
		try {
			// Extract JSON from response
			const jsonMatch = response.match(/\{[\s\S]*\}/);
			if (!jsonMatch) {
				throw new Error('No JSON found in response');
			}

			const parsed = JSON.parse(jsonMatch[0]);

			// Validate and clean the response
			return {
				intent: this.validateIntent(parsed.intent),
				filters: this.cleanFilters(parsed.filters || {}),
				require_knowledge: Boolean(parsed.require_knowledge),
				require_catalog: Boolean(parsed.require_catalog),
				confidence: Math.max(0, Math.min(1, parsed.confidence || 0.5)),
				reasoning: parsed.reasoning || 'No reasoning provided'
			};
		} catch (error) {
			console.error('Failed to parse classification response:', error);
			throw error;
		}
	}

	private validateIntent(intent: string): QueryIntent {
		const validIntents: QueryIntent[] = ['catalog', 'knowledge', 'roast', 'analysis', 'mixed'];
		return validIntents.includes(intent as QueryIntent) ? (intent as QueryIntent) : 'catalog';
	}

	private cleanFilters(filters: any): QueryClassification['filters'] {
		return {
			origin: typeof filters.origin === 'string' ? filters.origin : undefined,
			process_subtype:
				typeof filters.process_subtype === 'string' ? filters.process_subtype : undefined,
			variety: typeof filters.variety === 'string' ? filters.variety : undefined,
			price_range:
				Array.isArray(filters.price_range) && filters.price_range.length === 2
					? [Number(filters.price_range[0]), Number(filters.price_range[1])]
					: undefined,
			flavor_keywords: Array.isArray(filters.flavor_keywords)
				? filters.flavor_keywords.filter((k: any) => typeof k === 'string')
				: [],
			bean_id: typeof filters.bean_id === 'number' ? filters.bean_id : undefined,
			roast_id: typeof filters.roast_id === 'string' ? filters.roast_id : undefined
		};
	}

	private extractQueryTerms(query: string): string {
		// Extract key terms for tsvector search
		const stopWords = [
			'i',
			'need',
			'want',
			'looking',
			'for',
			'a',
			'an',
			'the',
			'and',
			'or',
			'but',
			'with',
			'from'
		];
		const terms = query
			.toLowerCase()
			.replace(/[^\w\s]/g, ' ')
			.split(/\s+/)
			.filter((term) => term.length > 2 && !stopWords.includes(term))
			.slice(0, 10); // Limit to 10 terms

		return terms.join(' ');
	}

	private getFallbackClassification(query: string): QueryClassification {
		// Simple fallback classification using keyword matching
		const lowerQuery = query.toLowerCase();

		let intent: QueryIntent = 'catalog';
		let require_knowledge = false;
		let require_catalog = true;

		// Basic intent detection
		if (
			lowerQuery.includes('roast') &&
			(lowerQuery.includes('profile') || lowerQuery.includes('chart'))
		) {
			intent = 'roast';
			require_catalog = false;
		} else if (
			lowerQuery.includes('how') ||
			lowerQuery.includes('guide') ||
			lowerQuery.includes('tip')
		) {
			intent = 'knowledge';
			require_knowledge = true;
			require_catalog = false;
		} else if (
			lowerQuery.includes('analyze') ||
			lowerQuery.includes('trend') ||
			lowerQuery.includes('compare')
		) {
			intent = 'analysis';
		}

		// Basic filter extraction
		const filters: QueryClassification['filters'] = {
			flavor_keywords: []
		};

		// Extract basic origins
		const origins = [
			'ethiopia',
			'colombia',
			'brazil',
			'kenya',
			'guatemala',
			'costa rica',
			'panama'
		];
		const foundOrigin = origins.find((origin) => lowerQuery.includes(origin));
		if (foundOrigin) {
			filters.origin = foundOrigin;
		}

		// Extract basic processes
		const processes = ['natural', 'washed', 'honey', 'anaerobic'];
		const foundProcess = processes.find((process) => lowerQuery.includes(process));
		if (foundProcess) {
			filters.process_subtype = foundProcess;
		}

		// Extract basic flavor keywords
		const flavors = ['fruity', 'chocolate', 'floral', 'citrus', 'nutty', 'sweet', 'bright'];
		filters.flavor_keywords = flavors.filter((flavor) => lowerQuery.includes(flavor));

		return {
			intent,
			filters,
			require_knowledge,
			require_catalog,
			query_terms: this.extractQueryTerms(query),
			confidence: 0.3, // Low confidence for fallback
			reasoning: 'Fallback classification due to parsing error'
		};
	}
}

/**
 * Factory function to create QueryRouter instance
 */
export function createQueryRouter(openaiApiKey: string): QueryRouter {
	return new QueryRouter(openaiApiKey);
}
