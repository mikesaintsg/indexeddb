# @mikesaintsg Ecosystem — Integration Guide

> **Purpose:** Comprehensive guide for integrating packages in the `@mikesaintsg` ecosystem to build production-ready AI applications with RAG, tool calling, context management, and streaming responses.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Setup and Configuration](#setup-and-configuration)
3. [Complete Application Example](#complete-application-example)
4. [Step-by-Step Breakdown](#step-by-step-breakdown)
5. [Advanced Patterns](#advanced-patterns)
6. [Error Handling](#error-handling)
7. [Performance Optimization](#performance-optimization)
8. [Testing Strategies](#testing-strategies)

---

## Architecture Overview

### Package Responsibilities

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Your Application                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   Context    │  │    Tool      │  │   Vector     │  │  Inference   │ │
│  │   Builder    │  │   Registry   │  │    Store     │  │   Engine     │ │
│  │              │  │              │  │              │  │              │ │
│  │ • Sections   │  │ • Schemas    │  │ • Documents  │  │ • Sessions   │ │
│  │ • Files      │  │ • Handlers   │  │ • Search     │  │ • Streaming  │ │
│  │ • Templates  │  │ • Validation │  │ • Reranking  │  │ • Generation │ │
│  │ • Budgeting  │  │ • Execution  │  │ • Persistence│  │ • Tool Calls │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘ │
│         │                 │                 │                 │          │
│         └────────────┬────┴────────┬────────┴─────────────────┘          │
│                      │             │                                     │
│                      ▼             ▼                                     │
│              ┌──────────────────────────────┐                            │
│              │          Adapters            │                            │
│              │                              │                            │
│              │ • Provider (OpenAI/Anthropic)│                            │
│              │ • Embedding (OpenAI/Voyage)  │                            │
│              │ • Token (Estimator/Model)    │                            │
│              │ • Persistence (IDB/OPFS)     │                            │
│              │ • Tool Format (OpenAI/Anth)  │                            │
│              │ • Similarity (Cosine/Dot)    │                            │
│              └──────────────┬───────────────┘                            │
│                             │                                            │
│                             ▼                                            │
│              ┌──────────────────────────────┐                            │
│              │           Core               │                            │
│              │    (Shared Types Only)       │                            │
│              └──────────────────────────────┘                            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
User Query
    │
    ▼
┌─────────────────┐
│ Context Builder │ ◄── Sections, Files, Templates
│                 │
│ 1. Add frames   │
│ 2. Deduplicate  │
│ 3. Budget check │
│ 4. Build        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│ Tool Registry   │ ◄───│  Vector Store   │
│                 │     │                 │
│ Format schemas  │     │ Similarity      │
│ for provider    │     │ search          │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     │
                     ▼
         ┌─────────────────┐
         │ Inference Engine│
         │                 │
         │ 1. Send context │
         │ 2. Stream tokens│
         │ 3. Handle tools │
         │ 4. Return result│
         └────────┬────────┘
                  │
                  ▼
            Response to User
```

---

## Setup and Configuration

### Environment Configuration

```typescript name=src/config.ts
/**
 * Application configuration. 
 * 
 * All API keys and settings come from environment variables.
 * Never hardcode secrets in source code.
 */

export interface AppConfig {
	readonly openai:  {
		readonly apiKey: string
		readonly model: string
		readonly embeddingModel: string
	}
	readonly budget: {
		readonly maxTokens: number
		readonly reservedTokens: number
		readonly warningThreshold: number
	}
	readonly vectorStore: {
		readonly searchLimit: number
		readonly scoreThreshold: number
	}
	readonly session: {
		readonly ttlMs: number
		readonly maxHistory: number
	}
}

export function getConfig(): AppConfig {
	const openaiKey = process.env.OPENAI_API_KEY
	if (!openaiKey) {
		throw new Error('OPENAI_API_KEY environment variable is required')
	}

	return {
		openai: {
			apiKey:  openaiKey,
			model: process.env.OPENAI_MODEL ??  'gpt-4o',
			embeddingModel: process.env.OPENAI_EMBEDDING_MODEL ??  'text-embedding-3-small',
		},
		budget: {
			maxTokens: Number(process.env. MAX_TOKENS ??  8000),
			reservedTokens: Number(process.env. RESERVED_TOKENS ?? 2000),
			warningThreshold: Number(process.env. WARNING_THRESHOLD ??  0.8),
		},
		vectorStore: {
			searchLimit:  Number(process.env.SEARCH_LIMIT ?? 5),
			scoreThreshold: Number(process.env.SCORE_THRESHOLD ?? 0.7),
		},
		session:  {
			ttlMs: Number(process.env.SESSION_TTL_MS ?? 7 * 24 * 60 * 60 * 1000),
			maxHistory: Number(process.env.MAX_HISTORY ?? 50),
		},
	}
}
```

### Database Schema (for IndexedDB)

```typescript name=src/database.ts
/**
 * IndexedDB database setup for persistence. 
 * 
 * We use three stores:
 * - sessions: Conversation history
 * - vectors: Document embeddings
 * - vector_metadata: Vector store metadata
 */

import { createDatabase } from '@mikesaintsg/indexeddb'
import type { StoredDocument, SerializedSession, VectorStoreMetadata } from '@mikesaintsg/core'

export interface AppDatabaseSchema {
	readonly sessions: SerializedSession
	readonly vectors: StoredDocument
	readonly vector_metadata: VectorStoreMetadata
}

export async function createAppDatabase() {
	return createDatabase<AppDatabaseSchema>({
		name:  'my-ai-app',
		version: 1,
		stores: {
			sessions: { keyPath: 'id' },
			vectors:  { keyPath: 'id' },
			vector_metadata:  { keyPath: 'model' },
		},
	})
}
```

---

## Complete Application Example

This is a full, working example that demonstrates every package working together. 

```typescript name=src/app.ts
/**
 * Complete AI Application
 * 
 * This example demonstrates: 
 * - Setting up all adapters as independent, peer components
 * - Creating the inference engine with adapter ports
 * - Building a vector store with all adapter types
 * - Registering tools with the tool registry
 * - Managing context with sections, files, and templates
 * - Handling a complete conversation with RAG and tool calling
 * - Streaming responses to the UI
 * - Proper cleanup and error handling
 */

import {
	// Source Adapters
	createOpenAIProviderAdapter,
	createOpenAIEmbeddingAdapter,
	// Transform Adapters
	createModelTokenAdapter,
	createOpenAIToolFormatAdapter,
	createCosineSimilarityAdapter,
	// Persistence Adapters
	createIndexedDBSessionAdapter,
	createIndexedDBVectorPersistenceAdapter,
	// Policy Adapters
	createExponentialRetryAdapter,
	createTokenBucketRateLimitAdapter,
	// Enhancement Adapters
	createLRUCacheAdapter,
	createBatchAdapter,
} from '@mikesaintsg/adapters'

import { createEngine } from '@mikesaintsg/inference'
import type { SessionInterface, GenerationResult, Message } from '@mikesaintsg/inference'

import { createVectorStore } from '@mikesaintsg/vectorstore'
import type { VectorStoreInterface, Document } from '@mikesaintsg/vectorstore'

import { createToolRegistry } from '@mikesaintsg/contextprotocol'
import type { ToolRegistryInterface } from '@mikesaintsg/contextprotocol'

import { createContextManager } from '@mikesaintsg/contextbuilder'
import type { ContextManagerInterface, BuiltContext } from '@mikesaintsg/contextbuilder'

import { createToolCallBridge, createRetrievalTool } from '@mikesaintsg/core'
import type { Unsubscribe, ToolCall, ToolResult } from '@mikesaintsg/core'

import { getConfig, type AppConfig } from './config.js'
import { createAppDatabase, type AppDatabaseSchema } from './database.js'
import type { DatabaseInterface } from '@mikesaintsg/indexeddb'

// ============================================================================
// Application State Interface
// ============================================================================

/**
 * Central application state container.
 * 
 * Holds references to all initialized components. 
 * Provides a single point for cleanup via destroy().
 */
export interface AppState {
	readonly config: AppConfig
	readonly database: DatabaseInterface<AppDatabaseSchema>
	readonly engine: ReturnType<typeof createEngine>
	readonly vectorStore: VectorStoreInterface
	readonly toolRegistry: ToolRegistryInterface
	readonly contextManager: ContextManagerInterface
	readonly session: SessionInterface
	destroy(): void
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize the complete application.
 * 
 * This function sets up all components in the correct order: 
 * 1. Configuration and database
 * 2. All adapters (independently instantiated)
 * 3. Systems with adapter ports filled
 * 4. Tool registration
 * 5. Initial content setup
 * 
 * @returns Fully initialized application state
 */
export async function initializeApp(): Promise<AppState> {
	const config = getConfig()
	
	// ──────────────────────────────────────────────────────────────────────
	// Step 1: Database Setup
	// ──────────────────────────────────────────────────────────────────────
	
	const database = await createAppDatabase()
	
	// ──────────────────────────────────────────────────────────────────────
	// Step 2: Create All Adapters (as independent, peer components)
	// ──────────────────────────────────────────────────────────────────────
	
	// Source Adapters - Generate or retrieve data
	const providerAdapter = createOpenAIProviderAdapter({
		apiKey: config.openai.apiKey,
		model: config.openai.model,
	})
	
	const embeddingAdapter = createOpenAIEmbeddingAdapter({
		apiKey: config.openai.apiKey,
		model: config.openai.embeddingModel,
	})
	
	// Transform Adapters - Transform data formats
	const tokenAdapter = createModelTokenAdapter({
		model: config.openai.model,
	})
	
	const toolFormatAdapter = createOpenAIToolFormatAdapter({
		toolChoice: 'auto',
	})
	
	const similarityAdapter = createCosineSimilarityAdapter()
	
	// Persistence Adapters - Store and load data
	const sessionPersistence = createIndexedDBSessionAdapter({
		database,
		storeName: 'sessions',
		ttlMs: config.session.ttlMs,
	})
	
	const vectorPersistence = createIndexedDBVectorPersistenceAdapter({
		database,
		documentsStore: 'vectors',
		metadataStore: 'vector_metadata',
	})
	
	// Policy Adapters - Apply policies to operations
	const retryAdapter = createExponentialRetryAdapter({
		maxAttempts: 5,
		initialDelayMs: 1000,
		maxDelayMs: 30000,
		backoffMultiplier: 2,
		jitter: true,
		retryableCodes: ['RATE_LIMIT_ERROR', 'NETWORK_ERROR', 'TIMEOUT_ERROR'],
		onRetry: (error, attempt, delayMs) => {
			console.warn(`Retry ${attempt}, waiting ${delayMs}ms:`, error)
		},
	})
	
	const rateLimitAdapter = createTokenBucketRateLimitAdapter({
		requestsPerMinute: 60,
		maxConcurrent: 10,
	})
	
	// Enhancement Adapters - Add capabilities
	const cacheAdapter = createLRUCacheAdapter({
		maxSize: 10000,
		ttlMs: 24 * 60 * 60 * 1000, // 24 hours
	})
	
	const batchAdapter = createBatchAdapter({
		batchSize: 100,
		delayMs: 50,
		deduplicate: true,
	})
	
	// ──────────────────────────────────────────────────────────────────────
	// Step 3: Create Inference Engine
	// ──────────────────────────────────────────────────────────────────────
	
	// The engine orchestrates all inference operations.
	// Required adapter is first parameter, optional adapters in options.
	const engine = createEngine(providerAdapter, {
		// Persistence (opt-in)
		session: sessionPersistence,
		
		// Transform (opt-in)
		token: tokenAdapter,
		
		// Policy (opt-in)
		retry: retryAdapter,
		rateLimit: rateLimitAdapter,
		
		// Configuration
		deduplication: {
			enabled: true,
			windowMs: 1000,
		},
		
		// Hooks
		onRequest: (requestId, messages) => {
			console.log(`[Engine] Request ${requestId}: ${messages.length} messages`)
		},
		onResponse: (requestId, result) => {
			console.log(`[Engine] Response ${requestId}: ${result.finishReason}`)
		},
		onError: (requestId, error) => {
			console.error(`[Engine] Error ${requestId}:`, error)
		},
	})
	
	// ──────────────────────────────────────────────────────────────────────
	// Step 4: Create Vector Store
	// ──────────────────────────────────────────────────────────────────────
	
	// Vector store for RAG.
	// Required adapter is first parameter, optional adapters in options.
	const vectorStore = await createVectorStore(embeddingAdapter, {
		// Persistence (opt-in)
		persistence: vectorPersistence,
		
		// Transform (opt-in)
		similarity: similarityAdapter,
		
		// Policy (opt-in)
		retry: retryAdapter,
		rateLimit: rateLimitAdapter,
		
		// Enhancement (opt-in)
		cache: cacheAdapter,
		batch: batchAdapter,
		
		// Configuration
		autoSave: true,
		
		// Hooks
		onDocumentAdded: (doc) => {
			console.log(`[VectorStore] Document added: ${doc.id}`)
		},
	})
	
	// Load existing vectors from persistence (only needed with persistence)
	await vectorStore.load()
	console.log(`[VectorStore] Loaded ${await vectorStore.count()} documents`)
	
	// ──────────────────────────────────────────────────────────────────────
	// Step 5: Create Tool Registry
	// ──────────────────────────────────────────────────────────────────────
	
	// Tool registry manages tool schemas and execution. 
	// Format adapter is first and required. 
	const toolRegistry = createToolRegistry(toolFormatAdapter, {
		timeout: 30000, // 30 second default timeout for tool execution
		onToolRegistered: (schema) => {
			console.log(`[ToolRegistry] Registered:  ${schema.name}`)
		},
	})
	
	// ──────────────────────────────────────────────────────────────────────
	// Step 12: Register Tools
	// ──────────────────────────────────────────────────────────────────────
	
	// Register the retrieval tool using the factory from core. 
	// This creates a tool that searches the vector store.
	const { schema: searchSchema, handler: searchHandler } = createRetrievalTool({
		vectorStore,
		name: 'search_knowledge_base',
		description: 'Search the knowledge base for relevant information.  Use this when the user asks questions that might be answered by stored documents.',
		defaultLimit: config.vectorStore.searchLimit,
		scoreThreshold: config.vectorStore.scoreThreshold,
		formatResult: (result) => ({
			content: result.content,
			relevance: Math.round(result.score * 100) + '%',
			source: result.metadata?. source ??  'unknown',
		}),
	})
	
	toolRegistry.register(searchSchema, searchHandler)
	
	// Register a custom tool for getting the current date/time
	toolRegistry.register(
		{
			name: 'get_current_time',
			description:  'Get the current date and time.  Use this when the user asks about the current time or date.',
			parameters: {
				type: 'object',
				properties: {
					timezone: {
						type: 'string',
						description: 'IANA timezone (e.g., "America/New_York"). Defaults to UTC.',
					},
				},
			},
		},
		async (params:  { timezone?: string }) => {
			const tz = params.timezone ??  'UTC'
			const now = new Date()
			return {
				iso: now.toISOString(),
				formatted: now.toLocaleString('en-US', { timeZone: tz }),
				timezone: tz,
			}
		}
	)
	
	// Register a tool for creating tasks (example of a write operation)
	toolRegistry.register(
		{
			name:  'create_task',
			description: 'Create a new task or todo item.  Use this when the user wants to add something to their task list.',
			parameters: {
				type: 'object',
				properties:  {
					title:  {
						type:  'string',
						description: 'The task title',
						minLength: 1,
						maxLength: 200,
					},
					priority: {
						type: 'string',
						enum: ['low', 'medium', 'high'],
						description: 'Task priority level',
					},
					dueDate: {
						type: 'string',
						format: 'date',
						description: 'Due date in YYYY-MM-DD format',
					},
				},
				required: ['title'],
			},
		},
		async (params: { title:  string; priority?:  string; dueDate?: string }) => {
			// In a real app, this would persist to a database
			const taskId = `task_${Date.now()}`
			console.log(`[Task] Created:  ${taskId}`, params)
			return {
				id: taskId,
				title: params.title,
				priority: params.priority ??  'medium',
				dueDate:  params.dueDate ??  null,
				status: 'pending',
				createdAt: new Date().toISOString(),
			}
		}
	)
	
	// ──────────────────────────────────────────────────────────────────────
	// Step 13: Create Context Manager
	// ──────────────────────────────────────────────────────────────────────
	
	// Context manager handles sections, files, templates, and building context.
	// Token adapter is first and required for accurate budgeting.
	const contextManager = createContextManager(tokenAdapter, {
		budget: {
			maxTokens: config.budget.maxTokens,
			reservedTokens: config.budget.reservedTokens,
			warningThreshold: config.budget.warningThreshold,
			criticalThreshold:  0.95,
		},
		deduplication: {
			strategy: 'keep_latest',
			preservePinned: true,
		},
		truncationStrategy: 'priority',
		onBudgetChange: (state) => {
			if (state.level === 'warning') {
				console.warn(`[Context] Token budget at ${Math.round(state.usage * 100)}%`)
			} else if (state.level === 'critical') {
				console.error(`[Context] Token budget critical:  ${Math.round(state.usage * 100)}%`)
			}
		},
	})
	
	// ──────────────────────────────────────────────────────────────────────
	// Step 14: Setup Initial Content
	// ──────────────────────────────────────────────────────────────────────
	
	// Register the system prompt as a pinned section (always included)
	contextManager.sections.setSection({
		id: 'system-prompt',
		name: 'System Prompt',
		content: `You are a helpful AI assistant with access to a knowledge base and various tools. 

Your capabilities:
- Search the knowledge base for relevant information
- Get the current date and time
- Create tasks for the user

Guidelines:
- Always search the knowledge base when the user asks factual questions
- Be concise but thorough in your responses
- When creating tasks, confirm the details with the user
- If you're unsure about something, say so`,
		metadata: {
			pinned: true,
			source: 'system',
		},
	})
	
	// Register a template for code review requests
	contextManager.templates.register({
		id: 'code-review',
		name: 'Code Review Template',
		content: `Please review the following {{language}} code: 

\`\`\`{{language}}
{{code}}
\`\`\`

Focus on:
- Code quality and best practices
- Potential bugs or issues
- Performance considerations
- Suggestions for improvement`,
		placeholders: [
			{ name: 'language', pattern: '{{language}}', required: true },
			{ name: 'code', pattern: '{{code}}', required: true },
		],
	})
	
	// Always select the system prompt
	contextManager.sections.select(['system-prompt'])
	
	// ──────────────────────────────────────────────────────────────────────
	// Step 15: Create Session
	// ──────────────────────────────────────────────────────────────────────
	
	// Create a conversation session
	const session = engine.createSession({
		system: undefined, // We'll inject system prompt via context builder
		tokenBudget: {
			model: config.openai.model,
			warningThreshold: config.budget.warningThreshold,
			autoTruncate: true,
		},
		onMessageAdded: (message) => {
			console.log(`[Session] Message added: ${message.role}`)
		},
	})
	
	// ──────────────────────────────────────────────────────────────────────
	// Step 16: Create Cleanup Function
	// ──────────────────────────────────────────────────────────────────────
	
	const cleanupFns:  Unsubscribe[] = []
	
	function destroy() {
		console.log('[App] Destroying application.. .')
		
		// Run all cleanup functions
		for (const cleanup of cleanupFns) {
			try {
				cleanup()
			} catch (error) {
				console.error('[App] Cleanup error:', error)
			}
		}
		
		// Destroy components in reverse order
		contextManager.destroy()
		toolRegistry.destroy()
		vectorStore.destroy()
		engine.destroy()
		
		console.log('[App] Application destroyed')
	}
	
	return {
		config,
		database,
		engine,
		vectorStore,
		toolRegistry,
		contextManager,
		session,
		destroy,
	}
}

// ============================================================================
// Document Ingestion
// ============================================================================

/**
 * Ingest documents into the vector store.
 * 
 * This is typically called during initial setup or when new content
 * needs to be added to the knowledge base.
 * 
 * @param app - Application state
 * @param documents - Documents to ingest
 */
export async function ingestDocuments(
	app: AppState,
	documents: readonly Document[]
): Promise<void> {
	console.log(`[Ingest] Adding ${documents.length} documents... `)
	
	const startTime = Date.now()
	
	// Upsert all documents (will generate embeddings automatically)
	await app.vectorStore.upsertDocument(documents)
	
	const elapsed = Date.now() - startTime
	const count = await app.vectorStore.count()
	
	console.log(`[Ingest] Complete in ${elapsed}ms.  Total documents: ${count}`)
}

// ============================================================================
// Conversation Handling
// ============================================================================

/**
 * Handle a user message and generate a response.
 * 
 * This is the main conversation loop that: 
 * 1. Adds the user message to the session
 * 2. Builds context with sections, files, and retrieval results
 * 3. Generates a response (potentially with tool calls)
 * 4. Handles tool execution and follow-up generation
 * 5. Streams the response
 * 
 * @param app - Application state
 * @param userMessage - The user's message
 * @param onToken - Callback for each token (for streaming UI)
 * @returns The complete response
 */
export async function handleUserMessage(
	app: AppState,
	userMessage: string,
	onToken?:  (token: string) => void
): Promise<GenerationResult> {
	const { session, contextManager, toolRegistry, vectorStore, engine } = app
	
	// ──────────────────────────────────────────────────────────────────────
	// Step 1: Add user message to session
	// ──────────────────────────────────────────────────────────────────────
	
	session.addMessage('user', userMessage)
	
	// ──────────────────────────────────────────────────────────────────────
	// Step 2: Pre-fetch relevant context from vector store
	// ──────────────────────────────────────────────────────────────────────
	
	// Do a preliminary search to add relevant context before generation. 
	// This is in addition to the search tool the model can use.
	const retrievalResults = await vectorStore.similaritySearch(userMessage, {
		limit: 3,
		threshold: 0.75,
	})
	
	if (retrievalResults.length > 0) {
		console.log(`[Context] Adding ${retrievalResults.length} retrieval results`)
		contextManager.builder.addRetrieval(retrievalResults, 'normal')
	}
	
	// ──────────────────────────────────────────────────────────────────────
	// Step 3: Add tool schemas to context (for token counting)
	// ──────────────────────────────────────────────────────────────────────
	
	for (const schema of toolRegistry.getSchemas()) {
		contextManager.builder.addTool(schema, 'high')
	}
	
	// ──────────────────────────────────────────────────────────────────────
	// Step 4: Add conversation history as frames
	// ──────────────────────────────────────────────────────────────────────
	
	// Add recent messages as memory frames
	const history = session.getHistory()
	for (const message of history.slice(-10)) { // Last 10 messages
		if (typeof message.content === 'string') {
			contextManager.builder.addFrame({
				type: 'memory',
				content:  `${message.role}:  ${message.content}`,
				priority: message.role === 'user' ? 'high' : 'normal',
				metadata: { source: 'conversation' },
			})
		}
	}
	
	// ──────────────────────────────────────────────────────────────────────
	// Step 5: Build context from selections
	// ──────────────────────────────────────────────────────────────────────
	
	const context = contextManager.buildFromSelection()
	
	console.log(`[Context] Built with ${context.frames.length} frames, ${context.totalTokens} tokens`)
	
	if (context.truncated && context.truncationInfo) {
		console.warn(
			`[Context] Truncated ${context.truncationInfo.removedFrames.length} frames ` +
			`to fit budget (strategy: ${context.truncationInfo.strategy})`
		)
	}
	
	// ──────────────────────────────────────────────────────────────────────
	// Step 6: Generate response with streaming
	// ──────────────────────────────────────────────────────────────────────
	
	// Create the tool call bridge for executing tools
	const toolBridge = createToolCallBridge({
		registry: toolRegistry,
		timeout: 30000,
		onBeforeExecute: (call) => {
			console.log(`[Tool] Executing:  ${call.name}`)
		},
		onAfterExecute: (call, result) => {
			console.log(`[Tool] Completed: ${call.name}`)
		},
		onError:  (error, call) => {
			console.error(`[Tool] Error in ${call.name}:`, error)
		},
	})
	
	// Build messages array from context
	const messages = buildMessagesFromContext(context, session)
	
	// Stream the response
	const stream = engine.stream(messages, {
		tools: toolRegistry.getSchemas(),
		toolChoice: 'auto',
	})
	
	// Handle streaming tokens
	if (onToken) {
		stream.onToken(onToken)
	}
	
	// Wait for completion
	let result = await stream.result()
	
	// ──────────────────────────────────────────────────────────────────────
	// Step 7: Handle tool calls
	// ──────────────────────────────────────────────────────────────────────
	
	// Process tool calls in a loop until no more tool calls
	while (result.toolCalls.length > 0) {
		console.log(`[Tool] Processing ${result.toolCalls.length} tool calls`)
		
		// Execute all tool calls in parallel
		const toolResults = await toolBridge.executeAll(result.toolCalls)
		
		// Add tool results to session
		for (const toolResult of toolResults) {
			session.addToolResult(toolResult.callId, toolResult.name, toolResult.value)
		}
		
		// Continue generation with tool results
		const continuationStream = session.stream({
			tools: toolRegistry.getSchemas(),
		})
		
		if (onToken) {
			continuationStream.onToken(onToken)
		}
		
		result = await continuationStream.result()
	}
	
	// ──────────────────────────────────────────────────────────────────────
	// Step 8: Add assistant response to session
	// ──────────────────────────────────────────────────────────────────────
	
	if (result.text) {
		session.addMessage('assistant', result.text)
	}
	
	// ──────────────────────────────────────────────────────────────────────
	// Step 9: Clear builder for next turn
	// ──────────────────────────────────────────────────────────────────────
	
	// Clear non-pinned frames for next turn
	contextManager.builder.clear()
	
	// Re-add pinned sections
	for (const sectionId of contextManager.sections.getSelected()) {
		const section = contextManager.sections.getSection(sectionId)
		if (section) {
			contextManager.builder.addSection(section, section.metadata?. pinned ?  'critical' : 'normal')
		}
	}
	
	return result
}

/**
 * Build messages array from built context.
 * 
 * Converts context frames into the message format expected by the provider.
 */
function buildMessagesFromContext(
	context: BuiltContext,
	session: SessionInterface
): readonly Message[] {
	const messages: Message[] = []
	
	// Extract system content from frames
	const systemFrames = context.frames.filter(f => 
		f.type === 'system' || f.type === 'instruction' || f.metadata?.pinned
	)
	
	if (systemFrames.length > 0) {
		const systemContent = systemFrames.map(f => f.content).join('\n\n')
		messages.push({
			id: 'system',
			role: 'system',
			content: systemContent,
			createdAt: Date.now(),
		})
	}
	
	// Extract retrieval context
	const retrievalFrames = context.frames.filter(f => f.type === 'retrieval')
	if (retrievalFrames.length > 0) {
		const retrievalContent = retrievalFrames
			.map(f => `[Retrieved Context]\n${f.content}`)
			.join('\n\n---\n\n')
		
		messages.push({
			id: 'context',
			role:  'system',
			content:  `Relevant information from the knowledge base:\n\n${retrievalContent}`,
			createdAt: Date.now(),
		})
	}
	
	// Add conversation history
	for (const message of session.getHistory()) {
		messages.push(message)
	}
	
	return messages
}

// ============================================================================
// File Context Handling
// ============================================================================

/**
 * Add a file to the context for code assistance.
 * 
 * @param app - Application state
 * @param filePath - Path to the file
 * @param content - File content
 * @param language - Programming language
 */
export function addFileToContext(
	app: AppState,
	filePath: string,
	content: string,
	language?:  string
): void {
	const { contextManager } = app
	
	// Detect language from extension if not provided
	const detectedLanguage = language ??  detectLanguageFromPath(filePath)
	
	// Add to file tracker (handles versioning automatically)
	const file = contextManager.files.setFile({
		path: filePath,
		name: filePath.split('/').pop() ??  filePath,
		content,
		language:  detectedLanguage,
		metadata: {
			url: `file://${filePath}`,
		},
	})
	
	console.log(`[File] Added ${filePath} (v${file.version}, ${detectedLanguage ??  'unknown'})`)
	
	// Select for inclusion in context
	contextManager.files.select([filePath])
}

/**
 * Simple language detection from file path.
 */
function detectLanguageFromPath(path: string): string | undefined {
	const ext = path.split('.').pop()?.toLowerCase()
	const languageMap: Record<string, string> = {
		ts: 'typescript',
		tsx: 'typescript',
		js:  'javascript',
		jsx: 'javascript',
		py: 'python',
		rb: 'ruby',
		go: 'go',
		rs: 'rust',
		java: 'java',
		kt: 'kotlin',
		swift: 'swift',
		cs: 'csharp',
		cpp: 'cpp',
		c: 'c',
		h: 'c',
		hpp: 'cpp',
		md: 'markdown',
		json: 'json',
		yaml: 'yaml',
		yml: 'yaml',
		toml: 'toml',
		xml: 'xml',
		html: 'html',
		css: 'css',
		scss: 'scss',
		sql: 'sql',
		sh: 'bash',
		bash: 'bash',
		zsh: 'bash',
		ps1: 'powershell',
	}
	return ext ? languageMap[ext] : undefined
}

// ============================================================================
// Code Review with Templates
// ============================================================================

/**
 * Request a code review using the template system.
 * 
 * @param app - Application state
 * @param code - Code to review
 * @param language - Programming language
 * @param onToken - Streaming callback
 * @returns The review response
 */
export async function requestCodeReview(
	app:  AppState,
	code: string,
	language: string,
	onToken?:  (token: string) => void
): Promise<GenerationResult> {
	const { contextManager } = app
	
	// Fill the code review template
	const reviewPrompt = contextManager.templates.fill('code-review', {
		language,
		code,
	})
	
	// Use the template as the user message
	return handleUserMessage(app, reviewPrompt, onToken)
}

// ============================================================================
// Session Management
// ============================================================================

/**
 * Clear the current conversation and start fresh.
 * 
 * @param app - Application state
 */
export function clearConversation(app:  AppState): void {
	app.session.clear()
	app.contextManager.builder.clear()
	
	// Re-add system section
	const systemSection = app.contextManager.sections.getSection('system-prompt')
	if (systemSection) {
		app.contextManager.builder.addSection(systemSection, 'critical')
	}
	
	console.log('[Session] Conversation cleared')
}

/**
 * Get conversation history for display.
 * 
 * @param app - Application state
 * @returns Array of messages
 */
export function getConversationHistory(app: AppState): readonly Message[] {
	return app.session.getHistory()
}

/**
 * Truncate conversation history to save tokens.
 * 
 * @param app - Application state
 * @param keepLast - Number of messages to keep
 */
export function truncateHistory(app: AppState, keepLast:  number): void {
	app.session.truncateHistory(keepLast)
	console.log(`[Session] History truncated to last ${keepLast} messages`)
}

// ============================================================================
// Usage Example
// ============================================================================

/**
 * Example usage of the complete application.
 */
async function main() {
	// Initialize the application
	console.log('Initializing application...')
	const app = await initializeApp()
	
	try {
		// Ingest some sample documents
		await ingestDocuments(app, [
			{
				id: 'doc-1',
				content: 'TypeScript is a strongly typed programming language that builds on JavaScript.  It adds optional static typing and class-based object-oriented programming to the language.',
				metadata: { source: 'docs', topic: 'typescript' },
			},
			{
				id: 'doc-2',
				content: 'React is a JavaScript library for building user interfaces.  It uses a declarative approach and component-based architecture.',
				metadata: { source: 'docs', topic: 'react' },
			},
			{
				id:  'doc-3',
				content:  'Node.js is a JavaScript runtime built on Chrome\'s V8 JavaScript engine. It allows running JavaScript on the server side.',
				metadata: { source: 'docs', topic: 'nodejs' },
			},
		])
		
		// Add a file to context
		addFileToContext(app, 'src/example.ts', `
export function greet(name: string): string {
	return \`Hello, \${name}!\`
}
`, 'typescript')
		
		// Handle a user message with streaming
		console.log('\n--- Conversation Start ---\n')
		
		const response1 = await handleUserMessage(
			app,
			'What is TypeScript and how does it relate to JavaScript?',
			(token) => process.stdout.write(token)
		)
		console.log('\n')
		
		// Another message that might trigger tool use
		const response2 = await handleUserMessage(
			app,
			'Create a task to learn more about React with high priority',
			(token) => process.stdout.write(token)
		)
		console.log('\n')
		
		// Request a code review
		const reviewResponse = await requestCodeReview(
			app,
			`function add(a, b) {
	return a + b
}`,
			'javascript',
			(token) => process.stdout.write(token)
		)
		console.log('\n')
		
		console.log('--- Conversation End ---\n')
		
		// Show conversation history
		const history = getConversationHistory(app)
		console.log(`Conversation had ${history.length} messages`)
		
	} finally {
		// Always cleanup
		app.destroy()
	}
}

// Run if this is the main module
main().catch(console.error)
```

---

## Step-by-Step Breakdown

### 1. The Port Pattern

The key insight is that systems define **ports** (typed slots) for adapters, and adapters plug into those ports as **peers**, not layers:

```typescript
// All adapters are instantiated independently
const embedding = createOpenAIEmbeddingAdapter({ apiKey })
const retry = createExponentialRetryAdapter({ maxAttempts: 5 })
const cache = createLRUCacheAdapter({ maxSize: 10000 })

// Required adapter is first parameter, optional adapters in options
const vectorStore = await createVectorStore(embedding, {
  retry,  // Opt-in: Policy adapter
  cache,  // Opt-in: Enhancement adapter
})
```

The system coordinates adapters internally. Nothing is enabled unless you explicitly provide it.

### 2. Adapter Categories

Adapters are organized into categories by their purpose:

| Category        | Purpose                      | Examples                                             |
|-----------------|------------------------------|------------------------------------------------------|
| **Source**      | Generate or retrieve data    | `OpenAIEmbeddingAdapter`, `OpenAIProviderAdapter`    |
| **Persistence** | Store and load data          | `IndexedDBVectorPersistenceAdapter`                  |
| **Transform**   | Transform data formats       | `CosineSimilarityAdapter`, `TokenAdapter`            |
| **Policy**      | Apply policies to operations | `ExponentialRetryAdapter`, `RateLimitAdapter`        |
| **Enhancement** | Add capabilities             | `LRUCacheAdapter`, `BatchAdapter`, `RerankerAdapter` |

### 3. Factory Function Pattern

Every system follows the same pattern: **required adapter first, optional adapters in options**:

```typescript
// Required adapter is always the first parameter
// Optional adapters are in the options object (opt-in only)

const engine = createEngine(providerAdapter, {
  token: tokenAdapter,        // Opt-in
  retry: retryAdapter,        // Opt-in
})

const vectorStore = await createVectorStore(embeddingAdapter, {
  persistence: persistenceAdapter,  // Opt-in
  cache: cacheAdapter,              // Opt-in
})

const toolRegistry = createToolRegistry(formatAdapter, {
  timeout: 30000,  // Configuration
})

const contextBuilder = createContextBuilder(tokenAdapter, {
  budget: { maxTokens: 8000 },  // Required configuration
})
```

### 4. Event-Driven Architecture

All components emit events via the `on*` pattern:

```typescript
// All return Unsubscribe functions
const cleanup1 = engine.onRequest((id, messages) => { ...  })
const cleanup2 = vectorStore.onDocumentAdded((doc) => { ... })
const cleanup3 = session.onMessageAdded((message) => { ... })

// Cleanup when done
cleanup1()
cleanup2()
cleanup3()
```

### 4. Context Building Flow

```typescript
// 1. Add fixed content
contextManager.sections.setSection({ id: 'system', ...  })
contextManager.sections.select(['system'])

// 2. Add dynamic content
contextManager.files.setFile({ path: 'src/app.ts', ... })
contextManager.files.select(['src/app.ts'])

// 3. Add retrieval results
const results = await vectorStore.similaritySearch(query)
contextManager.builder.addRetrieval(results, 'normal')

// 4. Add tool schemas
for (const schema of toolRegistry.getSchemas()) {
	contextManager.builder.addTool(schema, 'high')
}

// 5. Build (handles deduplication, truncation, budgeting)
const context = contextManager.buildFromSelection()
```

### 5. Tool Execution Loop

```typescript
// Generate with tools
let result = await engine.stream(messages, { tools: schemas })

// Loop until no more tool calls
while (result.toolCalls.length > 0) {
	// Execute tools
	const results = await toolBridge.executeAll(result.toolCalls)
	
	// Add results to session
	for (const r of results) {
		session.addToolResult(r.callId, r.name, r.value)
	}
	
	// Continue generation
	result = await session.stream({ tools: schemas })
}
```

---

## Advanced Patterns

### Multi-Provider Fallback

```typescript
import {
	createOpenAIProviderAdapter,
	createAnthropicProviderAdapter,
} from '@mikesaintsg/adapters'

async function generateWithFallback(
	messages: readonly Message[],
	options: GenerationOptions
): Promise<GenerationResult> {
	const providers = [
		createOpenAIProviderAdapter({ apiKey:  openaiKey }),
		createAnthropicProviderAdapter({ apiKey: anthropicKey }),
	]
	
	for (const provider of providers) {
		try {
			const engine = createEngine(provider)
			return await engine.generate(messages, options)
		} catch (error) {
			console.warn(`Provider ${provider.getId()} failed, trying next... `)
		}
	}
	
	throw new Error('All providers failed')
}
```

### Streaming with Token Batching

For better UI performance, batch tokens before rendering:

```typescript
import { createTokenBatcher } from '@mikesaintsg/inference'

const batcher = createTokenBatcher({
	batchSize: 5,
	flushIntervalMs: 50,
	flushOnBoundary: 'word',
})

// Subscribe to batches
batcher.onBatch((batch) => {
	// Update UI with batch.text (more efficient than per-token)
	updateUI(batch.text)
	
	if (batch.isFinal) {
		finishRendering()
	}
})

// Feed tokens from stream
const stream = session.stream()
stream.onToken((token) => batcher.push(token))
stream.onComplete(() => batcher.end())
```

### Cross-Tab Synchronization

```typescript
import { createBroadcastChannel } from '@mikesaintsg/broadcast'

const channel = createBroadcastChannel<SessionEvent>('ai-session')

// Broadcast session changes
session.onMessageAdded((message) => {
	channel.postMessage({ type: 'message_added', message })
})

// Receive from other tabs
channel.onMessage((event) => {
	if (event.type === 'message_added') {
		// Sync to local session
		localSession.addMessage(event.message.role, event.message.content)
	}
})
```

### Hybrid Search with Reranking

```typescript
import { createCohereRerankerAdapter } from '@mikesaintsg/adapters'

const vectorStore = await createVectorStore(embeddingAdapter, {
	reranker: createCohereRerankerAdapter({ apiKey: cohereKey }),
})

// First pass: fast vector search (50 results)
// Second pass: rerank to get best 5
const results = await vectorStore.hybridSearch(query, {
	limit:  5,
	rerankTopK: 50,
	rerank: true,
	vectorWeight: 0.7,
	keywordWeight: 0.3,
})
```

---

## Error Handling

### Comprehensive Error Handling

```typescript
import { isEcosystemError } from '@mikesaintsg/core'
import { isInferenceError, type InferenceErrorCode } from '@mikesaintsg/inference'
import { isVectorStoreError } from '@mikesaintsg/vectorstore'
import { isContextProtocolError } from '@mikesaintsg/contextprotocol'
import { isContextBuilderError } from '@mikesaintsg/contextbuilder'

async function safeGenerate(app: AppState, message: string): Promise<string> {
	try {
		const result = await handleUserMessage(app, message)
		return result.text
	} catch (error) {
		// Handle inference errors
		if (isInferenceError(error)) {
			switch (error.code) {
				case 'RATE_LIMIT': 
					// Wait and retry
					await sleep(error.retryAfter ??  5000)
					return safeGenerate(app, message)
				
				case 'CONTEXT_LENGTH_EXCEEDED':
					// Truncate and retry
					truncateHistory(app, 5)
					return safeGenerate(app, message)
				
				case 'ABORTED':
					return 'Generation was cancelled.'
				
				default:
					throw error
			}
		}
		
		// Handle vector store errors
		if (isVectorStoreError(error)) {
			if (error.code === 'NOT_LOADED') {
				await app.vectorStore.load()
				return safeGenerate(app, message)
			}
		}
		
		// Handle context builder errors
		if (isContextBuilderError(error)) {
			if (error.code === 'BUDGET_EXCEEDED') {
				// Remove non-essential content
				app.contextManager.files.clearSelection()
				return safeGenerate(app, message)
			}
		}
		
		// Handle context protocol errors
		if (isContextProtocolError(error)) {
			if (error.code === 'TOOL_NOT_FOUND') {
				console.warn(`Tool not found: ${error.toolName}`)
				// Continue without the tool
			}
		}
		
		// Unknown error
		throw error
	}
}
```

### Graceful Degradation

```typescript
async function generateWithDegradation(
	app:  AppState,
	message: string
): Promise<GenerationResult> {
	// Try full RAG pipeline
	try {
		const results = await app.vectorStore.similaritySearch(message)
		app.contextManager.builder.addRetrieval(results, 'normal')
	} catch (error) {
		console.warn('RAG failed, continuing without retrieval:', error)
		// Continue without retrieval context
	}
	
	// Try with tools
	try {
		return await handleUserMessage(app, message)
	} catch (error) {
		if (isInferenceError(error) && error.code === 'CONTEXT_LENGTH_EXCEEDED') {
			// Retry without tools
			console.warn('Context too long, retrying without tools')
			const stream = app.session.stream({ tools: [] })
			return await stream.result()
		}
		throw error
	}
}
```

---

## Performance Optimization

### 1. Lazy Loading

```typescript
// Don't load vector store until needed
let vectorStore: VectorStoreInterface | undefined

async function getVectorStore(app: AppState): Promise<VectorStoreInterface> {
	if (!vectorStore) {
		vectorStore = await createVectorStore(embeddingAdapter, options)
		await vectorStore.load()
	}
	return vectorStore
}
```

### 2. Debounced Context Building

```typescript
import { debounce } from './utils.js'

const debouncedBuild = debounce((contextManager: ContextManagerInterface) => {
	return contextManager.buildFromSelection()
}, 100)

// Use debounced version during rapid updates
files.onFileChange(() => {
	debouncedBuild(contextManager)
})
```

### 3. Parallel Initialization

```typescript
async function initializeParallel(): Promise<AppState> {
	// Start all async operations in parallel
	const [database, ... ] = await Promise.all([
		createAppDatabase(),
		// Other async initialization
	])
	
	// Continue with sync operations
	const provider = createOpenAIProviderAdapter({ apiKey })
	// ... 
}
```

### 4. Streaming Response Rendering

```typescript
// Use requestAnimationFrame for smooth UI updates
function createSmoothRenderer(element: HTMLElement) {
	let pending = ''
	let rafId: number | null = null
	
	function flush() {
		if (pending) {
			element.textContent += pending
			pending = ''
		}
		rafId = null
	}
	
	return {
		append(text: string) {
			pending += text
			if (! rafId) {
				rafId = requestAnimationFrame(flush)
			}
		},
		finish() {
			if (rafId) {
				cancelAnimationFrame(rafId)
			}
			flush()
		},
	}
}
```

---

## Testing Strategies

### Unit Testing with Mocks

```typescript
import { describe, it, expect, vi } from 'vitest'
import type { EmbeddingAdapterInterface, ProviderAdapterInterface } from '@mikesaintsg/core'

// Create mock adapters
function createMockEmbeddingAdapter(): EmbeddingAdapterInterface {
	return {
		embed: vi.fn().mockResolvedValue([new Float32Array(1536)]),
		getModelMetadata: () => ({
			provider: 'mock',
			model:  'mock-embedding',
			dimensions: 1536,
		}),
	}
}

function createMockProviderAdapter(): ProviderAdapterInterface {
	return {
		getId: () => 'mock-provider',
		generate: vi.fn().mockImplementation(() => ({
			requestId: 'test-123',
			[Symbol.asyncIterator]: async function* () {
				yield 'Hello'
				yield ' world'
			},
			result: async () => ({
				text: 'Hello world',
				toolCalls: [],
				finishReason: 'stop',
				aborted: false,
			}),
			abort: vi.fn(),
			onToken: vi.fn(() => () => {}),
			onComplete: vi.fn(() => () => {}),
			onError: vi.fn(() => () => {}),
		})),
		supportsTools: () => true,
		supportsStreaming: () => true,
		getCapabilities: () => ({
			supportsTools: true,
			supportsStreaming: true,
			supportsVision: false,
			supportsFunctions: true,
			models: ['mock-model'],
		}),
	}
}

describe('VectorStore', () => {
	it('should add and search documents', async () => {
		const embedding = createMockEmbeddingAdapter()
		const store = await createVectorStore(embedding)
		
		await store.upsertDocument({
			id: 'test-doc',
			content: 'Test content',
		})
		
		const results = await store.similaritySearch('test')
		expect(results).toHaveLength(1)
		expect(results[0].content).toBe('Test content')
	})
})

describe('Engine', () => {
	it('should generate responses', async () => {
		const provider = createMockProviderAdapter()
		const engine = createEngine(provider)
		
		const result = await engine.generate([
			{ id: '1', role: 'user', content: 'Hello', createdAt: Date.now() },
		])
		
		expect(result.text).toBe('Hello world')
		expect(provider.generate).toHaveBeenCalled()
	})
})
```

### Integration Testing

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

describe('Full Integration', () => {
	let app: AppState
	
	beforeAll(async () => {
		// Use Ollama for local testing (no API costs)
		process.env.USE_OLLAMA = 'true'
		app = await initializeApp()
	})
	
	afterAll(() => {
		app.destroy()
	})
	
	it('should handle complete conversation flow', async () => {
		// Ingest test documents
		await ingestDocuments(app, [
			{ id: 'test-1', content: 'The capital of France is Paris.' },
		])
		
		// Ask a question
		const tokens:  string[] = []
		const result = await handleUserMessage(
			app,
			'What is the capital of France?',
			(token) => tokens.push(token)
		)
		
		// Verify streaming worked
		expect(tokens.length).toBeGreaterThan(0)
		
		// Verify response mentions Paris
		expect(result.text.toLowerCase()).toContain('paris')
	})
	
	it('should execute tools when needed', async () => {
		const result = await handleUserMessage(
			app,
			'What time is it?'
		)
		
		// Should have used the time tool
		// (check logs or mock the tool to verify)
		expect(result.finishReason).toBe('stop')
	})
})
```

### E2E Testing with Playwright

```typescript
import { test, expect } from '@playwright/test'

test('chat interface', async ({ page }) => {
	await page.goto('/')
	
	// Type a message
	await page.fill('[data-testid="chat-input"]', 'Hello!')
	await page.click('[data-testid="send-button"]')
	
	// Wait for streaming response
	await expect(page.locator('[data-testid="message-assistant"]')).toBeVisible()
	
	// Verify response is not empty
	const response = await page.textContent('[data-testid="message-assistant"]')
	expect(response?. length).toBeGreaterThan(0)
})
```

---

## Summary

This integration guide demonstrates how packages in the ecosystem work together:

1. **Core** provides shared types and interfaces (including policy and enhancement adapter interfaces)
2. **Adapters** implements all adapter categories (source, persistence, transform, policy, enhancement)
3. **Inference** handles LLM generation with streaming
4. **VectorStore** provides RAG capabilities
5. **ContextProtocol** manages tool calling
6. **ContextBuilder** assembles and budgets context
7. **Rater** provides factor-based rate calculations with conditions, lookups, and aggregation
8. **ActionLoop** provides predictive workflow guidance with learned transitions

The key patterns are: 

- **Required adapter first** — Required adapters are always the first parameter
- **Opt-in options** — Optional adapters are in the options object, nothing enabled by default
- **Adapter Categories** — Source, Persistence, Transform, Policy, Enhancement
- **Self-contained adapters** — Each adapter works independently
- **Default implementations** — We provide ready-to-use adapters you can opt into
- **System coordination** — Systems bring adapters together and coordinate their interactions
- **Event-driven subscriptions** — `on*` methods return `Unsubscribe`
- **Explicit data flow** — No hidden state or magic
- **Graceful degradation** — Handle failures at each layer

By following these patterns, you can build robust, maintainable AI applications that are easy to test, extend, and debug.

---

## Appendix: Rater Integration

The `@mikesaintsg/rater` package provides factor-based rate calculations for dynamic pricing, insurance premiums, risk scoring, and similar use cases.

### Integration with Storage Packages

```typescript
import { createRatingEngine } from '@mikesaintsg/rater'
import { createStorage } from '@mikesaintsg/storage'
import { createDatabase } from '@mikesaintsg/indexeddb'
import type { RateFactorGroup, RatingResult } from '@mikesaintsg/rater'

// Store rating configurations
const storage = createStorage<{ groups: readonly RateFactorGroup[]; baseRate: number }>('localStorage', {
	prefix: 'rater:',
})

// Load saved configuration
const config = await storage.get('config')
const engine = createRatingEngine({ baseRate: config?.baseRate ?? 100 })

// Store rating history in IndexedDB
interface RatingRecord {
	id: string
	subjectId: string
	finalRate: number
	breakdown: readonly string[]
	timestamp: number
}

const db = await createDatabase({
	name: 'ratings',
	version: 1,
	stores: {
		history: { keyPath: 'id' },
	},
})

// Track current subject being rated
let currentSubjectId = ''

engine.onRate(async (result) => {
	await db.store('history').set({
		id: crypto.randomUUID(),
		subjectId: currentSubjectId,
		finalRate: result.finalRate,
		breakdown: result.breakdown,
		timestamp: Date.now(),
	})
})
```

### Integration with Form Package

```typescript
import { createRatingEngine } from '@mikesaintsg/rater'
import { createForm } from '@mikesaintsg/form'
import type { RateFactor } from '@mikesaintsg/rater'

// Build forms for rate factor configuration
interface RateFactorForm {
	id: string
	label: string
	baseRate: number
}

const form = createForm<RateFactorForm>(formElement, {
	values: { id: '', label: '', baseRate: 0 },
	onSubmit: (values) => {
		const newFactor: RateFactor = {
			id: values.id,
			label: values.label,
			baseRate: values.baseRate,
		}
		// Add to factor groups
	},
})
```

### Use Cases

| Use Case                       | Rater Features Used                          |
|--------------------------------|----------------------------------------------|
| Insurance premium calculation  | Range tables, conditions, aggregation        |
| Dynamic pricing                | Lookup tables, mathematical operations       |
| Loan interest rates            | Conditions, factor groups                    |
| Shipping cost calculation      | Range tables, aggregation                    |
| Subscription tier pricing      | Lookup tables, conditions                    |
| Risk scoring                   | Weighted factors, conditions                 |

---

## Appendix: ActionLoop Integration

The `@mikesaintsg/actionloop` package provides predictive workflow guidance for user navigation and interaction patterns.

### Basic Setup

```typescript
import {
	createProceduralGraph,
	createPredictiveGraph,
	createWorkflowEngine,
} from '@mikesaintsg/actionloop'

// 1. Define workflow transitions
const transitions = [
	{ from: 'landing', to: 'login', weight: 1, actor: 'user' },
	{ from: 'landing', to: 'register', weight: 1, actor: 'user' },
	{ from: 'login', to: 'dashboard', weight: 1, actor: 'user' },
	{ from: 'register', to: 'onboarding', weight: 1, actor: 'user' },
	{ from: 'onboarding', to: 'dashboard', weight: 1, actor: 'user' },
	{ from: 'dashboard', to: 'settings', weight: 1, actor: 'user' },
	{ from: 'dashboard', to: 'profile', weight: 1, actor: 'user' },
	{ from: 'dashboard', to: 'projects', weight: 1, actor: 'user' },
] as const

// 2. Create procedural graph (static rules)
const procedural = createProceduralGraph({
	transitions,
	validateOnCreate: true,
})

// 3. Create predictive graph (dynamic weights)
const predictive = createPredictiveGraph(procedural, {
	decayAlgorithm: 'ewma',
	decayFactor: 0.9,
})

// 4. Create workflow engine
const engine = createWorkflowEngine(procedural, predictive, {
	trackSessions: true,
	validateTransitions: true,
})
```

### Recording Transitions

```typescript
// Start a session
const session = engine.startSession('user')

// Record transitions
engine.recordTransition('landing', 'login', {
	actor: 'user',
	sessionId: session.id,
	path: '/login',
})

engine.recordTransition('login', 'dashboard', {
	actor: 'user',
	sessionId: session.id,
	path: '/dashboard',
})

// Get predictions for current state
const predictions = engine.predictNext('dashboard', {
	actor: 'user',
	sessionId: session.id,
	path: '/dashboard',
	count: 3,
})
// => ['projects', 'settings', 'profile'] ranked by learned weights
```

### Displaying Predictions

```typescript
// With confidence scores
const detailed = engine.predictNextDetailed('dashboard', {
	actor: 'user',
	sessionId: session.id,
	path: '/dashboard',
	count: 5,
})

detailed.predictions.forEach(prediction => {
	console.log(`${prediction.nodeId}: ${Math.round(prediction.confidence * 100)}%`)
})
```

### Persisting Weights

```typescript
// Save to localStorage
function saveWeights() {
	const exported = predictive.export()
	localStorage.setItem('actionloop:weights', JSON.stringify(exported))
}

function loadWeights() {
	const stored = localStorage.getItem('actionloop:weights')
	if (stored) {
		predictive.import(JSON.parse(stored))
	}
}
```

### Cross-Tab Synchronization

```typescript
const channel = new BroadcastChannel('actionloop-sync')

// Broadcast weight updates
predictive.onWeightUpdate((from, to, actor, weight) => {
	channel.postMessage({ type: 'weight', from, to, actor, weight })
})

// Listen for updates from other tabs
channel.onmessage = (event) => {
	if (event.data.type === 'weight') {
		const { from, to, actor, weight } = event.data
		predictive.setWeight(from, to, actor, weight)
	}
}
```

### Navigation Integration

```typescript
// Navigation guard
function canNavigate(from: string, to: string): boolean {
	return engine.isValidTransition(from, to)
}

// Navigation hook
function onNavigate(from: string, to: string) {
	engine.recordTransition(from, to, {
		actor: 'user',
		sessionId: currentSessionId,
		path: `/${to}`,
	})
}
```

### Error Handling

```typescript
import { isActionLoopError } from '@mikesaintsg/actionloop'

try {
	engine.recordTransition('invalid', 'transition', context)
} catch (error) {
	if (isActionLoopError(error)) {
		switch (error.code) {
			case 'INVALID_TRANSITION':
				console.warn('Invalid transition:', error.message)
				break
			case 'SESSION_NOT_FOUND':
				console.info('Session expired, starting new session')
				engine.startSession('user')
				break
			case 'NODE_NOT_FOUND':
				console.error('Configuration error:', error.message)
				break
		}
	}
}
```

### Cleanup

```typescript
// Application shutdown
window.addEventListener('beforeunload', () => {
	// Save weights
	const exported = predictive.export()
	localStorage.setItem('actionloop:weights', JSON.stringify(exported))

	// End session
	engine.endSession(session.id, 'abandoned')

	// Cleanup
	engine.destroy()
})
```

### Use Cases

| Use Case                       | ActionLoop Features Used                     |
|--------------------------------|----------------------------------------------|
| Navigation suggestions         | Predictions, session tracking                |
| Workflow optimization          | Transition recording, weight learning        |
| User behavior analytics        | Session chains, prediction accuracy          |
| Onboarding flows               | Valid transitions, step validation           |
| Form wizard guidance           | Micro-transitions, predictions               |
| Content recommendation         | Learned weights, confidence scores           |

## Appendix: LLM-Powered ActionLoop Applications

This section describes how to build intelligent applications that combine ActionLoop's predictive workflow capabilities with local and remote LLM inference for contextual assistance.

### Overview

The integration enables:
- **Predictive UI**: ActionLoop predictions displayed as confidence-ranked action buttons
- **Prompt Refinement**: Local small model parses ambiguous input into structured queries
- **Contextual Assistance**: LLM receives ActionLoop state (predictions, events, patterns) for informed responses
- **Tool Automation**: LLM executes tools via ContextProtocol, transitions recorded in ActionLoop
- **Cross-Tab Sync**: Broadcast synchronizes state and predictions across browser tabs

### Architecture

```markdown
┌─────────────────────────────────────────────────────────────────────────┐
│                         Application                                      │
├─────────────────────────────────────────────────────────────────────────┤
│  UI Layer                                                               │
│  ├── Recommended Actions (from ActionLoop predictions)                  │
│  ├── Input Field (search/prompt)                                        │
│  ├── Refined Prompt Display (from local model)                          │
│  └── Results + Insights (from LLM + tools)                              │
├─────────────────────────────────────────────────────────────────────────┤
│  Integration Layer                                                      │
│  ├── ActionLoopContextFormatter (predictions → LLM context)             │
│  ├── ModelOrchestrator (fast/balanced/powerful tier selection)          │
│  └── AccountAssistant (orchestrates the full flow)                      │
├─────────────────────────────────────────────────────────────────────────┤
│  Core Packages                                                          │
│  ├── @mikesaintsg/actionloop (workflow + predictions)                   │
│  ├── @mikesaintsg/inference (LLM generation + streaming)                │
│  ├── @mikesaintsg/vectorstore (RAG for documentation)                   │
│  ├── @mikesaintsg/contextbuilder (context assembly + budget)            │
│  ├── @mikesaintsg/contextprotocol (tool schemas + execution)            │
│  ├── @mikesaintsg/indexeddb (persistence)                               │
│  └── @mikesaintsg/broadcast (cross-tab sync)                            │
├─────────────────────────────────────────────────────────────────────────┤
│  Adapter Layer                                                          │
│  ├── HuggingFace Provider Adapter (local models)                        │
│  ├── OpenAI/Anthropic Provider Adapter (API models)                     │
│  ├── HuggingFace Embedding Adapter (local embeddings)                   │
│  ├── IndexedDB Persistence Adapters (weights, events, vectors)          │
│  └── OpenAI Tool Format Adapter (tool calling)                          │
└─────────────────────────────────────────────────────────────────────────┘
```

```markdown
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Application Layer                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                    Account Management UI                               │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │ │
│  │  │  🔮 Recommended Actions (ActionLoop predictions)                 │  │ │
│  │  │  [Billing 85%] [Settings 62%] [Profile 41%] [Support 23%]       │  │ │
│  │  └─────────────────────────────────────────────────────────────────┘  │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │ │
│  │  │  🔍 User Input                                                   │  │ │
│  │  │  "show me accounts with failed payments this month"              │  │ │
│  │  └─────────────────────────────────────────────────────────────────┘  │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │ │
│  │  │  ✨ Refined Prompt (local model)                                 │  │ │
│  │  │  Query: payment_status='failed' AND date >= 2025-01-01           │  │ │
│  │  │  [Execute] [Use API Model] [Edit]                                │  │ │
│  │  └─────────────────────────────────────────────────────────────────┘  │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │ │
│  │  │  📋 Results + AI Insights                                        │  │ │
│  │  │  3 accounts, $23,750 total.  Acme Corp highest - prioritize.       │  │ │
│  │  └─────────────────────────────────────────────────────────────────┘  │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                        Integration Layer                                     │
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │ ActionLoop      │  │ Model           │  │ Context         │             │
│  │ Context         │  │ Orchestrator    │  │ Builder         │             │
│  │ Formatter       │  │                 │  │                 │             │
│  │                 │  │ • Fast (360M)   │  │ • Token budget  │             │
│  │ • Predictions   │  │ • Balanced (1.5B)│ │ • Deduplication │             │
│  │ • Events        │  │ • Powerful (API)│  │ • RAG frames    │             │
│  │ • Patterns      │  │                 │  │                 │             │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘             │
│           │                    │                    │                       │
│           └────────────────────┼────────────────────┘                       │
│                                │                                            │
├────────────────────────────────┼────────────────────────────────────────────┤
│                        Core Packages                                         │
│                                │                                            │
│  ┌─────────────┐  ┌────────────┴───────────┐  ┌─────────────┐              │
│  │ actionloop  │  │      inference         │  │ vectorstore │              │
│  │             │  │                        │  │             │              │
│  │ • Procedural│  │ • Engine               │  │ • Embeddings│              │
│  │ • Predictive│  │ • Session              │  │ • Search    │              │
│  │ • Engine    │  │ • Streaming            │  │ • RAG       │              │
│  │ • Activity  │  │ • Token batching       │  │             │              │
│  └─────────────┘  └────────────────────────┘  └─────────────┘              │
│                                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │contextproto-│  │contextbuilder│ │  indexeddb  │  │  broadcast  │        │
│  │   col       │  │             │  │             │  │             │        │
│  │ • Tools     │  │ • Frames    │  │ • Weights   │  │ • Cross-tab │        │
│  │ • Validation│  │ • Budget    │  │ • Events    │  │ • Leader    │        │
│  │ • Execution │  │ • Sliding   │  │ • Sessions  │  │ • Sync      │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                        Adapter Layer                                         │
│                                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ HuggingFace │  │ OpenAI      │  │ IndexedDB   │  │ OpenAI Tool │        │
│  │ Provider    │  │ Provider    │  │ Persistence │  │ Format      │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                         │
│  │ HuggingFace │  │ Voyage      │  │ Event Store │                         │
│  │ Embedding   │  │ Embedding   │  │ Persistence │                         │
│  └─────────────┘  └─────────────┘  └─────────────┘                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```markdown
User Input
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1. Prompt Refinement (Fast Model)                               │
│    "show failed payments" → { intent: 'search', query: {... } }  │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Context Assembly (ContextBuilder)                            │
│    • ActionLoop predictions + confidence                        │
│    • Recent events + engagement                                 │
│    • RAG results from VectorStore (if needed)                   │
│    • Tool schemas from ContextProtocol                          │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Generation (Balanced/Powerful Model)                         │
│    • Structured response with tool calls                        │
│    • Insights based on ActionLoop patterns                      │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. Tool Execution (ContextProtocol)                             │
│    • Execute search_accounts, get_account_details, etc.         │
│    • Record transition in ActionLoop                            │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. Response + Updated Predictions                               │
│    • Display results                                            │
│    • Update recommended actions from ActionLoop                 │
│    • Cross-tab sync via Broadcast                               │
└─────────────────────────────────────────────────────────────────┘
```

### Model Selection

| Tier     | Model                                  | Size   | Purpose                                  |
|----------|----------------------------------------|--------|------------------------------------------|
| Fast     | `HuggingFaceTB/SmolLM2-360M-Instruct`  | ~200MB | Instant intent detection, prompt parsing |
| Balanced | `Qwen/Qwen2.5-1.5B-Instruct`           | ~900MB | General assistance, insights             |
| Powerful | `microsoft/Phi-4-mini-instruct` or API | ~2.2GB | Complex reasoning, graph building        |

Progressive loading ensures immediate responsiveness:
1. Fast model loads first (~2-5s)
2. Balanced model loads in background (~10-20s)
3. Powerful model loaded on-demand or via API

### Setup

#### 1. Database Schema

```ts
import { createDatabase } from '@mikesaintsg/indexeddb'

interface AppSchema {
	accounts: Account
	sessions: SessionRecord
	events: TransitionEvent
	weights: ExportedWeight
	vectors: StoredDocument
}

const database = await createDatabase<AppSchema>({
	name: 'account-manager',
	version: 1,
	stores: {
		accounts: {
			keyPath: 'id',
			indexes: [
				{ name: 'status', keyPath: 'status' },
				{ name: 'paymentStatus', keyPath: 'paymentStatus' },
			],
		},
		sessions:  { keyPath: 'id' },
		events: {
			keyPath: 'id',
			indexes: [
				{ name: 'sessionId', keyPath: 'sessionId' },
				{ name:  'timestamp', keyPath: 'timestamp' },
			],
		},
		weights: { keyPath: ['from', 'to', 'actor'] },
		vectors: { keyPath: 'id' },
	},
})
```

#### 2. ActionLoop Setup

```ts
import {
	createProceduralGraph,
	createPredictiveGraph,
	createWorkflowEngine,
	createActivityTracker,
} from '@mikesaintsg/actionloop'
import {
	createIndexedDBEventPersistenceAdapter,
	createIndexedDBWeightPersistenceAdapter,
} from '@mikesaintsg/adapters'

// Define workflow transitions
const transitions = [
	{ from: 'dashboard', to: 'accounts', weight: 1, actor: 'user' },
	{ from: 'dashboard', to: 'billing', weight: 1, actor:  'user' },
	{ from: 'dashboard', to:  'settings', weight: 1, actor: 'user' },
	{ from: 'accounts', to: 'account-detail', weight: 1, actor:  'user' },
	{ from: 'accounts', to:  'dashboard', weight: 1, actor:  'user' },
	{ from: 'account-detail', to: 'accounts', weight: 1, actor:  'user' },
	{ from: 'account-detail', to: 'send-notification', weight: 1, actor:  'user' },
	{ from: 'billing', to: 'dashboard', weight: 1, actor: 'user' },
	{ from:  'settings', to: 'dashboard', weight: 1, actor: 'user' },
] as const

// Create graphs
const procedural = createProceduralGraph({ transitions })

const weightPersistence = createIndexedDBWeightPersistenceAdapter({
	database,
	storeName: 'weights',
})

const predictive = createPredictiveGraph(procedural, {
	persistence: weightPersistence,
	decayAlgorithm: 'ewma',
	decayFactor: 0.9,
	coldStart: {
		strategy: 'procedural-weight',
		warmupThreshold: 50,
	},
})

// Load existing weights on startup
await predictive.loadWeights()

// Create activity tracker
const activity = createActivityTracker({
	idleThreshold: 30000,
	awayThreshold: 300000,
})

// Create event persistence
const eventPersistence = createIndexedDBEventPersistenceAdapter({
	database,
	storeName: 'events',
})

// Create engine
const engine = createWorkflowEngine(procedural, predictive, {
	activity,
	eventPersistence,
	validateTransitions: true,
	trackSessions: true,
})
```

#### 3. VectorStore for RAG

```ts
import { createVectorStore } from '@mikesaintsg/vectorstore'
import {
	createHuggingFaceEmbeddingAdapter,
	createIndexedDBVectorPersistenceAdapter,
} from '@mikesaintsg/adapters'

// Small, fast embedding model
const embeddingAdapter = createHuggingFaceEmbeddingAdapter({
	model: 'Xenova/all-MiniLM-L6-v2',
})

const vectorPersistence = createIndexedDBVectorPersistenceAdapter({
	database,
	storeName:  'vectors',
})

const vectorStore = await createVectorStore(embeddingAdapter, {
	persistence: vectorPersistence,
})

// Load persisted vectors
await vectorStore.load()

// Index help documentation (do once or on updates)
await vectorStore.upsertDocument([
	{
		id: 'help-search',
		content: 'To search accounts, use filters like status, payment status, date range.. .',
		metadata: { category: 'help', topic: 'search' },
	},
	{
		id: 'help-notifications',
		content: 'Send notifications to accounts via email, SMS, or push.. .',
		metadata: { category: 'help', topic: 'notifications' },
	},
])
```

#### 4. Tool Registry

```ts
import { createToolRegistry } from '@mikesaintsg/contextprotocol'
import { createOpenAIToolFormatAdapter } from '@mikesaintsg/adapters'

const formatAdapter = createOpenAIToolFormatAdapter()
const tools = createToolRegistry(formatAdapter)

// Search accounts tool
tools.register(
	{
		name: 'search_accounts',
		description: 'Search for accounts matching criteria',
		parameters: {
			type: 'object',
			properties: {
				query:  { type: 'string', description: 'Free-text search' },
				status: { type: 'string', enum: ['active', 'inactive', 'suspended'] },
				paymentStatus:  { type: 'string', enum: ['current', 'overdue', 'failed'] },
				limit: { type: 'number', default: 10 },
			},
		},
	},
	async (params) => {
		// Query IndexedDB
		let query = database.store('accounts').query()
		
		if (params.status) {
			query = query.where('status').equals(params.status)
		}
		if (params.paymentStatus) {
			query = query.where('paymentStatus').equals(params.paymentStatus)
		}
		
		const accounts = await query.limit(params. limit ??  10).toArray()
		return { accounts, count: accounts.length }
	}
)

// Get account details tool
tools.register(
	{
		name: 'get_account_details',
		description:  'Get full details for a specific account',
		parameters: {
			type: 'object',
			properties: {
				accountId: { type: 'string', description: 'Account ID' },
			},
			required: ['accountId'],
		},
	},
	async (params) => {
		const account = await database.store('accounts').get(params.accountId)
		if (!account) {
			return { error: 'Account not found' }
		}
		return { account }
	}
)

// Send notification tool
tools.register(
	{
		name: 'send_notification',
		description:  'Send a notification to an account.  Requires confirmation.',
		parameters: {
			type: 'object',
			properties: {
				accountId:  { type: 'string' },
				type: { type: 'string', enum: ['email', 'sms', 'push'] },
				template: { type: 'string' },
				variables: { type: 'object' },
			},
			required:  ['accountId', 'type', 'template'],
		},
	},
	async (params) => {
		// Implementation would send actual notification
		return { success: true, notificationId: crypto.randomUUID() }
	}
)
```

#### 5. Model Orchestrator

```ts
import { createEngine } from '@mikesaintsg/inference'
import { createHuggingFaceProviderAdapter, createOpenAIProviderAdapter } from '@mikesaintsg/adapters'

// Create provider adapters
const fastProvider = createHuggingFaceProviderAdapter({
	model:  'HuggingFaceTB/SmolLM2-360M-Instruct',
	quantization: 'q4',
})

const balancedProvider = createHuggingFaceProviderAdapter({
	model: 'Qwen/Qwen2.5-1.5B-Instruct',
	quantization:  'q4',
})

const powerfulProvider = createOpenAIProviderAdapter({
	apiKey: import.meta.env.VITE_OPENAI_API_KEY,
	model: 'gpt-4o-mini',
})

// Model orchestrator manages tier selection
interface ModelOrchestrator {
	readonly fast: ReturnType<typeof createEngine> | undefined
	readonly balanced: ReturnType<typeof createEngine> | undefined
	readonly powerful: ReturnType<typeof createEngine> | undefined
	isReady(tier: 'fast' | 'balanced' | 'powerful'): boolean
	generate(prompt: string, options?: { tier?: 'fast' | 'balanced' | 'powerful' }): Promise<string>
}

function createModelOrchestrator(): ModelOrchestrator {
	const engines = {
		fast: undefined as ReturnType<typeof createEngine> | undefined,
		balanced: undefined as ReturnType<typeof createEngine> | undefined,
		powerful:  undefined as ReturnType<typeof createEngine> | undefined,
	}
	
	const ready = { fast: false, balanced: false, powerful: false }
	
	// Load fast model immediately
	;(async () => {
		engines.fast = createEngine(fastProvider)
		// Warm up with minimal generation
		await engines.fast. generate([{ id: '1', role: 'user', content: 'Hi' }], { maxTokens: 1 })
		ready.fast = true
	})()
	
	// Load balanced model in background
	;(async () => {
		engines.balanced = createEngine(balancedProvider)
		await engines.balanced.generate([{ id: '1', role: 'user', content: 'Hi' }], { maxTokens: 1 })
		ready.balanced = true
	})()
	
	// Powerful model is API-based, always ready
	engines.powerful = createEngine(powerfulProvider)
	ready.powerful = true
	
	return {
		get fast() { return engines.fast },
		get balanced() { return engines.balanced },
		get powerful() { return engines.powerful },
		
		isReady(tier) { return ready[tier] },
		
		async generate(prompt, options) {
			const tier = options?.tier ??  (ready.balanced ? 'balanced' : ready.fast ? 'fast' :  'powerful')
			const engine = engines[tier]
			
			if (!engine) {
				throw new Error(`No engine available for tier: ${tier}`)
			}
			
			const result = await engine.generate([
				{ id: crypto.randomUUID(), role: 'user', content: prompt },
			])
			
			return result. text
		},
	}
}

const orchestrator = createModelOrchestrator()
```

#### 6. ActionLoop Context Formatter

```ts
import type { DetailedPrediction, TransitionEvent } from '@mikesaintsg/actionloop'

interface FormattedActionLoopContext {
	currentNode: string
	predictions: Array<{
		nodeId: string
		label: string
		confidencePercent: number
		reasoning: string
	}>
	warmupComplete: boolean
	recentActivity: Array<{
		from: string
		to: string
		timestamp: number
	}>
	engagement: string
}

function formatActionLoopContext(
	predictions: DetailedPrediction,
	events: readonly TransitionEvent[],
	getLabel: (nodeId: string) => string = (id) => id
): FormattedActionLoopContext {
	return {
		currentNode: predictions. currentNode,
		predictions:  predictions.predictions.slice(0, 5).map((p) => ({
			nodeId: p.nodeId,
			label: getLabel(p.nodeId),
			confidencePercent: Math.round(p.confidence * 100),
			reasoning: formatReasoning(p.factors),
		})),
		warmupComplete: predictions.warmupComplete,
		recentActivity: events.slice(-10).map((e) => ({
			from: e.from,
			to: e.to,
			timestamp: e.timestamp,
		})),
		engagement: events[events.length - 1]?.engagement ??  'unknown',
	}
}

function formatReasoning(factors: { frequency: number; recency: number; engagement: number; sampleSize: number }): string {
	const parts:  string[] = []
	if (factors.frequency > 0.7) parts.push('frequently visited')
	if (factors.recency > 0.7) parts.push('recently accessed')
	if (factors.engagement > 0.7) parts.push('high engagement')
	if (factors.sampleSize > 0.7) parts.push('strong pattern')
	return parts.length > 0 ? parts.join(', ') : 'based on workflow structure'
}

function contextToNaturalLanguage(context: FormattedActionLoopContext): string {
	const lines: string[] = []
	
	lines.push(`Current location: ${context.currentNode}`)
	lines.push(`User engagement: ${context.engagement}`)
	
	if (context.warmupComplete && context.predictions.length > 0) {
		lines.push('')
		lines.push('Predicted next actions (based on learned patterns):')
		for (const p of context.predictions. slice(0, 3)) {
			lines.push(`  - ${p.label}: ${p.confidencePercent}% likely (${p.reasoning})`)
		}
	} else if (! context.warmupComplete) {
		lines.push('')
		lines.push('Note:  Predictions will improve with more usage data.')
	}
	
	return lines.join('\n')
}
```

#### 7. Context Builder Integration

```ts
import { createContextBuilder, createTokenCounter } from '@mikesaintsg/contextbuilder'

const tokenCounter = createTokenCounter()

async function buildAssistantContext(
	userInput: string,
	actionLoopContext: FormattedActionLoopContext,
	ragQuery?:  string
): Promise<BuiltContext> {
	const builder = createContextBuilder(tokenCounter, {
		budget: { maxTokens: 4000, reservedTokens: 1000 },
	})
	
	// System prompt
	builder.addFrame({
		id: 'system',
		type: 'system',
		priority: 'critical',
		content: `You are an intelligent account management assistant. 

Your capabilities:
- Search and filter accounts using search_accounts
- Get detailed account information using get_account_details
- Send notifications using send_notification (requires confirmation)

Guidelines:
- Be concise and actionable
- Use structured queries when searching
- Confirm before destructive actions
- Leverage the user's behavioral context for personalization`,
	})
	
	// ActionLoop context
	builder.addFrame({
		id: 'actionloop-context',
		type: 'context',
		priority: 'high',
		content: contextToNaturalLanguage(actionLoopContext),
		metadata: { source: 'actionloop' },
	})
	
	// RAG results if query provided
	if (ragQuery) {
		const results = await vectorStore.similaritySearch(ragQuery, { limit: 3 })
		for (const result of results) {
			builder.addFrame({
				id: `rag-${result. document.id}`,
				type: 'retrieval',
				priority: 'medium',
				content: result.document.content,
				metadata: { score: result.score },
			})
		}
	}
	
	// Tool schemas
	builder.addFrame({
		id: 'tools',
		type: 'tools',
		priority: 'high',
		content: JSON.stringify(tools.getSchemas(), null, 2),
	})
	
	// User input
	builder.addFrame({
		id: 'user-input',
		type: 'user',
		priority: 'critical',
		content: userInput,
	})
	
	return builder.build()
}
```

#### 8. Complete Assistant Flow

```ts
import { createSession } from '@mikesaintsg/inference'

interface AssistantResult {
	refinedPrompt: string
	response: string
	toolsExecuted: Array<{ name: string; result: unknown }>
	recommendations: Array<{ nodeId: string; label: string; confidence: number }>
}

async function processUserInput(
	input: string,
	currentNode: string,
	sessionId: string
): Promise<AssistantResult> {
	// 1. Get ActionLoop predictions
	const predictions = engine.predictNextDetailed(currentNode, {
		actor: 'user',
		sessionId,
		path: window.location.pathname,
		count: 5,
	})
	
	// 2. Get recent events
	const recentEvents = await engine.getEvents({
		sessionId,
		limit: 20,
	})
	
	// 3. Format ActionLoop context
	const actionLoopContext = formatActionLoopContext(
		predictions,
		recentEvents,
		(nodeId) => procedural.getNode(nodeId)?.label ??  nodeId
	)
	
	// 4. Refine prompt with fast model
	const refinedPrompt = await refinePrompt(input)
	
	// 5. Build context
	const builtContext = await buildAssistantContext(
		refinedPrompt,
		actionLoopContext,
		refinedPrompt // Use refined prompt for RAG
	)
	
	// 6. Generate response with tools
	const session = orchestrator.balanced?. createSession({
		system: builtContext.system,
	})
	
	if (!session) {
		throw new Error('No model available')
	}
	
	for (const frame of builtContext.frames. filter((f) => f.type !== 'system')) {
		session.addMessage('user', frame.content)
	}
	
	const result = await session.generate({
		tools: tools.getFormattedSchemas(),
		toolChoice: 'auto',
	})
	
	// 7. Execute tool calls
	const toolsExecuted:  Array<{ name: string; result: unknown }> = []
	
	if (result.toolCalls && result.toolCalls.length > 0) {
		for (const call of result.toolCalls) {
			const toolResult = await tools.execute(call)
			toolsExecuted.push({ name: call.name, result: toolResult. result })
			session.addToolResult(call.id, call.name, toolResult.result)
		}
		
		// Get final response after tool execution
		const finalResult = await session.generate()
		
		return {
			refinedPrompt,
			response: finalResult.text,
			toolsExecuted,
			recommendations: actionLoopContext.predictions.map((p) => ({
				nodeId: p.nodeId,
				label: p.label,
				confidence: p.confidencePercent,
			})),
		}
	}
	
	return {
		refinedPrompt,
		response: result.text,
		toolsExecuted:  [],
		recommendations: actionLoopContext.predictions.map((p) => ({
			nodeId: p. nodeId,
			label: p.label,
			confidence: p.confidencePercent,
		})),
	}
}

async function refinePrompt(input: string): Promise<string> {
	if (!orchestrator.isReady('fast')) {
		return input // Fall back to raw input if fast model not ready
	}
	
	const result = await orchestrator.generate(
		`Analyze and refine this user input for an account management system. 
Input: "${input}"

Respond with a clear, structured version of the request.
If it's a search, specify the filters clearly.
If it's an action, specify what should be done.
Keep it concise. `,
		{ tier: 'fast' }
	)
	
	return result.trim()
}
```

#### 9. Recording Transitions

```ts
// When user navigates or takes action
function handleNavigation(from: string, to: string): void {
	const session = engine.getActiveSession('user') ??  engine.startSession('user')
	
	engine.recordTransition(from, to, {
		actor:  'user',
		sessionId: session.id,
		path: window.location.pathname,
	})
}

// When tool is executed, record as system transition
function handleToolExecution(toolName: string): void {
	const session = engine.getActiveSession('user')
	if (! session) return
	
	const currentNode = session.nodeHistory? .[session.nodeHistory.length - 1] ?? 'dashboard'
	const toolNode = `tool: ${toolName}`
	
	// Record as automation actor
	engine.recordTransition(currentNode, toolNode, {
		actor: 'automation',
		sessionId: session.id,
		path: window.location. pathname,
		metadata: { toolName },
	})
}
```

#### 10. Cross-Tab Synchronization

```ts
import { createBroadcast } from '@mikesaintsg/broadcast'

interface AppState {
	currentNode: string
	predictions: Array<{ nodeId: string; confidence: number }>
	sessionId: string
}

const broadcast = createBroadcast<AppState, { type: 'navigation'; to: string }>({
	channel: 'account-manager',
	state: {
		currentNode: 'dashboard',
		predictions: [],
		sessionId: '',
	},
})

// Update state when predictions change
engine.onTransition((from, to, context) => {
	const predictions = engine.predictNextDetailed(to, {
		actor: 'user',
		sessionId: context.sessionId,
		path: context.path,
		count: 5,
	})
	
	broadcast.setState({
		currentNode: to,
		predictions:  predictions. predictions.map((p) => ({
			nodeId: p.nodeId,
			confidence: p.confidence,
		})),
		sessionId: context.sessionId,
	})
})

// Listen for changes from other tabs
broadcast.onStateChange((state, source) => {
	if (source === 'remote') {
		updateUIWithPredictions(state.predictions)
	}
})

// Leader tab handles weight persistence
broadcast.onLeaderChange((isLeader) => {
	if (isLeader) {
		// Auto-save weights periodically
		setInterval(() => {
			predictive.saveWeights()
		}, 60000)
	}
})
```

#### 11. UI Integration

```ts
// Recommended actions component
function RecommendedActions(): HTMLElement {
	const container = document.createElement('div')
	container.className = 'recommended-actions'
	
	function render(predictions: Array<{ nodeId: string; label: string; confidence: number }>): void {
		container.innerHTML = ''
		
		const heading = document.createElement('h3')
		heading.textContent = '🔮 Recommended Actions'
		container.appendChild(heading)
		
		const buttons = document.createElement('div')
		buttons.className = 'action-buttons'
		
		for (const p of predictions) {
			const button = document.createElement('button')
			button.className = 'action-button'
			button.innerHTML = `${p.label} <span class="confidence">${p. confidence}%</span>`
			button.onclick = () => handleNavigation(getCurrentNode(), p.nodeId)
			buttons.appendChild(button)
		}
		
		container. appendChild(buttons)
	}
	
	// Subscribe to prediction updates
	broadcast.onStateChange((state) => {
		const predictions = state.predictions. map((p) => ({
			...p,
			label: procedural.getNode(p.nodeId)?.label ?? p.nodeId,
		}))
		render(predictions)
	})
	
	return container
}

// Input with refinement display
function AssistantInput(): HTMLElement {
	const container = document.createElement('div')
	container.className = 'assistant-input'
	
	const input = document.createElement('input')
	input.type = 'text'
	input.placeholder = 'Search accounts or ask a question...'
	
	const refinedDisplay = document.createElement('div')
	refinedDisplay.className = 'refined-prompt'
	refinedDisplay.style.display = 'none'
	
	const responseDisplay = document.createElement('div')
	responseDisplay.className = 'response'
	
	input.onkeydown = async (e) => {
		if (e.key !== 'Enter') return
		
		const userInput = input.value.trim()
		if (!userInput) return
		
		// Show loading state
		refinedDisplay.textContent = 'Refining.. .'
		refinedDisplay.style.display = 'block'
		
		try {
			const session = engine.getActiveSession('user') ?? engine.startSession('user')
			const currentNode = broadcast.getState().currentNode
			
			const result = await processUserInput(userInput, currentNode, session.id)
			
			refinedDisplay.textContent = `✨ ${result.refinedPrompt}`
			responseDisplay.innerHTML = formatResponse(result)
		} catch (error) {
			responseDisplay.textContent = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
		}
	}
	
	container.appendChild(input)
	container.appendChild(refinedDisplay)
	container.appendChild(responseDisplay)
	
	return container
}

function formatResponse(result: AssistantResult): string {
	let html = `<p>${result.response}</p>`
	
	if (result.toolsExecuted.length > 0) {
		html += '<div class="tools-executed">'
		html += '<strong>Actions taken:</strong><ul>'
		for (const tool of result.toolsExecuted) {
			html += `<li>${tool.name}</li>`
		}
		html += '</ul></div>'
	}
	
	return html
}
```

### Performance Considerations

1. **Progressive Model Loading**: Load smallest model first for instant responsiveness
2. **Token Batching**: Use `TokenBatcher` from inference for smooth streaming UI
3. **Debounce Input**: Debounce prompt refinement to avoid excessive model calls
4. **Cache Embeddings**: VectorStore persistence avoids re-embedding on reload
5. **Weight Persistence**: Auto-save ActionLoop weights to avoid cold-start on refresh
6. **Leader Election**: Use Broadcast leader to coordinate background tasks

### Error Handling

```ts
import { isActionLoopError } from '@mikesaintsg/actionloop'
import { isInferenceError } from '@mikesaintsg/inference'
import { isVectorStoreError } from '@mikesaintsg/vectorstore'

async function safeProcessInput(input: string): Promise<AssistantResult | null> {
	try {
		return await processUserInput(input, getCurrentNode(), getSessionId())
	} catch (error) {
		if (isActionLoopError(error)) {
			console.error(`ActionLoop error [${error.code}]: ${error.message}`)
			// Handle specific ActionLoop errors
		} else if (isInferenceError(error)) {
			console.error(`Inference error [${error.code}]: ${error. message}`)
			// Retry with different tier or show user message
		} else if (isVectorStoreError(error)) {
			console.error(`VectorStore error [${error.code}]: ${error.message}`)
			// Continue without RAG
		}
		return null
	}
}
```

### Cleanup

```ts
function cleanup(): void {
	// Save weights before closing
	predictive.saveWeights()
	
	// Destroy all components
	engine.destroy()
	activity.destroy()
	vectorStore.destroy()
	tools.destroy()
	broadcast.destroy()
	database.close()
}

window.addEventListener('beforeunload', cleanup)
```

### Use Cases

| Use Case               | ActionLoop Role                      | LLM Role                                   |
|------------------------|--------------------------------------|--------------------------------------------|
| Navigation suggestions | Predict next actions with confidence | Explain reasoning                          |
| Account search         | Record search patterns               | Parse natural language to structured query |
| Insight generation     | Provide behavioral patterns          | Synthesize insights from patterns          |
| Task automation        | Track automation transitions         | Determine when to trigger tools            |
| Cross-tab coordination | Sync predictions                     | Share context                              |
| Cold-start handling    | Use procedural weights               | Provide onboarding guidance                |
