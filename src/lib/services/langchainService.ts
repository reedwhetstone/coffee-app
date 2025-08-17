import { ChatOpenAI } from '@langchain/openai';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { BufferMemory } from 'langchain/memory';
import { DynamicStructuredTool } from '@langchain/core/tools';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { BaseMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { createChatLogger, type ChatLogger } from './chatLogger.js';

export interface ChatMessage {
	role: 'user' | 'assistant';
	content: string;
	timestamp: Date;
}

export interface StructuredChatResponse {
	message: string; // Markdown-formatted text
	coffee_cards?: number[]; // Array of coffee_catalog.id values
	response_type: 'text' | 'cards' | 'mixed';
	// Extensible structure for future structured data types
	[key: string]: any; // Allow additional structured data fields
}

export interface ChatResponse {
	response: string;
	structured_response?: StructuredChatResponse;
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
	private logger: ChatLogger;

	constructor(
		openaiApiKey: string,
		supabase: SupabaseClient,
		baseUrl: string = '',
		authHeaders: Record<string, string> = {}
	) {
		this.openaiApiKey = openaiApiKey;
		this.supabase = supabase;
		this.baseUrl = baseUrl;
		this.authHeaders = authHeaders;
		this.logger = createChatLogger();

		// Initialize the chat model with GPT-5 for complex tool orchestration
		this.model = new ChatOpenAI({
			apiKey: this.openaiApiKey,
			model: 'gpt-5-mini-2025-08-07', // Use full GPT-5 for tool calling
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
				description:
					'Search for coffee beans in the catalog with filters for origin, processing, variety, price range, flavor keywords, coffee name, recent arrivals, and specific coffee IDs',
				schema: z.object({
					origin: z.string().optional().describe('Coffee origin (country, region, or continent)'),
					process: z
						.string()
						.optional()
						.describe('Processing method (natural, washed, honey, etc.)'),
					variety: z.string().optional().describe('Coffee variety/cultivar'),
					price_range: z.array(z.number()).length(2).optional().describe('Price range [min, max]'),
					flavor_keywords: z.array(z.string()).optional().describe('Flavor descriptors'),
					score_min: z.number().optional().describe('Minimum cupping score'),
					score_max: z.number().optional().describe('Maximum cupping score'),
					limit: z.number().optional().describe('Number of results to return (max 15)').default(10),
					stocked_only: z
						.boolean()
						.optional()
						.describe(
							'Only show currently stocked coffees (default: true, use false for historical analysis)'
						)
						.default(true),
					name: z.string().optional().describe('Search by coffee name'),
					stocked_days: z
						.number()
						.optional()
						.describe('Find coffees stocked within this many days'),
					drying_method: z
						.string()
						.optional()
						.describe('Drying method (sun-dried, patio-dried, etc.)'),
					coffee_ids: z.array(z.number()).optional().describe('Specific coffee IDs to retrieve')
				}),
				func: async (input) => {
					this.logger.logToolCall('coffee_catalog_search', input);
					const result = await this.callTool('/api/tools/coffee-catalog', input);
					this.logger.logToolResponse('coffee_catalog_search', result, true);
					return result;
				}
			}),

			// User's Green Coffee Inventory Tool
			new DynamicStructuredTool({
				name: 'green_coffee_inventory',
				description:
					"Get the user's personal coffee inventory with purchase history and roast summaries",
				schema: z.object({
					stocked_only: z
						.boolean()
						.optional()
						.describe(
							'Only show currently stocked beans (default: true, use false for historical analysis)'
						)
						.default(true),
					include_catalog_details: z
						.boolean()
						.optional()
						.describe('Include full catalog information'),
					include_roast_summary: z.boolean().optional().describe('Include roasting statistics'),
					limit: z.number().optional().describe('Number of results to return (max 15)').default(15)
				}),
				func: async (input) => {
					this.logger.logToolCall('green_coffee_inventory', input);
					const result = await this.callTool('/api/tools/green-coffee-inv', input);
					this.logger.logToolResponse('green_coffee_inventory', result, true);
					return result;
				}
			}),

			// Roast Profiles Tool
			new DynamicStructuredTool({
				name: 'roast_profiles',
				description: "Get user's roast profiles with filtering and summary statistics",
				schema: z.object({
					roast_id: z.string().optional().describe('Specific roast ID'),
					roast_name: z.string().optional().describe('Search by roast name'),
					batch_name: z.string().optional().describe('Search by batch name'),
					coffee_id: z.number().optional().describe('Filter by green coffee inventory ID'),
					catalog_id: z
						.number()
						.optional()
						.describe(
							'Filter by catalog ID (use this when you have an ID from coffee_catalog_search)'
						),
					limit: z.number().optional().describe('Number of results (max 15)').default(10),
					include_calculations: z
						.boolean()
						.optional()
						.describe('Include summary calculations')
						.default(true),
					stocked_only: z
						.boolean()
						.optional()
						.describe(
							'Only show roasts for currently stocked coffee (default: true, use false for historical analysis)'
						)
						.default(true)
				}),
				func: async (input) => {
					this.logger.logToolCall('roast_profiles', input);
					const result = await this.callTool('/api/tools/roast-profiles', input);
					this.logger.logToolResponse('roast_profiles', result, true);
					return result;
				}
			}),

			// Bean Tasting Notes Tool
			new DynamicStructuredTool({
				name: 'bean_tasting_notes',
				description:
					'Get tasting notes and radar chart data for a specific coffee bean; user data, supplier data, or both',
				schema: z.object({
					bean_id: z.number().describe('Required coffee bean ID'),
					filter: z.enum(['user', 'supplier', 'both']).describe('Which tasting notes to include'),
					include_radar_data: z.boolean().optional().describe('Include radar chart data')
				}),
				func: async (input) => {
					this.logger.logToolCall('bean_tasting_notes', input);
					const result = await this.callTool('/api/tools/bean-tasting', input);
					this.logger.logToolResponse('bean_tasting_notes', result, true);
					return result;
				}
			})

			// // Coffee Knowledge Base Tool - commenting this out until the vector db actually has good data.. right now it's not good.
			// new DynamicStructuredTool({
			// 	name: 'coffee_knowledge',
			// 	description:
			// 		'Search the coffee knowledge base for educational content about roasting, brewing, and coffee science',
			// 	schema: z.object({
			// 		context_string: z.string().describe('Required search query for knowledge retrieval'),
			// 		chunk_types: z
			// 			.array(z.enum(['profile', 'tasting', 'origin', 'commercial', 'processing']))
			// 			.optional()
			// 			.describe('Types of knowledge chunks to search'),
			// 		max_chunks: z
			// 			.number()
			// 			.optional()
			// 			.describe('Maximum number of knowledge chunks to return'),
			// 		similarity_threshold: z.number().optional().describe('Similarity threshold for matching')
			// 	}),
			// 	func: async (input) => {
			// 		this.logger.logToolCall('coffee_knowledge', input);
			// 		const result = await this.callTool('/api/tools/coffee-chunks', input);
			// 		this.logger.logToolResponse('coffee_knowledge', result, true);
			// 		return result;
			// 	}
			// })
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
				throw new Error(
					`Tool call failed: ${response.status} ${response.statusText} - ${errorText}`
				);
			}

			const result = await response.json();
			return JSON.stringify(result, null, 2);
		} catch (error) {
			const errorMessage = `Failed to call ${endpoint}: ${error instanceof Error ? error.message : 'Unknown error'}`;
			this.logger.logError(
				error instanceof Error ? error : errorMessage,
				`Tool call to ${endpoint}`
			);
			return JSON.stringify({ error: errorMessage });
		}
	}

	/**
	 * Initialize the agent with tools
	 */
	async initializeAgent(): Promise<void> {
		const prompt = ChatPromptTemplate.fromMessages([
			[
				'system',
				`You are an expert coffee consultant who combines deep knowledge of coffee varieties, 
processing methods, roasting techniques, and flavor profiles with practical guidance. 
Your goal is to help coffee enthusiasts and professionals make informed, actionable 
decisions about coffee selection, roasting, and brewing.

TOOL USAGE
You have access to 4 specialized tools (max 15 results each). You MUST use them strategically, 
and only when needed:
1. coffee_catalog_search - Query supplier inventories of green coffee
2. green_coffee_inventory - Query the users personal green coffee inventory & notes 
   (these rows may reference catalog entries or independent purchases)
3. roast_profiles - Analyze user's roasting data
4. bean_tasting_notes - Retrieve or analyze detailed flavor profiles (user vs supplier)

CONSTRAINTS
- You must not exceed: **3 tool execution rounds** and **7 total tool calls per user request**
- Always use stocked_only=true filters unless the user explicitly asks for historical or sold-out coffees
- Each tool call returns at most 15 results
- Use tools only when they add real value. General knowledge questions may not require tools.

STRATEGIC APPROACH
1. Parse the user request → identify whether tools are needed
2. If tools are needed, call the most relevant one(s) with focused filters
3. Prefer currently available inventory unless explicitly asked otherwise
4. Provide recommendations that are practical, specific, and usable today
5. If tools fail or return no results → acknowledge it, explain, and give general guidance

RESPONSE FORMAT
You MUST always return valid JSON with the following structure:
{{
  "message": "Markdown-formatted answer with headers, bullet lists, bold text, etc.",
  "coffee_cards": [list of coffee ID numbers or [] if none],
  "response_type": "text" | "cards" | "mixed"
			}}

RULES
- Include coffee IDs only when recommending specific coffees (never roast IDs)
- Omit or use an empty array for coffee_cards when no coffees are directly referenced
- Be conversational, encouraging, and enthusiastic about coffee while remaining precise
- Always ground advice in data where possible (tool results, user data)
- Default to stocked data; only fetch historical when explicitly requested"`
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

		// Create agent executor with limited iterations to prevent context bloat
		this.agent = new AgentExecutor({
			agent: agent,
			tools: this.tools,
			memory: this.memory,
			verbose: false, // Disable verbose LangChain logging
			maxIterations: 3, // Reduced from 5 to enforce strategic tool usage
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
			// Log user prompt
			this.logger.logUserPrompt(message, conversationHistory);

			// Initialize agent if not already done
			if (!this.agent) {
				await this.initializeAgent();
			}

			// Log LLM processing start
			this.logger.logLLMThinking('Starting message processing with GPT-5', {
				model: 'gpt-5-2025-08-07',
				max_iterations: 5
			});

			// Execute the agent with tool calling
			const result = await this.agent!.invoke({
				input: message,
				chat_history: conversationHistory.map((msg) => `${msg.role}: ${msg.content}`).join('\n')
			});

			// Extract tool calls from intermediate steps
			const toolCalls =
				result.intermediateSteps?.map((step: any) => ({
					tool: step.action?.tool || 'unknown',
					input: step.action?.toolInput || {},
					output: step.observation || null
				})) || [];

			// Log tool usage for monitoring
			if (toolCalls.length > 7) {
				this.logger.logError(
					new Error(`Excessive tool calls: ${toolCalls.length} calls made`),
					'Tool call limit exceeded'
				);
			}

			const finalResponse =
				result.output ||
				result.text ||
				'I apologize, but I encountered an issue processing your request.';

			// Log final response
			this.logger.logFinalResponse(finalResponse, toolCalls, {
				user_id: userId,
				iterations: result.intermediateSteps?.length || 0
			});

			// Log conversation summary if this seems like a completion
			if (toolCalls.length > 0) {
				this.logger.logConversationSummary();
			}

			return {
				response: finalResponse,
				tool_calls: toolCalls,
				conversation_id: userId ? `${userId}_${Date.now()}` : undefined
			};
		} catch (error) {
			this.logger.logError(error instanceof Error ? error : String(error), 'Message processing');
			throw new Error(
				`Failed to process message: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}

	/**
	 * Process a chat message with streaming thinking steps using LangChain's native streamEvents
	 */
	async processMessageWithStreaming(
		message: string,
		conversationHistory: ChatMessage[] = [],
		userId?: string,
		onThinkingStep?: (step: string) => void
	): Promise<ChatResponse> {
		try {
			// Simple string-based deduplication
			let lastThinkingStep = '';

			// Helper to emit only new thinking steps
			const emitThinkingStep = (step: string) => {
				if (step !== lastThinkingStep) {
					lastThinkingStep = step;
					onThinkingStep?.(step);
				}
			};

			// Log user prompt
			this.logger.logUserPrompt(message, conversationHistory);
			emitThinkingStep('Analyzing your request...');

			// Initialize agent if not already done
			if (!this.agent) {
				await this.initializeAgent();
				emitThinkingStep('AI assistant initialized');
			}

			// Log LLM processing start
			this.logger.logLLMThinking('Starting message processing with GPT-5', {
				model: 'gpt-5-2025-08-07',
				max_iterations: 5
			});

			emitThinkingStep('Planning approach to your question...');

			// Use LangChain's native streamEvents for real-time intermediate steps
			const streamingEvents = this.agent!.streamEvents(
				{
					input: message,
					chat_history: conversationHistory.map((msg) => `${msg.role}: ${msg.content}`).join('\n')
				},
				{ version: 'v2' }
			);

			const toolCalls: Array<{ tool: string; input: any; output: any }> = [];
			let finalResponse = '';
			let executorStarted = false;

			// Process events as they stream in
			for await (const event of streamingEvents) {
				// Map event types to user-friendly thinking steps
				if (event.event === 'on_tool_start') {
					const toolName = event.name;
					this.mapToolToThinkingStep(toolName, 'start', emitThinkingStep);
				} else if (event.event === 'on_tool_end') {
					const toolName = event.name;
					// Remove completion messages to avoid repetition
					// this.mapToolToThinkingStep(toolName, 'end', onThinkingStep);

					// Collect tool call data
					toolCalls.push({
						tool: toolName,
						input: event.data?.input || {},
						output: event.data?.output || null
					});

					// Check tool call limit
					if (toolCalls.length > 7) {
						emitThinkingStep('Tool call limit reached - finalizing response...');
						break;
					}
				} else if (
					event.event === 'on_chain_start' &&
					event.name === 'AgentExecutor' &&
					!executorStarted
				) {
					emitThinkingStep('Executing reasoning process...');
					executorStarted = true;
				} else if (event.event === 'on_llm_start') {
					emitThinkingStep('Generating response...');
				} else if (event.event === 'on_chain_end' && event.name === 'AgentExecutor') {
					finalResponse = event.data?.output?.output || event.data?.output || '';
					emitThinkingStep('Synthesizing final response...');
				}
			}

			// Fallback response if streaming didn't capture it
			if (!finalResponse) {
				finalResponse = 'I apologize, but I encountered an issue processing your request.';
			}

			// Log final response
			this.logger.logFinalResponse(finalResponse, toolCalls, {
				user_id: userId,
				iterations: toolCalls.length
			});

			// Log conversation summary if this seems like a completion
			if (toolCalls.length > 0) {
				this.logger.logConversationSummary();
			}

			return {
				response: finalResponse,
				tool_calls: toolCalls,
				conversation_id: userId ? `${userId}_${Date.now()}` : undefined
			};
		} catch (error) {
			this.logger.logError(error instanceof Error ? error : String(error), 'Message processing');
			throw new Error(
				`Failed to process message: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}

	/**
	 * Map tool names to user-friendly thinking steps
	 */
	private mapToolToThinkingStep(
		toolName: string,
		phase: 'start' | 'end',
		onThinkingStep?: (step: string) => void
	): void {
		if (phase === 'start') {
			switch (toolName) {
				case 'coffee_catalog_search':
					onThinkingStep?.('Searching coffee catalog...');
					break;
				case 'green_coffee_inventory':
					onThinkingStep?.('Analyzing your coffee inventory...');
					break;
				case 'roast_profiles':
					onThinkingStep?.('Reviewing your roasting history...');
					break;
				case 'bean_tasting_notes':
					onThinkingStep?.('Checking flavor profiles...');
					break;
				case 'coffee_knowledge':
					onThinkingStep?.('Consulting coffee knowledge base...');
					break;
				default:
					onThinkingStep?.(`Processing ${toolName}...`);
			}
			// } else if (phase === 'end') {
			// 	switch (toolName) {
			// 		case 'coffee_catalog_search':
			// 			onThinkingStep?.('Coffee catalog search completed');
			// 			break;
			// 		case 'green_coffee_inventory':
			// 			onThinkingStep?.('Inventory analysis completed');
			// 			break;
			// 		case 'roast_profiles':
			// 			onThinkingStep?.('Roasting history review completed');
			// 			break;
			// 		case 'roast_chart_data':
			// 			onThinkingStep?.('Roast data analysis completed');
			// 			break;
			// 		case 'bean_tasting_notes':
			// 			onThinkingStep?.('Flavor profile analysis completed');
			// 			break;
			// 		case 'coffee_knowledge':
			// 			onThinkingStep?.('Knowledge base consultation completed');
			// 			break;
			// 		default:
			// 			onThinkingStep?.(`${toolName} processing completed`);
			// 	}
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
