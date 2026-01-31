/**
 * Structured logging service for LangChain chat conversations
 * Provides clean, readable console output for debugging and monitoring
 */

export interface LogMessage {
	timestamp: string;
	type: 'user_prompt' | 'llm_thinking' | 'tool_call' | 'tool_response' | 'final_response' | 'error';
	content: unknown;
	metadata?: Record<string, unknown>;
}

export class ChatLogger {
	private sessionId: string;
	private logs: LogMessage[] = [];

	constructor(sessionId: string = '') {
		this.sessionId = sessionId || `session_${Date.now()}`;
	}

	/**
	 * Log user prompt with clean formatting
	 */
	logUserPrompt(prompt: string, conversationHistory?: any[]): void {
		const logMessage: LogMessage = {
			timestamp: new Date().toISOString(),
			type: 'user_prompt',
			content: prompt,
			metadata: {
				sessionId: this.sessionId,
				historyLength: conversationHistory?.length || 0
			}
		};

		this.logs.push(logMessage);
		this.printCleanLog('🧑‍💼 USER PROMPT', prompt, {
			session: this.sessionId,
			history: `${conversationHistory?.length || 0} messages`
		});
	}

	/**
	 * Log LLM interpretation and thinking process
	 */
	logLLMThinking(thinking: string, metadata?: Record<string, unknown>): void {
		const logMessage: LogMessage = {
			timestamp: new Date().toISOString(),
			type: 'llm_thinking',
			content: thinking,
			metadata: { sessionId: this.sessionId, ...metadata }
		};

		this.logs.push(logMessage);
		this.printCleanLog('🤖 LLM THINKING', thinking, metadata);
	}

	/**
	 * Log tool call with input parameters
	 */
	logToolCall(toolName: string, input: unknown, metadata?: Record<string, unknown>): void {
		const logMessage: LogMessage = {
			timestamp: new Date().toISOString(),
			type: 'tool_call',
			content: { toolName, input },
			metadata: { sessionId: this.sessionId, ...metadata }
		};

		this.logs.push(logMessage);
		this.printCleanLog(`🔧 TOOL CALL: ${toolName}`, input, metadata);
	}

	/**
	 * Log tool response/output
	 */
	logToolResponse(
		toolName: string,
		output: unknown,
		success: boolean = true,
		metadata?: Record<string, unknown>
	): void {
		const logMessage: LogMessage = {
			timestamp: new Date().toISOString(),
			type: 'tool_response',
			content: { toolName, output, success },
			metadata: { sessionId: this.sessionId, ...metadata }
		};

		this.logs.push(logMessage);

		const icon = success ? '✅' : '❌';
		const status = success ? 'SUCCESS' : 'FAILED';
		this.printCleanLog(`${icon} TOOL RESPONSE: ${toolName} ${status}`, output, metadata);
	}

	/**
	 * Log final LLM response to user
	 */
	logFinalResponse(
		response: string,
		toolCalls?: unknown[],
		metadata?: Record<string, unknown>
	): void {
		const logMessage: LogMessage = {
			timestamp: new Date().toISOString(),
			type: 'final_response',
			content: response,
			metadata: {
				sessionId: this.sessionId,
				toolCallCount: toolCalls?.length || 0,
				...metadata
			}
		};

		this.logs.push(logMessage);
		this.printCleanLog('💬 FINAL RESPONSE', response, {
			tools_used: toolCalls?.length || 0,
			...metadata
		});
	}

	/**
	 * Log errors with context
	 */
	logError(error: Error | string, context?: string, metadata?: Record<string, unknown>): void {
		const errorMessage = error instanceof Error ? error.message : error;
		const errorStack = error instanceof Error ? error.stack : undefined;

		const logMessage: LogMessage = {
			timestamp: new Date().toISOString(),
			type: 'error',
			content: { message: errorMessage, stack: errorStack, context },
			metadata: { sessionId: this.sessionId, ...metadata }
		};

		this.logs.push(logMessage);
		this.printCleanLog(`❌ ERROR${context ? ` (${context})` : ''}`, errorMessage, metadata);

		if (errorStack) {
			console.error('Stack trace:', errorStack);
		}
	}

	/**
	 * Print a conversation summary
	 */
	logConversationSummary(): void {
		const summary = {
			sessionId: this.sessionId,
			totalMessages: this.logs.length,
			userPrompts: this.logs.filter((l) => l.type === 'user_prompt').length,
			toolCalls: this.logs.filter((l) => l.type === 'tool_call').length,
			responses: this.logs.filter((l) => l.type === 'final_response').length,
			errors: this.logs.filter((l) => l.type === 'error').length,
			duration:
				this.logs.length > 0
					? new Date(this.logs[this.logs.length - 1].timestamp).getTime() -
						new Date(this.logs[0].timestamp).getTime()
					: 0
		};

		this.printCleanLog('📊 CONVERSATION SUMMARY', summary);
	}

	/**
	 * Get all logs for this session
	 */
	getLogs(): LogMessage[] {
		return [...this.logs];
	}

	/**
	 * Clear logs for this session
	 */
	clearLogs(): void {
		this.logs = [];
	}

	/**
	 * Private method to print clean, formatted console output
	 */
	private printCleanLog(
		header: string,
		content: unknown,
		metadata?: Record<string, unknown>
	): void {
		const timestamp = new Date().toISOString().split('T')[1].split('.')[0]; // HH:MM:SS format

		console.log(`\n━━━ ${header} [${timestamp}] ━━━`);

		if (typeof content === 'string') {
			console.log(content);
		} else {
			console.log(JSON.stringify(content, null, 2));
		}

		if (metadata && Object.keys(metadata).length > 0) {
			console.log('📋 Metadata:', metadata);
		}

		console.log('━'.repeat(80));
	}
}

/**
 * Factory function to create a new chat logger instance
 */
export function createChatLogger(sessionId?: string): ChatLogger {
	return new ChatLogger(sessionId);
}
