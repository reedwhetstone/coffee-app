import { ChatOpenAI } from '@langchain/openai';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { BufferMemory } from 'langchain/memory';
import { DynamicStructuredTool } from '@langchain/core/tools';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { BaseMessage } from '@langchain/core/messages';
import { z } from 'zod';

export interface ChatMessage {
	role: 'user' | 'assistant';
	content: string;
	timestamp: Date;
}

export interface ChatResponse {
	response: string;
	tool_calls?: Array<{
		tool: string;
		input: any;
		output: any;
	}>;
	conversation_id?: string;
}

export class LangChainService {
	private openaiApiKey: string;
	private supabase: SupabaseClient;
	private model: ChatOpenAI;
	private memory: BufferMemory;
	private agent?: AgentExecutor;
	private tools: DynamicStructuredTool[];
	private baseUrl: string;
	private authHeaders: Record<string, string>;

	constructor(openaiApiKey: string, supabase: SupabaseClient, baseUrl: string = '', authHeaders: Record<string, string> = {}) {
		this.openaiApiKey = openaiApiKey;
		this.supabase = supabase;
		this.baseUrl = baseUrl;
		this.authHeaders = authHeaders;

		// Initialize the chat model with GPT-5 for complex tool orchestration
		this.model = new ChatOpenAI({
			apiKey: this.openaiApiKey,
			model: 'gpt-5-2025-08-07', // Use full GPT-5 for tool calling
			// Note: GPT-5 models do not support temperature parameter
			maxTokens: 4096,
			streaming: false
		});

		// Initialize memory for conversation context
		this.memory = new BufferMemory({
			memoryKey: 'chat_history',
			returnMessages: true,
			inputKey: 'input',
			outputKey: 'output'
		});

		// Initialize tools
		this.tools = this.createTools();
	}

	/**
	 * Create all available tools for the agent
	 */
	private createTools(): DynamicStructuredTool[] {
		return [
			// Coffee Catalog Search Tool
			new DynamicStructuredTool({
				name: 'coffee_catalog_search',
				description: 'Search for coffee beans in the catalog with filters for origin, processing, variety, price range, and flavor keywords',
				schema: z.object({
					origin: z.string().optional().describe('Coffee origin (country, region, or continent)'),
					process: z.string().optional().describe('Processing method (natural, washed, honey, etc.)'),
					variety: z.string().optional().describe('Coffee variety/cultivar'),
					price_range: z.array(z.number()).length(2).optional().describe('Price range [min, max]'),
					flavor_keywords: z.array(z.string()).optional().describe('Flavor descriptors'),
					score_min: z.number().optional().describe('Minimum cupping score'),
					score_max: z.number().optional().describe('Maximum cupping score'),
					limit: z.number().optional().describe('Number of results to return'),
					stocked_only: z.boolean().optional().describe('Only show currently stocked coffees')
				}),
				func: async (input) => this.callTool('/api/tools/coffee-catalog', input)
			}),

			// User's Green Coffee Inventory Tool
			new DynamicStructuredTool({
				name: 'green_coffee_inventory',
				description: 'Get the user\'s personal coffee inventory with purchase history and roast summaries',
				schema: z.object({
					stocked_only: z.boolean().optional().describe('Only show currently stocked beans'),
					include_catalog_details: z.boolean().optional().describe('Include full catalog information'),
					include_roast_summary: z.boolean().optional().describe('Include roasting statistics'),
					limit: z.number().optional().describe('Number of results to return')
				}),
				func: async (input) => this.callTool('/api/tools/green-coffee-inv', input)
			}),

			// Roast Profiles Tool
			new DynamicStructuredTool({
				name: 'roast_profiles',
				description: 'Get user\'s roast profiles with filtering and summary statistics',
				schema: z.object({
					roast_id: z.string().optional().describe('Specific roast ID'),
					roast_name: z.string().optional().describe('Search by roast name'),
					batch_name: z.string().optional().describe('Search by batch name'),
					coffee_id: z.number().optional().describe('Filter by coffee ID'),
					limit: z.number().optional().describe('Number of results'),
					include_calculations: z.boolean().optional().describe('Include summary calculations')
				}),
				func: async (input) => this.callTool('/api/tools/roast-profiles', input)
			}),

			// Roast Chart Data Tool
			new DynamicStructuredTool({
				name: 'roast_chart_data',
				description: 'Get detailed roast chart data including temperature curves and events for a specific roast',
				schema: z.object({
					roast_id: z.string().describe('Required roast ID'),
					include_events: z.boolean().optional().describe('Include roast events'),
					include_temperature_data: z.boolean().optional().describe('Include temperature data')
				}),
				func: async (input) => this.callTool('/api/tools/roast-chart', input)
			}),

			// Bean Tasting Notes Tool
			new DynamicStructuredTool({
				name: 'bean_tasting_notes',
				description: 'Get tasting notes and radar chart data for a specific coffee bean',
				schema: z.object({
					bean_id: z.number().describe('Required coffee bean ID'),
					filter: z.enum(['user', 'supplier', 'both']).describe('Which tasting notes to include'),
					include_radar_data: z.boolean().optional().describe('Include radar chart data')
				}),
				func: async (input) => this.callTool('/api/tools/bean-tasting', input)
			}),

			// Coffee Knowledge Base Tool
			new DynamicStructuredTool({
				name: 'coffee_knowledge',
				description: 'Search the coffee knowledge base for educational content about roasting, brewing, and coffee science',
				schema: z.object({
					context_string: z.string().describe('Required search query for knowledge retrieval'),
					chunk_types: z.array(z.enum(['profile', 'tasting', 'origin', 'commercial', 'processing'])).optional().describe('Types of knowledge chunks to search'),
					max_chunks: z.number().optional().describe('Maximum number of knowledge chunks to return'),
					similarity_threshold: z.number().optional().describe('Similarity threshold for matching')
				}),
				func: async (input) => this.callTool('/api/tools/coffee-chunks', input)
			})
		];
	}

