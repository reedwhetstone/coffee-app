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
				temperature: 0,
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
							text:
								'You are a coffee expert. Please help users find the perfect coffee based on their preferences and questions. The date is currently ' +
								new Date().toLocaleDateString() +
								'.'
						}
					]
				},
				{
					role: 'model',
					parts: [
						{
							text:
								"I'll help users find their perfect coffee match by leveraging my expertise and the available coffee data. I will only recommend coffees that are currently stocked. When possible, I will make recommendations based on the initial user request, without additional information from the user. I underdtand that today's date is " +
								new Date().toLocaleDateString() +
								'.'
						}
					]
				}
			]
		});

		const result = await chatSession.sendMessage(`
            You are a coffee expert. Use the following information to make informed recommendations:

            AVAILABLE STOCKED COFFEES:
            ${JSON.stringify(coffeeData, null, 2)}

            USER QUERY: ${prompt}

            TASK:
            Recommend 3 currently stocked coffees that best match the query.
            Consider freshness, scores, processing methods, and value.
            First, provide a natural language response to the user's query.
            Then, provide specific recommendations in the JSON format below.

            FORMAT RESPONSE AS:
            [Natural language response to the query]

            \`\`\`json
            {
                "recommendations": [
                    {
                        "id": "coffee_id",
                        "reason": "Detailed explanation of why this coffee matches the query"
                    }
                ]
            }
            \`\`\`
        `);

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
