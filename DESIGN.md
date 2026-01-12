# IndexedDB Wrapper Library Design Document

> **Package:** `@anthropic/indexeddb`  
> **Status:** Design Phase  
> **Last Updated:** 2026-01-12

---

## Table of Contents

1. [Vision](#vision)
2. [Non-Goals](#non-goals)
3. [Design Philosophy](#design-philosophy)
4. [Architecture](#architecture)
5. [API Reference](#api-reference)
6. [Query Builder](#query-builder)
7. [Error Handling](#error-handling)
8. [Performance Strategy](#performance-strategy)
9. [Reactivity](#reactivity)
10. [Migrations](#migrations)
11. [Implementation Phases](#implementation-phases)
12. [Testing Strategy](#testing-strategy)

---

## Vision

A focused IndexedDB wrapper that **enhances** the native API without abstracting it away.  Developers get type safety, Promise-based operations, and ergonomic helpers while retaining full access to native IndexedDB when needed.

### Value Proposition

| Native IndexedDB              | This Library                        |
|-------------------------------|-------------------------------------|
| Request/event callbacks       | Promise-based async/await           |
| No type safety                | Generic schema types                |
| Verbose cursor iteration      | Async generators with early break   |
| Manual transaction management | Auto-batching, explicit when needed |
| No cross-tab sync             | Built-in BroadcastChannel sync      |

### Quick Example

```typescript
// Define schema
interface AppSchema {
	readonly users: User
	readonly posts: Post
}

// Create database
const db = await createDatabase<AppSchema>({
	name: 'myApp',
	version:  1,
	stores: {
		users: {}, // keyPath: 'id' (default)
		posts: {
			indexes: [{ name: 'byAuthor', keyPath: 'authorId' }]
		}
	}
})

// Simple operations
const user = await db. store('users').get('u1')        // User | undefined
const user = await db.store('users').resolve('u1')    // User (throws if missing)
await db.store('users').set({ id: 'u1', name: 'Alice' })

// Batch operations (single transaction)
await db.store('users').set([user1, user2, user3])

// Query builder
const active = await db.store('users').query()
	.where('status').equals('active')
	.limit(10)
	.toArray()

// Need native access? It's there. 
const nativeStore = db.store('users').native
```

---

## Non-Goals

Explicit boundaries—what we are **NOT** building: 

| ❌ Not Building          | Reason                                    |
|-------------------------|-------------------------------------------|
| ORM/Relations           | App-layer concern, adds complexity        |
| Sync protocol           | Use dedicated sync libraries              |
| Full-text search        | Use dedicated search libraries            |
| Schema inference        | Explicit schemas are safer                |
| Cross-field OR          | IndexedDB limitation, use filter()        |
| Populate/Join           | Denormalize or fetch separately           |
| Offline-first framework | We're a database wrapper, not a framework |

---

## Design Philosophy

### 1. Enhance, Don't Abstract

Stay close to IndexedDB semantics.  Our API should feel familiar to anyone who knows IndexedDB. 

```typescript
// Native IndexedDB
const tx = db.transaction('users', 'readonly')
const store = tx.objectStore('users')
const request = store.get(key)
request.onsuccess = () => console.log(request. result)

// Our wrapper - same concepts, better ergonomics
const user = await db.store('users').get(key)

// Need native? It's there. 
const nativeDb = db.native           // IDBDatabase
const nativeTx = db.read('users')    // IDBTransaction
```

### 2. Simple Return Types

No Result wrappers. Methods return values directly or throw.

```typescript
// ✅ Simple and direct
const user = await store.get('u1')        // User | undefined
const user = await store.resolve('u1')    // User (throws if missing)
const key = await store.set(user)         // ValidKey
const count = await store.count()         // number
const exists = await store.has('u1')      // boolean

// ❌ NOT this (over-engineered)
const result = await store.get('u1')
if (result. ok) {
	if (result.value) { /* double-checking */ }
}
```

### 3. Exceptions for Infrastructure Errors

Missing records are **data**, not errors. Infrastructure failures throw.

| Scenario            | Behavior                           | Rationale              |
|---------------------|------------------------------------|------------------------|
| Record not found    | `get()` returns `undefined`        | Absence is valid data  |
| Record must exist   | `resolve()` throws `NotFoundError` | Explicit expectation   |
| Key exists on add   | `add()` throws `ConstraintError`   | Uniqueness violated    |
| Quota exceeded      | Throws `QuotaExceededError`        | Infrastructure failure |
| Transaction aborted | Throws `TransactionError`          | Infrastructure failure |

### 4. Unified Single/Array Methods

Same method handles both.  Arrays auto-batch in single transaction.

```typescript
// Single
await store.get('u1')              // User | undefined
await store.set(user)              // ValidKey

// Array (auto-batched)
await store.get(['u1', 'u2'])      // readonly (User | undefined)[]
await store.set([user1, user2])    // readonly ValidKey[]
```

### 5. Sensible Defaults

```typescript
// Default store definition
{
	keyPath: 'id',           // Most common pattern
	autoIncrement: false,    // Explicit IDs (UUIDs)
	indexes: []
}

// Usage
stores: {
	users: {},                           // Uses defaults
	logs: { keyPath: null, autoIncrement:  true }  // Explicit out-of-line
}
```

### 6. Native Escape Hatches

Every wrapper exposes its underlying native object: 

```typescript
db.native                    // IDBDatabase
db.store('users').native     // IDBObjectStore (in transaction)
cursor.native                // IDBCursorWithValue
transaction.native           // IDBTransaction
```

---

## Architecture

### File Structure

```
src/
├── types.ts              # All interfaces (SOURCE OF TRUTH)
├── errors.ts             # Error classes
├── constants.ts          # Defaults, error codes
├── helpers.ts            # promisifyRequest, type guards, utilities
├── factories.ts          # createDatabase
├── index.ts              # Barrel exports
└── core/
    ├── Database.ts       # DatabaseInterface implementation
    ├── Store.ts          # StoreInterface implementation
    ├── Index.ts          # IndexInterface implementation
    ├── Transaction.ts    # TransactionInterface implementation
    ├── Cursor.ts         # CursorInterface implementation
    └── QueryBuilder.ts   # QueryBuilderInterface implementation
```

### Dependency Graph

```
factories. ts
    │
    ▼
Database.ts ──────────────────┐
    │                         │
    ▼                         ▼
Store.ts                 Transaction.ts
    │                         │
    ├──────┬──────┐          │
    ▼      ▼      ▼          │
Index.ts  Cursor.ts  QueryBuilder.ts
                              │
    ◄─────────────────────────┘
```

### Core Helpers

```typescript
// Essential promise wrappers (from lowapi pattern)
function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result)
		request.onerror = () => reject(wrapError(request. error))
	})
}

function promisifyTransaction(transaction: IDBTransaction): Promise<void> {
	return new Promise((resolve, reject) => {
		transaction.oncomplete = () => resolve()
		transaction.onerror = () => reject(wrapError(transaction.error))
		transaction.onabort = () => reject(new TransactionError(
			'TRANSACTION_ABORTED',
			'Transaction was aborted'
		))
	})
}
```

---

## API Reference

### Factory Functions

#### `createDatabase<Schema>(options): Promise<DatabaseInterface<Schema>>`

Opens or creates a database with the specified schema. 

```typescript
const db = await createDatabase<MySchema>({
	name: 'myApp',
	version: 1,
	stores: {
		users: {},
		posts: {
			keyPath: 'slug',
			indexes:  [
				{ name: 'byAuthor', keyPath: 'authorId' },
				{ name:  'byTags', keyPath:  'tags', multiEntry: true }
			]
		}
	},
	migrations: [
		{ version: 2, migrate: (ctx) => { /* ... */ } }
	],
	// Optional hooks
	onChange: (event) => console.log(event),
	onError:  (error) => reportError(error),
	onBlocked: () => showBlockedMessage()
})
```

---

### DatabaseInterface

```typescript
interface DatabaseInterface<Schema> extends DatabaseSubscriptions {
	// Native access
	readonly native: IDBDatabase

	// Accessors
	getName(): string
	getVersion(): number
	getStoreNames(): readonly string[]
	isOpen(): boolean

	// Store access
	store<K extends keyof Schema & string>(name: K): StoreInterface<Schema[K]>

	// Transactions
	transaction<K extends keyof Schema & string>(
		storeNames: readonly K[],
		mode: TransactionMode,
		operation:  (tx: TransactionInterface<Schema, K>) => Promise<void> | void,
		options?: TransactionOptions
	): Promise<void>

	// Transaction shortcuts (return native for advanced use)
	read<K extends keyof Schema & string>(storeNames: K | readonly K[]): IDBTransaction
	write<K extends keyof Schema & string>(storeNames:  K | readonly K[]): IDBTransaction

	// Lifecycle
	close(): void
	drop(): Promise<void>
}
```

**Usage:**

```typescript
// Access store
const userStore = db.store('users')

// Explicit transaction for multi-store operations
await db.transaction(['users', 'posts'], 'readwrite', async (tx) => {
	const user = await tx.store('users').resolve('u1')
	await tx.store('posts').set({ ... post, authorId: user.id })
})

// Native transaction for advanced patterns
const tx = db.write('users')
const store = tx.objectStore('users')
// ...  use native APIs
```

---

### StoreInterface

```typescript
interface StoreInterface<T> extends StoreSubscriptions {
	// Native access (requires active transaction)
	readonly native: IDBObjectStore

	// Accessors
	getName(): string
	getKeyPath(): KeyPath | null
	getIndexNames(): readonly string[]
	hasAutoIncrement(): boolean

	// Get (undefined for missing)
	get(key: ValidKey): Promise<T | undefined>
	get(keys: readonly ValidKey[]): Promise<readonly (T | undefined)[]>

	// Resolve (throws for missing)
	resolve(key:  ValidKey): Promise<T>
	resolve(keys: readonly ValidKey[]): Promise<readonly T[]>

	// Set (upsert)
	set(value: T, key?: ValidKey): Promise<ValidKey>
	set(values: readonly T[]): Promise<readonly ValidKey[]>

	// Add (insert only, throws if exists)
	add(value: T, key?: ValidKey): Promise<ValidKey>
	add(values:  readonly T[]): Promise<readonly ValidKey[]>

	// Remove (no error if missing)
	remove(key: ValidKey): Promise<void>
	remove(keys: readonly ValidKey[]): Promise<void>

	// Has
	has(key: ValidKey): Promise<boolean>
	has(keys: readonly ValidKey[]): Promise<readonly boolean[]>

	// Bulk operations
	all(query?: IDBKeyRange | null, count?: number): Promise<readonly T[]>
	keys(query?: IDBKeyRange | null, count?: number): Promise<readonly ValidKey[]>
	clear(): Promise<void>
	count(query?: IDBKeyRange | ValidKey | null): Promise<number>

	// Query builder
	query(): QueryBuilderInterface<T>

	// Index access
	index(name: string): IndexInterface<T>

	// Cursor (async generator)
	iterate(options?: IterateOptions): AsyncGenerator<T, void, unknown>
	iterateKeys(options?: IterateOptions): AsyncGenerator<ValidKey, void, unknown>

	// Manual cursor (for update/delete during iteration)
	openCursor(options?:  CursorOptions): Promise<CursorInterface<T> | null>
	openKeyCursor(options?:  CursorOptions): Promise<KeyCursorInterface | null>
}
```

**Usage:**

```typescript
const store = db.store('users')

// Simple get
const user = await store.get('u1')
if (user) {
	console.log(user. name)
}

// Must exist
const user = await store.resolve('u1')  // Throws if missing

// Batch (single transaction)
const keys = await store.set([user1, user2, user3])

// Query
const active = await store.query()
	.where('status').equals('active')
	.limit(10)
	.toArray()

// Efficient iteration
for await (const user of store.iterate()) {
	console. log(user.name)
	if (shouldStop) break  // Clean early termination
}

// Index query
const byEmail = await store.index('byEmail').get('alice@example.com')
```

---

### IndexInterface

```typescript
interface IndexInterface<T> {
	// Native access
	readonly native:  IDBIndex

	// Accessors
	getName(): string
	getKeyPath(): KeyPath
	isUnique(): boolean
	isMultiEntry(): boolean

	// Get (undefined for missing)
	get(key:  ValidKey): Promise<T | undefined>
	get(keys:  readonly ValidKey[]): Promise<readonly (T | undefined)[]>

	// Resolve (throws for missing)
	resolve(key: ValidKey): Promise<T>
	resolve(keys: readonly ValidKey[]): Promise<readonly T[]>

	// Get primary key
	getKey(key: ValidKey): Promise<ValidKey | undefined>

	// Bulk
	all(query?: IDBKeyRange | null, count?:  number): Promise<readonly T[]>
	keys(query?:  IDBKeyRange | null, count?: number): Promise<readonly ValidKey[]>
	count(query?: IDBKeyRange | ValidKey | null): Promise<number>

	// Query
	query(): QueryBuilderInterface<T>

	// Iteration
	iterate(options?: IterateOptions): AsyncGenerator<T, void, unknown>
	iterateKeys(options?: IterateOptions): AsyncGenerator<ValidKey, void, unknown>
}
```

---

### TransactionInterface

```typescript
interface TransactionInterface<Schema, K extends keyof Schema> {
	// Native access
	readonly native:  IDBTransaction

	// Accessors
	getMode(): TransactionMode
	getStoreNames(): readonly string[]
	isActive(): boolean
	isFinished(): boolean

	// Store access (within transaction)
	store<S extends K & string>(name: S): TransactionStoreInterface<Schema[S]>

	// Control
	abort(): void
	commit(): void  // Explicit commit (when supported)
}
```

**Usage:**

```typescript
await db.transaction(['users', 'posts'], 'readwrite', async (tx) => {
	// All operations share one transaction
	const user = await tx.store('users').resolve('u1')
	
	const newPost = {
		id: crypto.randomUUID(),
		title: 'New Post',
		authorId: user.id
	}
	await tx.store('posts').set(newPost)
	
	// Update user's post count
	await tx.store('users').set({
		... user,
		postCount: user.postCount + 1
	})
	
	// Transaction commits on success, aborts on error
})
```

---

### CursorInterface

```typescript
interface CursorInterface<T> {
	// Native access
	readonly native: IDBCursorWithValue

	// Accessors
	getKey(): ValidKey
	getPrimaryKey(): ValidKey
	getValue(): T
	getDirection(): CursorDirection

	// Navigation (returns null at end)
	continue(key?:  ValidKey): Promise<CursorInterface<T> | null>
	continuePrimaryKey(key:  ValidKey, primaryKey: ValidKey): Promise<CursorInterface<T> | null>
	advance(count: number): Promise<CursorInterface<T> | null>

	// Mutation (within readwrite transaction)
	update(value: T): Promise<ValidKey>
	delete(): Promise<void>
}
```

**Usage (manual cursor for mutation):**

```typescript
await db.transaction(['users'], 'readwrite', async (tx) => {
	let cursor = await tx.store('users').openCursor()
	
	while (cursor) {
		const user = cursor.getValue()
		
		if (user. status === 'inactive') {
			await cursor.delete()
		} else if (user.needsUpdate) {
			await cursor.update({ ... user, updatedAt: Date. now() })
		}
		
		cursor = await cursor. continue()
	}
})
```

---

## Query Builder

### Design Principle

**Only expose what IndexedDB natively supports efficiently.**

The query builder maps directly to IndexedDB's `IDBKeyRange` operations.  Non-native operations use `filter()` which applies post-cursor. 

### Native Operations (Fast)

| Method                  | IDBKeyRange                          | Index Required |
|-------------------------|--------------------------------------|----------------|
| `equals(v)`             | `IDBKeyRange.only(v)`                | Yes            |
| `greaterThan(v)`        | `IDBKeyRange.lowerBound(v, true)`    | Yes            |
| `greaterThanOrEqual(v)` | `IDBKeyRange.lowerBound(v, false)`   | Yes            |
| `lessThan(v)`           | `IDBKeyRange.upperBound(v, true)`    | Yes            |
| `lessThanOrEqual(v)`    | `IDBKeyRange.upperBound(v, false)`   | Yes            |
| `between(a, b)`         | `IDBKeyRange.bound(a, b)`            | Yes            |
| `startsWith(s)`         | `IDBKeyRange.bound(s, s + '\uffff')` | Yes            |
| `anyOf([... ])`         | Multiple queries, merged             | Yes            |

### Non-Native Operations (Use filter())

| Operation      | Why Not Native   | Solution                              |
|----------------|------------------|---------------------------------------|
| `endsWith()`   | No index support | `filter(x => x.field.endsWith(... ))` |
| `contains()`   | No index support | `filter(x => x.field.includes(...))`  |
| `regex`        | No index support | `filter(x => pattern.test(x. field))` |
| Cross-field OR | Not supported    | Separate queries + merge              |

### QueryBuilderInterface

```typescript
interface QueryBuilderInterface<T> {
	// Indexed query (FAST - uses IDBKeyRange)
	where(keyPath: string): WhereClauseInterface<T>

	// Post-cursor filter (flexible, applied after retrieval)
	filter(predicate: (value: T) => boolean): QueryBuilderInterface<T>

	// Ordering
	orderBy(direction: OrderDirection): QueryBuilderInterface<T>

	// Pagination
	limit(count: number): QueryBuilderInterface<T>
	offset(count: number): QueryBuilderInterface<T>

	// Terminal operations
	toArray(): Promise<readonly T[]>
	first(): Promise<T | undefined>
	count(): Promise<number>
	keys(): Promise<readonly ValidKey[]>

	// Memory-efficient iteration
	iterate(): AsyncGenerator<T, void, unknown>
}
```

### WhereClauseInterface

```typescript
interface WhereClauseInterface<T> {
	equals(value: ValidKey): QueryBuilderInterface<T>
	greaterThan(value:  ValidKey): QueryBuilderInterface<T>
	greaterThanOrEqual(value: ValidKey): QueryBuilderInterface<T>
	lessThan(value: ValidKey): QueryBuilderInterface<T>
	lessThanOrEqual(value: ValidKey): QueryBuilderInterface<T>
	between(lower: ValidKey, upper: ValidKey, options?: BetweenOptions): QueryBuilderInterface<T>
	startsWith(prefix: string): QueryBuilderInterface<T>
	anyOf(values: readonly ValidKey[]): QueryBuilderInterface<T>
}
```

### Usage Examples

```typescript
// Native query (fast - uses index)
const activeUsers = await store.query()
	.where('status').equals('active')
	.toArray()

// Range query
const recentPosts = await store.query()
	.where('createdAt').greaterThan(lastWeek)
	.orderBy('descending')
	.limit(20)
	.toArray()

// Prefix search (native)
const smiths = await store.query()
	.where('lastName').startsWith('Smith')
	.toArray()

// Multiple values (runs parallel queries, merges)
const priorityUsers = await store.query()
	.where('role').anyOf(['admin', 'moderator', 'vip'])
	.toArray()

// Filter for non-indexed conditions
const gmailUsers = await store.query()
	.filter(user => user.email. endsWith('@gmail. com'))
	.toArray()

// Combined:  native first, then filter
const activeGmailUsers = await store.query()
	.where('status').equals('active')
	.filter(user => user.email.endsWith('@gmail.com'))
	.toArray()

// Memory-efficient iteration
for await (const user of store.query().where('status').equals('active').iterate()) {
	processUser(user)
	if (done) break
}
```

### anyOf Implementation Strategy

```typescript
// Internally:  runs multiple queries, dedupes by primary key
async function anyOf<T>(index: IDBIndex, values:  ValidKey[]): Promise<T[]> {
	const results = new Map<ValidKey, T>()  // Dedupe by primary key
	
	await Promise.all(values.map(async (value) => {
		const items = await promisifyRequest(index.all(value))
		for (const item of items) {
			const key = extractPrimaryKey(item)
			results.set(key, item)
		}
	}))
	
	return Array.from(results. values())
}
```

---

## Error Handling

### Error Classes

```typescript
// Base error
class DatabaseError extends Error {
	readonly code: DatabaseErrorCode
	readonly cause?: unknown
	
	constructor(code:  DatabaseErrorCode, message: string, cause?:  unknown) {
		super(message)
		this.name = 'DatabaseError'
		this. code = code
		this.cause = cause
	}
}

// Specific errors
class NotFoundError extends DatabaseError {
	readonly key: ValidKey
	readonly storeName: string
	
	constructor(storeName: string, key: ValidKey) {
		super('NOT_FOUND', `Record not found in "${storeName}" with key:  ${key}`)
		this.name = 'NotFoundError'
		this.storeName = storeName
		this. key = key
	}
}

class ConstraintError extends DatabaseError {
	readonly key: ValidKey
	readonly storeName: string
	
	constructor(storeName: string, key:  ValidKey) {
		super('CONSTRAINT_ERROR', `Key already exists in "${storeName}": ${key}`)
		this.name = 'ConstraintError'
		this.storeName = storeName
		this.key = key
	}
}

class QuotaExceededError extends DatabaseError {
	constructor() {
		super('QUOTA_EXCEEDED', 'Storage quota exceeded')
		this.name = 'QuotaExceededError'
	}
}

class TransactionError extends DatabaseError {
	constructor(code: 'TRANSACTION_ABORTED' | 'TRANSACTION_INACTIVE', message: string) {
		super(code, message)
		this.name = 'TransactionError'
	}
}

class UpgradeError extends DatabaseError {
	constructor(code: 'UPGRADE_FAILED' | 'UPGRADE_BLOCKED', message: string) {
		super(code, message)
		this.name = 'UpgradeError'
	}
}
```

### Error Mapping from Native

```typescript
function wrapError(error:  DOMException | null, context?:  ErrorContext): DatabaseError {
	if (!error) {
		return new DatabaseError('UNKNOWN_ERROR', 'Unknown error occurred')
	}
	
	switch (error.name) {
		case 'ConstraintError': 
			return new ConstraintError(context?. storeName ??  '', context?.key ??  '')
		case 'QuotaExceededError':
			return new QuotaExceededError()
		case 'TransactionInactiveError': 
			return new TransactionError('TRANSACTION_INACTIVE', error.message)
		case 'AbortError':
			return new TransactionError('TRANSACTION_ABORTED', error. message)
		case 'VersionError':
			return new DatabaseError('VERSION_ERROR', error. message)
		case 'DataError':
			return new DatabaseError('DATA_ERROR', error. message)
		default:
			return new DatabaseError('UNKNOWN_ERROR', error. message, error)
	}
}
```

### Error Handling Patterns

```typescript
// Simple case - missing is just undefined
const user = await store.get('u1')
if (user) {
	console.log(user. name)
}

// Must exist case
try {
	const user = await store. resolve('u1')
	console.log(user.name)
} catch (error) {
	if (error instanceof NotFoundError) {
		console.log(`User ${error.key} not found in ${error.storeName}`)
	}
}

// Insert with uniqueness check
try {
	await store.add({ id: 'u1', name: 'Alice' })
} catch (error) {
	if (error instanceof ConstraintError) {
		console.log('User already exists, updating instead')
		await store.set({ id: 'u1', name:  'Alice' })
	}
}

// Infrastructure errors
try {
	await store.set(largeData)
} catch (error) {
	if (error instanceof QuotaExceededError) {
		showStorageFullMessage()
	} else if (error instanceof TransactionError) {
		console.log('Transaction failed:', error.code)
	}
}
```

### Type Guards

```typescript
function isNotFoundError(error: unknown): error is NotFoundError {
	return error instanceof NotFoundError
}

function isConstraintError(error: unknown): error is ConstraintError {
	return error instanceof ConstraintError
}

function isDatabaseError(error:  unknown): error is DatabaseError {
	return error instanceof DatabaseError
}
```

---

## Performance Strategy

### 1. Automatic Transaction Batching

Array inputs use single transaction: 

```typescript
// ✅ One transaction, 100 operations
await store.set(arrayOf100Users)

// ❌ 100 transactions (if done naively)
for (const user of users) {
	await store.set(user)
}
```

### 2. Lazy Connection

Database connection opens on first operation, not on `createDatabase()`:

```typescript
const db = await createDatabase(options)  // Fast - just setup
await db.store('users').get('u1')         // Connection opens here
```

**Implementation:**

```typescript
class Database<Schema> implements DatabaseInterface<Schema> {
	#db: IDBDatabase | null = null
	#opening:  Promise<IDBDatabase> | null = null
	
	async #ensureOpen(): Promise<IDBDatabase> {
		if (this. #db) return this.#db
		if (this.#opening) return this.#opening
		
		this. #opening = this. #open()
		this.#db = await this.#opening
		this.#opening = null
		return this. #db
	}
}
```

### 3. Cursor Streaming with Async Generators

Memory-efficient iteration without loading all records:

```typescript
async *iterate(options?:  IterateOptions): AsyncGenerator<T, void, unknown> {
	const tx = this.#db.transaction(this.#storeName, 'readonly')
	const store = tx.objectStore(this.#storeName)
	const request = store.openCursor(options?. query, options?.direction)
	
	while (true) {
		const cursor = await promisifyRequest(request)
		if (!cursor) break
		
		yield cursor.value as T
		cursor.continue()
	}
}

// Usage - only one record in memory at a time
for await (const user of store.iterate()) {
	processUser(user)
	if (done) break  // Clean early termination
}
```

### 4. Transaction Durability Hints

```typescript
await db.transaction(['users'], 'readwrite', async (tx) => {
	await tx.store('users').set(user)
}, { durability: 'relaxed' })  // Faster writes (Chrome)
```

### 5. Parallel Query Execution

For `anyOf()`, run queries in parallel: 

```typescript
// Parallel execution, single merged result
const results = await Promise.all(
	values.map(value => index.all(value))
)
```

### 6. Index-Aware Queries

Query builder validates index existence and logs warnings:

```typescript
where(keyPath: string): WhereClauseInterface<T> {
	if (!this.#hasIndex(keyPath) && keyPath !== this.#keyPath) {
		console.warn(`No index for "${keyPath}" - query will scan all records`)
	}
	return new WhereClause(this, keyPath)
}
```

---

## Reactivity

### Change Events

```typescript
interface ChangeEvent {
	readonly storeName: string
	readonly type: 'set' | 'add' | 'remove' | 'clear'
	readonly keys: readonly ValidKey[]
	readonly source: 'local' | 'remote'
}
```

### Implementation Strategy

1. **Local changes**: Intercept write operations, emit events
2. **Cross-tab sync**: Use `BroadcastChannel` API (native, zero overhead)

```typescript
class Database<Schema> {
	#channel: BroadcastChannel | null = null
	#changeListeners = new Set<ChangeCallback>()
	
	constructor(options: DatabaseOptions<Schema>) {
		if (options.crossTabSync !== false) {
			this.#channel = new BroadcastChannel(`idb: ${options.name}`)
			this.#channel. onmessage = (event) => {
				this.#emitChange({ ... event. data, source: 'remote' })
			}
		}
	}
	
	#emitChange(event: ChangeEvent): void {
		for (const callback of this.#changeListeners) {
			callback(event)
		}
	}
	
	#notifyChange(storeName: string, type: ChangeType, keys: ValidKey[]): void {
		const event: ChangeEvent = { storeName, type, keys, source: 'local' }
		this.#emitChange(event)
		this.#channel?.postMessage(event)
	}
}
```

### Subscription API

```typescript
// Database level (all stores)
const unsub = db.onChange((event) => {
	console.log(`${event.storeName}:  ${event.type}`, event.keys)
	if (event.source === 'remote') {
		refreshUI()
	}
})

// Store level
const unsub = db.store('users').onChange((event) => {
	if (event.type === 'set') {
		invalidateUserCache(event.keys)
	}
})

// Error events
const unsub = db. onError((error) => {
	reportToSentry(error)
})

// Cleanup
unsub()
```

---

## Migrations

### Migration Definition

```typescript
interface Migration {
	readonly version: number
	readonly migrate: (context: MigrationContext) => void | Promise<void>
}

interface MigrationContext {
	readonly database: IDBDatabase
	readonly transaction: IDBTransaction
	readonly oldVersion: number
	readonly newVersion: number
}
```

### Migration Execution

Migrations run inside the `onupgradeneeded` callback:

```typescript
request.onupgradeneeded = async (event) => {
	const db = request.result
	const tx = request.transaction! 
	const oldVersion = event.oldVersion
	const newVersion = event. newVersion! 
	
	// Create new stores (from schema diff)
	for (const [name, def] of Object.entries(options. stores)) {
		if (!db.objectStoreNames.contains(name)) {
			createStore(db, name, def)
		}
	}
	
	// Run migrations in order
	for (const migration of options.migrations ??  []) {
		if (migration.version > oldVersion && migration.version <= newVersion) {
			await migration.migrate({ database: db, transaction: tx, oldVersion, newVersion })
		}
	}
}
```

### Example Migration

```typescript
const db = await createDatabase<MySchema>({
	name: 'myApp',
	version: 3,
	stores: {
		users: {},
		posts: {}
	},
	migrations: [
		{
			// v1 -> v2: Add email index
			version: 2,
			migrate:  (ctx) => {
				const store = ctx.transaction.objectStore('users')
				store.createIndex('byEmail', 'email', { unique: true })
			}
		},
		{
			// v2 -> v3: Normalize data
			version:  3,
			migrate: async (ctx) => {
				const store = ctx.transaction.objectStore('users')
				const request = store.openCursor()
				
				await new Promise<void>((resolve, reject) => {
					request.onsuccess = () => {
						const cursor = request.result
						if (! cursor) {
							resolve()
							return
						}
						
						const user = cursor.value
						if (user.fullName && ! user.firstName) {
							const [firstName, ... rest] = user. fullName.split(' ')
							cursor.update({
								... user,
								firstName,
								lastName: rest.join(' ')
							})
						}
						cursor.continue()
					}
					request.onerror = () => reject(request.error)
				})
			}
		}
	]
})
```

---

## Implementation Phases

### Phase 1: Foundation

| Deliverable    | Description                                             |
|----------------|---------------------------------------------------------|
| `types.ts`     | All interfaces and type definitions                     |
| `errors.ts`    | Error classes                                           |
| `constants.ts` | Defaults and error codes                                |
| `helpers.ts`   | `promisifyRequest`, `promisifyTransaction`, type guards |

### Phase 2: Core Database

| Deliverable    | Description                            |
|----------------|----------------------------------------|
| `Database.ts`  | Database implementation with lazy open |
| `factories.ts` | `createDatabase`                       |
| Store access   | `db.store()` returning StoreInterface  |

### Phase 3: Store Operations

| Deliverable      | Description                        |
|------------------|------------------------------------|
| `Store.ts`       | Full StoreInterface implementation |
| get/resolve      | Single and array overloads         |
| set/add          | Upsert and insert operations       |
| remove/has/clear | Deletion and existence checks      |
| Batching         | Auto-transaction for arrays        |

### Phase 4: Indexes and Cursors

| Deliverable | Description                            |
|-------------|----------------------------------------|
| `Index.ts`  | IndexInterface implementation          |
| `Cursor.ts` | CursorInterface implementation         |
| Iteration   | Async generators for memory efficiency |

### Phase 5: Query Builder

| Deliverable       | Description                |
|-------------------|----------------------------|
| `QueryBuilder.ts` | Fluent query API           |
| Where clauses     | All IDBKeyRange operations |
| `anyOf`           | Multi-value queries        |
| `filter`          | Post-cursor predicates     |

### Phase 6: Transactions

| Deliverable      | Description                   |
|------------------|-------------------------------|
| `Transaction.ts` | Explicit transaction API      |
| Multi-store      | Cross-store atomic operations |
| Durability       | Durability hints support      |

### Phase 7: Reactivity

| Deliverable    | Description                  |
|----------------|------------------------------|
| Change events  | Local change tracking        |
| Cross-tab sync | BroadcastChannel integration |
| Subscriptions  | Event subscription API       |

### Phase 8: Polish

| Deliverable   | Description              |
|---------------|--------------------------|
| Migrations    | Version migration system |
| Tests         | Full test coverage       |
| Documentation | API docs and examples    |

---

## Testing Strategy

### Test Environment

- **Vitest** with **Playwright** browser mode
- Real IndexedDB (no mocks)
- Isolated databases per test

### Test Structure

```
tests/
├── helpers.test.ts           # promisifyRequest, type guards
├── errors.test.ts            # Error classes
├── core/
│   ├── Database.test.ts      # Database operations
│   ├── Store.test.ts         # Store CRUD
│   ├── Index.test.ts         # Index queries
│   ├── Cursor. test.ts        # Cursor iteration
│   ├── QueryBuilder.test.ts  # Query builder
│   └── Transaction.test. ts   # Transaction handling
├── integration/
│   ├── crud.test.ts          # Full CRUD workflows
│   ├── migrations.test.ts    # Schema migrations
│   ├── cross-tab. test.ts     # Cross-tab sync
│   └── performance.test.ts   # Batching, large datasets
```

### Example Test

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createDatabase } from '../src/factories. js'
import { NotFoundError, ConstraintError } from '../src/errors.js'
import type { DatabaseInterface } from '../src/types.js'

interface TestUser {
	readonly id: string
	readonly name: string
	readonly email: string
}

interface TestSchema {
	readonly users: TestUser
}

describe('Store', () => {
	let db: DatabaseInterface<TestSchema>
	const dbName = `test-${crypto.randomUUID()}`
	
	beforeEach(async () => {
		db = await createDatabase<TestSchema>({
			name: dbName,
			version: 1,
			stores: { users: {} }
		})
	})
	
	afterEach(async () => {
		db.drop()
	})
	
	describe('get', () => {
		it('returns undefined for missing key', async () => {
			const result = await db.store('users').get('nonexistent')
			expect(result).toBeUndefined()
		})
		
		it('returns record for existing key', async () => {
			await db.store('users').set({ id: 'u1', name: 'Alice', email: 'alice@test.com' })
			const result = await db.store('users').get('u1')
			expect(result).toEqual({ id: 'u1', name: 'Alice', email:  'alice@test.com' })
		})
		
		it('returns array with undefined for missing keys', async () => {
			await db.store('users').set({ id: 'u1', name: 'Alice', email: 'alice@test.com' })
			const result = await db.store('users').get(['u1', 'u2'])
			expect(result).toEqual([
				{ id: 'u1', name: 'Alice', email: 'alice@test.com' },
				undefined
			])
		})
	})
	
	describe('resolve', () => {
		it('throws NotFoundError for missing key', async () => {
			await expect(db.store('users').resolve('nonexistent'))
				.rejects.toThrow(NotFoundError)
		})
		
		it('throws NotFoundError with correct properties', async () => {
			try {
				await db.store('users').resolve('u1')
				expect.fail('Should have thrown')
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundError)
				expect((error as NotFoundError).key).toBe('u1')
				expect((error as NotFoundError).storeName).toBe('users')
			}
		})
		
		it('returns record for existing key', async () => {
			await db.store('users').set({ id: 'u1', name: 'Alice', email: 'alice@test. com' })
			const result = await db.store('users').resolve('u1')
			expect(result).toEqual({ id: 'u1', name: 'Alice', email: 'alice@test. com' })
		})
		
		it('throws if any key in array is missing', async () => {
			await db.store('users').set({ id: 'u1', name: 'Alice', email: 'alice@test. com' })
			await expect(db. store('users').resolve(['u1', 'u2']))
				.rejects.toThrow(NotFoundError)
		})
	})
	
	describe('add', () => {
		it('inserts new record', async () => {
			const key = await db.store('users').add({ id: 'u1', name: 'Alice', email: 'alice@test. com' })
			expect(key).toBe('u1')
			
			const result = await db. store('users').get('u1')
			expect(result).toEqual({ id:  'u1', name: 'Alice', email: 'alice@test.com' })
		})
		
		it('throws ConstraintError for duplicate key', async () => {
			await db.store('users').add({ id: 'u1', name:  'Alice', email: 'alice@test.com' })
			await expect(db.store('users').add({ id: 'u1', name: 'Bob', email: 'bob@test.com' }))
				.rejects.toThrow(ConstraintError)
		})
	})
})
```

---

## Naming Conventions

### Method Prefixes

| Prefix    | Category              | Examples                               |
|-----------|-----------------------|----------------------------------------|
| `get`     | Accessor              | `getName()`, `getKeyPath()`, `get()`   |
| `has`     | Boolean accessor      | `has()`, `hasAutoIncrement()`          |
| `is`      | Boolean accessor      | `isOpen()`, `isUnique()`, `isActive()` |
| `set`     | Mutator (upsert)      | `set()`                                |
| `add`     | Mutator (insert)      | `add()`                                |
| `remove`  | Mutator (delete)      | `remove()`                             |
| `clear`   | Mutator (bulk delete) | `clear()`                              |
| `open`    | Factory               | `openCursor()`, `openKeyCursor()`      |
| `create`  | Factory               | `createDatabase()`                     |
| `on`      | Event subscription    | `onChange()`, `onError()`              |
| `iterate` | Generator             | `iterate()`, `iterateKeys()`           |
| `to`      | Transformer           | `toArray()`                            |
| `drop`    | Lifecycle             | `drop()`                               |
| `close`   | Lifecycle             | `close()`                              |
| `abort`   | Control               | `abort()`                              |
| `commit`  | Control               | `commit()`                             |

### Explicit Names (No Abbreviations)

| ❌ Avoid | ✅ Use                |
|---------|----------------------|
| `eq`    | `equals`             |
| `gt`    | `greaterThan`        |
| `gte`   | `greaterThanOrEqual` |
| `lt`    | `lessThan`           |
| `lte`   | `lessThanOrEqual`    |
| `asc`   | `ascending`          |
| `desc`  | `descending`         |
| `prev`  | `previous`           |
| `tx`    | `transaction`        |
| `db`    | `database`           |
| `cb`    | `callback`           |
| `fn`    | `function`           |
| `val`   | `value`              |
| `idx`   | `index`              |

### Allowed Abbreviations

ID, URL, API, HTML, DOM, CSS, JSON, UUID, ARIA

---

## Appendix:  Comparison with Alternatives

| Feature          | This Library       | Dexie. js          | idb        | localForage |
|------------------|--------------------|--------------------|------------|-------------|
| Type safety      | ✅ Generic schemas  | ⚠️ Limited         | ⚠️ Limited | ❌ None      |
| Promise API      | ✅ Yes              | ✅ Yes              | ✅ Yes      | ✅ Yes       |
| Native access    | ✅ `.native`        | ❌ Hidden           | ⚠️ Exposed | ❌ Hidden    |
| Query builder    | ✅ Native ops only  | ⚠️ Over-abstracted | ❌ None     | ❌ None      |
| Auto batching    | ✅ Yes              | ✅ Yes              | ❌ No       | ❌ No        |
| Cross-tab sync   | ✅ BroadcastChannel | ⚠️ Custom          | ❌ No       | ❌ No        |
| Bundle size      | ~5KB               | ~30KB              | ~1KB       | ~10KB       |
| Dependencies     | 0                  | 0                  | 0          | 0           |
| Cursor streaming | ✅ Async generators | ⚠️ Callbacks       | ⚠️ Manual  | ❌ No        |
| Error handling   | ✅ Typed exceptions | ⚠️ Generic         | ⚠️ Native  | ⚠️ Generic  |