	/**
	 * Call a tool endpoint with proper authentication
	 */
	private async callTool(endpoint: string, input: any): Promise<string> {
		try {
			const url = this.baseUrl + endpoint;
			const response = await fetch(url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...this.authHeaders
				},
				body: JSON.stringify(input)
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`Tool call failed: ${response.status} ${response.statusText} - ${errorText}`);
			}

			const result = await response.json();
			return JSON.stringify(result, null, 2);
		} catch (error) {
			console.error(`Tool call error for ${endpoint}:`, error);
			return JSON.stringify({ 
				error: `Failed to call ${endpoint}: ${error instanceof Error ? error.message : 'Unknown error'}` 
			});
		}
	}

	/**
	 * Initialize the agent with tools
	 */
	async initializeAgent(): Promise<void> {
		const prompt = ChatPromptTemplate.fromMessages([
			[
				'system',
				`You are an expert coffee consultant with deep knowledge of coffee varieties, processing methods, 
				roasting techniques, and flavor profiles. You help coffee enthusiasts and professionals make 
				informed decisions about coffee selection, roasting, and brewing.

				You have access to several tools to help users:
				1. coffee_catalog_search - Find and recommend coffee beans
				2. green_coffee_inventory - View user's personal coffee inventory  
				3. roast_profiles - Analyze user's roasting history and profiles
				4. roast_chart_data - Get detailed roast curves and data
				5. bean_tasting_notes - Get tasting notes and flavor profiles
				6. coffee_knowledge - Search educational content about coffee

				Guidelines:
				- Use tools proactively to provide helpful, data-driven responses
				- When users ask for coffee recommendations, use coffee_catalog_search
				- When discussing their inventory or beans, use green_coffee_inventory
				- For roasting advice, combine roast_profiles with coffee_knowledge
				- Always provide practical, actionable advice
				- Be conversational and enthusiastic about coffee
				- If a tool call fails, acknowledge it and provide general guidance`
			],
			['placeholder', '{chat_history}'],
			['human', '{input}'],
			['placeholder', '{agent_scratchpad}']
		]);

		// Create tool-calling agent
		const agent = await createToolCallingAgent({
			llm: this.model,
			tools: this.tools,
			prompt: prompt
		});

		// Create agent executor
		this.agent = new AgentExecutor({
			agent: agent,
			tools: this.tools,
			memory: this.memory,
			verbose: true,
			maxIterations: 5,
			returnIntermediateSteps: true
		});
	}

	/**
	 * Process a chat message and return AI response
	 */
	async processMessage(
		message: string,
		conversationHistory: ChatMessage[] = [],
		userId?: string
	): Promise<ChatResponse> {
		try {
			// Initialize agent if not already done
			if (!this.agent) {
				await this.initializeAgent();
			}

			// Execute the agent with tool calling
			const result = await this.agent!.invoke({
				input: message,
				chat_history: conversationHistory.map(msg => 
					`${msg.role}: ${msg.content}`
				).join('\n')
			});

			// Extract tool calls from intermediate steps
			const toolCalls = result.intermediateSteps?.map((step: any) => ({
				tool: step.action?.tool || 'unknown',
				input: step.action?.toolInput || {},
				output: step.observation || null
			})) || [];

			return {
				response: result.output || result.text || 'I apologize, but I encountered an issue processing your request.',
				tool_calls: toolCalls,
				conversation_id: userId ? `${userId}_${Date.now()}` : undefined
			};
		} catch (error) {
			console.error('LangChain service error:', error);
			throw new Error(
				`Failed to process message: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}

	/**
	 * Clear conversation memory
	 */
	async clearMemory(): Promise<void> {
		this.memory.clear();
	}

	/**
	 * Get conversation history from memory
	 */
	async getConversationHistory(): Promise<BaseMessage[]> {
		const messages = await this.memory.chatHistory.getMessages();
		return messages;
	}

	/**
	 * Update model configuration (for future GPT-5 upgrade)
	 */
	updateModel(modelName: string, temperature?: number): void {
		// GPT-5 models do not support temperature parameter at all
		const isGPT5 = modelName.includes('gpt-5');
		
		const modelConfig: any = {
			apiKey: this.openaiApiKey,
			model: modelName,
			maxTokens: 4096,
			streaming: false
		};

		// Only set temperature for non-GPT-5 models
		if (!isGPT5 && temperature !== undefined) {
			modelConfig.temperature = temperature;
		}

		this.model = new ChatOpenAI(modelConfig);

		// Reset agent to use new model
		this.agent = undefined;
	}

	/**
	 * Health check for the service
	 */
	async healthCheck(): Promise<boolean> {
		try {
			const testResponse = await this.model.invoke('Hello, can you respond with just "OK"?');
			return testResponse.content.toString().includes('OK');
		} catch (error) {
			console.error('LangChain health check failed:', error);
			return false;
		}
	}
}

/**
 * Factory function to create LangChain service instance
 */
export function createLangChainService(
	openaiApiKey: string,
	supabase: SupabaseClient,
	baseUrl: string = '',
	authHeaders: Record<string, string> = {}
): LangChainService {
	return new LangChainService(openaiApiKey, supabase, baseUrl, authHeaders);
}
