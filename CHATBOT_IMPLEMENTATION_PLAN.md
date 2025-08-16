# Coffee Chatbot Implementation Plan

## Overview

This plan outlines the implementation of a sophisticated coffee chatbot that moves from the current home page integration to a dedicated `/chat` route with GPT-5, LangChain orchestration, and comprehensive tool-based function calling.

## Phase 4: Chat Interface & Components

### 4.1 Modern Chat UI

- **Conversation interface**: Message bubbles with sender identification
- **Loading states**: Typing indicators, tool execution feedback
- **Progressive disclosure**: Expandable structured responses
- **Export functionality**: Download conversation history (JSON/Markdown)
- **Mobile responsive**: Touch-friendly interface

### 4.2 Structured Response Components

- **Coffee Cards**: Reusable components for coffee recommendations
- **Roast Charts**: Integration with existing D3.js visualization
- **Tasting Notes**: Radar chart integration from existing components
- **Data Tables**: Structured display for analysis results
- **Tool indicators**: Visual feedback for which tools were called

### 4.3 Session Management

- **In-session storage**: Conversation history during active session
- **Export/Import**: Users can save and restore conversations
- **Context preservation**: Maintain conversation context for follow-up questions
- **Memory limits**: Efficient context window management

## Phase 5: Advanced Features

### 5.1 Two-Layer Hybrid Retrieval

- **Catalog search**: Combine pgvector similarity + tsvector keyword scoring
- **Ranking algorithm**: Weighted combination of semantic and keyword relevance
- **Fuzzy matching**: Handle variety/origin name variations
- **Smart fallbacks**: Progressive query expansion for zero-result scenarios

### 5.2 Enhanced Knowledge Base

- **Content expansion**:
  - Roasting best practices and techniques
  - Green coffee education and processing methods
  - Brewing guides and extraction theory
  - Coffee science and flavor development
- **Chunking strategy**: Optimize chunk size and overlap for RAG
- **Source attribution**: Track document_id for transparency
- **Multi-document synthesis**: Combine information from multiple sources

### 5.3 Security & Validation

- **JSON Schema validation**: Strict tool input/output validation
- **Tool allow-list**: Prevent execution of unauthorized functions
- **Prompt injection guards**: Sanitize retrieved content before LLM processing
- **RLS enforcement**: All user-bound tools respect Supabase Row Level Security
- **Rate limiting**: Prevent abuse and manage API costs

## Phase 6: Optimization & Polish

### 6.1 Performance Optimization

- **Caching strategy**: Store tool results per user/session
- **Request deduplication**: Avoid redundant API calls within conversations
- **Memory management**: Efficient LangChain memory usage
- **Context compression**: Smart summarization for long conversations

### 6.2 Error Handling & Monitoring

- **Error boundaries**: Graceful degradation for tool failures
- **Fallback responses**: Meaningful responses when tools are unavailable
- **Conversation analytics**: Track usage patterns and success metrics
- **Cost monitoring**: Track API usage and optimize spend

## Technical Implementation Details

### Database Schema

- **Minimal changes**: Leverage existing table structure
- **coffee_chunks expansion**: Add educational content types
- **Performance indices**: Add indices for common query patterns
- **Cleanup procedures**: Remove stale conversation data

### API Architecture

- **Consistent patterns**: All tools follow same input/output schema structure
- **Error handling**: Standardized error responses across endpoints
- **Authentication**: Leverage existing auth middleware
- **Versioning**: Plan for future API evolution

### LangChain Configuration

- **Agent setup**: Tool-calling agent with memory
- **Custom tools**: Define tools with strict JSON schemas
- **Memory configuration**: Conversation buffer with smart summarization
- **Error handling**: Retry logic and graceful degradation

### Frontend Architecture

- **SvelteKit 5**: Use proper $state, $derived, and $effect patterns
- **Component composition**: Reusable chat and response components
- **Progressive enhancement**: Core functionality without JavaScript
- **Accessibility**: Screen reader support and keyboard navigation

## Example Chat Query Flows

### Coffee Recommendation Query

```
User: "I need a natural processed Ethiopian. I want it to be really fruity. Hopefully stone fruit notes!"

1. Router classifies as: intent=catalog, filters={origin: "ethiopia", process: "natural", flavors: ["fruity", "stone fruit"]}
2. LangChain calls coffee-catalog tool with structured filters
3. Tool returns matching coffees with relevance scores
4. GPT-5 synthesizes response with recommendations
5. Frontend renders coffee cards with tasting notes
```

### Roasting Advice Query

```
User: "I really like this Ethiopian but I feel like I'm not getting the most out of it when roasting. What would you recommend for adjustments on my roast settings to pull more fruit body from the coffee?"

1. Router classifies as: intent=mixed (roast + knowledge)
2. LangChain calls multiple tools:
   - roast-profiles (user's roasting history)
   - coffee-chunks (roasting best practices)
   - bean-tasting (target flavor profile)
3. GPT-5 synthesizes technical roasting advice
4. Frontend renders roast charts and recommendations
```

### Analysis Query

