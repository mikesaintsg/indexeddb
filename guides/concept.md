# @mikesaintsg Ecosystem — Conceptual Architecture

> **Purpose:** Comprehensive architectural overview of the `@mikesaintsg` package ecosystem, including adapter patterns, package responsibilities, and integration guidelines.

---

## Package Overview

| Package                        | Purpose                             | Required First Param         |
|--------------------------------|-------------------------------------|------------------------------|
| `@mikesaintsg/core`            | Shared types, interfaces, utilities | N/A                          |
| `@mikesaintsg/adapters`        | All adapter implementations         | N/A (factory per adapter)    |
| `@mikesaintsg/inference`       | LLM generation engine               | `ProviderAdapterInterface`   |
| `@mikesaintsg/vectorstore`     | Vector storage & search             | `EmbeddingAdapterInterface`  |
| `@mikesaintsg/contextprotocol` | Tool registry & execution           | `ToolFormatAdapterInterface` |
| `@mikesaintsg/contextbuilder`  | Context assembly & budgeting        | `TokenCounterInterface`      |
| `@mikesaintsg/indexeddb`       | IndexedDB wrapper                   | N/A                          |
| `@mikesaintsg/filesystem`      | OPFS wrapper                        | N/A                          |
| `@mikesaintsg/broadcast`       | Cross-tab state sync                | N/A                          |
| `@mikesaintsg/form`            | Form state management               | N/A                          |
| `@mikesaintsg/table`           | Virtual table                       | N/A                          |
| `@mikesaintsg/navigation`      | Client-side routing                 | N/A                          |
| `@mikesaintsg/storage`         | Storage abstraction                 | N/A                          |
| `@mikesaintsg/rater`           | Factor-based rating engine          | N/A                          |
| `@mikesaintsg/actionloop`      | Predictive workflow guidance        | `ProceduralGraphInterface`   |

**Factory Pattern:** `createSystem(requiredAdapter, options?)`

- The **required adapter** is always the **first parameter**
- **Optional adapters** are in the **options object** (second parameter)
- **All optional adapters are opt-in** — nothing is enabled by default

---

## Adapter Architecture Philosophy

### The Port Pattern

Every system in this ecosystem follows the **Port Pattern**: systems define **ports** (slots for adapters) and adapters **plug into** those ports. This creates a clean separation where:

1. **Adapters are self-contained** — Each adapter implements an interface and can function independently
2. **Systems orchestrate adapters** — Systems bring adapters together and coordinate their interactions
3. **Adapters are peers, not layers** — No adapter "wraps" another; they work alongside each other
4. **Required adapters are parameters** — The primary adapter is always a required parameter, not in options
5. **Optional adapters are opt-in** — No optional adapters are enabled by default; developers explicitly provide them

### Adapter Categories

All adapters fall into these categories:

| Category                 | Purpose                      | Examples                                                 |
|--------------------------|------------------------------|----------------------------------------------------------|
| **Source Adapters**      | Generate or retrieve data    | `EmbeddingAdapter`, `ProviderAdapter`                    |
| **Persistence Adapters** | Store and load data          | `VectorPersistenceAdapter`, `SessionPersistenceAdapter`  |
| **Policy Adapters**      | Apply policies to operations | `RetryAdapter`, `RateLimitAdapter`                       |
| **Transform Adapters**   | Transform data formats       | `ToolFormatAdapter`, `TokenAdapter`, `SimilarityAdapter` |
| **Enhancement Adapters** | Add capabilities             | `CacheAdapter`, `BatchAdapter`, `RerankerAdapter`        |

### Key Principle: Opt-In Design

All optional adapters are **opt-in**. This gives developers full control:

- **No hidden behavior** — Nothing happens unless you explicitly enable it
- **Explicit dependencies** — You know exactly what's running
- **Minimal by default** — Start simple, add capabilities as needed
- **Default implementations provided** — We provide ready-to-use adapters you can plug in

```ts
// MINIMAL: Just the required adapter, no extras
const store = await createVectorStore(embeddingAdapter)

// WITH PERSISTENCE: Opt-in to persistence
const store = await createVectorStore(embeddingAdapter, {
  persistence: createIndexedDBVectorPersistenceAdapter({ database }),
})

// PRODUCTION: Opt-in to multiple capabilities
const store = await createVectorStore(embeddingAdapter, {
  persistence: createIndexedDBVectorPersistenceAdapter({ database }),
  retry: createExponentialRetryAdapter(),      // Use our default retry
  cache: createLRUCacheAdapter({ maxSize: 10000 }),
  batch: createBatchAdapter(),          // Use our default batch
})
```

### Adapter Interface Design

Every adapter interface follows this structure:

```ts
interface SomeAdapterInterface {
  // Core operations (what it does)
  doThing(input: Input): Output | Promise<Output>
  
  // Optional: Capability queries
  supports?(feature: string): boolean
  
  // Optional: Metadata
  getMetadata?(): Metadata
}
```

### Policy Adapter Interfaces

Policy adapters have their own dedicated interfaces:

```ts
/** Retry policies adapter - determines retry behavior */
interface RetryAdapterInterface {
  shouldRetry(error: unknown, attempt: number): boolean
  getDelay(attempt: number): number
  getMaxAttempts(): number
  onRetry?(error: unknown, attempt: number, delayMs: number): void
}

/** Rate limit adapter - controls request rate */
interface RateLimitAdapterInterface {
  acquire(): Promise<void>
  release(): void
  getState(): RateLimitState
  setLimit(requestsPerMinute: number): void
}

/** Cache adapter - provides caching for embeddings */
interface EmbeddingCacheAdapterInterface {
  get(text: string): Embedding | undefined
  set(text: string, embedding: Embedding): void
  has(text: string): boolean
  clear(): void
}

/** Batch adapter - controls batching behavior */
interface BatchAdapterInterface {
  getBatchSize(): number
  getDelayMs(): number
  shouldDeduplicate(): boolean
}
```

### System Factory Pattern

Systems take the **required adapter as a parameter** and **optional adapters in an options object**:

```ts
// Factory signature: required adapter first, options second
function createVectorStore(
  embedding: EmbeddingAdapterInterface,
  options?: VectorStoreOptions
): Promise<VectorStoreInterface>

// Options contain ONLY optional adapters and configuration
interface VectorStoreOptions extends SubscriptionToHook<VectorStoreSubscriptions> {
  // Persistence (opt-in)
  readonly persistence?: VectorPersistenceAdapterInterface
  
  // Transform (opt-in)
  readonly similarity?: SimilarityAdapterInterface
  
  // Policy (opt-in)
  readonly retry?: RetryAdapterInterface
  readonly rateLimit?: RateLimitAdapterInterface
  
  // Enhancement (opt-in)
  readonly cache?: EmbeddingCacheAdapterInterface
  readonly batch?: BatchAdapterInterface
  readonly reranker?: RerankerAdapterInterface
  
  // Configuration
  readonly autoSave?: boolean
}

```

### Default Adapter Implementations

We provide ready-to-use default implementations for common use cases. These are **not enabled by default**—you must explicitly provide them:

| Adapter Type    | Default Implementation | Factory Function                           |
|-----------------|------------------------|--------------------------------------------|
| **Persistence** | In-memory storage      | `createInMemoryVectorPersistenceAdapter()` |
| **Similarity**  | Cosine similarity      | `createCosineSimilarityAdapter()`          |
| **Retry**       | Exponential backoff    | `createExponentialRetryAdapter()`          |
| **Batch**       | Sensible defaults      | `createBatchAdapter()`              |
| **Cache**       | LRU eviction           | `createLRUCacheAdapter()`                  |
| **Rate Limit**  | Token bucket           | `createTokenBucketRateLimitAdapter()`      |

### Creating and Using Adapters

```ts
import { createVectorStore } from '@mikesaintsg/vectorstore'
import {
  // Source adapters (required)
  createOpenAIEmbeddingAdapter,
  // Persistence adapters (opt-in)
  createIndexedDBVectorPersistenceAdapter,
  createInMemoryVectorPersistenceAdapter,
  // Policy adapters (opt-in)
  createExponentialRetryAdapter,
  createTokenBucketRateLimitAdapter,
  // Enhancement adapters (opt-in)
  createLRUCacheAdapter,
  createBatchAdapter,
  // Transform adapters (opt-in)
  createCosineSimilarityAdapter,
} from '@mikesaintsg/adapters'

// MINIMAL: Just the required adapter - no persistence, no retry, no cache
const simpleStore = await createVectorStore(
  createOpenAIEmbeddingAdapter({ apiKey, model: 'text-embedding-3-small' })
)

// WITH PERSISTENCE: Opt-in to IndexedDB persistence
const persistedStore = await createVectorStore(
  createOpenAIEmbeddingAdapter({ apiKey, model: 'text-embedding-3-small' }),
  {
    persistence: createIndexedDBVectorPersistenceAdapter({ database: db }),
  }
)

// PRODUCTION: Opt-in to multiple capabilities
const productionStore = await createVectorStore(
  createOpenAIEmbeddingAdapter({ apiKey, model: 'text-embedding-3-small' }),
  {
    // Persistence
    persistence: createIndexedDBVectorPersistenceAdapter({ database: db }),
    // Transform
    similarity: createCosineSimilarityAdapter(),
    // Policy
    retry: createExponentialRetryAdapter({ maxAttempts: 5 }),
    rateLimit: createTokenBucketRateLimitAdapter({ requestsPerMinute: 60 }),
    // Enhancement
    cache: createLRUCacheAdapter({ maxSize: 10000, ttlMs: 3600000 }),
    batch: createBatchAdapter({ batchSize: 100 }),
  }
)
```

### How Systems Coordinate Adapters

Inside the system, adapters are used as peers. The system checks if an adapter was provided before using it:

```ts
// Inside VectorStore implementation (pseudocode)
async function embed(text: string): Promise<Embedding> {
  // 1. Check cache adapter (only if provided)
  if (this.#cache) {
    const cached = this.#cache.get(text)
    if (cached) return cached
  }
  
  // 2. Apply rate limit policies (only if provided)
  if (this.#rateLimit) {
    await this.#rateLimit.acquire()
  }
  
  try {
    // 3. Use retry policies (only if provided)
    const embedding = this.#retry
      ? await this.#executeWithRetry(() => this.#embedding.embed([text]))
      : await this.#embedding.embed([text])
    
    // 4. Store in cache (only if provided)
    if (this.#cache) {
      this.#cache.set(text, embedding[0])
    }
    
    return embedding[0]
  } finally {
    if (this.#rateLimit) {
      this.#rateLimit.release()
    }
  }
}

// Batch adapter influences grouping (only if provided)
async function embedBatch(texts: readonly string[]): Promise<readonly Embedding[]> {
  // If no batch adapter, process all at once
  if (!this.#batch) {
    return this.#embedding.embed(texts)
  }
  
  const batchSize = this.#batch.getBatchSize()
  const delayMs = this.#batch.getDelayMs()
  
  const results: Embedding[] = []
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize)
    const embeddings = await this.#embedBatchInternal(batch)
    results.push(...embeddings)
    
    if (i + batchSize < texts.length && delayMs > 0) {
      await sleep(delayMs)
    }
  }
  return results
}
```

### Benefits of This Pattern

1. **Adapters are truly self-contained** — Each adapter works independently
2. **No wrapping mental model** — Adapters are peers, not layers
3. **Explicit opt-in** — Nothing is enabled unless you provide it
4. **No hidden behavior** — You know exactly what's running
5. **Testable in isolation** — Each adapter can be tested independently
6. **Composable at system level** — Systems decide how to coordinate adapters
7. **Default implementations available** — We provide sensible defaults you can use
8. **Type-safe ports** — Each port has a typed interface

---

## 1. @mikesaintsg/core

````markdown name=guides/core.md
# @mikesaintsg/core — Shared Types & Interfaces

## Purpose

The foundational package providing shared type definitions, adapter interfaces, and utility types used across the ecosystem.  Contains **zero implementations** — only contracts. 

## Design Principles

1. **Interface-only** — No runtime code, just TypeScript types
2. **Dependency root** — All other packages depend on core
3. **Stability first** — Changes here affect everything
4. **Minimal surface** — Only truly shared types belong here

## Package Boundaries

### What Belongs in Core

- Adapter interface definitions (contracts)
- Shared data types (Message, ToolCall, Embedding, etc.)
- Utility types (Result, Unsubscribe, Destroyable)
- Error base classes and type guards
- Bridge interfaces for cross-package integration

### What Does NOT Belong in Core

