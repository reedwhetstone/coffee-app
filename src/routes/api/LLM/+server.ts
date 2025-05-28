import { json } from '@sveltejs/kit';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AI_API_KEY, OPENAI_API_KEY } from '$env/static/private';
import { RAGService } from '$lib/services/ragService';
import type { RequestHandler } from './$types';

const genAI = new GoogleGenerativeAI(AI_API_KEY);

export const POST: RequestHandler = async ({ request, locals: { supabase } }) => {
	try {
		const { prompt, coffeeData } = await request.json();

		// Initialize RAG service
		const ragService = new RAGService(supabase, OPENAI_API_KEY);

		// Retrieve relevant coffee data using semantic search
		const retrievalResult = await ragService.retrieveRelevantCoffees(prompt, {
			maxCurrentInventory: 15,
			maxHistorical: 25,
			similarityThreshold: 0.3 // Lowered threshold to be more inclusive
		});

		console.log('RAG Service Results:', {
			currentInventoryCount: retrievalResult.currentInventory.length,
			historicalDataCount: retrievalResult.historicalData.length,
			prompt: prompt
		});

		const model = genAI.getGenerativeModel({
			model: 'gemini-2.0-flash-exp',
			generationConfig: {
				temperature: 0.1,
				topP: 0.95,
				topK: 40,
				maxOutputTokens: 8192
			}
		});

		let chatSession = model.startChat({
			history: [
				{
					role: 'user',
					parts: [
						{
							text: `You are an expert coffee consultant with deep knowledge of contemporary coffee best practices, Cup of Excellence, Specialty Coffee Association Q-Grading, varieties, processing methods, flavor profiles, and more.

Your task is to analyze coffee data and make personalized recommendations based on the user's query. You have access to:

1. CURRENT INVENTORY: Currently stocked coffees available for purchase
2. HISTORICAL DATA: Past coffees for context, trends, and comparison

Use the same scoring rubric as before, but now you can reference historical patterns, seasonal availability, and make more informed recommendations based on the broader context.

When making recommendations:
- Prioritize CURRENT INVENTORY for actual recommendations
- Use HISTORICAL DATA to provide context, explain trends, or suggest alternatives

If you are making a recommendation, use the following SCORING RUBRIC (Total 100 points):

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
}`
						}
					]
				},
				{
					role: 'model',
					parts: [
						{
							text: "I understand my enhanced role as a coffee expert with access to both current inventory and historical context. I'll use semantic search results to provide more informed recommendations, drawing on patterns from historical data while prioritizing currently available coffees."
						}
					]
				}
			]
		});

		const contextualPrompt = `
CURRENT INVENTORY (Available for Purchase):
${JSON.stringify(retrievalResult.currentInventory, null, 2)}

HISTORICAL CONTEXT (For Reference & Trends):
${JSON.stringify(retrievalResult.historicalData, null, 2)}

USER QUERY: ${prompt}

Please provide recommendations prioritizing CURRENT INVENTORY, but use the historical coffee data to provide richer context and explanations.
`;

		const result = await chatSession.sendMessage(contextualPrompt);
		const response = await result.response;

		return json({
			text: response.text(),
			metadata: {
				currentInventoryCount: retrievalResult.currentInventory.length,
				historicalDataCount: retrievalResult.historicalData.length
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
