import { json } from '@sveltejs/kit';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AI_API_KEY, OPENAI_API_KEY } from '$env/static/private';
import { RAGService } from '$lib/services/ragService';
import { requireMemberRole } from '$lib/server/auth';
import type { RequestHandler } from './$types';

// Timeout helper function
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
	return Promise.race([
		promise,
		new Promise<T>((_, reject) =>
			setTimeout(() => reject(new Error(`${operation} timed out after ${timeoutMs}ms`)), timeoutMs)
		)
	]);
}

const genAI = new GoogleGenerativeAI(AI_API_KEY);

// Helper function to detect query type
function detectQueryType(prompt: string): 'analysis' | 'recommendation' {
	const analysisKeywords = [
		'analysis',
		'analyze',
		'trend',
		'trends',
		'historical',
		'history',
		'price changes',
		'price trends',
		'compare',
		'comparison',
		'over time',
		'timeline',
		'evolution',
		'statistics',
		'data',
		'patterns',
		'insights',
		'report',
		'summary'
	];

	const recommendationKeywords = [
		'recommend',
		'suggestion',
		'suggest',
		'best',
		'top',
		'find',
		'looking for',
		'want',
		'need',
		'should I',
		'what coffee',
		'which coffee'
	];

	const lowerPrompt = prompt.toLowerCase();

	const analysisScore = analysisKeywords.reduce(
		(score, keyword) => score + (lowerPrompt.includes(keyword) ? 1 : 0),
		0
	);
	const recommendationScore = recommendationKeywords.reduce(
		(score, keyword) => score + (lowerPrompt.includes(keyword) ? 1 : 0),
		0
	);

	return analysisScore > recommendationScore ? 'analysis' : 'recommendation';
}

export const POST: RequestHandler = async (event) => {
	try {
		// Require member role for AI features
		const { user } = await requireMemberRole(event);
		const { supabase } = event.locals;

		const { prompt, coffeeData } = await event.request.json();

		// Detect query type
		const queryType = detectQueryType(prompt);
		console.log('Detected query type:', queryType);

		// Initialize RAG service
		const ragService = new RAGService(supabase, OPENAI_API_KEY);

		let retrievalResult;

		if (queryType === 'analysis') {
			// For analysis queries, get more current inventory data with timeout
			retrievalResult = await withTimeout(
				ragService.retrieveRelevantCoffees(prompt, {
					maxCurrentInventory: 50, // More current data for analysis
					similarityThreshold: 0.06 // Lower threshold to be more inclusive
				}),
				15000, // 15 second timeout for RAG service
				'RAG analysis retrieval'
			);
		} else {
			// For recommendations, use the existing focused approach with timeout
			retrievalResult = await withTimeout(
				ragService.retrieveRelevantCoffees(prompt, {
					maxCurrentInventory: 50,
					similarityThreshold: 0.06
				}),
				15000, // 15 second timeout for RAG service
				'RAG recommendation retrieval'
			);
		}

		console.log('RAG Service Results:', {
			queryType,
			currentInventoryCount: retrievalResult.currentInventory.length,
			currentInventorySource: retrievalResult.currentInventory.map((c) => c.source),
			currentInventoryNames: retrievalResult.currentInventory.map((c) => c.name),
			currentInventorySimilarity: retrievalResult.currentInventory.map((c) => c.similarity),
			prompt: prompt
		});

		const model = genAI.getGenerativeModel({
			model: 'gemini-2.5-flash',
			generationConfig: {
				temperature: queryType === 'analysis' ? 0.05 : 0.1, // Lower temperature for analysis
				topP: 0.95,
				topK: 40,
				maxOutputTokens: 8192
			}
		});

		// Different prompts based on query type
		const systemPrompt =
			queryType === 'analysis' ? getAnalysisSystemPrompt() : getRecommendationSystemPrompt();

		const chatSession = model.startChat({
			history: [
				{
					role: 'user',
					parts: [{ text: systemPrompt }]
				},
				{
					role: 'model',
					parts: [
						{
							text:
								queryType === 'analysis'
									? "I understand my role as a coffee data analyst. I'll provide comprehensive analysis using available current inventory data, focusing on trends, patterns, and insights rather than recommendations."
									: "I understand my role as a coffee expert with access to current inventory. I'll use semantic search results to provide informed recommendations based on currently available coffees."
						}
					]
				}
			]
		});

		const contextualPrompt =
			queryType === 'analysis'
				? `
CURRENT INVENTORY DATA (All Available Records):
${JSON.stringify(retrievalResult.currentInventory, null, 2)}

ANALYSIS REQUEST: ${prompt}

Please provide a comprehensive analysis of the current inventory data. Focus on trends, patterns, and insights. Do not make recommendations unless specifically requested.
`
				: `
CURRENT INVENTORY (Available for Purchase):
${JSON.stringify(retrievalResult.currentInventory, null, 2)}

USER QUERY: ${prompt}

Please provide recommendations based on the current inventory.
`;

		const result = await withTimeout(
			chatSession.sendMessage(contextualPrompt),
			30000, // 30 second timeout for AI generation
			'Google AI chat completion'
		);
		const response = await result.response;

		return json({
			text: response.text(),
			metadata: {
				queryType,
				currentInventoryCount: retrievalResult.currentInventory.length
			}
		});
	} catch (error) {
		console.error('Server error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Unknown error' },
			{ status: 500 }
		);
	}
};

