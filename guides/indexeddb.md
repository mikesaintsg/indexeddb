# @mikesaintsg/indexeddb API Guide

> **Zero-dependency, type-safe IndexedDB wrapper for browser applications.**

---

## Table of Contents

1. [Introduction](#introduction)
2. [Installation](#installation)
3. [Quick Start](#quick-start)
4. [Core Concepts](#core-concepts)
5. [Database Operations](#database-operations)
6. [Store Operations](#store-operations)
7. [Index Operations](#index-operations)
8. [Query Builder](#query-builder)
9. [Transactions](#transactions)
10. [Cursors](#cursors)
11. [TTL (Time-To-Live)](#ttl-time-to-live)
12. [Migrations](#migrations)
13. [Reactivity & Events](#reactivity--events)
14. [Error Handling](#error-handling)
15. [Native Access](#native-access)
16. [TypeScript Integration](#typescript-integration)
17. [Performance Tips](#performance-tips)
18. [Export & Import](#export--import)
19. [Storage Management](#storage-management)
20. [Compound Indexes](#compound-indexes)
21. [Binary Keys](#binary-keys)
22. [Transaction Atomicity](#transaction-atomicity)
23. [API Reference](#api-reference)
24. [Helper Functions](#helper-functions)
25. [License](#license)

---

## Introduction

### Value Proposition

`@mikesaintsg/indexeddb` provides a modern, Promise-based API for IndexedDB with: 

- **Full TypeScript support** — Schema-driven types flow through all operations
- **Zero dependencies** — Built entirely on native IndexedDB APIs
- **Fluent query builder** — Chainable API for complex queries
- **TTL support** — Automatic expiration for cache-like use cases
- **Migration system** — Version-controlled schema evolution
- **Event subscriptions** — React to data changes across tabs
- **Escape hatches** — Access native IDBDatabase when needed

### When to Use IndexedDB

| Use Case | Recommendation |
|----------|----------------|
| Simple key-value storage | Use `@mikesaintsg/storage` instead |
| Structured data with queries | ✅ Use indexeddb |
| Large datasets (1000+ records) | ✅ Use indexeddb |
| Offline-first applications | ✅ Use indexeddb |
| Complex relationships | ✅ Use indexeddb |
| Session-only data | Use `sessionStorage` via storage |
| Cross-tab real-time sync | Combine with `@mikesaintsg/broadcast` |
| Cache with automatic expiration | ✅ Use indexeddb with TTL |

---

## Installation

```bash
npm install @mikesaintsg/indexeddb
```

---

## Quick Start

```ts
import { createDatabase } from '@mikesaintsg/indexeddb'

// Define your schema
interface AppSchema {
	users: {
		id: string
		name: string
		email:  string
		createdAt: number
	}
	posts: {
		id: string
		userId: string
		title: string
		content: string
		publishedAt: number
	}
}

// Create database
const db = await createDatabase<AppSchema>({
	name: 'my-app',
	version: 1,
	stores: {
		users: {
			keyPath: 'id',
			indexes: [
				{ name: 'email', keyPath:  'email', unique: true },
				{ name: 'createdAt', keyPath: 'createdAt' },
			],
		},
		posts: {
			keyPath: 'id',
			indexes: [
				{ name: 'userId', keyPath: 'userId' },
				{ name:  'publishedAt', keyPath: 'publishedAt' },
			],
		},
	},
})

// Use the database
await db.store('users').set({
	id: crypto.randomUUID(),
	name: 'Alice',
	email: 'alice@example.com',
	createdAt: Date.now(),
})

const user = await db.store('users').index('email').get('alice@example.com')
console.log(user?. name) // 'Alice'
```

---

## Core Concepts

### Schema Definition

The schema type defines the shape of data in each store:

```ts
interface MySchema {
	// Store name → Record type
	users: UserRecord
	posts: PostRecord
	settings: SettingRecord
}
```

TypeScript uses this schema to: 
- Enforce correct store names
- Type-check values in set/add operations
- Type return values from get/query operations

### Store Definition

Each store requires a definition specifying its structure:

```ts
interface StoreDefinition {
	readonly keyPath?:  KeyPath
	readonly autoIncrement?: boolean
	readonly indexes?:  readonly IndexDefinition[]
	readonly ttl?: TTLOptions
}
```

Example configuration: 

```ts
const stores: StoreDefinitions<MySchema> = {
	users: {
		keyPath: 'id',           // Field used as primary key
		autoIncrement: false,    // Generate keys automatically
		indexes: [               // Secondary indexes
			{ name: 'email', keyPath: 'email', unique: true },
		],
	},
	cache: {
		keyPath: 'key',
		ttl: {                   // Optional TTL configuration
			defaultMs: 24 * 60 * 60 * 1000, // 24 hours
		},
	},
}
```

### Index Definition

Indexes enable fast lookups on non-primary-key fields:

```ts
interface IndexDefinition {
	readonly name: string        // Index name for access
	readonly keyPath: KeyPath    // Field(s) to index
	readonly unique?: boolean    // Enforce uniqueness
	readonly multiEntry?:  boolean // Index array elements separately
}
```

### Method Semantics

This library follows consistent naming conventions:

| Method | Returns | When Not Found | Use Case |
|--------|---------|----------------|----------|
| `get(key)` | `T \| undefined` | Returns `undefined` | Optional lookup |
| `resolve(key)` | `T` | Throws `NotFoundError` | Required lookup |
| `has(key)` | `boolean` | Returns `false` | Existence check |
| `set(value)` | `ValidKey` | Creates new | Insert or update |
| `add(value)` | `ValidKey` | Creates new | Insert only (throws if exists) |
| `remove(key)` | `void` | No-op | Delete |
| `all()` | `readonly T[]` | Empty array | Bulk retrieval |
| `prune()` | `PruneResult` | N/A | Remove expired records (TTL stores) |

---

## Database Operations

### Creating a Database

```ts
import { createDatabase } from '@mikesaintsg/indexeddb'

const db = await createDatabase<MySchema>({
	name: 'my-app',
	version: 1,
	stores:  {
		users: { keyPath: 'id' },
		posts: { keyPath: 'id' },
	},
	// Optional: Subscribe to events at creation
	onChange: (event) => console.log('Data changed:', event),
	onError: (error) => console.error('Database error:', error),
})
```

### Database Methods

```ts
// Accessors
db.getName()        // 'my-app'
db.getVersion()     // 1
db.getStoreNames()  // ['users', 'posts']
db.isOpen()         // true

// Store access
const store = db.store('users')

// Transactions (see Transactions section)
await db.read(['users'], async (tx) => { /* ... */ })
await db.write(['users'], async (tx) => { /* ... */ })

// Lifecycle
db.close()          // Close connection
await db.drop()     // Delete entire database

// Export/Import
const data = await db.export()
await db.import(data)

// Storage info
const estimate = await db.getStorageEstimate()
```

### Native Access

Access the underlying `IDBDatabase` for advanced operations:

```ts
const nativeDb = db.native

// Use native API directly
const tx = nativeDb.transaction(['users'], 'readonly')
const store = tx.objectStore('users')
```

---

## Store Operations

### get() — Optional Lookup

Returns `undefined` if the key doesn't exist:

```ts
const user = await db.store('users').get('user-123')
if (user) {
	console.log(user.name)
}

// Batch get
const users = await db. store('users').get(['id1', 'id2', 'id3'])
// Returns: readonly (User | undefined)[]
```

### resolve() — Required Lookup

Throws `NotFoundError` if the key doesn't exist:

```ts
try {
	const user = await db.store('users').resolve('user-123')
	console.log(user.name) // Safe - would have thrown
} catch (error) {
	if (isDatabaseError(error) && error.code === 'NOT_FOUND') {
		console.log('User not found')
	}
}

// Batch resolve (throws if ANY key is missing)
const users = await db.store('users').resolve(['id1', 'id2', 'id3'])
```

### set() — Upsert

Inserts or updates a record:

```ts
// Single record
const key = await db.store('users').set({
	id: 'user-123',
	name: 'Alice',
	email: 'alice@example.com',
	createdAt: Date.now(),
})

// With TTL override (if store has TTL enabled)
await db.store('cache').set(
	{ key: 'temp-data', data: tempData },
	{ ttl:  5 * 60 * 1000 } // 5 minutes
)

// Disable expiration for specific record
await db.store('cache').set(
	{ key: 'permanent', data: importantData },
	{ ttl: null }
)

// Batch set with progress
const keys = await db.store('users').set(userArray, {
	onProgress: (completed, total) => {
		console.log(`${completed}/${total} users saved`)
	},
})
```

### add() — Insert Only

Throws `ConstraintError` if the key already exists:

```ts
try {
	await db.store('users').add({
		id: 'user-123',
		name: 'Alice',
		email: 'alice@example.com',
		createdAt: Date.now(),
	})
} catch (error) {
	if (isDatabaseError(error) && error.code === 'CONSTRAINT') {
		console.log('User already exists')
	}
}

// Batch add
const keys = await db.store('users').add(userArray, {
	onProgress: (completed, total) => {
		console.log(`${completed}/${total} users added`)
	},
})
```

### remove() — Delete

```ts
// Single key
await db.store('users').remove('user-123')

// Multiple keys
await db.store('users').remove(['id1', 'id2', 'id3'])
```

### has() — Existence Check

```ts
const exists = await db.store('users').has('user-123')

// Batch check
const results = await db.store('users').has(['id1', 'id2', 'id3'])
// Returns: readonly boolean[]
```

### Bulk Operations

```ts
// Get all records
const allUsers = await db.store('users').all()

// Get all records with query
const recentUsers = await db.store('users').all(
	IDBKeyRange.lowerBound(lastWeekTimestamp)
)

// Get all records with limit
const firstTen = await db.store('users').all(null, 10)

// Get all keys
const allKeys = await db. store('users').keys()

// Count records
const count = await db. store('users').count()

// Count with query
const recentCount = await db.store('users').count(
	IDBKeyRange.lowerBound(lastWeekTimestamp)
)

// Clear all records
await db.store('users').clear()
```

### Store Accessors

```ts
const store = db.store('users')

store.getName()          // 'users'
store. getKeyPath()       // 'id' or null for out-of-line keys
store.getIndexNames()    // readonly string[]
store.hasAutoIncrement() // boolean
store.hasTTL()           // boolean
```

---

## Index Operations

Indexes allow efficient lookups on fields other than the primary key. 

### Accessing an Index

```ts
const emailIndex = db.store('users').index('email')
```

### Index Query Methods

```ts
// Get by index key
const user = await emailIndex.get('alice@example. com')

// Batch get by index keys
const users = await emailIndex.get(['alice@example.com', 'bob@example.com'])

// Resolve by index key (throws if not found)
const user = await emailIndex.resolve('alice@example.com')

// Check existence
const exists = await emailIndex.has('alice@example.com')

// Batch existence check
const results = await emailIndex.has(['alice@example.com', 'bob@example.com'])

// Get primary key for index key
const primaryKey = await emailIndex.getKey('alice@example.com')

// Get all by index
const allByEmail = await emailIndex.all()

// Get all with query
const gmailUsers = await emailIndex.all(
	IDBKeyRange. bound('a@gmail.com', 'z@gmail.com')
)

// Get all keys
const allEmailKeys = await emailIndex.keys()

// Count by index
const count = await emailIndex.count()
```

### Index Accessors

```ts
emailIndex.getName()      // 'email'
emailIndex.getKeyPath()   // 'email' or ['field1', 'field2'] for compound
emailIndex.isUnique()     // true
emailIndex.isMultiEntry() // false
```

---

## Query Builder

The query builder provides a fluent API for complex queries. 

### Basic Usage

```ts
const results = await db.store('users')
	.query()
	.where('createdAt')
	.greaterThan(Date.now() - 86400000) // Last 24 hours
	.descending()
	.limit(10)
	.toArray()
```

### where() — Index Queries (Fast)

When the field has an index, queries use IDBKeyRange for O(log n) lookups:

```ts
// Exact match
. where('email').equals('alice@example.com')

// Range queries
.where('createdAt').greaterThan(timestamp)
.where('createdAt').greaterThanOrEqual(timestamp)
.where('createdAt').lessThan(timestamp)
.where('createdAt').lessThanOrEqual(timestamp)
. where('createdAt').between(start, end)
. where('createdAt').between(start, end, { lowerOpen: true, upperOpen:  false })

// String prefix
.where('name').startsWith('Ali')

// Multiple values
.where('status').anyOf(['active', 'pending'])
.where('status').noneOf(['deleted', 'banned'])

// String suffix (filter-based, O(n))
.where('email').endsWith('@gmail.com')
```

### Non-Indexable Types (Automatic Fallback)

IndexedDB cannot index `boolean`, `null`, or `undefined`. The query builder automatically falls back to filter-based queries:

```ts
// These use filter() internally since booleans aren't indexable
.where('isActive').equals(true)
.where('deletedAt').equals(null)
.where('metadata').equals(undefined)
```

### filter() — Post-Cursor Filtering (Flexible)

For complex conditions not supported by indexes:

```ts
const results = await db.store('users')
	.query()
	.filter((user) => user.name.includes('Smith'))
	.filter((user) => user.age >= 18)
	.toArray()
```

### Combining where() and filter()

Use indexed `where()` to narrow results, then `filter()` for refinement:

```ts
// Fast:  Index narrows to recent users
// Then: Filter checks name pattern
const results = await db.store('users')
	.query()
	.where('createdAt').greaterThan(lastWeek)
	.filter((user) => user.name.toLowerCase().includes(searchTerm))
	.toArray()
```

### Filter-Based Where Methods (O(n))

Some `where()` methods fall back to filtering when the condition cannot be expressed as an IDBKeyRange:

```ts
// These scan all records
. where('status').noneOf(['deleted', 'banned'])
.where('email').endsWith('@gmail.com')
```

### Ordering and Pagination

```ts
const page = await db.store('posts')
	.query()
	.where('publishedAt').greaterThan(0)
	.descending()      // Newest first (default:  ascending)
	.offset(20)        // Skip first 20
	.limit(10)         // Take 10
	.toArray()
```

### Range Introspection

```ts
const query = db.store('users')
	.query()
	.where('createdAt')
	.between(start, end)

const range = query.getRange() // IDBKeyRange object or null
```

### Terminal Operations

```ts
// Get all matching records
const records = await query.toArray()

// Get first matching record
const first = await query.first()

// Count matching records
const count = await query.count()

// Get matching keys
const keys = await query.keys()

// Iterate (memory-efficient for large results)
for await (const record of query. iterate()) {
	console.log(record)
}
```

---

## Transactions

### Automatic Transactions

Most store operations create implicit transactions:

```ts
// Each operation runs in its own transaction
await db. store('users').set(user1)
await db.store('users').set(user2)
```

### Explicit Transactions

For atomic operations across multiple records or stores:

```ts
// Read-only transaction
await db.read(['users', 'posts'], async (tx) => {
	const user = await tx.store('users').get('user-123')
	const posts = await tx.store('posts')
		.index('userId')
		.all(IDBKeyRange.only('user-123'))
})

// Read-write transaction
await db.write(['users', 'posts'], async (tx) => {
	await tx.store('users').remove('user-123')
	// All posts by this user are also removed atomically
	const posts = await tx.store('posts')
		.index('userId')
		.all(IDBKeyRange.only('user-123'))
	for (const post of posts) {
		await tx.store('posts').remove(post.id)
	}
})
```

### Transaction Options

```ts
await db.write(['users'], async (tx) => {
	// ...  operations
}, {
	durability: 'strict', // 'default' | 'strict' | 'relaxed'
})
```

| Durability | Behavior |
|------------|----------|
| `'default'` | Browser decides based on context |
| `'strict'` | Wait for disk write (slower, safer) |
| `'relaxed'` | May not wait for disk (faster, less safe) |

### Transaction Methods

```ts
await db.write(['users'], async (tx) => {
	tx.getMode()        // 'readwrite'
	tx.getStoreNames()  // readonly string[]
	tx.isActive()       // true while transaction is active
	tx.isFinished()     // true after commit or abort
	
	// Manual control (usually not needed)
	tx.commit()         // Explicitly commit
	tx.abort()          // Abort and rollback
})
```

---

## Cursors

### Async Generator Iteration

The preferred way to iterate large datasets:

```ts
// Iterate all records
for await (const user of db.store('users').iterate()) {
	console.log(user)
}

// Iterate with options
for await (const user of db.store('users').iterate({
	direction: 'previous', // Reverse order
	query: IDBKeyRange.bound('a', 'z'),
})) {
	console.log(user)
}

// Iterate keys only (faster, no value loading)
for await (const key of db.store('users').iterateKeys()) {
	console.log(key)
}
```

### Manual Cursor (for Mutation)

When you need to update or delete during iteration:

```ts
let cursor = await db.store('users').openCursor()

while (cursor) {
	const user = cursor.getValue()
	
	if (user.shouldDelete) {
		await cursor.delete()
	} else if (user.needsUpdate) {
		await cursor.update({ ... user, updated: true })
	}
	
	cursor = await cursor.continue()
}
```

### Cursor Methods

```ts
// Accessors
cursor.getKey()        // Current index key
cursor.getPrimaryKey() // Current primary key
cursor.getValue()      // Current record value
cursor.getDirection()  // CursorDirection

// Navigation
await cursor.continue()           // Next record
await cursor.continue(targetKey)  // Skip to specific key
await cursor.advance(5)           // Skip 5 records
await cursor.continuePrimaryKey(indexKey, primaryKey) // Skip to specific entry

// Mutation (CursorInterface only, not KeyCursorInterface)
await cursor.update(newValue)     // Update current record
await cursor.delete()             // Delete current record
```

### Cursor Directions

```ts
type CursorDirection =
	| 'next'           // Ascending, all duplicates
	| 'nextunique'     // Ascending, skip duplicates
	| 'previous'       // Descending, all duplicates
	| 'previousunique' // Descending, skip duplicates
```

---

## TTL (Time-To-Live)

TTL support enables automatic expiration for cache-like use cases.  Records are not automatically deleted but are filtered from queries and can be pruned on demand.

### Enabling TTL on a Store

```ts
interface CacheSchema {
	cache: {
		key: string
		data: unknown
	}
	sessions: {
		id: string
		userId: string
		data: SessionData
		expiresAt: number
	}
}

const db = await createDatabase<CacheSchema>({
	name: 'my-cache',
	version: 1,
	stores: {
		cache: {
			keyPath: 'key',
			ttl: {
				defaultMs: 60 * 60 * 1000, // 1 hour default
			},
		},
		sessions:  {
			keyPath: 'id',
			indexes: [{ name: 'userId', keyPath:  'userId' }],
			ttl: {
				field: 'expiresAt',        // Use existing field instead of internal
				defaultMs: 24 * 60 * 60 * 1000, // 24 hours
			},
		},
	},
})
```

### TTL Configuration

```ts
interface TTLOptions {
	/**
	 * Field that stores expiration timestamp. 
	 * If not specified, internal `_expiresAt` field is added automatically.
	 */
	readonly field?: string

	/**
	 * Default TTL in milliseconds.
	 * Individual records can override via SetOptions.
	 */
	readonly defaultMs?: number
}
```

### Setting Records with TTL

```ts
// Use default TTL from store configuration
await db.store('cache').set({
	key: 'user-profile-123',
	data: profileData,
})

// Override TTL for specific record (shorter)
await db.store('cache').set(
	{ key: 'temp-data', data: tempData },
	{ ttl: 5 * 60 * 1000 } // 5 minutes
)

// Override TTL for specific record (longer)
await db.store('cache').set(
	{ key: 'important-data', data: importantData },
	{ ttl: 7 * 24 * 60 * 60 * 1000 } // 7 days
)

// Disable expiration for specific record
await db. store('cache').set(
	{ key: 'permanent', data: neverExpires },
	{ ttl: null }
)
```

### Checking Expiration

```ts
// Check if a specific record is expired
const isExpired = await db.store('cache').isExpired('user-profile-123')

if (isExpired) {
	// Fetch fresh data
	const freshData = await fetchFromAPI()
	await db.store('cache').set({ key: 'user-profile-123', data: freshData })
}
```

### Automatic Filtering

Expired records are automatically filtered from query results:

```ts
// Only returns non-expired records
const activeItems = await db.store('cache').all()

// Queries also filter expired records
const results = await db.store('cache')
	.query()
	.where('key')
	.startsWith('user-')
	.toArray()
```

### Pruning Expired Records

Expired records remain in storage until explicitly pruned:

```ts
// Remove all expired records
const result = await db.store('cache').prune()
console.log(`Pruned ${result.prunedCount} records`)
console.log(`${result.remainingCount} records remaining`)

// Prune periodically
const pruneInterval = setInterval(async () => {
	const result = await db.store('cache').prune()
	if (result.prunedCount > 0) {
		console.log(`Pruned ${result.prunedCount} expired records`)
	}
}, 60 * 60 * 1000) // Every hour

// Cleanup on shutdown
clearInterval(pruneInterval)
```

### TTL Store Methods

```ts
const store = db.store('cache')

// Check if store has TTL enabled
store.hasTTL() // boolean

// Check specific record expiration
await store.isExpired('key') // boolean

// Remove expired records
await store.prune() // PruneResult { prunedCount, remainingCount }
```

### TTL Use Cases

**API Response Cache:**

```ts
interface ApiCacheSchema {
	responses: {
		url: string
		response: unknown
		cachedAt: number
	}
}

const db = await createDatabase<ApiCacheSchema>({
	name: 'api-cache',
	version: 1,
	stores: {
		responses: {
			keyPath: 'url',
			ttl:  { defaultMs: 5 * 60 * 1000 }, // 5 minutes default
		},
	},
})

async function fetchWithCache(url: string, ttlMs?:  number): Promise<unknown> {
	// Check cache first
	const cached = await db. store('responses').get(url)
	if (cached) {
		return cached. response
	}

	// Fetch fresh data
	const response = await fetch(url).then((r) => r.json())

	// Cache with optional custom TTL
	await db.store('responses').set(
		{ url, response, cachedAt:  Date.now() },
		ttlMs ?  { ttl: ttlMs } : undefined
	)

	return response
}

// Use default TTL
const data = await fetchWithCache('/api/users')

// Use custom TTL for frequently changing data
const liveData = await fetchWithCache('/api/live-feed', 30 * 1000) // 30 seconds
```

**Session Storage:**

```ts
interface SessionSchema {
	sessions: {
		id: string
		userId: string
		data: SessionData
		expiresAt: number
	}
}

const db = await createDatabase<SessionSchema>({
	name: 'sessions',
	version: 1,
	stores: {
		sessions: {
			keyPath: 'id',
			indexes: [{ name: 'userId', keyPath: 'userId' }],
			ttl: {
				field: 'expiresAt', // Use the existing expiresAt field
				defaultMs: 7 * 24 * 60 * 60 * 1000, // 7 days
			},
		},
	},
})

async function createSession(userId: string, data: SessionData): Promise<string> {
	const id = crypto.randomUUID()
	const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000

	await db.store('sessions').set({
		id,
		userId,
		data,
		expiresAt,
	})

	return id
}

async function getSession(id: string): Promise<SessionData | undefined> {
	const session = await db.store('sessions').get(id)
	return session?.data
}

async function extendSession(id: string): Promise<void> {
	const session = await db.store('sessions').get(id)
	if (session) {
		await db.store('sessions').set({
			...session,
			expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
		})
	}
}
```

**Temporary Upload Storage:**

```ts
interface UploadSchema {
	pendingUploads: {
		id: string
		file: ArrayBuffer
		filename: string
		mimeType: string
		createdAt: number
	}
}

const db = await createDatabase<UploadSchema>({
	name: 'uploads',
	version: 1,
	stores: {
		pendingUploads: {
			keyPath: 'id',
			ttl: { defaultMs: 24 * 60 * 60 * 1000 }, // 24 hours
		},
	},
})

// Store file for later upload
async function stageUpload(file: File): Promise<string> {
	const id = crypto.randomUUID()
	const buffer = await file.arrayBuffer()

	await db.store('pendingUploads').set({
		id,
		file: buffer,
		filename: file.name,
		mimeType: file.type,
		createdAt: Date.now(),
	})

	return id
}

// Cleanup abandoned uploads periodically
setInterval(async () => {
	await db.store('pendingUploads').prune()
}, 6 * 60 * 60 * 1000) // Every 6 hours
```

---

## Migrations

### Defining Migrations

```ts
const db = await createDatabase<MySchema>({
	name: 'my-app',
	version: 3,
	stores: { /* current schema */ },
	migrations: [
		{
			version: 2,
			migrate: (ctx) => {
				// Add index to existing store
				const store = ctx.getStore('users')
				store.createIndex('email', 'email', { unique: true })
			},
		},
		{
			version: 3,
			migrate: (ctx) => {
				// Create new store
				ctx.createStore('posts', { keyPath: 'id' })
			},
		},
	],
})
```

### Migration Context

```ts
interface MigrationContext {
	readonly db: IDBDatabase
	readonly transaction: IDBTransaction
	readonly oldVersion: number
	readonly newVersion: number

	createStore(name: string, options?:  IDBObjectStoreParameters): IDBObjectStore
	deleteStore(name: string): void
	getStore(name: string): IDBObjectStore
}
```

### Common Migration Patterns

**Adding an index:**

```ts
{
	version: 2,
	migrate: (ctx) => {
		const store = ctx.getStore('users')
		store.createIndex('createdAt', 'createdAt')
	},
}
```

**Removing an index:**

```ts
{
	version: 3,
	migrate: (ctx) => {
		const store = ctx.getStore('users')
		store.deleteIndex('oldIndex')
	},
}
```

**Adding a store:**

```ts
{
	version: 4,
	migrate: (ctx) => {
		const store = ctx.createStore('settings', { keyPath: 'key' })
		store.createIndex('category', 'category')
	},
}
```

**Removing a store:**

```ts
{
	version: 5,
	migrate: (ctx) => {
		ctx.deleteStore('oldStore')
	},
}
```

**Data migration:**

```ts
{
	version: 6,
	migrate: async (ctx) => {
		const store = ctx.getStore('users')
		const request = store.openCursor()

		await new Promise<void>((resolve, reject) => {
			request.onerror = () => reject(request.error)
			request.onsuccess = () => {
				const cursor = request.result
				if (cursor) {
					// Transform data
					const updated = {
						...cursor.value,
						displayName: cursor.value.name, // Rename field
					}
					delete updated.name
					cursor.update(updated)
					cursor.continue()
				} else {
					resolve()
				}
			}
		})
	},
}
```

**Adding TTL to existing store:**

```ts
{
	version: 7,
	migrate: async (ctx) => {
		// Note: TTL is configured in store definition, not migration
		// This migration adds the expiration field to existing records
		const store = ctx.getStore('cache')
		const request = store.openCursor()
		const defaultExpiration = Date.now() + 24 * 60 * 60 * 1000

		await new Promise<void>((resolve, reject) => {
			request.onerror = () => reject(request.error)
			request.onsuccess = () => {
				const cursor = request.result
				if (cursor) {
					if (cursor.value._expiresAt === undefined) {
						cursor.update({
							... cursor.value,
							_expiresAt: defaultExpiration,
						})
					}
					cursor.continue()
				} else {
					resolve()
				}
			}
		})
	},
}
```

---

## Reactivity & Events

### Change Events

Subscribe to data changes:

```ts
// Database-level (all stores)
const unsub = db.onChange((event) => {
	console.log('Change:', event.type, event.storeName, event.key)
})

// Store-level
const unsub = db.store('users').onChange((event) => {
	console.log('Users changed:', event.type, event.key)
})

// Cleanup
unsub()
```

### Change Event Structure

```ts
interface ChangeEvent {
	readonly type: ChangeType      // 'set' | 'add' | 'remove' | 'clear'
	readonly storeName: string
	readonly key?:  ValidKey
	readonly value?: unknown
	readonly source:  ChangeSource  // 'local' | 'remote'
	readonly timestamp: number
}
```

### Cross-Tab Synchronization

IndexedDB doesn't provide native cross-tab change events.  Combine with `@mikesaintsg/broadcast` for real-time sync:

```ts
import { createDatabase } from '@mikesaintsg/indexeddb'
import { createBroadcast } from '@mikesaintsg/broadcast'

const db = await createDatabase<MySchema>({ /* ... */ })
const broadcast = createBroadcast<{ lastChange: number }>({
	channel: 'db-sync',
	state: { lastChange: 0 },
})

// Notify other tabs on local change
db.onChange((event) => {
	if (event.source === 'local') {
		broadcast.setState({ lastChange: Date.now() })
	}
})

// React to changes from other tabs
broadcast.onStateChange((state, source) => {
	if (source === 'remote') {
		// Refresh data from IndexedDB
		refreshUI()
	}
})
```

### Error Events

```ts
const unsub = db.onError((error) => {
	console.error('Database error:', error)
	// Log to error tracking service
})
```

### Version Change Events

Fired when another connection (tab/window) upgrades the database: 

```ts
const unsub = db.onVersionChange((event) => {
	console.log(`Database upgraded from v${event.oldVersion} to v${event.newVersion}`)
	// Another tab upgraded the database
	// Consider reloading or closing this connection
	db.close()
	location.reload()
})
```

### Close Events

```ts
const unsub = db.onClose(() => {
	console.log('Database connection closed')
})
```

---

## Error Handling

### Error Classes

```ts
import { DatabaseError, isDatabaseError } from '@mikesaintsg/indexeddb'

try {
	await db.store('users').resolve('nonexistent')
} catch (error) {
	if (isDatabaseError(error)) {
		console.log('Code:', error.code)
		console.log('Store:', error.storeName)
		console.log('Key:', error.key)
	}
}
```

### Error Hierarchy

```ts
class DatabaseError extends Error {
	readonly code: DatabaseErrorCode
	readonly storeName?:  string
	readonly key?: ValidKey
	readonly cause?: Error
}
```

### Error Codes

| Code | Cause |
|------|-------|
| `NOT_FOUND` | Record doesn't exist (from `resolve()`) |
| `CONSTRAINT` | Unique constraint violated (from `add()` or unique index) |
| `DATA` | Invalid data for IndexedDB (e.g., functions, symbols) |
| `TRANSACTION_INACTIVE` | Transaction already completed |
| `READ_ONLY` | Write operation in read-only transaction |
| `VERSION` | Version mismatch during upgrade |
| `ABORT` | Transaction was aborted |
| `TIMEOUT` | Operation timed out |
| `QUOTA_EXCEEDED` | Storage quota exceeded |
| `INVALID_STATE` | Database not open or connection lost |
| `INVALID_ACCESS` | Invalid operation for current state |
| `UNKNOWN` | Unknown or uncategorized error |

### Handling Errors

```ts
import { isDatabaseError } from '@mikesaintsg/indexeddb'

try {
	await db.store('users').add(user)
} catch (error) {
	if (isDatabaseError(error)) {
		switch (error.code) {
			case 'CONSTRAINT':
				console.log('User already exists')
				// Maybe update instead
				await db.store('users').set(user)
				break
			case 'QUOTA_EXCEEDED':
				console. log('Storage full, pruning old data')
				await db.store('cache').prune()
				await db.store('cache').clear()
				break
			case 'NOT_FOUND':
				console. log(`Record not found: ${error.key}`)
				break
			default: 
				throw error
		}
	} else {
		throw error
	}
}
```

### Type Guards

```ts
import {
	isDatabaseError,
	isNotFoundError,
	isConstraintError,
	isQuotaExceededError,
} from '@mikesaintsg/indexeddb'

if (isDatabaseError(error)) { /* any database error */ }
if (isNotFoundError(error)) { /* NOT_FOUND error */ }
if (isConstraintError(error)) { /* CONSTRAINT error */ }
if (isQuotaExceededError(error)) { /* QUOTA_EXCEEDED error */ }
```

---

## Native Access

Every wrapper exposes its underlying native object via the `native` property.

### Database

```ts
const nativeDb:  IDBDatabase = db.native
```

### Store

```ts
// Within a transaction
await db.write(['users'], async (tx) => {
	const nativeStore:  IDBObjectStore = tx.store('users').native
})
```

### Index

```ts
await db.read(['users'], async (tx) => {
	const nativeIndex:  IDBIndex = tx.store('users').index('email').native
})
```

### Cursor

```ts
const cursor = await db.store('users').openCursor()
if (cursor) {
	const nativeCursor: IDBCursorWithValue = cursor.native
}

const keyCursor = await db.store('users').openKeyCursor()
if (keyCursor) {
	const nativeKeyCursor: IDBCursor = keyCursor.native
}
```

### Transaction

```ts
await db.write(['users'], async (tx) => {
	const nativeTx: IDBTransaction = tx.native
})
```

### When to Use Native Access

- Complex queries not supported by the wrapper
- Performance-critical batch operations
- Features not yet wrapped by the library
- Debugging and inspection
- Integration with other libraries expecting native objects

---

## TypeScript Integration

### Schema Types

```ts
interface MySchema {
	users: User
	posts: Post
	settings: Setting
}

interface User {
	readonly id: string
	readonly name:  string
	readonly email: string
	readonly createdAt: number
}

// Schema flows through all operations
const db = await createDatabase<MySchema>({ /* ... */ })

const user = await db.store('users').get('123')
// user is User | undefined

await db.store('users').set({ id: '1', name: 'Alice', email: 'a@b.com', createdAt: Date.now() })
// TypeScript validates the shape

db.store('invalid') // ❌ TypeScript error:  'invalid' is not a key of MySchema
```

### Readonly by Default

All returned data is readonly to prevent accidental mutation:

```ts
const users = await db.store('users').all()
// users is readonly User[]

users.push(newUser)    // ❌ TypeScript error
users[0].name = 'Bob'  // ❌ TypeScript error (if User has readonly fields)
```

### Strict Typing

```ts
// Store name validation
db.store('users')   // ✅ Valid
db.store('invalid') // ❌ TypeScript error

// Key type validation
await db.store('users').get('user-123')     // ✅ string is ValidKey
await db.store('users').get(123)            // ✅ number is ValidKey
await db. store('users').get(new Date())     // ✅ Date is ValidKey
await db.store('users').get(['a', 'b'])     // ✅ array is ValidKey
await db.store('users').get({ obj: 1 })     // ❌ object is not ValidKey
```

### Key Types

```ts
type ValidKey = IDBValidKey
// Equivalent to: string | number | Date | BufferSource | ValidKey[]
```

---

## Performance Tips

### 1. Batch Operations

```ts
// ❌ Slow: Multiple transactions
for (const user of users) {
	await db.store('users').set(user)
}

// ✅ Fast: Single call with array
await db.store('users').set(users)

// ✅ Fast:  Explicit transaction
await db.write(['users'], async (tx) => {
	for (const user of users) {
		await tx.store('users').set(user)
	}
})
```

### 2. Use Indexed Queries

```ts
// ❌ Slow: Full scan with filter
const users = await db.store('users')
	.query()
	.filter((u) => u.email === 'alice@example.com')
	.toArray()

// ✅ Fast: Index lookup
const user = await db.store('users')
	.index('email')
	.get('alice@example.com')
```

### 3. Combine where() and filter()

```ts
// ✅ Use index to narrow, filter to refine
const results = await db.store('users')
	.query()
	.where('createdAt').greaterThan(lastWeek) // Index narrows results
	.filter((u) => u.name. includes('Smith'))   // Filter refines
	.toArray()
```

### 4. Use Async Generators

```ts
// ❌ Memory-heavy for large datasets
const allUsers = await db.store('users').all()

// ✅ Memory-efficient streaming
for await (const user of db.store('users').iterate()) {
	process(user)
}
```

### 5. Transaction Durability

```ts
// For non-critical data, use relaxed durability
await db.write(['cache'], async (tx) => {
	await tx.store('cache').set(data)
}, { durability: 'relaxed' })
```

### 6. Lazy Connection

```ts
// Database connection is lazy - no cost until first operation
const db = await createDatabase<MySchema>({ /* ... */ })
// Connection opens on first store access
```

### 7. Key-Only Cursors

```ts
// ✅ Faster when you only need keys
for await (const key of db.store('users').iterateKeys()) {
	console.log(key)
}
```

### 8. Progress Callbacks for Bulk Operations

```ts
await db.store('users').set(largeArray, {
	onProgress: (completed, total) => {
		updateProgressBar(completed / total)
	},
})
```

---

## Export & Import

### Exporting Data

```ts
const data = await db.export()
// {
//   version: 1,
//   exportedAt: 1699123456789,
//   databaseName: 'my-app',
//   databaseVersion: 1,
//   stores: {
//     users: [... ],
//     posts: [...],
//   },
// }

// Save to file
const json = JSON.stringify(data)
const blob = new Blob([json], { type: 'application/json' })
downloadBlob(blob, 'backup.json')
```

### Importing Data

```ts
// Load from file
const json = await file.text()
const data = JSON.parse(json)

await db.import(data, {
	clearExisting: true, // Clear stores before import
	onProgress: (storeName, completed, total) => {
		console.log(`Importing ${storeName}:  ${completed}/${total}`)
	},
})
```

---

## Storage Management

### Checking Storage Usage

```ts
const estimate = await db.getStorageEstimate()
// {
//   usage: 1234567,       // Bytes currently used
//   quota: 1073741824,    // Total quota available
//   available: 1072506857, // Bytes remaining
//   percentUsed: 0.115,   // Usage as percentage (0-1)
// }

if (estimate.percentUsed > 0.9) {
	console.warn('Storage nearly full!')
	// Prune caches, delete old data, etc.
}
```

---

## Compound Indexes

### Defining Compound Indexes

Compound indexes allow efficient queries on multiple fields:

```ts
const db = await createDatabase<MySchema>({
	name: 'my-app',
	version: 1,
	stores:  {
		events: {
			keyPath: 'id',
			indexes: [
				{
					name: 'userDate',
					keyPath: ['userId', 'date'], // Compound key path
				},
			],
		},
	},
})
```

### Querying Compound Indexes

```ts
// Exact match on compound key
const events = await db.store('events')
	.index('userDate')
	.all(IDBKeyRange.only(['user-123', '2024-01-15']))

// Range query on compound key
const events = await db.store('events')
	.index('userDate')
	.all(IDBKeyRange.bound(
		['user-123', '2024-01-01'],
		['user-123', '2024-01-31']
	))
```

### Compound Key Ordering

Compound keys are compared element by element:

```ts
// ['a', 1] < ['a', 2] < ['b', 1]

// Query all entries for user-123, any date
const events = await db. store('events')
	.index('userDate')
	.all(IDBKeyRange.bound(
		['user-123'],           // Lower bound
		['user-123', '\uffff']  // Upper bound (max string)
	))
```

---

## Binary Keys

IndexedDB supports binary data as keys:

```ts
// ArrayBuffer as key
const buffer = new Uint8Array([1, 2, 3, 4]).buffer
await store.set(value, buffer)

// Typed array as key
const typedArray = new Uint8Array([1, 2, 3, 4])
await store.set(value, typedArray)
```

---

## Transaction Atomicity

### Guarantees

- All operations in a transaction succeed or fail together
- No partial updates are visible to other transactions
- Read operations see a consistent snapshot

### Transaction Isolation

```ts
// Transaction 1 starts
await db.write(['users'], async (tx) => {
	const user = await tx.store('users').get('user-123')
	// Transaction 2 can't see changes until Transaction 1 commits
	await tx.store('users').set({ ... user, name: 'Updated' })
})
// Transaction 1 commits - changes now visible
```

### Transaction Scope

```ts
// Transaction only includes specified stores
await db.write(['users'], async (tx) => {
	await tx.store('users').set(user)  // ✅ In scope
	await tx.store('posts').set(post)  // ❌ Error: not in scope
})

// Include multiple stores
await db.write(['users', 'posts'], async (tx) => {
	await tx.store('users').set(user)  // ✅ In scope
	await tx.store('posts').set(post)  // ✅ In scope
})
```

---

## API Reference

### Factory Functions

#### createDatabase\<Schema\>(options): Promise\<DatabaseInterface\<Schema\>\>

Creates and opens a database connection.

```ts
const db = await createDatabase<MySchema>({
	name: 'my-app',
	version: 1,
	stores: {
		users: { keyPath: 'id' },
		posts: { keyPath:  'id', ttl: { defaultMs: 86400000 } },
	},
	migrations: [
		{ version: 2, migrate: (ctx) => { /* ... */ } },
	],
	onChange: (event) => { /* ... */ },
	onError: (error) => { /* ... */ },
	onVersionChange: (event) => { /* ... */ },
	onClose: () => { /* ... */ },
})
```

### DatabaseInterface\<Schema\>

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `native` | `IDBDatabase` | Native database handle |

#### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `getName()` | `string` | Database name |
| `getVersion()` | `number` | Database version |
| `getStoreNames()` | `readonly string[]` | All store names |
| `isOpen()` | `boolean` | Connection status |
| `store(name)` | `StoreInterface<T>` | Get store interface |
| `read(stores, op)` | `Promise<void>` | Read-only transaction |
| `write(stores, op, opts?)` | `Promise<void>` | Read-write transaction |
| `close()` | `void` | Close connection |
| `drop()` | `Promise<void>` | Delete database |
| `export()` | `Promise<ExportedData>` | Export all data |
| `import(data, opts?)` | `Promise<void>` | Import data |
| `getStorageEstimate()` | `Promise<StorageEstimate>` | Storage usage |
| `onChange(cb)` | `Unsubscribe` | Subscribe to changes |
| `onError(cb)` | `Unsubscribe` | Subscribe to errors |
| `onVersionChange(cb)` | `Unsubscribe` | Subscribe to version changes |
| `onClose(cb)` | `Unsubscribe` | Subscribe to close |

### StoreInterface\<T\>

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `native` | `IDBObjectStore` | Native store handle |

#### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `getName()` | `string` | Store name |
| `getKeyPath()` | `KeyPath \| null` | Key path |
| `getIndexNames()` | `readonly string[]` | Index names |
| `hasAutoIncrement()` | `boolean` | Auto-increment enabled |
| `hasTTL()` | `boolean` | TTL enabled |
| `get(key)` | `Promise<T \| undefined>` | Optional lookup |
| `get(keys)` | `Promise<readonly (T \| undefined)[]>` | Batch lookup |
| `resolve(key)` | `Promise<T>` | Required lookup |
| `resolve(keys)` | `Promise<readonly T[]>` | Batch required lookup |
| `set(value, key?)` | `Promise<ValidKey>` | Insert or update |
| `set(value, opts)` | `Promise<ValidKey>` | Insert with options |
| `set(values, opts?)` | `Promise<readonly ValidKey[]>` | Batch insert |
| `add(value, key?)` | `Promise<ValidKey>` | Insert only |
| `add(values, opts?)` | `Promise<readonly ValidKey[]>` | Batch insert only |
| `remove(key)` | `Promise<void>` | Delete |
| `remove(keys)` | `Promise<void>` | Batch delete |
| `has(key)` | `Promise<boolean>` | Existence check |
| `has(keys)` | `Promise<readonly boolean[]>` | Batch existence |
| `all(query?, count?)` | `Promise<readonly T[]>` | Get all |
| `keys(query?, count?)` | `Promise<readonly ValidKey[]>` | Get all keys |
| `clear()` | `Promise<void>` | Remove all |
| `count(query?)` | `Promise<number>` | Count records |
| `prune()` | `Promise<PruneResult>` | Remove expired (TTL) |
| `isExpired(key)` | `Promise<boolean>` | Check expiration (TTL) |
| `query()` | `QueryBuilderInterface<T>` | Create query |
| `index(name)` | `IndexInterface<T>` | Get index |
| `iterate(opts?)` | `AsyncGenerator<T>` | Iterate records |
| `iterateKeys(opts?)` | `AsyncGenerator<ValidKey>` | Iterate keys |
| `openCursor(opts?)` | `Promise<CursorInterface<T> \| null>` | Open cursor |
| `openKeyCursor(opts?)` | `Promise<KeyCursorInterface \| null>` | Open key cursor |
| `onChange(cb)` | `Unsubscribe` | Subscribe to changes |

### IndexInterface\<T\>

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `native` | `IDBIndex` | Native index handle |

#### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `getName()` | `string` | Index name |
| `getKeyPath()` | `KeyPath` | Index key path |
| `isUnique()` | `boolean` | Uniqueness constraint |
| `isMultiEntry()` | `boolean` | Multi-entry index |
| `get(key)` | `Promise<T \| undefined>` | Lookup by index key |
| `get(keys)` | `Promise<readonly (T \| undefined)[]>` | Batch lookup |
| `resolve(key)` | `Promise<T>` | Required lookup |
| `resolve(keys)` | `Promise<readonly T[]>` | Batch required |
| `getKey(key)` | `Promise<ValidKey \| undefined>` | Get primary key |
| `has(key)` | `Promise<boolean>` | Existence check |
| `has(keys)` | `Promise<readonly boolean[]>` | Batch existence |
| `all(query?, count?)` | `Promise<readonly T[]>` | Get all by index |
| `keys(query?, count?)` | `Promise<readonly ValidKey[]>` | Get all keys |
| `count(query?)` | `Promise<number>` | Count by index |
| `query()` | `QueryBuilderInterface<T>` | Create query |
| `iterate(opts?)` | `AsyncGenerator<T>` | Iterate by index |
| `iterateKeys(opts?)` | `AsyncGenerator<ValidKey>` | Iterate keys |
| `openCursor(opts?)` | `Promise<CursorInterface<T> \| null>` | Open cursor |
| `openKeyCursor(opts?)` | `Promise<KeyCursorInterface \| null>` | Open key cursor |

### QueryBuilderInterface\<T\>

#### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `where(keyPath)` | `WhereClauseInterface<T>` | Start where clause |
| `filter(predicate)` | `QueryBuilderInterface<T>` | Add filter |
| `ascending()` | `QueryBuilderInterface<T>` | Sort ascending |
| `descending()` | `QueryBuilderInterface<T>` | Sort descending |
| `limit(count)` | `QueryBuilderInterface<T>` | Limit results |
| `offset(count)` | `QueryBuilderInterface<T>` | Skip results |
| `getRange()` | `IDBKeyRange \| null` | Get constructed range |
| `toArray()` | `Promise<readonly T[]>` | Execute and get all |
| `first()` | `Promise<T \| undefined>` | Execute and get first |
| `count()` | `Promise<number>` | Execute and count |
| `keys()` | `Promise<readonly ValidKey[]>` | Execute and get keys |
| `iterate()` | `AsyncGenerator<T>` | Execute and iterate |

### WhereClauseInterface\<T\>

#### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `equals(value)` | `QueryBuilderInterface<T>` | Exact match |
| `greaterThan(value)` | `QueryBuilderInterface<T>` | Greater than |
| `greaterThanOrEqual(value)` | `QueryBuilderInterface<T>` | Greater or equal |
| `lessThan(value)` | `QueryBuilderInterface<T>` | Less than |
| `lessThanOrEqual(value)` | `QueryBuilderInterface<T>` | Less or equal |
| `between(lower, upper, opts?)` | `QueryBuilderInterface<T>` | Range query |
| `startsWith(prefix)` | `QueryBuilderInterface<T>` | String prefix |
| `endsWith(suffix)` | `QueryBuilderInterface<T>` | String suffix |
| `anyOf(values)` | `QueryBuilderInterface<T>` | Match any value |
| `noneOf(values)` | `QueryBuilderInterface<T>` | Match none |

### CursorInterface\<T\>

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `native` | `IDBCursorWithValue` | Native cursor |

#### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `getKey()` | `ValidKey` | Current key |
| `getPrimaryKey()` | `ValidKey` | Current primary key |
| `getValue()` | `T` | Current value |
| `getDirection()` | `CursorDirection` | Cursor direction |
| `continue(key?)` | `Promise<CursorInterface<T> \| null>` | Advance cursor |
| `continuePrimaryKey(key, pk)` | `Promise<CursorInterface<T> \| null>` | Advance to key |
| `advance(count)` | `Promise<CursorInterface<T> \| null>` | Skip records |
| `update(value)` | `Promise<ValidKey>` | Update current |
| `delete()` | `Promise<void>` | Delete current |

### TransactionInterface\<Schema, K\>

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `native` | `IDBTransaction` | Native transaction |

#### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `getMode()` | `TransactionMode` | Transaction mode |
| `getStoreNames()` | `readonly string[]` | Stores in scope |
| `isActive()` | `boolean` | Transaction active |
| `isFinished()` | `boolean` | Transaction finished |
| `store(name)` | `TransactionStoreInterface<T>` | Get store |
| `abort()` | `void` | Abort transaction |
| `commit()` | `void` | Commit transaction |

### Types

```ts
type ValidKey = IDBValidKey
type KeyPath = string | readonly string[]
type TransactionMode = 'readonly' | 'readwrite'
type TransactionDurability = 'default' | 'strict' | 'relaxed'
type CursorDirection = 'next' | 'nextunique' | 'previous' | 'previousunique'
type ChangeType = 'set' | 'add' | 'remove' | 'clear'
type ChangeSource = 'local' | 'remote'
type OrderDirection = 'ascending' | 'descending'
type Unsubscribe = () => void
```

### Error Types

```ts
type DatabaseErrorCode =
	| 'NOT_FOUND'
	| 'CONSTRAINT'
	| 'DATA'
	| 'TRANSACTION_INACTIVE'
	| 'READ_ONLY'
	| 'VERSION'
	| 'ABORT'
	| 'TIMEOUT'
	| 'QUOTA_EXCEEDED'
	| 'INVALID_STATE'
	| 'INVALID_ACCESS'
	| 'UNKNOWN'
```

---

## Helper Functions

### Database Management

```ts
import { listDatabases, deleteDatabase } from '@mikesaintsg/indexeddb'

// List all databases (where supported)
const databases = await listDatabases()
// readonly DatabaseInfo[] = [{ name:  'my-app', version:  1 }, ...]

// Delete a database
await deleteDatabase('my-app')
```

### Date Range Helpers

```ts
import { dateRange } from '@mikesaintsg/indexeddb'

// Create IDBKeyRange for common date ranges
dateRange. today()              // Today's range
dateRange.yesterday()          // Yesterday's range
dateRange. lastDays(7)          // Last 7 days
dateRange.thisWeek()           // This week (Sunday-Saturday)
dateRange.thisMonth()          // This month
dateRange.thisYear()           // This year
dateRange.between(start, end)  // Custom range
```

### IDBKeyRange Helpers

```ts
import { keyRange } from '@mikesaintsg/indexeddb'

// Create IDBKeyRange instances
keyRange.only(value)                        // Exact match
keyRange.lowerBound(lower)                  // >= lower
keyRange.lowerBound(lower, true)            // > lower (open)
keyRange.upperBound(upper)                  // <= upper
keyRange.upperBound(upper, true)            // < upper (open)
keyRange.bound(lower, upper)                // lower <= x <= upper
keyRange.bound(lower, upper, true, false)   // lower < x <= upper
keyRange.bound(lower, upper, false, true)   // lower <= x < upper
keyRange.bound(lower, upper, true, true)    // lower < x < upper
```

---

## License

MIT