- Implementations of any interface
- Package-specific types (use package's own types.ts)
- Configuration options (belong with implementations)
- Factory functions (belong with implementations)

## Ecosystem Ownership Table

| Concept | Owner | Core Provides |
|---------|-------|---------------|
| Provider generation | inference | `ProviderAdapterInterface` |
| Embedding generation | adapters | `EmbeddingAdapterInterface` |
| Tool formatting | adapters | `ToolFormatAdapterInterface` |
| Vector persistence | adapters | `VectorPersistenceAdapterInterface` |
| Session persistence | adapters | `SessionPersistenceAdapterInterface` |
| Token counting | inference | `TokenAdapterInterface` |
| Token budgeting | contextbuilder | `BudgetAdapterInterface` |
| Abort coordination | inference | `AbortAdapterInterface` |
| Tool execution | contextprotocol | `ToolRegistryInterface` (minimal) |

## Adapter Interface Pattern

All adapter interfaces follow this pattern:

```ts
export interface SomeAdapterInterface {
	// Identity
	readonly id?:  string
	
	// Core operations (what it does)
	doThing(input: Input): Output
	
	// Capability queries (what it supports)
	supportsSomething(): boolean
	
	// Metadata (what it is)
	getMetadata(): Metadata
}
```

## Result Pattern

Used for operations that can fail predictably:

```ts
import { ok, err, isOk, unwrapOrThrow } from '@mikesaintsg/core'

const result = await riskyOperation()
if (isOk(result)) {
	console.log(result.value)
} else {
	console.error(result.error)
}
```

## Bridge Interfaces

Minimal interfaces for cross-package integration without hard dependencies:

```ts
// Instead of importing full VectorStoreInterface
interface VectorStoreMinimal {
	search(query: string, options?: SearchOptions): Promise<readonly ScoredResult[]>
}
```

## Error Utilities

```ts
import { EcosystemError, isEcosystemError } from '@mikesaintsg/core'

try {
	await operation()
} catch (error) {
	if (isEcosystemError(error)) {
		console.log(error.code) // Typed error code
	}
}
```

## API Reference

### Utility Types

- `Unsubscribe` — Cleanup function from subscriptions
- `SubscriptionToHook<T>` — Converts subscription methods to hook callbacks
- `ChangeSource` — Origin of state change ('local' | 'remote')
- `AbortableOptions` — Options with optional AbortSignal
- `ContentHash` — SHA-256 hex string for deduplication

### Result Types

- `Ok<T>` — Success result with value
- `Err<E>` — Failure result with error
- `Result<T, E>` — Union of Ok and Err

### Data Types

- `Embedding` — Float32Array vector
- `EmbeddingModelMetadata` — Provider, model, dimensions
- `ToolCall` — LLM tool invocation
- `ToolResult` — Tool execution result
- `ToolSchema` — Tool definition with JSON Schema
- `ScoredResult` — Search result with score
- `ContextFrame` — Atomic unit of context
- `BuiltContext` — Assembled context for inference

### Adapter Interfaces

- `EmbeddingAdapterInterface` — Generate embeddings
- `ProviderAdapterInterface` — LLM generation (defined in inference)
- `TokenAdapterInterface` — Token counting
- `BudgetAdapterInterface` — Token budget management
- `AbortAdapterInterface` — Cancellation coordination
- `ToolFormatAdapterInterface` — Provider-specific tool formatting
- `VectorPersistenceAdapterInterface` — Vector storage backend
- `SessionPersistenceAdapterInterface` — Session storage backend
- `SimilarityAdapterInterface` — Vector similarity computation
- `RerankerAdapterInterface` — Result reranking

### Policy Adapter Interfaces

- `RetryAdapterInterface` — Retry policy for failed operations
- `RateLimitAdapterInterface` — Request rate control

### Enhancement Adapter Interfaces

- `EmbeddingCacheAdapterInterface` — Caching for embeddings
- `BatchAdapterInterface` — Batching configuration

### Bridge Interfaces

- `ToolRegistryMinimal` — Minimal tool registry for bridges
- `VectorStoreMinimal` — Minimal vector store for bridges
- `FormMinimal` — Minimal form for navigation guards
- `SerializableSession` — Session for serialization

### Error Types

- `EcosystemError` — Base error class
- `PackageErrorData<TCode>` — Generic error data interface
- `isEcosystemError(error)` — Type guard
````

```typescript name=types/core/types.ts
/**
 * @mikesaintsg/core
 *
 * Shared type definitions for the ecosystem. 
 * Contains ONLY types and interfaces — no implementations.
 */

// ============================================================================
// Utility Types
// ============================================================================

/** Cleanup function returned by event subscriptions */
export type Unsubscribe = () => void

/** Converts subscription methods to hook callbacks for options */
export type SubscriptionToHook<T> = {
	[K in keyof T]?: T[K] extends (callback: infer CB) => Unsubscribe ?  CB : never
}

/** Origin of state change */
export type ChangeSource = 'local' | 'remote'

/** Cancellable operation options */
export interface AbortableOptions {
	readonly signal?: AbortSignal
}

/** Content hash for deduplication (SHA-256 hex string) */
export type ContentHash = string

// ============================================================================
// Result Pattern
// ============================================================================

/** Success result */
export interface Ok<T> {
	readonly ok: true
	readonly value: T
}

/** Failure result */
export interface Err<E> {
	readonly ok:  false
	readonly error: E
}

/** Result union */
export type Result<T, E> = Ok<T> | Err<E>

// ============================================================================
// Embedding Types
// ============================================================================

/** Embedding vector */
export type Embedding = Float32Array

/** Embedding model info */
export interface EmbeddingModelMetadata {
	readonly provider: string
	readonly model: string
	readonly dimensions: number
}

// ============================================================================
// Tool Types
// ============================================================================

/** Tool call from LLM response */
export interface ToolCall {
	readonly id: string
	readonly name: string
	readonly arguments:  Readonly<Record<string, unknown>>
}

/** Tool execution result */
export interface ToolResult {
	readonly callId: string
	readonly name: string
	readonly success: boolean
	readonly value?: unknown
	readonly error?: string
}

/** Tool schema definition */
export interface ToolSchema {
	readonly name: string
	readonly description:  string
	readonly parameters: JSONSchema7
	readonly returns?:  JSONSchema7
}

/** JSON Schema 7 subset for tool parameters */
export interface JSONSchema7 {
	readonly type?:  string | readonly string[]
	readonly properties?:  Readonly<Record<string, JSONSchema7>>
	readonly items?: JSONSchema7 | readonly JSONSchema7[]
	readonly required?: readonly string[]
	readonly enum?: readonly unknown[]
	readonly const?: unknown
	readonly format?: string
	readonly minimum?: number
	readonly maximum?: number
	readonly minLength?: number
	readonly maxLength?: number
	readonly pattern?: string
	readonly description?: string
	readonly default?: unknown
	readonly additionalProperties?: boolean | JSONSchema7
	readonly anyOf?: readonly JSONSchema7[]
	readonly oneOf?: readonly JSONSchema7[]
	readonly allOf?: readonly JSONSchema7[]
	readonly $ref?: string
	readonly definitions?:  Readonly<Record<string, JSONSchema7>>
}

// ============================================================================
// Scored Result Types
// ============================================================================

/** Scored result from similarity search or retrieval */
export interface ScoredResult {
	readonly id: string
	readonly content: string
	readonly score:  number
	readonly metadata?:  Readonly<Record<string, unknown>>
	readonly embedding?: Embedding
}

// ============================================================================
// Context Frame Types
// ============================================================================

/** Frame type discriminator */
export type FrameType =
	| 'system'
	| 'instruction'
	| 'section'
	| 'file'
	| 'document'
	| 'example'
	| 'tool'
	| 'memory'
	| 'retrieval'
	| 'custom'

/** Frame priority levels */
export type FramePriority = 'critical' | 'high' | 'normal' | 'low' | 'optional'

/** Context frame - atomic unit of context */
export interface ContextFrame {
	readonly id: string
	readonly type: FrameType
	readonly content: string
	readonly contentHash: ContentHash
	readonly priority: FramePriority
	readonly tokenEstimate: number
	readonly createdAt: number
	readonly metadata?: FrameMetadata
}

/** Frame metadata */
export interface FrameMetadata {
	readonly sectionId?:  string
	readonly filePath?: string
	readonly fileVersion?: number
	readonly toolName?: string
	readonly score?: number
	readonly tags?: readonly string[]
	readonly expiresAt?: number
	readonly source?: string
}

// ============================================================================
// Token Budget Types
// ============================================================================

/** Token budget level */
export type TokenBudgetLevel = 'ok' | 'warning' | 'critical' | 'exceeded'

/** Token budget state */
export interface TokenBudgetState {
	readonly used: number
	readonly available: number
	readonly reserved: number
	readonly max: number
	readonly usage: number
	readonly level: TokenBudgetLevel
}

// ============================================================================
// Built Context Types
// ============================================================================

/** Deduplication result summary */
export interface DeduplicationResult {
	readonly originalCount: number
	readonly deduplicatedCount:  number
	readonly removedFrames: readonly ContextFrame[]
	readonly mergedFrames: readonly ContextFrame[]
	readonly tokensSaved: number
}

/** Truncation strategy */
export type TruncationStrategy = 'priority' | 'fifo' | 'lifo' | 'score' | 'custom'

/** Why a frame was truncated */
export type TruncationReason =
	| 'budget_exceeded'
	| 'priority_too_low'
	| 'expired'
	| 'deduplicated'
	| 'manual'

/** Frame summary for reporting */
export interface FrameSummary {
	readonly id: string
	readonly type: FrameType
	readonly tokenEstimate: number
	readonly reason: TruncationReason
}

/** Truncation information */
export interface TruncationInfo {
	readonly originalFrameCount: number
	readonly keptFrameCount:  number
	readonly removedFrames: readonly FrameSummary[]
	readonly strategy: TruncationStrategy
}

/** Assembled context ready for inference */
export interface BuiltContext {
	readonly frames: readonly ContextFrame[]
	readonly totalTokens: number
	readonly budget: TokenBudgetState
	readonly truncated: boolean
	readonly truncationInfo?:  TruncationInfo
	readonly deduplication?:  DeduplicationResult
	readonly timestamp: number
}

// ============================================================================
// Adapter Interfaces
// ============================================================================

/**
 * Embedding adapter interface. 
 * Generates embeddings from text.  Implemented in @mikesaintsg/adapters.
 */
export interface EmbeddingAdapterInterface {
	embed(texts: readonly string[], options?: AbortableOptions): Promise<readonly Embedding[]>
	getModelMetadata(): EmbeddingModelMetadata
}

/**
 * Token adapter interface.
 * Counts tokens for context window management. 
 */
export interface TokenAdapterInterface {
	countTokens(text: string): number
	countMessages(messages: readonly unknown[]): number
	getContextWindow(): number
	fitsInContext(tokens: number): boolean
}

/**
 * Budget adapter interface. 
 * Manages token budgets for context building.
 */
export interface BudgetAdapterInterface {
	getState(): TokenBudgetState
	reserve(tokens: number): boolean
	release(tokens: number): void
	consume(tokens: number): void
	reset(): void
	onBudgetChange(callback: (state: TokenBudgetState) => void): Unsubscribe
}

/**
 * Abort adapter interface.
 * Coordinates cancellation across operations.
 */
export interface AbortAdapterInterface {
	createSignal(): AbortSignal
	abort(reason?: string): void
	isAborted(): boolean
	onAbort(callback: (reason:  string) => void): Unsubscribe
}

/**
 * Tool format adapter interface.
 * Converts between internal and provider-specific tool formats. 
 */
export interface ToolFormatAdapterInterface {
	formatSchemas(schemas: readonly ToolSchema[]): unknown
	parseToolCalls(response: unknown): readonly ToolCall[]
	formatResult(result: ToolResult): unknown
}

/**
 * Similarity adapter interface. 
 * Computes similarity between embedding vectors.
 */
export interface SimilarityAdapterInterface {
	compute(a: Embedding, b: Embedding): number
	readonly name: string
}

/**
 * Reranker adapter interface.
 * Reranks search results using a cross-encoder or similar. 
 */
export interface RerankerAdapterInterface {
	rerank(query: string, docs: readonly ScoredResult[]): Promise<readonly ScoredResult[]>
	getModelId(): string
}

// ============================================================================
// Policy Adapter Interfaces
// ============================================================================

/**
 * Retry adapter interface.
 * Determines retry behavior for failed operations.
 * Systems use this to decide when and how to retry.
 */
export interface RetryAdapterInterface {
	/** Determine if an error should trigger a retry */
	shouldRetry(error: unknown, attempt: number): boolean
	/** Get delay before next retry attempt (ms) */
	getDelay(attempt: number): number
	/** Maximum number of retry attempts */
	getMaxAttempts(): number
	/** Optional callback before each retry */
	onRetry?(error: unknown, attempt: number, delayMs: number): void
}

/**
 * Rate limit adapter interface.
 * Controls request rate to external services.
 * Systems acquire/release slots to coordinate requests.
 */
export interface RateLimitAdapterInterface {
	/** Acquire a request slot, waits if none available */
	acquire(): Promise<void>
	/** Release a request slot */
	release(): void
	/** Get current rate limit state */
	getState(): RateLimitState
	/** Dynamically adjust rate limit (e.g., from Retry-After header) */
	setLimit(requestsPerMinute: number): void
}

/** Rate limit state */
export interface RateLimitState {
	readonly activeRequests: number
	readonly maxConcurrent: number
	readonly requestsInWindow: number
	readonly requestsPerMinute: number
	readonly windowResetIn: number
}

// ============================================================================
// Enhancement Adapter Interfaces
// ============================================================================

/**
 * Embedding cache adapter interface.
 * Provides caching for embedding operations.
 * Systems check cache before calling embedding adapter.
 */
export interface EmbeddingCacheAdapterInterface {
	/** Get cached embedding for text */
	get(text: string): Embedding | undefined
	/** Store embedding in cache */
	set(text: string, embedding: Embedding): void
	/** Check if text is cached */
	has(text: string): boolean
	/** Clear all cached embeddings */
	clear(): void
	/** Optional: Get cache statistics */
	getStats?(): CacheStats
}

/** Cache statistics */
export interface CacheStats {
	readonly hits: number
	readonly misses: number
	readonly size: number
	readonly maxSize?: number
}

/**
 * Batch adapter interface.
 * Controls batching behavior for bulk operations.
 * Systems use this to determine batch sizes and delays.
 */
export interface BatchAdapterInterface {
	/** Maximum items per batch */
	getBatchSize(): number
	/** Delay between batches (ms) */
	getDelayMs(): number
	/** Whether to deduplicate items within a batch */
	shouldDeduplicate(): boolean
}

// ============================================================================
// Persistence Adapter Interfaces
// ============================================================================

/** Stored document for vector persistence */
export interface StoredDocument {
	readonly id: string
	readonly content:  string
	readonly embedding: Embedding
	readonly metadata?:  Readonly<Record<string, unknown>>
	readonly contentHash?:  ContentHash
	readonly createdAt?:  number
	readonly updatedAt?: number
}

/** VectorStore metadata for persistence */
export interface VectorStoreMetadata {
	readonly dimensions: number
	readonly model: string
	readonly provider: string
	readonly documentCount: number
	readonly createdAt: number
	readonly updatedAt: number
}

/**
 * Vector persistence adapter interface.
 * Storage backend for vector store. 
 */
export interface VectorPersistenceAdapterInterface {
	load(): Promise<readonly StoredDocument[]>
	loadMetadata(): Promise<VectorStoreMetadata | undefined>
	save(docs: StoredDocument | readonly StoredDocument[]): Promise<void>
	saveMetadata(metadata: VectorStoreMetadata): Promise<void>
	remove(ids: string | readonly string[]): Promise<void>
	clear(): Promise<void>
	isAvailable(): Promise<boolean>
}

/** Serialized message for session persistence */
export interface SerializedMessage {
	readonly role: 'user' | 'assistant' | 'system' | 'tool'
	readonly content:  string
	readonly toolCalls?: readonly ToolCall[]
	readonly toolResult?: ToolResult
}

/** Serialized session for storage */
export interface SerializedSession {
	readonly id: string
	readonly messages:  readonly SerializedMessage[]
	readonly system?:  string
	readonly createdAt: number
	readonly updatedAt: number
}

/** Session summary for listing */
export interface SessionSummary {
	readonly id: string
	readonly messageCount: number
	readonly createdAt: number
	readonly updatedAt: number
}

/**
 * Session persistence adapter interface. 
 * Storage backend for inference sessions.
 */
export interface SessionPersistenceAdapterInterface {
	save(session: SerializedSession): Promise<void>
	load(id: string): Promise<SerializedSession | undefined>
	remove(id: string): Promise<void>
	all(): Promise<readonly SessionSummary[]>
	clear(): Promise<void>
}

// ============================================================================
// Minimal Bridge Interfaces
// ============================================================================

/**
 * Minimal tool registry interface for bridge functions.
 * Avoids hard dependency on contextprotocol package. 
 */
export interface ToolRegistryMinimal {
	has(name: string): boolean
	execute(name: string, args:  Readonly<Record<string, unknown>>): Promise<unknown>
}

/**
 * Minimal vectorstore interface for bridge functions. 
 * Avoids hard dependency on vectorstore package.
 */
export interface VectorStoreMinimal {
	search(
		query: string,
		options?: { readonly limit?: number; readonly threshold?: number }
	): Promise<readonly ScoredResult[]>
}

/**
 * Minimal database access interface for cross-package adapters.
 */
export interface MinimalDatabaseAccess<T = unknown> {
	store<S extends T>(name: string): MinimalStoreAccess<S>
}

/**
 * Minimal store access interface for cross-package adapters. 
 */
export interface MinimalStoreAccess<T> {
	get(key: IDBValidKey): Promise<T | undefined>
	set(value: T, key?:  IDBValidKey): Promise<IDBValidKey>
	remove(key:  IDBValidKey): Promise<void>
	all(): Promise<readonly T[]>
	clear(): Promise<void>
}

/**
 * Minimal directory access interface for OPFS adapters.
 */
export interface MinimalDirectoryAccess {
	getFile(name: string): Promise<MinimalFileAccess | undefined>
	createFile(name: string): Promise<MinimalFileAccess>
	removeFile(name:  string): Promise<void>
	listFiles(): Promise<readonly MinimalFileAccess[]>
}

/**
 * Minimal file access interface for OPFS adapters.
 */
export interface MinimalFileAccess {
	getName(): string
	getText(): Promise<string>
	getArrayBuffer(): Promise<ArrayBuffer>
	write(data: string | ArrayBuffer): Promise<void>
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Generic error data interface for package-specific errors.
 */
export interface PackageErrorData<TCode extends string> {
	readonly code: TCode
	readonly cause?:  Error
}

/** Base ecosystem error */
export abstract class EcosystemError extends Error {
	abstract readonly code: string
	override readonly cause:  Error | undefined
}

/** Type guard for ecosystem errors */
export function isEcosystemError(error: unknown): error is EcosystemError {
	return error instanceof EcosystemError
}

// ============================================================================
// Provider Types (Shared with inference)
// ============================================================================

/** Provider capabilities information */
export interface ProviderCapabilities {
	readonly supportsTools: boolean
	readonly supportsStreaming: boolean
	readonly supportsVision: boolean
	readonly supportsFunctions: boolean
	readonly models: readonly string[]
}

/** Generation defaults for provider adapters */
export interface GenerationDefaults {
	readonly model?:  string
	readonly temperature?: number
	readonly maxTokens?: number
	readonly topP?: number
	readonly stop?: readonly string[]
}
```

---

## 2. @mikesaintsg/adapters

````markdown name=guides/adapters.md
# @mikesaintsg/adapters — Adapter Implementations

## Purpose

Centralized package containing all adapter implementations for the ecosystem. Adapters are swappable components that implement interfaces defined in `@mikesaintsg/core`.

## Design Principles

1. **Single responsibility** — Each adapter does one thing well
2. **Self-contained** — Adapters work independently, not as wrappers
3. **Provider isolation** — Provider-specific code stays in adapters
4. **Zero magic** — Explicit configuration, no string-based lookups
5. **Peer composition** — Systems coordinate adapters as peers

## Adapter Categories

| Category | Purpose | Examples |
|----------|---------|----------|
| **Source** | Generate or retrieve data | OpenAI Embedding, Voyage Embedding, Ollama |
| **Provider** | LLM generation | OpenAI, Anthropic, Ollama |
| **Persistence** | Store and load data | InMemory, IndexedDB, OPFS, HTTP |
| **Transform** | Transform data formats | Token, ToolFormat, Similarity |
| **Policy** | Apply policies to operations | Retry, RateLimit |
| **Enhancement** | Add capabilities | Cache, Batch, Reranker |

## Policy Adapters

Policy adapters implement policies that systems apply to operations. They are self-contained adapters that define **how** operations should behave under certain conditions.

### Retry Adapters

```ts
import { 
	createExponentialRetryAdapter,
	createLinearRetryAdapter,
} from '@mikesaintsg/adapters'

// Exponential backoff with jitter
const retry = createExponentialRetryAdapter({
	maxAttempts: 5,
	initialDelayMs: 1000,
	maxDelayMs: 30000,
	backoffMultiplier: 2,
	jitter: true,
	retryableCodes: ['RATE_LIMIT_ERROR', 'NETWORK_ERROR', 'TIMEOUT_ERROR'],
	onRetry: (error, attempt, delayMs) => {
		console.log(`Retry ${attempt} after ${delayMs}ms`)
	},
})

// Linear backoff
const linearRetry = createLinearRetryAdapter({
	maxAttempts: 3,
	delayMs: 2000,
})

```

### Rate Limit Adapters

```ts
import {
	createTokenBucketRateLimitAdapter,
	createSlidingWindowRateLimitAdapter,
} from '@mikesaintsg/adapters'

// Token bucket algorithm
const rateLimit = createTokenBucketRateLimitAdapter({
	requestsPerMinute: 60,
	maxConcurrent: 10,
	burstSize: 20,
})

// Sliding window algorithm
const slidingWindow = createSlidingWindowRateLimitAdapter({
	requestsPerMinute: 100,
	windowMs: 60000,
})
```

## Enhancement Adapters

Enhancement adapters add capabilities to systems. They are self-contained and provide specific functionality that systems can optionally use.

### Cache Adapters

```ts
import {
	createLRUCacheAdapter,
	createTTLCacheAdapter,
	createIndexedDBCacheAdapter,
} from '@mikesaintsg/adapters'

// LRU (Least Recently Used) cache
const cache = createLRUCacheAdapter({
	maxSize: 10000,
	ttlMs: 3600000, // 1 hour
})

// TTL-only cache (no size limit)
const ttlCache = createTTLCacheAdapter({
	ttlMs: 86400000, // 24 hours
})

// Persistent cache using IndexedDB
const persistentCache = createIndexedDBCacheAdapter({
	database: db,
	storeName: 'embedding_cache',
	ttlMs: 7 * 24 * 60 * 60 * 1000, // 7 days
})
```

### Batch Adapters

```ts
import {
	createBatchAdapter,
	createAggressiveBatchAdapter,
} from '@mikesaintsg/adapters'

// Default batching strategy
const batch = createBatchAdapter({
	batchSize: 100,
	delayMs: 50,
	deduplicate: true,
})

// Aggressive batching (larger batches, longer delays)
const aggressiveBatch = createAggressiveBatchAdapter({
	batchSize: 500,
	delayMs: 200,
	deduplicate: true,
})
```

### Reranker Adapters

```ts
import {
	createCohereRerankerAdapter,
	createCrossEncoderRerankerAdapter,
} from '@mikesaintsg/adapters'

// Cohere reranker
const reranker = createCohereRerankerAdapter({
	apiKey: process.env.COHERE_API_KEY,
	model: 'rerank-english-v3.0',
})

// Local cross-encoder reranker
const localReranker = createCrossEncoderRerankerAdapter({
	model: 'cross-encoder/ms-marco-MiniLM-L-6-v2',
})
```

## Source Adapters (Provider and Embedding)

### OpenAI Provider

```ts
import { createOpenAIProviderAdapter } from '@mikesaintsg/adapters'

const provider = createOpenAIProviderAdapter({
	apiKey: process.env.OPENAI_API_KEY,
	model: 'gpt-4o',
	baseURL: 'https://api.openai.com/v1', // optional
})
```

### Anthropic Provider

```ts
import { createAnthropicProviderAdapter } from '@mikesaintsg/adapters'

const provider = createAnthropicProviderAdapter({
	apiKey: process.env. ANTHROPIC_API_KEY,
	model: 'claude-3-5-sonnet-20241022',
})
```

### Ollama Provider (Local Development)

```ts
import { createOllamaProviderAdapter } from '@mikesaintsg/adapters'

const provider = createOllamaProviderAdapter({
	baseURL: 'http://localhost:11434',
	model:  'llama3',
})
```

## Embedding Adapters

### OpenAI Embeddings

```ts
import { createOpenAIEmbeddingAdapter } from '@mikesaintsg/adapters'

const embedding = createOpenAIEmbeddingAdapter({
	apiKey: process.env. OPENAI_API_KEY,
	model: 'text-embedding-3-small',
	dimensions: 1536, // optional dimension reduction
})
```

### Voyage Embeddings (Anthropic Partner)

```ts
import { createVoyageEmbeddingAdapter } from '@mikesaintsg/adapters'

const embedding = createVoyageEmbeddingAdapter({
	apiKey: process.env. VOYAGE_API_KEY,
	model: 'voyage-3',
	inputType: 'document', // or 'query'
})
```

## Session Persistence Adapters

### IndexedDB Session Persistence

```ts
import { createIndexedDBSessionPersistenceAdapter } from '@mikesaintsg/adapters'

const session = createIndexedDBSessionPersistenceAdapter({
	databaseName: 'my-app-sessions',
	storeName: 'sessions',
	ttlMs: 7 * 24 * 60 * 60 * 1000, // 7 days
})
```

## Vector Persistence Adapters


### IndexedDB

```ts
import { createIndexedDBVectorPersistenceAdapter } from '@mikesaintsg/adapters'

const persistence = createIndexedDBVectorPersistenceAdapter({
	database:  db,
	documentsStore: 'vectors',
	metadataStore: 'vector_metadata',
})
```

### OPFS

```ts
import { createOPFSVectorPersistenceAdapter } from '@mikesaintsg/adapters'

const persistence = createOPFSVectorPersistenceAdapter({
	directory: dir, // MinimalDirectoryAccess
	chunkSize: 1024 * 1024, // 1MB chunks
})
```

## Tool Format Adapters

### OpenAI Format

```ts
import { createOpenAIToolFormatAdapter } from '@mikesaintsg/adapters'

const toolFormat = createOpenAIToolFormatAdapter({
	toolChoice: 'auto', // 'auto' | 'none' | 'required' | { name }
})
```

### Anthropic Format

```ts
import { createAnthropicToolFormatAdapter } from '@mikesaintsg/adapters'

const toolFormat = createAnthropicToolFormatAdapter({
	toolChoice: 'auto', // 'auto' | 'any' | { name }
})
```

## Similarity Adapters

```ts
import {
	createCosineSimilarityAdapter,
	createDotSimilarityAdapter,
	createEuclideanSimilarityAdapter,
} from '@mikesaintsg/adapters'

const similarity = createCosineSimilarityAdapter()
```

## Error Mapping

All adapters map provider errors to `AdapterErrorCode`:

```ts
type AdapterErrorCode =
	| 'AUTHENTICATION_ERROR'
	| 'RATE_LIMIT_ERROR'
	| 'QUOTA_EXCEEDED_ERROR'
	| 'NETWORK_ERROR'
	| 'TIMEOUT_ERROR'
	| 'INVALID_REQUEST_ERROR'
	| 'MODEL_NOT_FOUND_ERROR'
	| 'CONTEXT_LENGTH_ERROR'
	| 'CONTENT_FILTER_ERROR'
	| 'SERVICE_ERROR'
	| 'UNKNOWN_ERROR'
```

## API Reference

### Provider Adapters

- `createOpenAIProviderAdapter(options)` → `ProviderAdapterInterface`
- `createAnthropicProviderAdapter(options)` → `ProviderAdapterInterface`
- `createOllamaProviderAdapter(options)` → `ProviderAdapterInterface`

### Embedding Adapters

- `createOpenAIEmbeddingAdapter(options)` → `EmbeddingAdapterInterface`
- `createVoyageEmbeddingAdapter(options)` → `EmbeddingAdapterInterface`
- `createOllamaEmbeddingAdapter(options)` → `EmbeddingAdapterInterface`
- `createNodeLlamaCppEmbeddingAdapter(options)` → `EmbeddingAdapterInterface`
- `createHuggingFaceEmbeddingAdapter(options)` → `EmbeddingAdapterInterface`

### Session Adapters

- `createIndexedDBSessionPersistenceAdapter(options?)` → `SessionPersistenceInterface`

### Vector Persistence Adapters

- `createIndexedDBVectorPersistenceAdapter(options)` → `VectorStorePersistenceAdapterInterface`
- `createOPFSVectorPersistenceAdapter(options)` → `VectorStorePersistenceAdapterInterface`
- `createHTTPVectorPersistenceAdapter(options)` → `VectorStorePersistenceAdapterInterface`

### ActionLoop Persistence Adapters

- `createIndexedDBEventPersistenceAdapter(options)` → `EventStorePersistenceAdapterInterface`
- `createIndexedDBWeightPersistenceAdapter(options)` → `WeightPersistenceAdapterInterface`
- `createInMemoryEventPersistenceAdapter(options?)` → `EventStorePersistenceAdapterInterface`
- `createInMemoryWeightPersistenceAdapter()` → `WeightPersistenceAdapterInterface`

### Tool Format Adapters

- `createOpenAIToolFormatAdapter(options?)` → `ToolFormatAdapterInterface`
- `createAnthropicToolFormatAdapter(options?)` → `ToolFormatAdapterInterface`

### Similarity Adapters

- `createCosineSimilarityAdapter()` → `SimilarityAdapterInterface`
- `createDotSimilarityAdapter()` → `SimilarityAdapterInterface`
- `createEuclideanSimilarityAdapter()` → `SimilarityAdapterInterface`

### Policy Adapters

- `createExponentialRetryAdapter(options?)` → `RetryAdapterInterface`
- `createLinearRetryAdapter(options?)` → `RetryAdapterInterface`
- `createTokenBucketRateLimitAdapter(options?)` → `RateLimitAdapterInterface`
- `createSlidingWindowRateLimitAdapter(options?)` → `RateLimitAdapterInterface`

### Enhancement Adapters

- `createLRUCacheAdapter(options?)` → `EmbeddingCacheAdapterInterface`
- `createTTLCacheAdapter(options?)` → `EmbeddingCacheAdapterInterface`
- `createIndexedDBCacheAdapter(options)` → `EmbeddingCacheAdapterInterface`
- `createBatchAdapter(options?)` → `BatchAdapterInterface`
- `createCohereRerankerAdapter(options)` → `RerankerAdapterInterface`
- `createCrossEncoderRerankerAdapter(options)` → `RerankerAdapterInterface`

### Context Builder Adapters

- `createDeduplicationAdapter(options?)` → `DeduplicationAdapterInterface`
- `createFIFOTruncationAdapter(options?)` → `TruncationAdapterInterface`
- `createLIFOTruncationAdapter(options?)` → `TruncationAdapterInterface`
- `createPriorityTruncationAdapter(options?)` → `TruncationAdapterInterface`
- `createScoreTruncationAdapter(options?)` → `TruncationAdapterInterface`
- `createPriorityAdapter(options?)` → `PriorityAdapterInterface`

### Streaming Adapters

- `createStreamerAdapter()` → `StreamerAdapterInterface`
- `createSSEParserAdapter(options?)` → `SSEParserAdapterInterface`
- `createProviderStreamHandle(options)` → `ProviderStreamHandleInterface`
````

```typescript name=types/adapters/types.ts
/**
 * @mikesaintsg/adapters
 *
 * Type definitions for adapter implementations. 
 * Interfaces come from @mikesaintsg/core. 
 */

import type {
	EmbeddingAdapterInterface,
	TokenAdapterInterface,
	ToolFormatAdapterInterface,
	VectorPersistenceAdapterInterface,
	SessionPersistenceAdapterInterface,
	SimilarityAdapterInterface,
	GenerationDefaults,
	Unsubscribe,
	MinimalDatabaseAccess,
	MinimalDirectoryAccess,
	StoredDocument,
} from '@mikesaintsg/core'

import type { ProviderAdapterInterface } from '@mikesaintsg/inference'

// ============================================================================
// Provider Adapter Options
// ============================================================================

/** OpenAI provider adapter options */
export interface OpenAIProviderAdapterOptions {
	readonly apiKey: string
	readonly model?:  string
	readonly baseURL?: string
	readonly organization?: string
	readonly defaultOptions?: GenerationDefaults
	readonly rateLimiter?: RateLimiterInterface
}

/** Anthropic provider adapter options */
export interface AnthropicProviderAdapterOptions {
	readonly apiKey: string
	readonly model?: string
	readonly baseURL?: string
	readonly defaultOptions?: GenerationDefaults
	readonly rateLimiter?: RateLimiterInterface
}

/** Ollama provider adapter options */
export interface OllamaProviderAdapterOptions {
	readonly baseURL?:  string
	readonly model:  string
	readonly defaultOptions?: GenerationDefaults
	readonly keepAlive?: boolean | string
	readonly timeout?: number
}

// ============================================================================
// Embedding Adapter Options
// ============================================================================

/** OpenAI embedding adapter options */
export interface OpenAIEmbeddingAdapterOptions {
	readonly apiKey: string
	readonly model?: string
	readonly dimensions?:  number
	readonly baseURL?: string
}

/** Voyage embedding adapter options */
export interface VoyageEmbeddingAdapterOptions {
	readonly apiKey: string
	readonly model?:  VoyageEmbeddingModel
	readonly baseURL?: string
	readonly inputType?: 'query' | 'document'
}

/** Voyage embedding model options */
export type VoyageEmbeddingModel =
	| 'voyage-3'
	| 'voyage-3-lite'
	| 'voyage-code-3'
	| 'voyage-finance-2'
	| 'voyage-law-2'
	| 'voyage-multilingual-2'
	| (string & {})

/** Ollama embedding adapter options */
export interface OllamaEmbeddingAdapterOptions {
	readonly baseURL?: string
	readonly model: string
	readonly timeout?: number
}

// ============================================================================
// Token Adapter Options
// ============================================================================

/** Estimator token adapter options */
export interface EstimatorTokenAdapterOptions {
	readonly charsPerToken?:  number
	readonly contextWindow?: number
}

/** Model token adapter options */
export interface ModelTokenAdapterOptions {
	readonly model: string
	readonly multipliers?:  Readonly<Record<string, number>>
	readonly contextWindows?: Readonly<Record<string, number>>
}

// ============================================================================
// Session Persistence Options
// ============================================================================

/** IndexedDB session persistence options */
export interface IndexedDBSessionAdapterOptions {
	readonly database: MinimalDatabaseAccess
	readonly storeName?:  string
	readonly ttlMs?: number
}

// ============================================================================
// Vector Persistence Options
// ============================================================================

/** IndexedDB vector persistence options */
export interface IndexedDBVectorPersistenceOptions {
	readonly database:  MinimalDatabaseAccess<StoredDocument>
	readonly documentsStore?:  string
	readonly metadataStore?: string
}

/** OPFS vector persistence options */
export interface OPFSVectorPersistenceOptions {
	readonly directory: MinimalDirectoryAccess
	readonly chunkSize?: number
}

/** HTTP vector persistence options */
export interface HTTPVectorPersistenceOptions {
	readonly baseURL:  string
	readonly headers?:  Readonly<Record<string, string>>
	readonly timeout?: number
}

// ============================================================================
// Tool Format Adapter Options
// ============================================================================

/** OpenAI tool choice type */
export type OpenAIToolChoice =
	| 'auto'
	| 'none'
	| 'required'
	| { readonly type: 'function'; readonly function: { readonly name: string } }

/** OpenAI tool format adapter options */
export interface OpenAIToolFormatAdapterOptions {
	readonly toolChoice?:  OpenAIToolChoice
}

/** Anthropic tool choice type */
export type AnthropicToolChoice =
	| 'auto'
	| 'any'
	| { readonly type: 'tool'; readonly name: string }

/** Anthropic tool format adapter options */
export interface AnthropicToolFormatAdapterOptions {
	readonly toolChoice?: AnthropicToolChoice
}

// ============================================================================
// Rate Limiting
// ============================================================================

/** Rate limiter interface */
export interface RateLimiterInterface {
	acquire(): Promise<void>
	release(): void
	getState(): RateLimiterState
	setLimit(requestsPerMinute:  number): void
}

/** Rate limiter state */
export interface RateLimiterState {
	readonly activeRequests: number
	readonly maxConcurrent: number
	readonly requestsInWindow: number
	readonly requestsPerMinute: number
	readonly windowResetIn: number
}

/** Rate limiter options */
export interface RateLimiterOptions {
	readonly requestsPerMinute?:  number
	readonly maxConcurrent?: number
	readonly windowMs?: number
}

// ============================================================================
// Retry Options
// ============================================================================

/** Retry options for adapter operations */
export interface RetryOptions {
	readonly maxRetries?:  number
	readonly initialDelayMs?: number
	readonly maxDelayMs?: number
	readonly backoffMultiplier?: number
	readonly jitter?: boolean
	readonly retryableCodes?: readonly AdapterErrorCode[]
	readonly shouldRetry?: (error: unknown, attempt: number) => boolean
	readonly onRetry?:  (error: unknown, attempt: number, delayMs: number) => void
}

// ============================================================================
// Cache Options
// ============================================================================

/** Cached embedding entry */
export interface CachedEmbedding {
	readonly embedding: Float32Array
	readonly cachedAt: number
}

/** Cache adapter options */
export interface CacheAdapterOptions {
	readonly cache?: Map<string, CachedEmbedding>
	readonly ttlMs?: number
	readonly maxEntries?: number
}

// ============================================================================
// Batch Options
// ============================================================================

/** Batch adapter options */
export interface BatchAdapterOptions {
	readonly batchSize?: number
	readonly delayMs?: number
	readonly deduplicate?: boolean
}

// ============================================================================
// SSE Parsing
// ============================================================================

/** SSE event from parsing */
export interface SSEEvent {
	readonly event?:  string
	readonly data:  string
	readonly id?: string
	readonly retry?: number
}

/** SSE parser options */
export interface SSEParserOptions {
	readonly onEvent:  (event: SSEEvent) => void
	readonly onError?:  (error: Error) => void
	readonly onEnd?: () => void
}

/** SSE parser interface */
export interface SSEParserInterface {
	feed(chunk: string): void
	end(): void
	reset(): void
}

// ============================================================================
// Error Types
// ============================================================================

/** Adapter error codes */
export type AdapterErrorCode =
	| 'AUTHENTICATION_ERROR'
	| 'RATE_LIMIT_ERROR'
	| 'QUOTA_EXCEEDED_ERROR'
	| 'NETWORK_ERROR'
	| 'TIMEOUT_ERROR'
	| 'INVALID_REQUEST_ERROR'
	| 'MODEL_NOT_FOUND_ERROR'
	| 'CONTEXT_LENGTH_ERROR'
	| 'CONTENT_FILTER_ERROR'
	| 'SERVICE_ERROR'
	| 'UNKNOWN_ERROR'

/** Adapter error data */
export interface AdapterErrorData {
	readonly code: AdapterErrorCode
	readonly providerCode?: string
	readonly retryAfter?: number
	readonly context?:  Readonly<Record<string, unknown>>
}

// ============================================================================
// Model Multipliers
// ============================================================================

/** Default model multipliers (chars per token) */
export const DEFAULT_MODEL_MULTIPLIERS: Readonly<Record<string, number>> = {
	'gpt-4': 4,
	'gpt-4o': 4,
	'gpt-4o-mini':  4,
	'gpt-3.5-turbo': 4,
	'claude-3-5-sonnet-20241022': 3. 5,
	'claude-3-opus-20240229': 3.5,
	'claude-3-sonnet-20240229': 3.5,
	'claude-3-haiku-20240307': 3.5,
	'llama2': 4,
	'llama3': 4,
	'mistral':  4,
}

/** Default context window sizes */
export const DEFAULT_CONTEXT_WINDOWS: Readonly<Record<string, number>> = {
	'gpt-4o': 128000,
	'gpt-4o-mini': 128000,
	'gpt-4-turbo': 128000,
	'gpt-4':  8192,
	'gpt-3.5-turbo': 16385,
	'claude-3-5-sonnet-20241022': 200000,
	'claude-3-opus-20240229':  200000,
	'claude-3-sonnet-20240229': 200000,
	'claude-3-haiku-20240307': 200000,
	'llama2': 4096,
	'llama3': 8192,
	'mistral': 32768,
}

// ============================================================================
// Factory Function Types
// ============================================================================

/** Factory for OpenAI provider adapter */
export type CreateOpenAIProviderAdapter = (
	options: OpenAIProviderAdapterOptions
) => ProviderAdapterInterface

/** Factory for Anthropic provider adapter */
export type CreateAnthropicProviderAdapter = (
	options: AnthropicProviderAdapterOptions
) => ProviderAdapterInterface

/** Factory for Ollama provider adapter */
export type CreateOllamaProviderAdapter = (
	options: OllamaProviderAdapterOptions
) => ProviderAdapterInterface

/** Factory for OpenAI embedding adapter */
export type CreateOpenAIEmbeddingAdapter = (
	options: OpenAIEmbeddingAdapterOptions
) => EmbeddingAdapterInterface

/** Factory for Voyage embedding adapter */
export type CreateVoyageEmbeddingAdapter = (
	options:  VoyageEmbeddingAdapterOptions
) => EmbeddingAdapterInterface

/** Factory for Ollama embedding adapter */
export type CreateOllamaEmbeddingAdapter = (
	options: OllamaEmbeddingAdapterOptions
) => EmbeddingAdapterInterface

/** Factory for estimator token adapter */
export type CreateEstimatorTokenAdapter = (
	options?: EstimatorTokenAdapterOptions
) => TokenAdapterInterface

/** Factory for model token adapter */
export type CreateModelTokenAdapter = (
	options: ModelTokenAdapterOptions
) => TokenAdapterInterface

/** Factory for in-memory session adapter */
export type CreateInMemorySessionAdapter = () => SessionPersistenceAdapterInterface

/** Factory for IndexedDB session adapter */
export type CreateIndexedDBSessionAdapter = (
	options:  IndexedDBSessionAdapterOptions
) => SessionPersistenceAdapterInterface

/** Factory for in-memory vector persistence adapter */
export type CreateInMemoryVectorPersistenceAdapter = () => VectorPersistenceAdapterInterface

/** Factory for IndexedDB vector persistence adapter */
export type CreateIndexedDBVectorPersistenceAdapter = (
	options: IndexedDBVectorPersistenceOptions
) => VectorPersistenceAdapterInterface

/** Factory for OPFS vector persistence adapter */
export type CreateOPFSVectorPersistenceAdapter = (
	options:  OPFSVectorPersistenceOptions
) => VectorPersistenceAdapterInterface

/** Factory for HTTP vector persistence adapter */
export type CreateHTTPVectorPersistenceAdapter = (
	options: HTTPVectorPersistenceOptions
) => VectorPersistenceAdapterInterface

/** Factory for OpenAI tool format adapter */
export type CreateOpenAIToolFormatAdapter = (
	options?: OpenAIToolFormatAdapterOptions
) => ToolFormatAdapterInterface

/** Factory for Anthropic tool format adapter */
export type CreateAnthropicToolFormatAdapter = (
	options?: AnthropicToolFormatAdapterOptions
) => ToolFormatAdapterInterface

/** Factory for cosine similarity adapter */
export type CreateCosineSimilarityAdapter = () => SimilarityAdapterInterface

/** Factory for dot similarity adapter */
export type CreateDotSimilarityAdapter = () => SimilarityAdapterInterface

/** Factory for euclidean similarity adapter */
export type CreateEuclideanSimilarityAdapter = () => SimilarityAdapterInterface

/** Factory for rate limiter */
export type CreateRateLimiter = (options?: RateLimiterOptions) => RateLimiterInterface

/** Factory for SSE parser */
export type CreateSSEParser = (options: SSEParserOptions) => SSEParserInterface

/** Factory for retry wrapper (generic) */
export type CreateRetryAdapter = <T>(adapter: T, options:  RetryOptions) => T

/** Factory for cache wrapper (embedding only) */
export type CreateCacheAdapter = (
	adapter: EmbeddingAdapterInterface,
	options?:  CacheAdapterOptions
) => EmbeddingAdapterInterface

/** Factory for batch wrapper (embedding only) */
export type CreateBatchAdapter = (
	adapter: EmbeddingAdapterInterface,
	options?:  BatchAdapterOptions
) => EmbeddingAdapterInterface
```

---

## 3. @mikesaintsg/inference

````markdown name=guides/inference.md
# @mikesaintsg/inference — LLM Generation Engine

## Purpose

The inference package provides the engine for LLM text generation. It orchestrates provider adapters and manages sessions, streaming, and request lifecycle.

## Design Principles

1. **Provider first** — Provider adapter is required and first parameter
2. **Adapter composition** — All other concerns are optional adapters
3. **Session or ephemeral** — Choose stateful or stateless generation
4. **Streaming native** — All generation returns StreamHandle

## Package Boundaries

### What Inference Does

- Orchestrates provider adapters for generation
- Manages session state and message history
- Handles streaming token delivery
- Provides request deduplication
- Coordinates abort signals

### What Inference Does NOT Do

- Context assembly (use contextbuilder)
- Tool execution (use contextprotocol)
- Vector search (use vectorstore)
- Persistence (use adapters)

## Quick Start

### Minimal Setup

```ts
import { createEngine } from '@mikesaintsg/inference'
import { createOpenAIProviderAdapter } from '@mikesaintsg/adapters'

const engine = createEngine(
	createOpenAIProviderAdapter({ apiKey: process.env.OPENAI_API_KEY })
)

const result = await engine.generate([
	{ role: 'user', content: 'Hello!' }
])

console.log(result.text)
```

### Full Setup with Adapters

```ts
import { createEngine } from '@mikesaintsg/inference'
import {
	createOpenAIProviderAdapter,
	createIndexedDBSessionAdapter,
	createModelTokenAdapter,
	createExponentialRetryAdapter,
} from '@mikesaintsg/adapters'

// MINIMAL: Just the required provider
const simpleEngine = createEngine(
	createOpenAIProviderAdapter({ apiKey, model: 'gpt-4o' })
)

// WITH SESSION PERSISTENCE: Opt-in to session storage
const persistedEngine = createEngine(
	createOpenAIProviderAdapter({ apiKey, model: 'gpt-4o' }),
	{
		session: createIndexedDBSessionAdapter({ database: db }),
	}
)

// PRODUCTION: Opt-in to multiple capabilities
const productionEngine = createEngine(
	createOpenAIProviderAdapter({ apiKey, model: 'gpt-4o' }),
	{
		// Persistence (opt-in)
		session: createIndexedDBSessionAdapter({ database: db }),
		// Transform (opt-in)
		token: createModelTokenAdapter({ model: 'gpt-4o' }),
		// Policy (opt-in)
		retry: createExponentialRetryAdapter({ maxAttempts: 3 }),
		// Configuration
		deduplication: { enabled: true, windowMs: 1000 },
	}
)
```

## Engine API

### Creating the Engine

```ts
const engine = createEngine(provider, options?)
```

**Parameters:**

1. `provider: ProviderAdapterInterface` — **Required**. The LLM provider.
2. `options?: EngineOptions` — Optional adapters and configuration.

### Engine Options

```ts
interface EngineOptions extends SubscriptionToHook<EngineSubscriptions> {
	// Persistence (opt-in)
	readonly session?: SessionPersistenceAdapterInterface
	
	// Transform (opt-in)
	readonly token?: TokenAdapterInterface
	
	// Policy (opt-in)
	readonly retry?: RetryAdapterInterface
	readonly rateLimit?: RateLimitAdapterInterface
	
	// Configuration
	readonly deduplication?: DeduplicationOptions
}
```

### Ephemeral Generation

```ts
// Promise-based
const result = await engine.generate(messages, options?)

// Streaming
const stream = engine.stream(messages, options?)
for await (const token of stream) {
	process.stdout.write(token)
}
const result = await stream.result()
```

### Session-Based Generation

```ts
const session = engine.createSession({
	system: 'You are a helpful assistant.',
})

session.addMessage('user', 'Hello!')

const stream = session.stream()
for await (const token of stream) {
	process.stdout.write(token)
}

// Messages are automatically added to history
console.log(session.getHistory())
```

### Context-Aware Generation

```ts
import { createContextBuilder } from '@mikesaintsg/contextbuilder'

const builder = createContextBuilder(tokenAdapter, { budget: { maxTokens: 8000 } })
builder.addFrame({ type: 'system', content: 'You are helpful. ', priority: 'critical' })
builder.addFrame({ type:  'document', content: docContent, priority: 'normal' })

const context = builder.build()
const result = await engine.generateFromContext(context)
```

## Session API

### Creating Sessions

```ts
const session = engine.createSession({
	id: 'custom-id',           // optional, auto-generated if omitted
	system:  'System prompt',   // optional
	tokenBudget: {             // optional
		model: 'gpt-4o',
		warningThreshold: 0.8,
		autoTruncate: true,
	},
})
```

### Message Management

```ts
// Add messages
session.addMessage('user', 'Hello')
session.addMessage('assistant', 'Hi there!')

// Add tool results
session.addToolResult(callId, 'search', { results: [... ] })

// Get history
const messages = session.getHistory()

// Truncate old messages
session.truncateHistory(10) // Keep last 10

// Clear all
session.clear()
```

### Session Events

```ts
const cleanup = session.onMessageAdded((message) => {
	console.log('New message:', message.role)
})

// Later
cleanup()
```

## StreamHandle API

```ts
const stream = session.stream()

// Async iteration
for await (const token of stream) {
	process.stdout.write(token)
}

// Or event-based
stream.onToken((token) => process.stdout.write(token))
stream.onComplete((result) => console.log('Done:', result.finishReason))
stream.onError((error) => console.error(error))

// Get final result
const result = await stream.result()

// Abort if needed
stream.abort()
```

## Token Counting

```ts
// Count tokens
const count = engine.countTokens('Hello world', 'gpt-4o')

// Count messages
const messageCount = engine.countMessages(messages, 'gpt-4o')

// Check fit
const fits = engine.fitsInContext('Long content... ', 'gpt-4o')

// Get context window
const window = engine.getContextWindowSize('gpt-4o') // 128000
```

## Request Deduplication

```ts
const engine = createEngine(provider, {
	deduplication: {
		enabled: true,
		windowMs: 1000, // Dedupe identical requests within 1s
	},
})

// Check stats
const stats = engine.getDeduplicationStats()
console.log(stats.savings) // Percentage saved
```

## Tool Calling

```ts
const result = await session.generate({
	tools: [
		{
			name: 'search',
			description:  'Search documents',
			parameters:  { type: 'object', properties: { query: { type: 'string' } } },
		},
	],
})

if (result.toolCalls.length > 0) {
	for (const call of result.toolCalls) {
		const toolResult = await executeToolSomehow(call)
		session.addToolResult(call.id, call.name, toolResult)
	}
	
	// Continue generation
	const continuation = await session.generate()
}
```

## Error Handling

```ts
import { isInferenceError, InferenceErrorCode } from '@mikesaintsg/inference'

try {
	await engine.generate(messages)
} catch (error) {
	if (isInferenceError(error)) {
		switch (error.code) {
			case 'RATE_LIMIT': 
				// Wait and retry
				break
			case 'CONTEXT_LENGTH_EXCEEDED':
				// Truncate context
				break
			case 'ABORTED':
				// User cancelled
				break
		}
	}
}
```

## API Reference

### Factory Functions

- `createEngine(provider, options?)` → `EngineInterface`
- `createTokenBatcher(options?)` → `TokenBatcherInterface`
- `createTimeoutMonitor(options)` → `TimeoutMonitorInterface`
- `createAbortScope()` → `AbortScopeInterface`

### EngineInterface

- `createSession(options?)` → `SessionInterface`
- `generate(messages, options?)` → `Promise<GenerationResult>`
- `stream(messages, options?)` → `StreamHandleInterface`
- `generateFromContext(context, options?)` → `Promise<GenerationResult>`
- `streamFromContext(context, options?)` → `StreamHandleInterface`
- `countTokens(text, model)` → `number`
- `countMessages(messages, model)` → `number`
- `fitsInContext(content, model, max?)` → `boolean`
- `getContextWindowSize(model)` → `number | undefined`
- `abort(requestId)` → `void`
- `getDeduplicationStats()` → `DeduplicationStats`

### SessionInterface

- `getId()` → `string`
- `getSystem()` → `string | undefined`
- `getHistory()` → `readonly Message[]`
- `addMessage(role, content)` → `Message`
- `addToolResult(callId, name, result)` → `Message`
- `removeMessage(id)` → `boolean`
- `clear()` → `void`
- `truncateHistory(count)` → `void`
- `generate(options?)` → `Promise<GenerationResult>`
- `stream(options?)` → `StreamHandleInterface`

### StreamHandleInterface

- `readonly requestId: string`
- `[Symbol.asyncIterator]()` → `AsyncIterator<string>`
- `result()` → `Promise<GenerationResult>`
- `abort()` → `void`
- `onToken(callback)` → `Unsubscribe`
- `onComplete(callback)` → `Unsubscribe`
- `onError(callback)` → `Unsubscribe`
````

```typescript name=types/inference/types.ts
/**
 * @mikesaintsg/inference
 *
 * Type definitions for the inference engine.
 */

import type {
	Unsubscribe,
	SubscriptionToHook,
	AbortableOptions,
	ToolCall,
	ToolSchema,
	PackageErrorData,
	BuiltContext,
	ProviderCapabilities,
	TokenAdapterInterface,
	SessionPersistenceAdapterInterface,
} from '@mikesaintsg/core'

// ============================================================================
// Message Types
// ============================================================================

/** Message role */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool'

/** Message content types */
export type MessageContent = string | ToolCallContent | ToolResultContent

/** Tool call content */
export interface ToolCallContent {
	readonly type: 'tool_calls'
	readonly toolCalls: readonly ToolCall[]
}

/** Tool result content */
export interface ToolResultContent {
	readonly type:  'tool_result'
	readonly callId: string
	readonly name: string
	readonly result: unknown
}

/** Message metadata */
export interface MessageMetadata {
	readonly model?:  string
	readonly tokenCount?: number
	readonly finishReason?: FinishReason
}

/** Message object */
export interface Message {
	readonly id: string
	readonly role: MessageRole
	readonly content: MessageContent
	readonly createdAt: number
	readonly metadata?:  MessageMetadata
}

// ============================================================================
// Generation Types
// ============================================================================

/** Generation finish reason */
export type FinishReason = 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'error'

/** Generation result */
export interface GenerationResult {
	readonly text: string
	readonly toolCalls:  readonly ToolCall[]
	readonly finishReason:  FinishReason
	readonly usage?:  UsageStats
	readonly aborted: boolean
}

/** Token usage statistics */
export interface UsageStats {
	readonly promptTokens: number
	readonly completionTokens: number
	readonly totalTokens:  number
}

/** Generation options */
export interface GenerationOptions extends AbortableOptions {
	readonly model?:  string
	readonly temperature?: number
	readonly maxTokens?: number
	readonly topP?:  number
	readonly tools?: readonly ToolSchema[]
	readonly toolChoice?: 'auto' | 'none' | 'required' | { readonly name: string }
	readonly stop?: readonly string[]
	readonly timeout?: TimeoutOptions
}

/** Timeout options */
export interface TimeoutOptions {
	readonly tokenTimeoutMs?: number
	readonly totalTimeoutMs?: number
}

// ============================================================================
// Subscription Interfaces
// ============================================================================

/** Engine subscription methods */
export interface EngineSubscriptions {
	onRequest(callback: (requestId: string, messages:  readonly Message[]) => void): Unsubscribe
	onResponse(callback: (requestId: string, result: GenerationResult) => void): Unsubscribe
	onError(callback:  (requestId: string, error: Error) => void): Unsubscribe
}

/** Session subscription methods */
export interface SessionSubscriptions {
	onMessageAdded(callback:  (message: Message) => void): Unsubscribe
	onMessageRemoved(callback:  (id: string) => void): Unsubscribe
}

// ============================================================================
// Options Interfaces
// ============================================================================

/** Request deduplication options */
export interface DeduplicationOptions {
	readonly enabled?:  boolean
	readonly windowMs?: number
	readonly hashFn?: (messages: readonly Message[], options: GenerationOptions) => string
}

/** Deduplication statistics */
export interface DeduplicationStats {
	readonly totalRequests: number
	readonly deduplicatedRequests: number
	readonly savings: number
}

/** Engine creation options */
export interface EngineOptions extends SubscriptionToHook<EngineSubscriptions> {
	readonly session?: SessionPersistenceAdapterInterface
	readonly token?: TokenAdapterInterface
	readonly deduplication?: DeduplicationOptions
}

/** Session token budget configuration */
export interface SessionTokenBudget {
	readonly model: string
	readonly warningThreshold?:  number
	readonly autoTruncate?:  boolean
}

/** Session creation options */
export interface SessionOptions extends SubscriptionToHook<SessionSubscriptions> {
	readonly id?: string
	readonly system?: string
	readonly tokenBudget?: SessionTokenBudget
}

// ============================================================================
// Behavioral Interfaces
// ============================================================================

/**
 * Stream handle - async iteration over tokens. 
 */
export interface StreamHandleInterface {
	readonly requestId: string
	[Symbol.asyncIterator](): AsyncIterator<string>
	result(): Promise<GenerationResult>
	abort(): void
	onToken(callback:  (token: string) => void): Unsubscribe
	onComplete(callback:  (result: GenerationResult) => void): Unsubscribe
	onError(callback: (error: Error) => void): Unsubscribe
}

/**
 * Session interface - conversation management.
 */
export interface SessionInterface extends SessionSubscriptions {
	getId(): string
	getSystem(): string | undefined
	getCreatedAt(): number
	getHistory(): readonly Message[]
	addMessage(role: MessageRole, content: MessageContent): Message
	addToolResult(callId: string, name: string, result:  unknown): Message
	removeMessage(id:  string): boolean
	clear(): void
	truncateHistory(count: number): void
	generate(options?:  GenerationOptions): Promise<GenerationResult>
	stream(options?: GenerationOptions): StreamHandleInterface
}

/**
 * Engine interface - main entry point for inference.
 */
export interface EngineInterface extends EngineSubscriptions {
	createSession(options?: SessionOptions): SessionInterface
	generate(messages:  readonly Message[], options?:  GenerationOptions): Promise<GenerationResult>
	stream(messages: readonly Message[], options?: GenerationOptions): StreamHandleInterface
	generateFromContext(context: BuiltContext, options?: GenerationOptions): Promise<GenerationResult>
	streamFromContext(context: BuiltContext, options?: GenerationOptions): StreamHandleInterface
	countTokens(text:  string, model: string): number
	countMessages(messages: readonly Message[], model: string): number
	fitsInContext(content: string, model:  string, max?: number): boolean
	getContextWindowSize(model: string): number | undefined
	abort(requestId: string): void
	getDeduplicationStats(): DeduplicationStats
	destroy(): void
}

/**
 * Provider adapter interface - LLM provider integration. 
 */
export interface ProviderAdapterInterface {
	getId(): string
	generate(messages: readonly Message[], options:  GenerationOptions): StreamHandleInterface
	supportsTools(): boolean
	supportsStreaming(): boolean
	getCapabilities(): ProviderCapabilities
}

// ============================================================================
// Token Batching Types
// ============================================================================

/** Token batch for coalesced emission */
export interface TokenBatch {
	readonly tokens: readonly string[]
	readonly text: string
	readonly isBoundary: boolean
	readonly isFinal: boolean
}

/** Boundary detection mode */
export type TokenBoundaryMode = 'sentence' | 'paragraph' | 'word' | 'never'

/** Token batching options */
export interface TokenBatchOptions {
	readonly batchSize?: number
	readonly flushIntervalMs?: number
	readonly flushOnBoundary?: TokenBoundaryMode
}

/** Token batcher interface */
export interface TokenBatcherInterface {
	push(token: string): void
	flush(): TokenBatch | undefined
	end(): TokenBatch | undefined
	getBufferSize(): number
	onBatch(callback: (batch: TokenBatch) => void): Unsubscribe
}

// ============================================================================
// Abort Scope Types
// ============================================================================

/** Abort scope interface */
export interface AbortScopeInterface {
	createSignal(): AbortSignal
	abortAll(reason?:  string): void
	getActiveCount(): number
	isAborted(): boolean
	onAbort(callback: (reason:  string | undefined) => void): Unsubscribe
}

// ============================================================================
// Error Types
// ============================================================================

/** Inference error codes */
export type InferenceErrorCode =
	| 'RATE_LIMIT'
	| 'CONTEXT_LENGTH_EXCEEDED'
	| 'INVALID_API_KEY'
	| 'PROVIDER_ERROR'
	| 'TIMEOUT'
	| 'ABORTED'
	| 'NETWORK_ERROR'
	| 'UNKNOWN'

/** Inference error data */
export interface InferenceErrorData extends PackageErrorData<InferenceErrorCode> {
	readonly requestId?:  string
}

// ============================================================================
// Factory Function Types
// ============================================================================

/** Factory for engine */
export type CreateEngine = (
	provider: ProviderAdapterInterface,
	options?: EngineOptions
) => EngineInterface

/** Factory for token batcher */
export type CreateTokenBatcher = (options?: TokenBatchOptions) => TokenBatcherInterface

/** Factory for abort scope */
export type CreateAbortScope = () => AbortScopeInterface
```

---

## 4. @mikesaintsg/vectorstore

````markdown name=guides/vectorstore.md
# @mikesaintsg/vectorstore — Vector Storage & Search

## Purpose

Vector storage and similarity search for RAG applications.  Stores document embeddings and provides fast similarity queries.

## Design Principles

1. **Embedding adapter first** — Required for all operations
2. **Persistence optional** — InMemory by default
3. **Model consistency** — Enforces same embedding model across documents
4. **Search flexibility** — Similarity, hybrid, and reranked search

## Package Boundaries

### What VectorStore Does

- Store documents with embeddings
- Similarity search (cosine, dot, euclidean)
- Hybrid search (vector + keyword)
- Metadata filtering
- Persistence to IndexedDB, OPFS, or HTTP
- Reranking with cross-encoders

### What VectorStore Does NOT Do

- Generate embeddings (use embedding adapter)
- Chunking/splitting (do before insertion)
- Context assembly (use contextbuilder)
- LLM generation (use inference)

## Quick Start

### Minimal Setup

```ts
import { createVectorStore } from '@mikesaintsg/vectorstore'
import { createOpenAIEmbeddingAdapter } from '@mikesaintsg/adapters'

const store = await createVectorStore({
	embedding: createOpenAIEmbeddingAdapter({ apiKey: process.env.OPENAI_API_KEY }),
})

await store.upsertDocument({ id: 'doc1', content: 'Hello world' })

const results = await store.similaritySearch('greeting')
console.log(results[0].content) // 'Hello world'
```

### Full Setup with All Adapters

```ts
import { createVectorStore } from '@mikesaintsg/vectorstore'
import {
	// Source adapters
	createOpenAIEmbeddingAdapter,
	// Persistence adapters
	createIndexedDBVectorPersistenceAdapter,
	// Transform adapters
	createCosineSimilarityAdapter,
	// Policy adapters
	createExponentialRetryAdapter,
	createTokenBucketRateLimitAdapter,
	// Enhancement adapters
	createLRUCacheAdapter,
	createBatchAdapter,
	createCohereRerankerAdapter,
} from '@mikesaintsg/adapters'

// MINIMAL: Just the required embedding adapter
const simpleStore = await createVectorStore(
	createOpenAIEmbeddingAdapter({ apiKey, model: 'text-embedding-3-small' })
)

// WITH PERSISTENCE: Opt-in to persistence
const persistedStore = await createVectorStore(
	createOpenAIEmbeddingAdapter({ apiKey, model: 'text-embedding-3-small' }),
	{
		persistence: createIndexedDBVectorPersistenceAdapter({
			database: db,
			documentsStore: 'vectors',
		}),
	}
)

// PRODUCTION: Opt-in to all capabilities
const productionStore = await createVectorStore(
	createOpenAIEmbeddingAdapter({ apiKey, model: 'text-embedding-3-small' }),
	{
		// Persistence (opt-in)
		persistence: createIndexedDBVectorPersistenceAdapter({
			database: db,
			documentsStore: 'vectors',
		}),
		
		// Transform (opt-in)
		similarity: createCosineSimilarityAdapter(),
		
		// Policy (opt-in)
		retry: createExponentialRetryAdapter({
			maxAttempts: 5,
			initialDelayMs: 1000,
		}),
		rateLimit: createTokenBucketRateLimitAdapter({
			requestsPerMinute: 60,
			maxConcurrent: 10,
		}),
		
		// Enhancement (opt-in)
		cache: createLRUCacheAdapter({
			maxSize: 10000,
			ttlMs: 3600000,
		}),
		batch: createBatchAdapter({
			batchSize: 100,
			delayMs: 50,
		}),
		reranker: createCohereRerankerAdapter({
			apiKey: process.env.COHERE_API_KEY,
		}),
		
		// Configuration
		autoSave: true,
	}
)

// Load existing data (only needed with persistence)
await productionStore.load()
```

## Creating a Vector Store

```ts
const store = await createVectorStore(embedding, options?)
```

**Parameters:**

1. `embedding: EmbeddingAdapterInterface` — **Required**. The embedding adapter to use.
2. `options?: VectorStoreOptions` — Optional configuration with opt-in adapters.

### VectorStoreOptions

```ts
interface VectorStoreOptions extends SubscriptionToHook<VectorStoreSubscriptions> {
	// Persistence (opt-in - stores in memory if not provided)
	readonly persistence?: VectorPersistenceAdapterInterface
	
	// Transform (opt-in)
	readonly similarity?: SimilarityAdapterInterface
	
	// Policy (opt-in)
	readonly retry?: RetryAdapterInterface
	readonly rateLimit?: RateLimitAdapterInterface
	
	// Enhancement (opt-in)
	readonly cache?: EmbeddingCacheAdapterInterface
	readonly batch?: BatchAdapterInterface
	readonly reranker?: RerankerAdapterInterface
	
	// Configuration
	readonly autoSave?: boolean
}
```

## Document Operations

### Adding Documents

```ts
// Single document
await store.upsertDocument({
	id: 'doc1',
	content: 'Document content here',
	metadata:  { source: 'manual', tags: ['important'] },
})

// Multiple documents
await store.upsertDocument([
	{ id:  'doc1', content: 'First document' },
	{ id: 'doc2', content:  'Second document' },
])
```

### Retrieving Documents

```ts
// Single document
const doc = await store.getDocument('doc1')

// Multiple documents
const docs = await store.getDocument(['doc1', 'doc2'])

// All documents
const allDocs = await store.all()

// Check existence
const exists = await store.hasDocument('doc1')

// Count
const count = await store.count()
```

### Removing Documents

```ts
// Single
await store.removeDocument('doc1')

// Multiple
await store.removeDocument(['doc1', 'doc2'])

// Clear all
await store.clear()
```

### Updating Metadata Only

```ts
await store.updateMetadata('doc1', {
	... existingMetadata,
	lastAccessed: Date.now(),
})
```

## Similarity Search

### Basic Search

```ts
const results = await store.similaritySearch('query text')

for (const result of results) {
	console.log(result.id, result.score, result.content)
}
```

### Search Options

```ts
const results = await store.similaritySearch('query', {
	limit: 10,                    // Max results (default: 10)
	threshold: 0.7,               // Min similarity score
	filter: { source: 'manual' }, // Metadata filter
	includeEmbeddings: false,     // Include vectors in results
	rerank: true,                 // Use reranker if configured
	rerankTopK: 20,               // Rerank top N before limiting
})
```

### Metadata Filtering

```ts
// Object filter (exact match)
const results = await store.similaritySearch('query', {
	filter:  { category: 'docs', status: 'published' },
})

// Function filter (complex logic)
const results = await store.similaritySearch('query', {
	filter:  (metadata) => {
		if (! metadata) return false
		return metadata.score > 0.5 && metadata.tags?. includes('important')
	},
})
```

## Hybrid Search

Combines vector similarity with keyword matching:

```ts
const results = await store.hybridSearch('query text', {
	vectorWeight: 0.7,       // Weight for vector similarity
	keywordWeight: 0.3,      // Weight for keyword matching
	keywordMode: 'fuzzy',    // 'exact' | 'fuzzy' | 'prefix'
	limit: 10,
})
```

### When to Use Hybrid Search

- Exact term matching matters (product names, codes)
- Query contains rare/specific terms
- Semantic search alone misses relevant docs

## Reranking

Two-stage search with cross-encoder reranking: 

```ts
import { createCohereRerankerAdapter } from '@mikesaintsg/adapters'

const store = await createVectorStore(embedding, {
	reranker: createCohereRerankerAdapter({ apiKey }),
})

// Automatic reranking
const results = await store.similaritySearch('query', {
	rerank: true,
	rerankTopK:  50, // Get 50 from vector search, rerank, return top 10
	limit: 10,
})
```

## Persistence

### Loading and Saving

```ts
// Load from persistence
await store.load()

// Force reload (discards in-memory changes)
await store.load({ force: true })

// Manual save
await store.save()

// Reload from persistence
await store.reload()

// Check if loaded
const loaded = store.isLoaded()
```

### Re-indexing

Regenerate all embeddings (e.g., after model change):

```ts
await store.reindex()
```

**Warning:** This will fail if the new model has different dimensions.  Clear and re-add documents instead.

## Model Consistency

VectorStore enforces consistent embedding models:

```ts
// First document sets the model
await store.upsertDocument({ id: 'doc1', content: 'Hello' })

// Later, if embedding adapter model changed... 
await store.upsertDocument({ id: 'doc2', content: 'World' })
// Throws MODEL_MISMATCH error if dimensions differ
```

### Handling Model Changes

```ts
// Option 1: Clear and rebuild
await store.clear()
await store.upsertDocument(allDocuments)

// Option 2: Export, change model, reimport
const exported = await store.export()
// ... change embedding adapter ...
await newStore.import(exported) // Will re-embed
```

## Export and Import

```ts
// Export for backup or transfer
const data = await store.export()
// data.version, data.metadata, data.documents

// Save to file
await fs.writeFile('vectors.json', JSON.stringify(data))

// Import
const imported = JSON.parse(await fs.readFile('vectors.json'))
await store.import(imported)
```

## Memory Management

```ts
const info = store.getMemoryInfo()
console.log({
	documentCount: info.documentCount,
	estimatedBytes: info.estimatedBytes,
	dimensionCount: info.dimensionCount,
})
```

### Performance Tips

1. **Batch insertions** — Use array overload of `upsertDocument`
2. **Cache embeddings** — Wrap adapter with `createCacheAdapter`
3. **Limit results** — Always set reasonable `limit`
4. **Filter early** — Metadata filters reduce vector comparisons
5. **Use persistence** — Don't re-embed on every page load

## Event Subscriptions

```ts
const cleanup1 = store.onDocumentAdded((doc) => {
	console.log('Added:', doc.id)
})

const cleanup2 = store.onDocumentUpdated((doc) => {
	console.log('Updated:', doc.id)
})

const cleanup3 = store.onDocumentRemoved((id) => {
	console.log('Removed:', id)
})

// Cleanup
cleanup1()
cleanup2()
cleanup3()
```

## Error Handling

```ts
import { isVectorStoreError } from '@mikesaintsg/vectorstore'

try {
	await store.similaritySearch('query')
} catch (error) {
	if (isVectorStoreError(error)) {
		switch (error.code) {
			case 'NOT_LOADED':
				await store.load()
				break
			case 'MODEL_MISMATCH':
				// Handle dimension mismatch
				break
			case 'EMBEDDING_ERROR':
				// Embedding generation failed
				break
		}
	}
}
```

## Integration with Ecosystem

### With @mikesaintsg/inference (RAG)

```ts
import { createEngine } from '@mikesaintsg/inference'
import { createVectorStore } from '@mikesaintsg/vectorstore'

const results = await store.similaritySearch(userQuery, { limit: 5 })

const context = results.map(r => r.content).join('\n\n')

const response = await engine.generate([
	{ role: 'system', content: `Use this context:\n${context}` },
	{ role: 'user', content: userQuery },
])
```

### With @mikesaintsg/contextbuilder

```ts
import { createContextBuilder } from '@mikesaintsg/contextbuilder'

const results = await store.similaritySearch(query)
builder.addRetrieval(results, 'normal')

const context = builder.build()
await engine.generateFromContext(context)
```

### With @mikesaintsg/contextprotocol

```ts
import { createRetrievalTool } from '@mikesaintsg/core'

const { schema, handler } = createRetrievalTool({
	vectorStore:  store,
	name: 'search_docs',
	description:  'Search documentation',
	defaultLimit: 5,
})

registry.register(schema, handler)
```

## API Reference

### Factory Functions

- `createVectorStore(embedding, options?)` → `Promise<VectorStoreInterface>`

### VectorStoreInterface

#### Document Operations

- `upsertDocument(doc)` → `Promise<void>`
- `getDocument(id)` → `Promise<StoredDocument | undefined>`
- `getDocument(ids)` → `Promise<readonly (StoredDocument | undefined)[]>`
- `removeDocument(id)` → `Promise<void>`
- `hasDocument(id)` → `Promise<boolean>`
- `all()` → `Promise<readonly StoredDocument[]>`
- `count()` → `Promise<number>`
- `clear()` → `Promise<void>`
- `updateMetadata(id, metadata)` → `Promise<void>`

#### Search Operations

- `similaritySearch(query, options?)` → `Promise<readonly ScoredResult[]>`
- `hybridSearch(query, options?)` → `Promise<readonly ScoredResult[]>`

#### Persistence Operations

- `load(options?)` → `Promise<void>`
- `save()` → `Promise<void>`
- `reload()` → `Promise<void>`
- `reindex()` → `Promise<void>`
- `isLoaded()` → `boolean`

#### Info Methods

- `getModelId()` → `string`
- `getMemoryInfo()` → `MemoryInfo`

#### Export/Import

- `export()` → `Promise<ExportedVectorStore>`
- `import(data)` → `Promise<void>`

#### Lifecycle

- `destroy()` → `void`

#### Event Subscriptions

- `onDocumentAdded(callback)` → `Unsubscribe`
- `onDocumentUpdated(callback)` → `Unsubscribe`
- `onDocumentRemoved(callback)` → `Unsubscribe`
````

```typescript name=types/vectorstore/types.ts
/**
 * @mikesaintsg/vectorstore
 *
 * Type definitions for vector storage and similarity search. 
 */

import type {
	Unsubscribe,
	SubscriptionToHook,
	Embedding,
	EmbeddingAdapterInterface,
	SimilarityAdapterInterface,
	VectorPersistenceAdapterInterface,
	PackageErrorData,
	ScoredResult,
} from '@mikesaintsg/core'

// ============================================================================
// Document Types
// ============================================================================

/** Document metadata */
export type DocumentMetadata = Readonly<Record<string, unknown>>

/** Input document (without embedding) */
export interface Document {
	readonly id: string
	readonly content: string
	readonly metadata?:  DocumentMetadata
}

/** Stored document (with embedding) */
export interface StoredDocument {
	readonly id: string
	readonly content: string
	readonly embedding: Embedding
	readonly metadata?:  DocumentMetadata
	readonly createdAt: number
	readonly updatedAt: number
}

// ============================================================================
// Search Types
// ============================================================================

/** Metadata filter - object for exact match, function for complex logic */
export type MetadataFilter =
	| Readonly<Record<string, unknown>>
	| ((metadata: DocumentMetadata | undefined) => boolean)

/** Similarity search options */
export interface SimilaritySearchOptions {
	/** Maximum results to return (default: 10) */
	readonly limit?: number
	/** Minimum similarity score threshold (0-1) */
	readonly threshold?: number
	/** Metadata filter */
	readonly filter?: MetadataFilter
	/** Include embedding vectors in results */
	readonly includeEmbeddings?: boolean
	/** Use reranker if configured */
	readonly rerank?: boolean
	/** Number of results to fetch before reranking */
	readonly rerankTopK?: number
}

/** Hybrid search options */
export interface HybridSearchOptions extends SimilaritySearchOptions {
	/** Weight for vector similarity (0-1, default: 0.7) */
	readonly vectorWeight?: number
	/** Weight for keyword matching (0-1, default:  0.3) */
	readonly keywordWeight?: number
	/** Keyword matching mode */
	readonly keywordMode?: 'exact' | 'fuzzy' | 'prefix'
}

// ============================================================================
// Persistence Types
// ============================================================================

/** Vector store metadata */
export interface VectorStoreMetadata {
	readonly modelId: string
	readonly dimension: number
	readonly documentCount: number
	readonly createdAt: number
	readonly updatedAt: number
}

/** Memory usage info */
export interface MemoryInfo {
	readonly documentCount:  number
	readonly estimatedBytes: number
	readonly dimensionCount: number
}

/** Exported vector store for backup/transfer */
export interface ExportedVectorStore {
	readonly version: number
	readonly exportedAt: number
	readonly metadata: VectorStoreMetadata
	readonly documents:  readonly StoredDocument[]
}

/** Load options */
export interface LoadOptions {
	/** Force reload, discarding in-memory changes */
	readonly force?:  boolean
}

// ============================================================================
// Reranker Types
// ============================================================================

/**
 * Reranker adapter interface. 
 * Reranks search results using a cross-encoder or similar model.
 */
export interface RerankerAdapterInterface {
	rerank(query: string, docs: readonly ScoredResult[]): Promise<readonly ScoredResult[]>
	getModelId(): string
}

// ============================================================================
// Subscription Interfaces
// ============================================================================

/** VectorStore subscription methods */
export interface VectorStoreSubscriptions {
	onDocumentAdded(callback: (doc:  StoredDocument) => void): Unsubscribe
	onDocumentUpdated(callback: (doc:  StoredDocument) => void): Unsubscribe
	onDocumentRemoved(callback: (id:  string) => void): Unsubscribe
}

// ============================================================================
// Options Interfaces
// ============================================================================

/** VectorStore creation options */
export interface VectorStoreOptions extends SubscriptionToHook<VectorStoreSubscriptions> {
	/** Persistence adapter for storage */
	readonly persistence?: VectorPersistenceAdapterInterface
	/** Similarity function adapter (default: cosine) */
	readonly similarity?: SimilarityAdapterInterface
	/** Reranker adapter for two-stage search */
	readonly reranker?: RerankerAdapterInterface
	/** Auto-save after mutations (default: false) */
	readonly autoSave?: boolean
}

// ============================================================================
// Error Types
// ============================================================================

/** VectorStore error codes */
export type VectorStoreErrorCode =
	| 'NOT_FOUND'
	| 'NOT_LOADED'
	| 'MODEL_MISMATCH'
	| 'DIMENSION_MISMATCH'
	| 'PERSISTENCE_ERROR'
	| 'EMBEDDING_ERROR'
	| 'UNKNOWN'

/** VectorStore error data */
export interface VectorStoreErrorData extends PackageErrorData<VectorStoreErrorCode> {
	readonly documentId?: string
	readonly expectedModel?: string
	readonly actualModel?: string
}

// ============================================================================
// Behavioral Interfaces
// ============================================================================

/**
 * VectorStore interface - main entry point. 
 */
export interface VectorStoreInterface extends VectorStoreSubscriptions {
	// ---- Document Operations ----

	/**
	 * Add or update document(s). Generates embeddings automatically.
	 */
	upsertDocument(doc: Document | readonly Document[]): Promise<void>

	/**
	 * Get document by ID.
	 */
	getDocument(id: string): Promise<StoredDocument | undefined>

	/**
	 * Get multiple documents by IDs.
	 */
	getDocument(ids: readonly string[]): Promise<readonly (StoredDocument | undefined)[]>

	/**
	 * Remove document(s) by ID.
	 */
	removeDocument(id: string | readonly string[]): Promise<void>

	/**
	 * Check if document exists. 
	 */
	hasDocument(id: string): Promise<boolean>

	/**
	 * Get all documents.
	 */
	all(): Promise<readonly StoredDocument[]>

	/**
	 * Get document count.
	 */
	count(): Promise<number>

	/**
	 * Clear all documents.
	 */
	clear(): Promise<void>

	/**
	 * Update only metadata (no re-embedding).
	 */
	updateMetadata(id:  string, metadata: DocumentMetadata): Promise<void>

	// ---- Search Operations ----

	/**
	 * Similarity search using vector embeddings.
	 */
	similaritySearch(query:  string, options?: SimilaritySearchOptions): Promise<readonly ScoredResult[]>

	/**
	 * Hybrid search combining vector and keyword matching.
	 */
	hybridSearch(query: string, options?: HybridSearchOptions): Promise<readonly ScoredResult[]>

	// ---- Persistence Operations ----

	/**
	 * Load documents from persistence adapter.
	 */
	load(options?: LoadOptions): Promise<void>

	/**
	 * Save documents to persistence adapter.
	 */
	save(): Promise<void>

	/**
	 * Reload from persistence (discard in-memory).
	 */
	reload(): Promise<void>

	/**
	 * Re-generate all embeddings.
	 */
	reindex(): Promise<void>

	/**
	 * Check if store has loaded from persistence.
	 */
	isLoaded(): boolean

	// ---- Info Methods ----

	/**
	 * Get embedding model ID.
	 */
	getModelId(): string

	/**
	 * Get memory usage information.
	 */
	getMemoryInfo(): MemoryInfo

	// ---- Export/Import ----

	/**
	 * Export all data for backup. 
	 */
	export(): Promise<ExportedVectorStore>

	/**
	 * Import data from export.
	 */
	import(data: ExportedVectorStore): Promise<void>

	// ---- Lifecycle ----

	/**
	 * Cleanup resources.
	 */
	destroy(): void
}

// ============================================================================
// Factory Function Types
// ============================================================================

/** Factory for vector store */
export type CreateVectorStore = (
	embedding: EmbeddingAdapterInterface,
	options?:  VectorStoreOptions
) => Promise<VectorStoreInterface>
```

---

## 5. @mikesaintsg/contextprotocol

````markdown name=guides/contextprotocol.md
# @mikesaintsg/contextprotocol — Tool Registry & Execution

## Purpose

Manages tool schemas, validates tool calls, and executes tool handlers.  Provides a provider-agnostic interface for LLM function calling.

## Design Principles

1. **Format adapter first** — Required for provider-specific formatting
2. **Schema-driven** — JSON Schema validation for all tool calls
3. **Execution isolation** — Handlers run with timeouts and error boundaries
4. **Registry pattern** — Central registry for all tools

## Package Boundaries

### What ContextProtocol Does

- Store and manage tool schemas
- Format schemas for specific providers (OpenAI, Anthropic)
- Validate tool call arguments against schemas
- Execute tool handlers with error handling
- Parse tool calls from provider responses

### What ContextProtocol Does NOT Do

- Context assembly (use contextbuilder)
- LLM generation (use inference)
- Define specific tools (your application does this)

## Quick Start

### Minimal Setup

```ts
import { createToolRegistry } from '@mikesaintsg/contextprotocol'
import { createOpenAIToolFormatAdapter } from '@mikesaintsg/adapters'

const registry = createToolRegistry(
	createOpenAIToolFormatAdapter()
)

registry.register(
	{
		name: 'get_weather',
		description: 'Get current weather for a city',
		parameters:  {
			type:  'object',
			properties: {
				city: { type: 'string', description: 'City name' },
			},
			required:  ['city'],
		},
	},
	async (params) => {
		return { temperature: 72, conditions: 'sunny' }
	}
)
```

### Full Integration

```ts
import { createToolRegistry } from '@mikesaintsg/contextprotocol'
import { createEngine } from '@mikesaintsg/inference'
import { createOpenAIToolFormatAdapter, createOpenAIProviderAdapter } from '@mikesaintsg/adapters'

const toolFormat = createOpenAIToolFormatAdapter()
const registry = createToolRegistry(toolFormat)

// Register tools
registry.register(weatherSchema, weatherHandler)
registry.register(searchSchema, searchHandler)

// Use with inference
const engine = createEngine(createOpenAIProviderAdapter({ apiKey }))
const session = engine.createSession({ system: 'You are helpful.' })

session.addMessage('user', 'What is the weather in Paris?')

const result = await session.generate({
	tools: registry.getSchemas(),
})

// Handle tool calls
for (const call of result.toolCalls) {
	const toolResult = await registry.execute(call)
	session.addToolResult(call.id, call.name, toolResult.value)
}

// Continue if tool calls were made
if (result.toolCalls.length > 0) {
	const continuation = await session.generate()
	console.log(continuation.text)
}
```

## Creating a Tool Registry

```ts
const registry = createToolRegistry(formatAdapter, options?)
```

**Parameters:**

1. `formatAdapter:  ToolFormatAdapterInterface` — **Required**.  Provider-specific formatting. 
2. `options?: ToolRegistryOptions` — Optional configuration.

### ToolRegistry Options

```ts
interface ToolRegistryOptions {
	readonly timeout?: number  // Default execution timeout (ms)
	readonly onToolRegistered?: (schema: ToolSchema) => void
	readonly onToolUnregistered?: (name: string) => void
}
```

## Registering Tools

### Basic Registration

```ts
const unregister = registry.register(
	{
		name: 'search',
		description:  'Search the knowledge base',
		parameters: {
			type: 'object',
			properties: {
				query: { type: 'string' },
				limit:  { type: 'number', default: 10 },
			},
			required: ['query'],
		},
	},
	async (params) => {
		// params is typed as { query: string; limit?:  number }
		return await searchKnowledgeBase(params.query, params.limit)
	}
)

// Later, unregister if needed
unregister()
```

### Typed Registration

```ts
interface SearchParams {
	readonly query: string
	readonly limit?: number
}

interface SearchResult {
	readonly items: readonly string[]
	readonly total: number
}

registry.register<SearchParams, SearchResult>(
	searchSchema,
	async (params) => {
		// params is SearchParams, return must be SearchResult
		return { items: ['... '], total: 1 }
	}
)
```

## Getting Schemas

```ts
// Get internal schemas
const schemas = registry.getSchemas()

// Get provider-formatted schemas (for API requests)
const formatted = registry.getFormattedSchemas()
// For OpenAI:  [{ type: 'function', function: { name, description, parameters } }]
// For Anthropic:  [{ name, description, input_schema }]
```

## Validating Tool Calls

```ts
const call:  ToolCall = {
	id: 'call_123',
	name: 'search',
	arguments: { query: 'hello' },
}

const validation = registry.validate(call)

if (! validation.valid) {
	console.error('Invalid call:', validation.errors)
}
```

## Executing Tool Calls

```ts
const call: ToolCall = {
	id:  'call_123',
	name:  'search',
	arguments: { query: 'hello', limit: 5 },
}

const result = await registry.execute(call)

if (result.success) {
	console.log('Result:', result.value)
} else {
	console.error('Error:', result.error)
}
```

### Execution with Timeout

```ts
const registry = createToolRegistry(formatAdapter, {
	timeout: 30000, // 30 second default timeout
})

// Or per-call (not directly supported, use AbortSignal in handler)
```

## Parsing Provider Responses

```ts
// After receiving response from LLM
const toolCalls = registry.parseResponse(providerResponse)

for (const call of toolCalls) {
	const result = await registry.execute(call)
	// ... 
}
```

## Formatting Results

```ts
const result = await registry.execute(call)
const formatted = registry.formatResult(result)
// Provider-specific format for injecting back into conversation
```

## Tool Schema Design

### JSON Schema Parameters

```ts
const schema: ToolSchema = {
	name: 'create_task',
	description:  'Create a new task in the project',
	parameters:  {
		type:  'object',
		properties: {
			title: {
				type: 'string',
				description: 'Task title',
				minLength: 1,
				maxLength: 200,
			},
			priority: {
				type: 'string',
				enum: ['low', 'medium', 'high'],
				default: 'medium',
			},
			dueDate: {
				type: 'string',
				format: 'date',
				description: 'Due date in YYYY-MM-DD format',
			},
			tags: {
				type: 'array',
				items:  { type: 'string' },
				maxItems: 10,
			},
		},
		required:  ['title'],
	},
}
```

### Returns Schema (Optional)

```ts
const schema: ToolSchema = {
	name: 'get_user',
	description: 'Get user by ID',
	parameters: {
		type: 'object',
		properties: {
			userId: { type: 'string' },
		},
		required: ['userId'],
	},
	returns: {
		type: 'object',
		properties: {
			id: { type: 'string' },
			name: { type: 'string' },
			email: { type:  'string' },
		},
	},
}
```

## Error Handling in Handlers

```ts
registry.register(
	schema,
	async (params) => {
		try {
			return await riskyOperation(params)
		} catch (error) {
			// Return error info that LLM can understand
			throw new Error(`Failed to execute: ${error.message}`)
		}
	}
)

// The registry catches errors and returns: 
// { callId, name, success:  false, error: 'Failed to execute:  ...' }
```

## Event Subscriptions

```ts
const cleanup1 = registry.onToolRegistered((schema) => {
	console.log('Tool registered:', schema.name)
})

const cleanup2 = registry.onToolUnregistered((name) => {
	console.log('Tool unregistered:', name)
})

// Cleanup
cleanup1()
cleanup2()
```

## Integration with VectorStore

### Retrieval Tool Factory

```ts
import { createRetrievalTool } from '@mikesaintsg/core'

const { schema, handler } = createRetrievalTool({
	vectorStore: store,
	name: 'search_docs',
	description: 'Search documentation for relevant information',
	defaultLimit: 5,
	scoreThreshold: 0.7,
	formatResult: (result) => ({
		content: result.content,
		score: result.score,
		source: result.metadata?. source,
	}),
})

registry.register(schema, handler)
```

## Integration with ContextBuilder

```ts
import { createContextBuilder } from '@mikesaintsg/contextbuilder'

// Add tool schemas to context for token counting
for (const schema of registry.getSchemas()) {
	builder.addTool(schema, 'high')
}

const context = builder.build()
// context.frames includes tool schema frames
```

## Tool Call Bridge

For connecting inference tool calls to registry execution:

```ts
import { createToolCallBridge } from '@mikesaintsg/core'

const bridge = createToolCallBridge({
	registry,
	timeout: 30000,
	onError: (error, call) => {
		console.error(`Tool ${call.name} failed:`, error)
	},
})

// Execute single call
const result = await bridge.execute(toolCall)

// Execute all calls in parallel
const results = await bridge.executeAll(toolCalls)
```

## Error Types

```ts
import { isContextProtocolError } from '@mikesaintsg/contextprotocol'

try {
	await registry.execute(call)
} catch (error) {
	if (isContextProtocolError(error)) {
		switch (error.code) {
			case 'TOOL_NOT_FOUND': 
				console.error('Unknown tool:', error.toolName)
				break
			case 'VALIDATION_FAILED':
				console.error('Invalid arguments')
				break
			case 'EXECUTION_FAILED':
				console.error('Handler threw error')
				break
			case 'TIMEOUT':
				console.error('Execution timed out')
				break
		}
	}
}
```

## API Reference

### Factory Functions

- `createToolRegistry(formatAdapter, options?)` → `ToolRegistryInterface`

### ToolRegistryInterface

#### Registration

- `register(schema, handler)` → `Unsubscribe`

#### Schema Access

- `getSchemas()` → `readonly ToolSchema[]`
- `getFormattedSchemas()` → `unknown`
- `has(name)` → `boolean`
- `getSchema(name)` → `ToolSchema | undefined`

#### Validation & Execution

- `validate(call)` → `ValidationResult`
- `execute(call)` → `Promise<ToolResult>`

#### Response Parsing

- `parseResponse(response)` → `readonly ToolCall[]`
- `formatResult(result)` → `unknown`

#### Event Subscriptions

- `onToolRegistered(callback)` → `Unsubscribe`
- `onToolUnregistered(callback)` → `Unsubscribe`

#### Lifecycle

- `destroy()` → `void`
````

```typescript name=types/contextprotocol/types.ts
/**
 * @mikesaintsg/contextprotocol
 *
 * Type definitions for tool registry and execution. 
 */

import type {
	Unsubscribe,
	SubscriptionToHook,
	ToolCall,
	ToolResult,
	ToolSchema,
	ToolFormatAdapterInterface,
	PackageErrorData,
} from '@mikesaintsg/core'

// ============================================================================
// Validation Types
// ============================================================================

/** Validation result */
export type ValidationResult =
	| { readonly valid: true }
	| { readonly valid: false; readonly errors: readonly string[] }

// ============================================================================
// Handler Types
// ============================================================================

/** Tool handler function */
export type ToolHandler<TParams = unknown, TResult = unknown> = (
	params: TParams
) => Promise<TResult>

// ============================================================================
// Subscription Interfaces
// ============================================================================

/** Tool registry subscription methods */
export interface ToolRegistrySubscriptions {
	onToolRegistered(callback: (schema:  ToolSchema) => void): Unsubscribe
	onToolUnregistered(callback: (name:  string) => void): Unsubscribe
}

// ============================================================================
// Options Interfaces
// ============================================================================

/** Tool registry options */
export interface ToolRegistryOptions extends SubscriptionToHook<ToolRegistrySubscriptions> {
	/** Default execution timeout in ms (default: 30000) */
	readonly timeout?: number
}

// ============================================================================
// Error Types
// ============================================================================

/** Context protocol error codes */
export type ContextProtocolErrorCode =
	| 'TOOL_NOT_FOUND'
	| 'VALIDATION_FAILED'
	| 'EXECUTION_FAILED'
	| 'TIMEOUT'
	| 'UNKNOWN'

/** Context protocol error data */
export interface ContextProtocolErrorData extends PackageErrorData<ContextProtocolErrorCode> {
	readonly toolName?:  string
	readonly validationErrors?: readonly string[]
}

// ============================================================================
// Behavioral Interfaces
// ============================================================================

/**
 * Tool registry interface - manages tools and their execution. 
 */
export interface ToolRegistryInterface extends ToolRegistrySubscriptions {
	/**
	 * Register a tool with its handler.
	 * @returns Unsubscribe function to remove the tool
	 */
	register<TParams = unknown, TResult = unknown>(
		schema: ToolSchema,
		handler: ToolHandler<TParams, TResult>
	): Unsubscribe

	/**
	 * Get all registered tool schemas.
	 */
	getSchemas(): readonly ToolSchema[]

	/**
	 * Get schemas formatted for provider API.
	 */
	getFormattedSchemas(): unknown

	/**
	 * Check if tool is registered.
	 */
	has(name: string): boolean

	/**
	 * Get specific tool schema.
	 */
	getSchema(name: string): ToolSchema | undefined

	/**
	 * Validate tool call arguments against schema.
	 */
	validate(call: ToolCall): ValidationResult

	/**
	 * Execute tool call with registered handler.
	 */
	execute(call: ToolCall): Promise<ToolResult>

	/**
	 * Parse tool calls from provider response.
	 */
	parseResponse(response: unknown): readonly ToolCall[]

	/**
	 * Format tool result for provider. 
	 */
	formatResult(result: ToolResult): unknown

	/**
	 * Cleanup resources.
	 */
	destroy(): void
}

// ============================================================================
// Factory Function Types
// ============================================================================

/** Factory for tool registry */
export type CreateToolRegistry = (
	formatAdapter:  ToolFormatAdapterInterface,
	options?: ToolRegistryOptions
) => ToolRegistryInterface
```

---

## 6. @mikesaintsg/contextbuilder

````markdown name=guides/contextbuilder.md
# @mikesaintsg/contextbuilder — Context Assembly & Budgeting

## Purpose

Assembles context for LLM inference with token budgeting, deduplication, and priority-based truncation.  The orchestration layer between your content and the inference engine.

## Design Principles

1. **Token adapter first** — Required for accurate budgeting
2. **Frame-based model** — All content as typed frames
3. **Budget-aware** — Never exceed token limits
4. **Deduplication** — Automatic content hash detection
5. **Priority-driven** — Critical content preserved first

## Package Boundaries

### What ContextBuilder Does

- Assemble context from multiple sources
- Track sections and files with versioning
- Deduplicate content by hash
- Manage token budgets
- Truncate based on priority
- Build formatted context for inference

### What ContextBuilder Does NOT Do

- Generate embeddings (use vectorstore)
- Execute tool calls (use contextprotocol)
- LLM generation (use inference)

## Quick Start

### Minimal Setup

```ts
import { createContextBuilder } from '@mikesaintsg/contextbuilder'
import { createEstimatorTokenAdapter } from '@mikesaintsg/adapters'

const builder = createContextBuilder(
	createEstimatorTokenAdapter({ contextWindow: 128000 }),
	{ budget: { maxTokens: 8000 } }
)

builder.addFrame({ type: 'system', content: 'You are helpful. ', priority: 'critical' })
builder.addFrame({ type:  'document', content: docContent, priority: 'normal' })

const context = builder.build()
console.log(context.totalTokens) // Token count
console.log(context.frames)     // Included frames
```

### Full Setup with All Trackers

```ts
import { createContextManager } from '@mikesaintsg/contextbuilder'
import { createModelTokenAdapter } from '@mikesaintsg/adapters'

const manager = createContextManager(
	createModelTokenAdapter({ model: 'gpt-4o' }),
	{
		budget: { maxTokens: 8000, reservedTokens: 1000 },
		deduplication:  { strategy: 'keep_latest' },
		truncationStrategy: 'priority',
	}
)

// Add sections
manager.sections.setSection({
	id: 'system',
	name: 'System Prompt',
	content: 'You are a helpful assistant.',
	metadata: { pinned: true },
})

// Add files
manager.files.setFile({
	path: 'src/index.ts',
	name: 'index.ts',
	content: fileContent,
	language: 'typescript',
})

// Select what to include
manager.sections.select(['system'])
manager.files.select(['src/index.ts'])

// Build context
const context = manager.buildFromSelection()
```

## Creating a Context Builder

```ts
const builder = createContextBuilder(tokenAdapter, options)
```

**Parameters:**

1. `tokenAdapter: TokenAdapterInterface` — **Required**. Token counting. 
2. `options:  ContextBuilderOptions` — Configuration with budget. 

### ContextBuilder Options

```ts
interface ContextBuilderOptions {
	readonly budget:  TokenBudget
	readonly deduplication?:  DeduplicationOptions
	readonly truncationStrategy?: TruncationStrategy
	readonly slidingWindow?: SlidingWindowOptions
	readonly onFrameChange?: (frame, action) => void
	readonly onBudgetChange?: (state) => void
	readonly onBuild?: (context) => void
}

interface TokenBudget {
	readonly maxTokens: number
	readonly reservedTokens?:  number   // Reserve for response
	readonly warningThreshold?: number // 0-1, default 0.8
	readonly criticalThreshold?: number // 0-1, default 0.95
}
```

## Context Frames

All content in the builder is represented as frames:

```ts
interface ContextFrame {
	readonly id: string
	readonly type: FrameType
	readonly content: string
	readonly contentHash: ContentHash
	readonly priority: FramePriority
	readonly tokenEstimate: number
	readonly createdAt: number
	readonly metadata?: FrameMetadata
}

type FrameType = 'system' | 'instruction' | 'section' | 'file' | 
                 'document' | 'example' | 'tool' | 'memory' | 
                 'retrieval' | 'custom'

type FramePriority = 'critical' | 'high' | 'normal' | 'low' | 'optional'
```

### Adding Frames

```ts
// Generic frame
builder.addFrame({
	type: 'system',
	content: 'You are helpful.',
	priority: 'critical',
})

// From section
builder.addSection(section, 'high')

// From file
builder.addFile(file, 'normal')

// From tool schema
builder.addTool(schema, 'high')

// From retrieval results
builder.addRetrieval(searchResults, 'normal')
```

### Frame Priority

Frames are sorted by priority during build:

| Priority | Weight | Use Case |
|----------|--------|----------|
| `critical` | 100 | System prompts, must include |
| `high` | 75 | Active file, current tool |
| `normal` | 50 | Context documents |
| `low` | 25 | Background info |
| `optional` | 0 | Nice to have, truncate first |

## Token Budget Management

### Budget State

```ts
const state = builder.getBudgetState()
// {
//   used: 3500,
//   available: 4500,
//   reserved: 1000,
//   max: 8000,
//   usage: 0.4375,
//   level: 'ok' | 'warning' | 'critical' | 'exceeded'
// }
```

### Checking Fit

```ts
if (builder.fitsInBudget(newContent)) {
	builder.addFrame({ type: 'document', content: newContent, priority: 'normal' })
}
```

### Token Allocation

```ts
const allocation = builder.getAllocation()
// { system: 150, file: 2000, retrieval: 1350 }
```

## Deduplication

### Automatic Deduplication

```ts
const builder = createContextBuilder(tokenAdapter, {
	budget: { maxTokens: 8000 },
	deduplication: {
		strategy: 'keep_latest',  // or 'keep_first', 'keep_highest_priority'
		preservePinned: true,
	},
})
```

### Manual Deduplication

```ts
const result = builder.deduplicate()
// {
//   originalCount: 15,
//   deduplicatedCount:  12,
//   removedFrames: [... ],
//   tokensSaved: 450
// }
```

### Finding Duplicates

```ts
const duplicates = builder.findDuplicates()
// Map<ContentHash, ContextFrame[]>

for (const [hash, frames] of duplicates) {
	if (frames.length > 1) {
		console.log('Duplicate content:', frames.map(f => f.id))
	}
}
```

## Truncation

### Strategies

```ts
type TruncationStrategy = 
	| 'priority'  // Remove lowest priority first
	| 'fifo'      // Remove oldest first
	| 'lifo'      // Remove newest first
	| 'score'     // Remove lowest score first (for retrieval)
	| 'custom'    // Custom comparator
```

### Truncation Info

```ts
const context = builder.build()

if (context.truncated) {
	console.log('Truncation info:', context.truncationInfo)
	// {
	//   originalFrameCount: 20,
	//   keptFrameCount:  15,
	//   removedFrames: [{ id, type, tokenEstimate, reason }],
	//   strategy: 'priority'
	// }
}
```

## Sliding Window

For long conversations, use a sliding window: 

```ts
const builder = createContextBuilder(tokenAdapter, {
	budget: { maxTokens: 8000 },
	slidingWindow: {
		windowSize: 20,       // Max frames in window
		slideBy: 5,           // Frames to slide
		preserveSystem: true, // Always keep system frames
		preserveRecent: 3,    // Always keep last N frames
	},
})

// Get window state
const window = builder.getWindowState()
// { start: 0, end: 20, size: 20, totalFrames: 50, visibleFrames: 20 }

// Slide window
builder.slideForward()
builder.slideBackward()
builder.resetWindow()
```

## Section Tracker

### Managing Sections

```ts
const sections = createSectionTracker()

sections.setSection({
	id: 'intro',
	name:  'Introduction',
	content: 'This is the intro.. .',
	metadata: { tags: ['overview'], pinned: true },
})

const section = sections.getSection('intro')
const all = sections.getSections()
const byTag = sections.findByTag('overview')

sections.removeSection('intro')
sections.clear()
```

### Selection for UI

```ts
// User selects sections in UI
sections.select(['intro', 'examples'])
sections.deselect(['old-section'])
sections.toggleSelection('maybe')

const selected = sections.getSelected()
```

## File Tracker

### Managing Files with Versions

```ts
const files = createFileTracker({ maxVersionHistory: 10 })

files.setFile({
	path: 'src/app.ts',
	name: 'app.ts',
	content: fileContent,
	language: 'typescript',
	metadata: { url: 'https://github.com/.. .' },
})

// Updates auto-increment version
files.setFile({
	path:  'src/app.ts',
	name: 'app.ts',
	content: newContent,
})

const file = files.getFile('src/app.ts')
console.log(file.version) // 2

// Get version history
const history = files.getVersionHistory('src/app.ts')
```

### Selection for UI

```ts
files.select(['src/app.ts', 'src/utils.ts'])
const selected = files.getSelected()
```

## Template Registry

### Managing Templates

```ts
const templates = createTemplateRegistry()

templates.register({
	id: 'code-review',
	name:  'Code Review',
	content: 'Review this {{language}} code:\n\n```{{language}}\n{{code}}\n```',
	placeholders: [
		{ name: 'language', pattern: '{{language}}', required: true },
		{ name: 'code', pattern: '{{code}}', required: true },
	],
})

// Fill template
const filled = templates.fill('code-review', {
	language: 'typescript',
	code: 'const x = 1;',
})

// Validate values
const validation = templates.validate('code-review', { language: 'ts' })
// { valid: false, missing: ['code'], extra: [] }
```

## Context Manager

Convenience wrapper combining all trackers: 

```ts
const manager = createContextManager(tokenAdapter, options)

// Access trackers
manager.sections.setSection(...)
manager.files.setFile(...)
manager.templates.register(...)
manager.builder.addFrame(...)

// Build from selections
manager.sections.select(['system', 'context'])
manager.files.select(['src/app.ts'])

const context = manager.buildFromSelection()
// Automatically adds selected sections and files as frames

// Cleanup
manager.destroy()
```

## Building Context

### The Build Process

1.  Collect all frames
2. Run deduplication
3. Sort by priority
4. Apply sliding window (if configured)
5. Truncate to fit budget
6. Return built context

### Build Output

```ts
const context = builder.build()

// BuiltContext
// {
//   frames: readonly ContextFrame[]
//   totalTokens: number
//   budget: TokenBudgetState
//   truncated: boolean
//   truncationInfo?:  TruncationInfo
//   deduplication?:  DeduplicationResult
//   timestamp: number
// }
```

### Formatted Output

```ts
const plain = builder.buildFormatted('plain')
const markdown = builder.buildFormatted('markdown')
const xml = builder.buildFormatted('xml')
```

### Preview Without Building

```ts
const preview = builder.preview()
// Same as build() but doesn't modify internal state
```

## Integration with Inference

```ts
import { createEngine } from '@mikesaintsg/inference'

const context = builder.build()
const result = await engine.generateFromContext(context)
```

## Event Subscriptions

```ts
builder.onFrameChange((frame, action) => {
	console.log(`Frame ${frame.id} ${action}`)
})

builder.onBudgetChange((state) => {
	if (state.level === 'critical') {
		console.warn('Token budget critical!')
	}
})

builder.onBuild((context) => {
	console.log('Context built with', context.frames.length, 'frames')
})
```

## Error Handling

```ts
import { isContextBuilderError } from '@mikesaintsg/contextbuilder'

try {
	builder.build()
} catch (error) {
	if (isContextBuilderError(error)) {
		switch (error.code) {
			case 'BUDGET_EXCEEDED': 
				console.error('Cannot fit in budget')
				break
			case 'SECTION_NOT_FOUND': 
				console.error('Section not found:', error.sectionId)
				break
		}
	}
}
```

## API Reference

### Factory Functions

- `createContextBuilder(tokenAdapter, options)` → `ContextBuilderInterface`
- `createContextManager(tokenAdapter, options)` → `ContextManagerInterface`
- `createSectionTracker(options?)` → `SectionTrackerInterface`
- `createFileTracker(options?)` → `FileTrackerInterface`
- `createTemplateRegistry()` → `TemplateRegistryInterface`

### ContextBuilderInterface

#### Frame Management

- `addFrame(input)` → `ContextFrame`
- `addSection(section, priority?)` → `ContextFrame`
- `addFile(file, priority?)` → `ContextFrame`
- `addTool(schema, priority?)` → `ContextFrame`
- `addRetrieval(results, priority?)` → `readonly ContextFrame[]`
- `getFrame(id)` → `ContextFrame | undefined`
- `hasFrame(id)` → `boolean`
- `removeFrame(id)` → `boolean`
- `getFrames()` → `readonly ContextFrame[]`
- `getFramesByType(type)` → `readonly ContextFrame[]`
- `clear()` → `void`

#### Deduplication

- `deduplicate(options?)` → `DeduplicationResult`
- `findDuplicates()` → `ReadonlyMap<ContentHash, readonly ContextFrame[]>`

#### Token Budget

- `getBudgetState()` → `TokenBudgetState`
- `setBudget(budget)` → `void`
- `fitsInBudget(content)` → `boolean`
- `getAllocation()` → `TokenAllocation`

#### Sliding Window

- `getWindowState()` → `WindowState | undefined`
- `slideForward(by?)` → `WindowState`
- `slideBackward(by?)` → `WindowState`
- `resetWindow()` → `WindowState`

#### Building

- `build()` → `BuiltContext`
- `buildFormatted(format?)` → `string`
- `preview()` → `BuiltContext`

#### Lifecycle

- `destroy()` → `void`

### SectionTrackerInterface

- `setSection(input)` → `Section`
- `getSection(id)` → `Section | undefined`
- `hasSection(id)` → `boolean`
- `removeSection(id)` → `boolean`
- `getSections()` → `readonly Section[]`
- `findByHash(hash)` → `readonly Section[]`
- `findByTag(tag)` → `readonly Section[]`
- `clear()` → `void`
- `getSelected()` → `readonly SectionId[]`
- `select(ids)` → `void`
- `deselect(ids)` → `void`
- `toggleSelection(id)` → `boolean`
- `clearSelection()` → `void`

### FileTrackerInterface

- `setFile(input)` → `TrackedFile`
- `getFile(path)` → `TrackedFile | undefined`
- `getFileVersion(path, version)` → `TrackedFile | undefined`
- `hasFile(path)` → `boolean`
- `removeFile(path)` → `boolean`
- `getFiles()` → `readonly TrackedFile[]`
- `getVersionHistory(path)` → `readonly TrackedFile[]`
- `clear()` → `void`
- `getSelected()` → `readonly FilePath[]`
- `select(paths)` → `void`
- `deselect(paths)` → `void`
- `toggleSelection(path)` → `boolean`
- `clearSelection()` → `void`

### TemplateRegistryInterface

- `register(template)` → `void`
- `get(id)` → `PromptTemplate | undefined`
- `has(id)` → `boolean`
- `remove(id)` → `boolean`
- `all()` → `readonly PromptTemplate[]`
- `fill(id, values)` → `string`
- `validate(id, values)` → `TemplateValidationResult`
- `clear()` → `void`

### ContextManagerInterface

- `readonly sections: SectionTrackerInterface`
- `readonly files: FileTrackerInterface`
- `readonly templates: TemplateRegistryInterface`
- `readonly builder: ContextBuilderInterface`
- `buildFromSelection()` → `BuiltContext`
- `destroy()` → `void`
````

```typescript name=types/contextbuilder/types.ts
/**
 * @mikesaintsg/contextbuilder
 *
 * Type definitions for context assembly and budgeting.  
 */

import type {
	Unsubscribe,
	SubscriptionToHook,
	TokenAdapterInterface,
	ToolSchema,
	ContentHash,
	ScoredResult,
	FrameType,
	FramePriority,
	ContextFrame,
	FrameMetadata,
	TokenBudgetState,
	DeduplicationResult,
	TruncationStrategy,
	BuiltContext,
	PackageErrorData,
} from '@mikesaintsg/core'

// ============================================================================
// Content Identification Types
// ============================================================================

/** Section identifier */
export type SectionId = string

/** File path for version tracking */
export type FilePath = string

// ============================================================================
// Section Types
// ============================================================================

/** Section definition */
export interface Section {
	readonly id: SectionId
	readonly name: string
	readonly content: string
	readonly contentHash: ContentHash
	readonly createdAt: number
	readonly updatedAt: number
	readonly metadata?:  SectionMetadata
}

/** Section metadata */
export interface SectionMetadata {
	readonly description?: string
	readonly tags?: readonly string[]
	readonly pinned?: boolean
	readonly source?: 'user' | 'system' | 'template' | 'extracted' | 'tool'
}

/** Input for creating/updating a section */
export interface SectionInput {
	readonly id: SectionId
	readonly name: string
	readonly content:  string
	readonly metadata?: SectionMetadata
}

// ============================================================================
// File Types
// ============================================================================

/** Tracked file with version history */
export interface TrackedFile {
	readonly path: FilePath
	readonly name: string
	readonly content: string
	readonly contentHash: ContentHash
	readonly language?:  string
	readonly version: number
	readonly createdAt: number
	readonly updatedAt: number
	readonly metadata?:  FileMetadata
}

/** File metadata */
export interface FileMetadata {
	readonly description?: string
	readonly url?: string
	readonly lineStart?: number
	readonly lineEnd?: number
	readonly repository?: string
	readonly commitOid?: string
}

/** Input for creating/updating a file */
export interface FileInput {
	readonly path: FilePath
	readonly name:  string
	readonly content: string
	readonly language?: string
	readonly metadata?: FileMetadata
}

// ============================================================================
// Template Types
// ============================================================================

/** Prompt template with placeholders */
export interface PromptTemplate {
	readonly id: string
	readonly name: string
	readonly content: string
	readonly placeholders: readonly TemplatePlaceholder[]
	readonly metadata?:  TemplateMetadata
}

/** Template placeholder */
export interface TemplatePlaceholder {
	readonly name: string
	readonly pattern: string
	readonly required: boolean
	readonly defaultValue?: string
	readonly description?: string
}

/** Template metadata */
export interface TemplateMetadata {
	readonly description?:  string
	readonly tags?: readonly string[]
	readonly version?: number
}

/** Template fill values */
export type TemplateFillValues = Readonly<Record<string, string>>

/** Template validation result */
export interface TemplateValidationResult {
	readonly valid: boolean
	readonly missing: readonly string[]
	readonly extra: readonly string[]
}

// ============================================================================
// Frame Input Types
// ============================================================================

/** Input for creating a frame */
export interface FrameInput {
	readonly id?:  string
	readonly type: FrameType
	readonly content: string
	readonly priority: FramePriority
	readonly metadata?: FrameMetadata
}

// ============================================================================
// Deduplication Types
// ============================================================================

/** Deduplication strategy */
export type DeduplicationStrategy =
	| 'keep_latest'
	| 'keep_first'
	| 'keep_highest_priority'
	| 'merge'

/** Deduplication options */
export interface DeduplicationOptions {
	readonly strategy?:  DeduplicationStrategy
	readonly preservePinned?: boolean
	readonly minSimilarity?: number
}

// ============================================================================
// Token Budget Types
// ============================================================================

/** Token budget configuration */
export interface TokenBudget {
	readonly maxTokens: number
	readonly reservedTokens?: number
	readonly warningThreshold?: number
	readonly criticalThreshold?:  number
}

/** Token allocation by frame type */
export type TokenAllocation = Partial<Record<FrameType, number>>

// ============================================================================
// Sliding Window Types
// ============================================================================

/** Sliding window configuration */
export interface SlidingWindowOptions {
	readonly windowSize: number
	readonly slideBy?: number
	readonly preserveSystem?: boolean
	readonly preservePinned?: boolean
	readonly preserveRecent?: number
}

/** Window state */
export interface WindowState {
	readonly start: number
	readonly end: number
	readonly size: number
	readonly totalFrames: number
	readonly visibleFrames:  number
}

// ============================================================================
// Context Format Types
// ============================================================================

/** Context output format */
export type ContextFormat = 'plain' | 'markdown' | 'xml'

// ============================================================================
// Subscription Interfaces
// ============================================================================

/** Section tracker subscriptions */
export interface SectionTrackerSubscriptions {
	onSectionChange(callback: (section:  Section, action: 'added' | 'updated' | 'removed') => void): Unsubscribe
}

/** File tracker subscriptions */
export interface FileTrackerSubscriptions {
	onFileChange(callback: (file: TrackedFile, action: 'added' | 'updated' | 'removed') => void): Unsubscribe
}

/** Context builder subscriptions */
export interface ContextBuilderSubscriptions {
	onFrameChange(callback: (frame: ContextFrame, action:  'added' | 'updated' | 'removed') => void): Unsubscribe
	onBudgetChange(callback: (state:  TokenBudgetState) => void): Unsubscribe
	onBuild(callback: (context:  BuiltContext) => void): Unsubscribe
}

// ============================================================================
// Options Interfaces
// ============================================================================

/** Section tracker options */
export interface SectionTrackerOptions extends SubscriptionToHook<SectionTrackerSubscriptions> {
	readonly deduplication?: DeduplicationOptions
}

/** File tracker options */
export interface FileTrackerOptions extends SubscriptionToHook<FileTrackerSubscriptions> {
	readonly deduplication?: DeduplicationOptions
	readonly maxVersionHistory?:  number
}

/** Context builder options */
export interface ContextBuilderOptions extends SubscriptionToHook<ContextBuilderSubscriptions> {
	readonly budget: TokenBudget
	readonly deduplication?: DeduplicationOptions
	readonly truncationStrategy?:  TruncationStrategy
	readonly slidingWindow?: SlidingWindowOptions
}

/** Context manager options */
export interface ContextManagerOptions extends ContextBuilderOptions {
	readonly sectionTracker?: SectionTrackerOptions
	readonly fileTracker?: FileTrackerOptions
}

// ============================================================================
// Error Types
// ============================================================================

/** Context builder error codes */
export type ContextBuilderErrorCode =
	| 'BUDGET_EXCEEDED'
	| 'SECTION_NOT_FOUND'
	| 'FILE_NOT_FOUND'
	| 'FRAME_NOT_FOUND'
	| 'TEMPLATE_NOT_FOUND'
	| 'TEMPLATE_FILL_FAILED'
	| 'INVALID_PRIORITY'
	| 'DUPLICATE_ID'
	| 'UNKNOWN'

/** Context builder error data */
export interface ContextBuilderErrorData extends PackageErrorData<ContextBuilderErrorCode> {
	readonly frameId?: string
	readonly sectionId?:  SectionId
	readonly filePath?: FilePath
	readonly templateId?: string
}

// ============================================================================
// Behavioral Interfaces
// ============================================================================

/**
 * Section tracker interface - manages reusable prompt sections. 
 */
export interface SectionTrackerInterface extends SectionTrackerSubscriptions {
	// ---- Section Management ----

	/** Add or update a section */
	setSection(input: SectionInput): Section

	/** Get section by ID */
	getSection(id: SectionId): Section | undefined

	/** Check if section exists */
	hasSection(id: SectionId): boolean

	/** Remove section */
	removeSection(id: SectionId): boolean

	/** Get all sections */
	getSections(): readonly Section[]

	/** Find sections by content hash */
	findByHash(contentHash: ContentHash): readonly Section[]

	/** Find sections by tag */
	findByTag(tag: string): readonly Section[]

	/** Clear all sections */
	clear(): void

	// ---- Selection State (for UI) ----

	/** Get selected section IDs */
	getSelected(): readonly SectionId[]

	/** Select sections for inclusion */
	select(ids: readonly SectionId[]): void

	/** Deselect sections */
	deselect(ids: readonly SectionId[]): void

	/** Toggle section selection */
	toggleSelection(id: SectionId): boolean

	/** Clear all selections */
	clearSelection(): void

	// ---- Lifecycle ----

	/** Destroy tracker and release resources */
	destroy(): void
}

/**
 * File tracker interface - manages file versions in context.
 */
export interface FileTrackerInterface extends FileTrackerSubscriptions {
	// ---- File Management ----

	/** Add or update a file (auto-increments version if content changed) */
	setFile(input: FileInput): TrackedFile

	/** Get file by path (latest version) */
	getFile(path:  FilePath): TrackedFile | undefined

	/** Get file at specific version */
	getFileVersion(path: FilePath, version: number): TrackedFile | undefined

	/** Check if file exists */
	hasFile(path:  FilePath): boolean

	/** Remove file (all versions) */
	removeFile(path:  FilePath): boolean

	/** Get all files (latest versions only) */
	getFiles(): readonly TrackedFile[]

	/** Get version history for a file */
	getVersionHistory(path: FilePath): readonly TrackedFile[]

	/** Clear all files */
	clear(): void

	// ---- Selection State (for UI) ----

	/** Get selected file paths */
	getSelected(): readonly FilePath[]

	/** Select files for inclusion */
	select(paths: readonly FilePath[]): void

	/** Deselect files */
	deselect(paths: readonly FilePath[]): void

	/** Toggle file selection */
	toggleSelection(path: FilePath): boolean

	/** Clear all selections */
	clearSelection(): void

	// ---- Lifecycle ----

	/** Destroy tracker and release resources */
	destroy(): void
}

/**
 * Template registry interface - manages prompt templates.
 */
export interface TemplateRegistryInterface {
	/** Register a template */
	register(template: PromptTemplate): void

	/** Get template by ID */
	get(id: string): PromptTemplate | undefined

	/** Check if template exists */
	has(id: string): boolean

	/** Remove template */
	remove(id: string): boolean

	/** Get all templates */
	all(): readonly PromptTemplate[]

	/** Fill template with values */
	fill(id: string, values: TemplateFillValues): string

	/** Validate fill values against template */
	validate(id: string, values: TemplateFillValues): TemplateValidationResult

	/** Clear all templates */
	clear(): void
}

/**
 * Context builder interface - assembles context for inference.
 */
export interface ContextBuilderInterface extends ContextBuilderSubscriptions {
	// ---- Frame Management ----

	/** Add a context frame */
	addFrame(input: FrameInput): ContextFrame

	/** Add frame from section */
	addSection(section: Section, priority?: FramePriority): ContextFrame

	/** Add frame from tracked file */
	addFile(file: TrackedFile, priority?:  FramePriority): ContextFrame

	/** Add frame from tool schema */
	addTool(schema: ToolSchema, priority?: FramePriority): ContextFrame

	/** Add frames from retrieval results */
	addRetrieval(results:  readonly ScoredResult[], priority?: FramePriority): readonly ContextFrame[]

	/** Get frame by ID */
	getFrame(id:  string): ContextFrame | undefined

	/** Check if frame exists */
	hasFrame(id: string): boolean

	/** Remove frame */
	removeFrame(id: string): boolean

	/** Get all frames */
	getFrames(): readonly ContextFrame[]

	/** Get frames by type */
	getFramesByType(type: FrameType): readonly ContextFrame[]

	/** Clear all frames */
	clear(): void

	// ---- Deduplication ----

	/** Run deduplication on current frames */
	deduplicate(options?: DeduplicationOptions): DeduplicationResult

	/** Find duplicate frames by content hash */
	findDuplicates(): ReadonlyMap<ContentHash, readonly ContextFrame[]>

	// ---- Token Budget ----

	/** Get current token budget state */
	getBudgetState(): TokenBudgetState

	/** Set token budget */
	setBudget(budget: TokenBudget): void

	/** Check if content fits in remaining budget */
	fitsInBudget(content: string): boolean

	/** Get token allocation by frame type */
	getAllocation(): TokenAllocation

	// ---- Sliding Window ----

	/** Get sliding window state */
	getWindowState(): WindowState | undefined

	/** Slide window forward */
	slideForward(by?:  number): WindowState

	/** Slide window backward */
	slideBackward(by?: number): WindowState

	/** Reset window to start */
	resetWindow(): WindowState

	// ---- Building ----

	/** Build context within token budget */
	build(): BuiltContext

	/** Build context and return as formatted string */
	buildFormatted(format?:  ContextFormat): string

	/** Preview build without modifying state */
	preview(): BuiltContext

	// ---- Lifecycle ----

	/** Destroy builder and release resources */
	destroy(): void
}

/**
 * Context manager interface - convenience wrapper combining all trackers.
 */
export interface ContextManagerInterface {
	/** Section tracker for managing reusable sections */
	readonly sections: SectionTrackerInterface

	/** File tracker for managing versioned files */
	readonly files: FileTrackerInterface

	/** Template registry for managing prompt templates */
	readonly templates: TemplateRegistryInterface

	/** Context builder for assembling context */
	readonly builder:  ContextBuilderInterface

	/** Build context from selected sections and files */
	buildFromSelection(): BuiltContext

	/** Destroy all components and release resources */
	destroy(): void
}

// ============================================================================
// Factory Function Types
// ============================================================================

/** Factory for section tracker */
export type CreateSectionTracker = (
	options?: SectionTrackerOptions
) => SectionTrackerInterface

/** Factory for file tracker */
export type CreateFileTracker = (
	options?:  FileTrackerOptions
) => FileTrackerInterface

/** Factory for template registry */
export type CreateTemplateRegistry = () => TemplateRegistryInterface

/** Factory for context builder */
export type CreateContextBuilder = (
	tokenAdapter:  TokenAdapterInterface,
	options:  ContextBuilderOptions
) => ContextBuilderInterface

/** Factory for context manager */
export type CreateContextManager = (
	tokenAdapter: TokenAdapterInterface,
	options: ContextManagerOptions
) => ContextManagerInterface

// ============================================================================
// Utility Types
// ============================================================================

/** Priority weight map for comparison */
export type PriorityWeights = Record<FramePriority, number>

/** Default priority weights (higher = more important) */
export const DEFAULT_PRIORITY_WEIGHTS: PriorityWeights = {
	critical: 100,
	high:  75,
	normal: 50,
	low: 25,
	optional: 0,
} as const

/** Frame formatter for different output formats */
export type FrameFormatter = (frame: ContextFrame) => string

/** Built-in formatters by format type */
export type FrameFormatters = Record<ContextFormat, FrameFormatter>

/** Utility:  Create content hash (async, Web Crypto API) */
export type CreateContentHash = (content: string) => Promise<ContentHash>

/** Utility: Create content hash (sync, simple algorithm) */
export type CreateContentHashSync = (content: string) => ContentHash

/** Utility: Default token estimator (~4 chars per token) */
export type DefaultTokenEstimator = (content: string) => number

/** Utility:  Detect language from filename */
export type DetectLanguage = (filename: string) => string | undefined
```

---

## Summary:  Complete Package Architecture

Here's the final overview of all packages:

| Package                        | First Param (Required)       | Purpose                                      |
|--------------------------------|------------------------------|----------------------------------------------|
| `@mikesaintsg/core`            | N/A                          | Shared types, interfaces, no implementations |
| `@mikesaintsg/adapters`        | Varies by factory            | All adapter implementations                  |
| `@mikesaintsg/inference`       | `ProviderAdapterInterface`   | LLM generation engine                        |
| `@mikesaintsg/vectorstore`     | `EmbeddingAdapterInterface`  | Vector storage & search                      |
| `@mikesaintsg/contextprotocol` | `ToolFormatAdapterInterface` | Tool registry & execution                    |
| `@mikesaintsg/contextbuilder`  | `TokenAdapterInterface`      | Context assembly & budgeting                 |
| `@mikesaintsg/rater`           | N/A                          | Factor-based rating engine                   |
| `@mikesaintsg/actionloop`      | `ProceduralGraphInterface`   | Predictive workflow guidance                 |

### Dependency Graph

```
                    ┌─────────────────┐
                    │  @mikesaintsg/  │
                    │      core       │
                    │  (types only)   │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌───────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  @mikesaintsg/│  │  @mikesaintsg/  │  │  @mikesaintsg/  │
│   adapters    │  │  contextbuilder │  │ contextprotocol │
└───────┬───────┘  └────────┬────────┘  └────────┬────────┘
        │                   │                    │
        │    ┌──────────────┴──────────────┐     │
        │    │                             │     │
        ▼    ▼                             ▼     ▼
┌───────────────┐                   ┌─────────────────┐
│  @mikesaintsg/│                   │  @mikesaintsg/  │
│   inference   │◄──────────────────│   vectorstore   │
└───────────────┘                   └─────────────────┘
```

### Files Created

| File                             | Purpose                          |
|----------------------------------|----------------------------------|
| `guides/core.md`                 | Core package guide               |
| `types/core/types.ts`            | Core type definitions            |
| `guides/adapters.md`             | Adapters package guide           |
| `types/adapters/types.ts`        | Adapter type definitions         |
| `guides/inference.md`            | Inference package guide          |
| `types/inference/types.ts`       | Inference type definitions       |
| `guides/vectorstore.md`          | VectorStore package guide        |
| `types/vectorstore/types.ts`     | VectorStore type definitions     |
| `guides/contextprotocol.md`      | ContextProtocol package guide    |
| `types/contextprotocol/types.ts` | ContextProtocol type definitions |
| `guides/contextbuilder.md`       | ContextBuilder package guide     |
| `types/contextbuilder/types.ts`  | ContextBuilder type definitions  |
| `guides/rater.md`                | Rater package guide              |
| `types/rater/types.ts`           | Rater type definitions           |
| `guides/actionloop.md`           | ActionLoop package guide         |
| `types/actionloop/types.ts`      | ActionLoop type definitions      |

### Key Design Decisions

1. **Provider/Adapter First**: Every main package requires its primary adapter as the first parameter
2. **Interfaces in Core**: All adapter interfaces defined in `@mikesaintsg/core`
3. **Implementations in Adapters**:  All adapter implementations in `@mikesaintsg/adapters`
4. **Wrapper Pattern**: Retry, cache, batch adapters wrap base adapters
5. **Minimal Bridge Interfaces**: Cross-package integration without hard dependencies
6. **Consistent Factory Pattern**: `create*` functions for all instances
7. **Event Subscriptions**: `on*` methods return `Unsubscribe` cleanup functions
8. **Readonly by Default**: All interfaces use `readonly` properties

---

## 7. @mikesaintsg/actionloop

````markdown name=guides/actionloop.md
# @mikesaintsg/actionloop — Predictive Workflow Guidance

## Purpose

ActionLoop provides predictive workflow guidance through the PPALS (Predict-Present-Act-Learn-Store) cycle. It combines static rules with dynamic learning to guide users through optimal workflows.

## Design Principles

1. **Separation of Concerns**: Static rules (ProceduralGraph) vs dynamic weights (PredictiveGraph)
2. **Composable**: Workflow engine combines graphs with runtime coordination
3. **Decay-based Learning**: Recent behavior weighted more heavily (EWMA)
4. **Session-aware**: Predictions consider session context

## Core Concepts

### ProceduralGraph

Defines valid transitions (static rules):

```ts
import { createProceduralGraph } from '@mikesaintsg/actionloop'

const transitions = [
	{ from: 'landing', to: 'login', weight: 1, actor: 'user' },
	{ from: 'landing', to: 'register', weight: 1, actor: 'user' },
	{ from: 'login', to: 'dashboard', weight: 1, actor: 'user' },
	{ from: 'register', to: 'onboarding', weight: 1, actor: 'user' },
	{ from: 'onboarding', to: 'dashboard', weight: 1, actor: 'user' },
	{ from: 'dashboard', to: 'settings', weight: 1, actor: 'user' },
	{ from: 'dashboard', to: 'profile', weight: 1, actor: 'user' },
] as const

const procedural = createProceduralGraph({
	transitions,
	validateOnCreate: true,
})

// Query valid transitions
const valid = procedural.isValid('dashboard', 'settings') // true
const neighbors = procedural.getNeighbors('dashboard') // ['settings', 'profile']
```

### PredictiveGraph

Learns from user behavior (dynamic weights):

```ts
import { createPredictiveGraph } from '@mikesaintsg/actionloop'

const predictive = createPredictiveGraph(procedural, {
	decayAlgorithm: 'ewma',
	decayFactor: 0.9,
	initialWeight: 0.5,
})

// Update weights based on usage
predictive.recordTransition('dashboard', 'settings', 'user')

// Get predictions
const predictions = predictive.predict('dashboard', { actor: 'user', count: 3 })
// => ['settings', 'profile'] sorted by learned weights

// Export/import for persistence
const exported = predictive.export()
predictive.import(exported)
```

### WorkflowEngine

Orchestrates the PPALS cycle:

```ts
import { createWorkflowEngine } from '@mikesaintsg/actionloop'

const engine = createWorkflowEngine(procedural, predictive, {
	trackSessions: true,
	validateTransitions: true,
})

// Start a session
const session = engine.startSession('user')

// Record transitions
engine.recordTransition('landing', 'login', {
	actor: 'user',
	sessionId: session.id,
	path: '/login',
})

// Get predictions
const predictions = engine.predictNext('dashboard', {
	actor: 'user',
	sessionId: session.id,
	path: '/dashboard',
	count: 3,
})

// With detailed confidence scores
const detailed = engine.predictNextDetailed('dashboard', context)
detailed.predictions.forEach(p => {
	console.log(`${p.nodeId}: ${Math.round(p.confidence * 100)}%`)
})

// End session
engine.endSession(session.id, 'completed')

// Cleanup
engine.destroy()
```

## The PPALS Cycle

1. **Predict**: Use learned weights to predict next likely action
2. **Present**: Show predictions to user (UI integration)
3. **Act**: User selects action (or different one)
4. **Learn**: Update weights based on actual action
5. **Store**: Persist updated weights

```ts
// PPALS in action
async function handleNavigation(from: string, to: string) {
	// 1. Predict (for analytics)
	const predicted = engine.predictNext(from, context)
	const wasPredicted = predicted.includes(to)
	
	// 2. Present (in UI layer)
	// ... render suggested actions
	
	// 3. Act (user navigation)
	engine.recordTransition(from, to, context) // 4. Learn
	
	// 5. Store (periodic or on-demand)
	saveWeights(predictive.export())
}
```

## Decay Algorithms

### EWMA (Exponential Weighted Moving Average)

Default algorithm. Recent events weighted more heavily:

```ts
const predictive = createPredictiveGraph(procedural, {
	decayAlgorithm: 'ewma',
	decayFactor: 0.9, // 0-1, higher = more weight on recent
})
```

### Time-based Decay

Weights decay based on elapsed time:

```ts
const predictive = createPredictiveGraph(procedural, {
	decayAlgorithm: 'time',
	halfLifeMs: 24 * 60 * 60 * 1000, // 24 hours
})
```

## Session Tracking

```ts
const engine = createWorkflowEngine(procedural, predictive, {
	trackSessions: true,
	maxSessionHistory: 100,
})

// Get session history
const chain = engine.getSessionChain('user', {
	limit: 50,
	includeMetadata: true,
})

console.log(`Events: ${chain.events.length}`)
console.log(`Duration: ${chain.totalDuration}ms`)
console.log(`Conversion: ${chain.completed ? 'Yes' : 'No'}`)
```

## API Reference

### Factory Functions

- `createProceduralGraph(options)` → `ProceduralGraphInterface`
- `createPredictiveGraph(procedural, options?)` → `PredictiveGraphInterface`
- `createWorkflowEngine(procedural, predictive, options?)` → `WorkflowEngineInterface`

### ProceduralGraphInterface

- `isValid(from, to)` → `boolean`
- `getNeighbors(nodeId)` → `readonly string[]`
- `getNodes()` → `readonly string[]`
- `getEdges()` → `readonly Edge[]`
- `getWeight(from, to, actor?)` → `number | undefined`

### PredictiveGraphInterface

- `recordTransition(from, to, actor)` → `void`
- `predict(from, options?)` → `readonly string[]`
- `getWeight(from, to, actor)` → `number`
- `setWeight(from, to, actor, weight)` → `void`
- `export()` → `ExportedWeights`
- `import(weights)` → `void`
- `onWeightUpdate(callback)` → `Unsubscribe`
- `reset()` → `void`

### WorkflowEngineInterface

- `startSession(actor, id?)` → `Session`
- `endSession(id, reason)` → `void`
- `resumeSession(id, context)` → `void`
- `recordTransition(from, to, context)` → `void`
- `recordTransitions(batch)` → `void`
- `predictNext(from, context)` → `readonly string[]`
- `predictNextDetailed(from, context)` → `DetailedPredictions`
- `isValidTransition(from, to)` → `boolean`
- `getSessionChain(actor, options?)` → `SessionChain`
- `destroy()` → `void`

### Error Types

```ts
import { isActionLoopError } from '@mikesaintsg/actionloop'

try {
	engine.recordTransition('invalid', 'transition', context)
} catch (error) {
	if (isActionLoopError(error)) {
		switch (error.code) {
			case 'INVALID_TRANSITION':
				console.error('Transition not allowed')
				break
			case 'SESSION_NOT_FOUND':
				console.error('Session expired')
				break
			case 'NODE_NOT_FOUND':
				console.error('Unknown node')
				break
		}
	}
}
```
````

```typescript name=types/actionloop/types.ts
/**
 * @mikesaintsg/actionloop
 *
 * Type definitions for predictive workflow guidance.
 */

import type { Unsubscribe, PackageErrorData } from '@mikesaintsg/core'

// ============================================================================
// Core Types
// ============================================================================

/** Actor type for transitions */
export type Actor = string

/** Node identifier */
export type NodeId = string

/** Edge in the graph */
export interface Edge {
	readonly from: NodeId
	readonly to: NodeId
	readonly weight: number
	readonly actor?: Actor
}

/** Transition definition for procedural graph */
export interface TransitionDefinition {
	readonly from: NodeId
	readonly to: NodeId
	readonly weight: number
	readonly actor: Actor
}

// ============================================================================
// Session Types
// ============================================================================

/** Session state */
export interface Session {
	readonly id: string
	readonly actor: Actor
	readonly startedAt: number
	readonly currentNode?: NodeId
}

/** Session end reason */
export type SessionEndReason = 'completed' | 'abandoned' | 'timeout' | 'error'

/** Session event */
export interface SessionEvent {
	readonly from: NodeId
	readonly to: NodeId
	readonly timestamp: number
	readonly metadata?: Readonly<Record<string, unknown>>
}

/** Session chain for analytics */
export interface SessionChain {
	readonly sessionId: string
	readonly actor: Actor
	readonly events: readonly SessionEvent[]
	readonly startedAt: number
	readonly endedAt?: number
	readonly totalDuration: number
	readonly completed: boolean
	readonly endReason?: SessionEndReason
}

// ============================================================================
// Prediction Types
// ============================================================================

/** Transition context */
export interface TransitionContext {
	readonly actor: Actor
	readonly sessionId?: string
	readonly path?: string
	readonly metadata?: Readonly<Record<string, unknown>>
}

/** Prediction options */
export interface PredictionOptions {
	readonly actor?: Actor
	readonly sessionId?: string
	readonly path?: string
	readonly count?: number
}

/** Detailed prediction result */
export interface PredictionResult {
	readonly nodeId: NodeId
	readonly confidence: number
	readonly weight: number
}

/** Detailed predictions with metadata */
export interface DetailedPredictions {
	readonly predictions: readonly PredictionResult[]
	readonly currentNode: NodeId
	readonly sessionId?: string
	readonly timestamp: number
}

// ============================================================================
// Export/Import Types
// ============================================================================

/** Exported weight entry */
export interface ExportedWeightEntry {
	readonly from: NodeId
	readonly to: NodeId
	readonly actor: Actor
	readonly weight: number
	readonly updatedAt: number
}

/** Exported weights for persistence */
export interface ExportedWeights {
	readonly version: number
	readonly entries: readonly ExportedWeightEntry[]
	readonly exportedAt: number
}

// ============================================================================
// Options Types
// ============================================================================

/** Decay algorithm type */
export type DecayAlgorithm = 'ewma' | 'time' | 'none'

/** Procedural graph options */
export interface ProceduralGraphOptions {
	readonly transitions: readonly TransitionDefinition[]
	readonly validateOnCreate?: boolean
}

/** Predictive graph options */
export interface PredictiveGraphOptions {
	readonly decayAlgorithm?: DecayAlgorithm
	readonly decayFactor?: number
	readonly halfLifeMs?: number
	readonly initialWeight?: number
}

/** Workflow engine options */
export interface WorkflowEngineOptions {
	readonly trackSessions?: boolean
	readonly validateTransitions?: boolean
	readonly maxSessionHistory?: number
	readonly onTransition?: (from: NodeId, to: NodeId, context: TransitionContext) => void
}

/** Session chain query options */
export interface SessionChainOptions {
	readonly limit?: number
	readonly includeMetadata?: boolean
}

// ============================================================================
// Error Types
// ============================================================================

/** ActionLoop error codes */
export type ActionLoopErrorCode =
	| 'INVALID_TRANSITION'
	| 'SESSION_NOT_FOUND'
	| 'NODE_NOT_FOUND'
	| 'VALIDATION_FAILED'
	| 'UNKNOWN'

/** ActionLoop error data */
export interface ActionLoopErrorData extends PackageErrorData<ActionLoopErrorCode> {
	readonly from?: NodeId
	readonly to?: NodeId
	readonly sessionId?: string
}

// ============================================================================
// Behavioral Interfaces
// ============================================================================

/**
 * Procedural graph interface - defines valid transitions (static).
 */
export interface ProceduralGraphInterface {
	/** Check if transition is valid */
	isValid(from: NodeId, to: NodeId): boolean

	/** Get valid neighbors from a node */
	getNeighbors(nodeId: NodeId): readonly NodeId[]

	/** Get all nodes */
	getNodes(): readonly NodeId[]

	/** Get all edges */
	getEdges(): readonly Edge[]

	/** Get edge weight */
	getWeight(from: NodeId, to: NodeId, actor?: Actor): number | undefined
}

/**
 * Predictive graph interface - learns from behavior (dynamic).
 */
export interface PredictiveGraphInterface {
	/** Record a transition to update weights */
	recordTransition(from: NodeId, to: NodeId, actor: Actor): void

	/** Get predictions from a node */
	predict(from: NodeId, options?: PredictionOptions): readonly NodeId[]

	/** Get current weight for an edge */
	getWeight(from: NodeId, to: NodeId, actor: Actor): number

	/** Set weight for an edge */
	setWeight(from: NodeId, to: NodeId, actor: Actor, weight: number): void

	/** Export weights for persistence */
	export(): ExportedWeights

	/** Import weights from storage */
	import(weights: ExportedWeights): void

	/** Subscribe to weight updates */
	onWeightUpdate(callback: (from: NodeId, to: NodeId, actor: Actor, weight: number) => void): Unsubscribe

	/** Reset all learned weights */
	reset(): void
}

/**
 * Workflow engine interface - orchestrates the PPALS cycle.
 */
export interface WorkflowEngineInterface {
	// ---- Session Management ----

	/** Start a new session */
	startSession(actor: Actor, id?: string): Session

	/** End a session */
	endSession(id: string, reason: SessionEndReason): void

	/** Resume an existing session */
	resumeSession(id: string, context: { previousNode: NodeId; actor: Actor }): void

	// ---- Transitions ----

	/** Record a single transition */
	recordTransition(from: NodeId, to: NodeId, context: TransitionContext): void

	/** Record multiple transitions in batch */
	recordTransitions(batch: readonly { from: NodeId; to: NodeId; context: TransitionContext }[]): void

	// ---- Predictions ----

	/** Get predictions for next node */
	predictNext(from: NodeId, context: TransitionContext & { count?: number }): readonly NodeId[]

	/** Get detailed predictions with confidence scores */
	predictNextDetailed(from: NodeId, context: TransitionContext & { count?: number }): DetailedPredictions

	// ---- Validation ----

	/** Check if transition is valid */
	isValidTransition(from: NodeId, to: NodeId): boolean

	// ---- Analytics ----

	/** Get session chain for analytics */
	getSessionChain(actor: Actor, options?: SessionChainOptions): SessionChain

	// ---- Lifecycle ----

	/** Destroy engine and cleanup resources */
	destroy(): void
}

// ============================================================================
// Factory Function Types
// ============================================================================

/** Factory for procedural graph */
export type CreateProceduralGraph = (
	options: ProceduralGraphOptions
) => ProceduralGraphInterface

/** Factory for predictive graph */
export type CreatePredictiveGraph = (
	procedural: ProceduralGraphInterface,
	options?: PredictiveGraphOptions
) => PredictiveGraphInterface

/** Factory for workflow engine */
export type CreateWorkflowEngine = (
	procedural: ProceduralGraphInterface,
	predictive: PredictiveGraphInterface,
	options?: WorkflowEngineOptions
) => WorkflowEngineInterface
```