function getAnalysisSystemPrompt(): string {
	return `You are an expert coffee data analyst with deep knowledge of coffee markets, pricing trends, and industry patterns.

Your task is to analyze coffee data and provide comprehensive insights, trends, and patterns. You have access to:

CURRENT INVENTORY: Current market offerings and available coffee data

When conducting analysis:
- Focus on data-driven insights and patterns from current inventory
- Identify patterns in pricing, regions, processing methods, and quality scores
- Provide statistical summaries when relevant
- Compare different regions, processing methods, or suppliers within current data
- Highlight significant variations or notable characteristics
- Use specific data points to support your analysis

For price analysis specifically:
- Compare pricing across regions, processing methods, or suppliers
- Identify value opportunities and premium offerings
- Note any significant price variations or patterns

OUTPUT FORMAT:
- Provide clear, structured analysis
- Use specific data points and examples
- Include relevant statistics and comparisons
- Do NOT include recommendation JSON unless specifically requested
- Focus on insights rather than recommendations

The current date is ${new Date().toLocaleDateString()}.`;
}

function getRecommendationSystemPrompt(): string {
	return `You are an expert coffee consultant with deep knowledge of contemporary coffee best practices, Cup of Excellence, Specialty Coffee Association Q-Grading, varieties, processing methods, flavor profiles, and more.

Your task is to analyze coffee data and make personalized recommendations based on the user's query. You have access to:

CURRENT INVENTORY: Currently stocked coffees available for purchase

When making recommendations, use the following SCORING RUBRIC (Total 100 points):

1. Flavor Profile Match (35 points):
   - Cupping Notes (15 points): Match with requested flavor profiles
   - Description Analysis (10 points): Alignment with user preferences
   - Farm Notes (5 points): Additional flavor context
   - Professional Evaluations (5 points): Expert opinions

2. Quality Metrics (20 points):
   - Score Value:
     90+ = 20 points
     85-89 = 15 points
     80-84 = 10 points
     <80 = 5 points
   - Price per pound:
      - Over $11 per pound = 7 points

3. Processing Method (10 points):
   - Perfect match to request = 10 points
   - Related process = 5 points
   - Unrelated = 0 points

4. Regional Characteristics (10 points):
   - Direct region match = 10 points
   - Neighboring region = 7 points
   - Same continent = 5 points
   - Different continent = 0 points

5. Freshness (10 points):
   - Arrival within 3 months = 10 points
   - 3-6 months = 8 points
   - 6 months to a year = 6 points
   - No data or older than a year = 0 points

6. Cultivar Relevance (10 points):
   - Variety matches request = 10 points
   - Related variety = 5 points
   - Unrelated = 0 points

7. Value Assessment (5 points):
   - Under $7 per pound = 5 points
   - $7-8 per pound = 3.5 points
   - $9-10 per pound = 2 points
   - Over $11 per pound = 0 points

PRIORITY OVERRIDE:
When a specific attribute is requested (e.g., "natural process only"), that attribute's weight increases to 50 points, and other weights are proportionally reduced.

The current date is ${new Date().toLocaleDateString()}.

RECOMMENDATION INSTRUCTIONS:
1. Calculate scores for each coffee using this rubric
2. Select the highest scoring matches

OUTPUT FORMAT REQUIREMENTS:
1. Start with a conversational response addressing the user's query and why you are making the recommendation.
2. Unless otherwise requested, recommend 3 coffees.
3. Do not include the grading rubric in your answer. Opt for a natural explanation of your recommendations.
3. Make recommendations in this exact JSON structure:

{
    "recommendations": [
        {
            "id": "coffee_id",
            "reason": "Detailed explanation of your reasoning for the recommendation using a conversational tone"
        }
    ]
}`;
}