```
User: "What would be the best way to roast this washed Puerto Rican coffee from Sweet Marias?"

1. Router classifies as: intent=knowledge + catalog
2. LangChain calls:
   - coffee-catalog (find specific coffee)
   - coffee-chunks (roasting guides for washed process)
3. GPT-5 provides detailed roasting recommendations
4. Frontend renders structured roasting profile suggestions
```

## Migration Strategy

### Phase 1: Infrastructure

1. Set up new `/chat` route alongside existing functionality
2. Install and configure LangChain dependencies
3. Create basic tool framework

### Phase 2: Tool Implementation

1. Implement tools one by one with thorough testing
2. Maintain existing home page chat during development
3. Add feature flags for gradual rollout

### Phase 3: Interface Migration

1. Move enhanced chat interface to dedicated route
2. Provide migration path for users
3. Maintain backward compatibility during transition

### Phase 4: Enhancement & Optimization

1. Add advanced features based on user feedback
2. Optimize performance and cost
3. Sunset old implementation

## Success Metrics

### User Engagement

- Session length and conversation depth
- Feature adoption rates
- User retention and return visits

### Technical Performance

- Response time and reliability
- Tool accuracy and relevance
- Cost per conversation

### Business Impact

- Coffee discovery and purchase conversion
- User satisfaction scores
- Premium feature engagement

## Future Enhancements

### Advanced AI Features

- **Multi-modal support**: Image analysis for coffee defects, roast color
- **Voice interface**: Speech-to-text for hands-free operation
- **Predictive analytics**: Suggest optimal roast profiles based on history

### Integration Expansion

- **IoT integration**: Connect with roasting equipment
- **Calendar integration**: Roasting schedule optimization
- **Social features**: Share roasts and recommendations

### Business Intelligence

- **Market analysis**: Price trends and availability forecasting
- **Inventory optimization**: Purchase timing recommendations
- **Quality correlation**: Link roasting parameters to cupping scores

## API References & Documentation

### OpenAI API Reference

- **Official Documentation**: https://platform.openai.com/docs/api-reference/introduction
- **Important Notes**:
  - **GPT-5 models do NOT support temperature parameter** - they use fixed internal settings
  - GPT-5 variants: `gpt-5-2025-08-07`, `gpt-5-mini-2025-08-07`, `gpt-5-nano-2025-08-07`
  - Use `model` parameter instead of `modelName` in newer OpenAI client versions
  - Use `apiKey` parameter instead of `openAIApiKey` in ChatOpenAI constructor

### LangChain Documentation

- **Official Documentation**: https://js.langchain.com/docs/introduction/
- **Key Integration Points**:
  - ChatOpenAI configuration for GPT-5 compatibility
  - Agent orchestration with tool calling
  - Memory management patterns
  - Custom tool definitions with JSON schemas

### Implementation Notes

- **Model Configuration**: GPT-5 models require minimal configuration (no temperature, fixed behavior)
- **Error Handling**: GPT-5 will reject temperature parameters with 400 error
- **Cost Optimization**: Use GPT-5-nano for routing, GPT-5 for complex synthesis
- **API Compatibility**: Always check latest OpenAI docs for parameter changes

### GPT-5 Tool Calling Audit (2025)

#### Key GPT-5 Tool Calling Enhancements

- **96.7% Success Rate**: GPT-5 achieves 96.7% on τ2-bench telecom tool calling benchmark
- **Improved Sequential/Parallel Calling**: Better at chaining dozens of tool calls in sequence and parallel
- **Enhanced Error Handling**: Better at dealing with tool errors and recovery
- **Proactive Tool Usage**: Can make tool calls without explicit instruction when beneficial

#### Two Tool Calling Approaches

**1. Traditional JSON Function Calling (Recommended for Our Use Case)**

- Use `tools` parameter with `"type": "function"`
- Enable `strict: true` for 100% JSON Schema compliance
- Supports parallel tool calling (multiple tools simultaneously)
- Perfect for structured data operations (our coffee catalog, inventory, roast data)

**2. Custom Tools (New in GPT-5)**

- Use `"type": "custom"` for raw text payloads (Python scripts, SQL, etc.)
- Grammar-constrained outputs via Context-Free Grammars (CFGs)
- **Does NOT support parallel calling**
- Better for code generation, but not needed for our structured data use case

#### Implementation Recommendations for Coffee Chatbot

- **Use Traditional JSON Function Calling** with `strict: true`
- **Enable Parallel Tool Calling** for efficiency (e.g., get inventory + roast profiles simultaneously)
- **Implement Comprehensive JSON Schemas** for all our 6 tools
- **Use GPT-5-nano for routing** (cost-effective, still supports tool calling)
- **Use GPT-5 for complex multi-tool orchestration**
- **Implement proper error handling** for tool call failures
- **Add progress messaging** for long-running multi-tool tasks

#### Tool Calling Architecture Decision

We'll use **Traditional JSON Function Calling** because:

- Our tools return structured data (perfect for JSON)
- We need parallel tool calling for efficiency
- 100% schema compliance with `strict: true`
- Better integration with LangChain agents
- Proven reliability for our use case

---

This implementation plan creates a production-ready, scalable chatbot that leverages modern AI capabilities while maintaining control over business logic and data access patterns. The modular approach allows for incremental development and testing while providing a clear path to a sophisticated coffee AI assistant.
