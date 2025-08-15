import { ChatOpenAI } from '@langchain/openai';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { pull } from 'langchain/hub';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { BufferMemory } from 'langchain/memory';
import { ConversationChain } from 'langchain/chains';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { BaseMessage } from '@langchain/core/messages';

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

	constructor(openaiApiKey: string, supabase: SupabaseClient) {
		this.openaiApiKey = openaiApiKey;
		this.supabase = supabase;

		// Initialize the chat model
		//gpt-5-2025-08-07
		//gpt-5-mini-2025-08-07
		//gpt-5-nano-2025-08-07
		this.model = new ChatOpenAI({
			apiKey: this.openaiApiKey,
			model: 'gpt-5-nano-2025-08-07',
			// Note: GPT-5 models do not support temperature parameter
			maxTokens: 4096,
			streaming: false
		});

		// Initialize memory for conversation context
		this.memory = new BufferMemory({
			memoryKey: 'chat_history',
			returnMessages: true,
			inputKey: 'input',
			outputKey: 'response' // Match the expected output key
		});
	}

	/**
	 * Initialize the agent with tools
	 * This will be expanded in Phase 2 when we add the tool functions
	 */
	async initializeAgent(): Promise<void> {
		// For now, create a basic conversation chain
		// TODO: Replace with tool-calling agent in Phase 2

		const prompt = ChatPromptTemplate.fromTemplate(`
			You are an expert coffee consultant with deep knowledge of coffee varieties, processing methods, 
			roasting techniques, and flavor profiles. You help coffee enthusiasts and professionals make 
			informed decisions about coffee selection, roasting, and brewing.

			Current conversation:
			{chat_history}

			Human: {input}
			Assistant: `);

		// Create a simple conversation chain for now
		const chain = new ConversationChain({
			llm: this.model,
			memory: this.memory,
			prompt: prompt,
			outputKey: 'response' // Explicitly specify the output key
		});

		// Store reference for later use
		this.agent = chain as any; // Type workaround for now
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

			// For now, use simple conversation chain
			// TODO: Replace with agent executor in Phase 2
			const result = await (this.agent as any).invoke({
				input: message
			});

			return {
				response: result.response || result.text || result.output,
				tool_calls: [], // Will be populated in Phase 2
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
	supabase: SupabaseClient
): LangChainService {
	return new LangChainService(openaiApiKey, supabase);
}
