import { json } from '@sveltejs/kit';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AI_API_KEY } from '$env/static/private';
import type { RequestHandler } from './$types';

const genAI = new GoogleGenerativeAI(AI_API_KEY);

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { prompt, coffeeData } = await request.json();

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
							text: `You are an expert coffee consultant with deep knowledge of coffee varieties, processing methods, and flavor profiles. Your task is to analyze coffee data and make personalized recommendations using this precise scoring system:

SCORING RUBRIC (Total 100 points):

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
1. Start with a conversational response addressing the user's query 
2. Unless otherwise requested, recommend 3 coffees
3. Follow with recommendations in this exact JSON structure:

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
							text: "I understand my role and will use the detailed scoring rubric to evaluate coffees systematically. I'll provide scored recommendations with clear explanations of how each coffee earned its selection, following the specified output format."
						}
					]
				}
			]
		});

		const result = await chatSession.sendMessage(
			`AVAILABLE COFFEE INVENTORY:\n${JSON.stringify(coffeeData, null, 2)}\n\nUSER QUERY: ${prompt}\n\n`
		);

		const response = await result.response;
		return json({ text: response.text() });
	} catch (error) {
		console.error('Server error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Unknown error' },
			{ status: 500 }
		);
	}
};
