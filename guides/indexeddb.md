# @mikesaintsg/indexeddb API Guide

> **A focused IndexedDB wrapper that enhances the native API without abstracting it away**

This guide provides comprehensive documentation for all features, APIs, and usage patterns of the `@mikesaintsg/indexeddb` library.

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
11. [Migrations](#migrations)
12. [Reactivity & Events](#reactivity--events)
13. [Error Handling](#error-handling)
14. [Native Access](#native-access)
15. [TypeScript Integration](#typescript-integration)
16. [Performance Tips](#performance-tips)
17. [API Reference](#api-reference)

---

## Introduction

This library provides a type-safe, Promise-based wrapper around IndexedDB that **enhances** the native API without abstracting it away. Developers get:

- **Type safety**: Generic schema types with full TypeScript support
- **Promise-based operations**: Async/await instead of event callbacks
- **Ergonomic helpers**: Simplified CRUD, batch operations, query builder
- **Native access**: Full access to underlying IndexedDB objects when needed
- **Zero dependencies**: Built entirely on Web Platform APIs

### Value Proposition

| Native IndexedDB              | This Library                        |
|-------------------------------|-------------------------------------|
| Request/event callbacks       | Promise-based async/await           |
| No type safety                | Generic schema types                |
| Verbose cursor iteration      | Async generators with early break   |
| Manual transaction management | Auto-batching, explicit when needed |
| No cross-tab sync             | Built-in BroadcastChannel sync      |

---

## Installation

```bash
npm install @mikesaintsg/indexeddb
```

---

## Quick Start

```typescript
import { createDatabase } from '@mikesaintsg/indexeddb'

// 1. Define your schema types
interface User {
	readonly id: string
	readonly name: string
	readonly email: string
	readonly status: 'active' | 'inactive'
}

interface Post {
	readonly id: string
	readonly title: string
	readonly authorId: string
	readonly tags: readonly string[]
}

interface AppSchema {
	readonly users: User
	readonly posts: Post
}

// 2. Create database with schema
const db = await createDatabase<AppSchema>({
	name: 'myApp',
	version: 1,
	stores: {
		users: {
			// keyPath defaults to 'id'
			indexes: [
				{ name: 'byEmail', keyPath: 'email', unique: true },
				{ name: 'byStatus', keyPath: 'status' }
			]
		},
		posts: {
			indexes: [
				{ name: 'byAuthor', keyPath: 'authorId' },
				{ name: 'byTags', keyPath: 'tags', multiEntry: true }
			]
		}
	}
})

// 3. Perform operations
await db.store('users').set({ id: 'u1', name: 'Alice', email: 'alice@example.com', status: 'active' })

const user = await db.store('users').get('u1')
console.log(user?.name) // 'Alice'

// 4. Query with builder
const activeUsers = await db.store('users').query()
	.where('status').equals('active')
	.limit(10)
	.toArray()

// 5. Clean up
db.close()
```

---

## Core Concepts

### Schema Definition

Define your database schema using TypeScript interfaces. The schema maps store names to record types:

```typescript
interface MySchema {
	readonly users: User      // 'users' store contains User records
	readonly posts: Post      // 'posts' store contains Post records
	readonly settings: Setting
}
```

### Store Definition

Each store can be configured with:

| Option          | Type                | Default | Description                                |
|-----------------|---------------------|---------|--------------------------------------------|
| `keyPath`       | `string \| null`    | `'id'`  | Path to key property, null for out-of-line |
| `autoIncrement` | `boolean`           | `false` | Auto-generate numeric keys                 |
| `indexes`       | `IndexDefinition[]` | `[]`    | Index definitions                          |

```typescript
const db = await createDatabase<MySchema>({
	name: 'myApp',
	version: 1,
	stores: {
		// Uses defaults: keyPath: 'id', autoIncrement: false
		users: {},
		
		// Custom key path
		posts: { keyPath: 'slug' },
		
		// Out-of-line keys with auto-increment
		logs: { keyPath: null, autoIncrement: true },
		
		// With indexes
		products: {
			indexes: [
				{ name: 'byCategory', keyPath: 'category' },
				{ name: 'bySku', keyPath: 'sku', unique: true },
				{ name: 'byTags', keyPath: 'tags', multiEntry: true }
			]
		}
	}
})
```

### Index Definition

Indexes enable efficient queries on non-primary-key fields:

| Option       | Type      | Default | Description                              |
|--------------|-----------|---------|------------------------------------------|
| `name`       | `string`  | —       | Index name (required)                    |
| `keyPath`    | `string`  | —       | Property path to index (required)        |
| `unique`     | `boolean` | `false` | Enforce unique values                    |
| `multiEntry` | `boolean` | `false` | Index each array element separately      |

```typescript
indexes: [
	// Simple index
	{ name: 'byEmail', keyPath: 'email' },
	
	// Unique constraint
	{ name: 'byUsername', keyPath: 'username', unique: true },
	
	// Compound key path
	{ name: 'byNameAndDate', keyPath: ['lastName', 'createdAt'] },
	
	// Multi-entry for arrays
	{ name: 'byTags', keyPath: 'tags', multiEntry: true }
]
```

### Method Semantics

The library follows consistent patterns for data access:

| Method      | Missing Key            | Use Case                      |
|-------------|------------------------|-------------------------------|
| `get()`     | Returns `undefined`    | Optional lookup, check result |
| `resolve()` | Throws `NotFoundError` | Must exist, handle error      |
| `set()`     | Creates new record     | Insert or update (upsert)     |
| `add()`     | Creates new record     | Insert only, throws if exists |
| `remove()`  | Silently succeeds      | Delete if exists              |

---

## Database Operations

### Creating a Database

```typescript
import { createDatabase } from '@mikesaintsg/indexeddb'

const db = await createDatabase<MySchema>({
	name: 'myApp',
	version: 1,
	stores: { /* store definitions */ },
	
	// Optional: migrations
	migrations: [
		{ version: 2, migrate: (ctx) => { /* migration logic */ } }
	],
	
	// Optional: enable cross-tab sync (default: true)
	crossTabSync: true,
	
	// Optional: event hooks
	onChange: (event) => console.log('Change:', event),
	onError: (error) => console.error('Error:', error),
	onBlocked: () => console.warn('Upgrade blocked'),
	onVersionChange: (event) => console.log('Version change requested')
})
```

### Database Methods

```typescript
// Accessors
db.getName()              // 'myApp'
db.getVersion()           // 1
db.getStoreNames()        // ['users', 'posts']
db.isOpen()               // true

// Store access
const store = db.store('users')

// Lifecycle
db.close()                // Close connection
await db.drop()           // Delete database entirely
```

### Native Access

Access the underlying `IDBDatabase` for advanced operations:

```typescript
const nativeDb = db.native

// Use native APIs
const tx = nativeDb.transaction(['users'], 'readonly')
const store = tx.objectStore('users')
const request = store.count()
// ... handle request events
```

---

## Store Operations

Access a store through `db.store(name)`:

```typescript
const store = db.store('users')
```

### get() — Optional Lookup

Returns `undefined` if record doesn't exist:

```typescript
// Single key
const user = await store.get('u1')
if (user) {
	console.log(user.name)
}

// Multiple keys (batch)
const users = await store.get(['u1', 'u2', 'u3'])
// users[1] may be undefined if 'u2' doesn't exist
```

### resolve() — Required Lookup

Throws `NotFoundError` if record doesn't exist:

```typescript
try {
	const user = await store.resolve('u1')
	console.log(user.name) // Safe - would have thrown
} catch (error) {
	if (error instanceof NotFoundError) {
		console.log(`User ${error.key} not found`)
	}
}

// Multiple keys - throws if ANY is missing
const users = await store.resolve(['u1', 'u2', 'u3'])
```

### set() — Upsert

Insert or update a record:

```typescript
// Single record
const key = await store.set({ id: 'u1', name: 'Alice', email: 'alice@example.com' })

// Multiple records (single transaction, atomic)
const keys = await store.set([user1, user2, user3])

// With out-of-line key
await store.set(valueWithoutId, 'custom-key')
```

### add() — Insert Only

Insert a new record, fails if key exists:

```typescript
try {
	await store.add({ id: 'u1', name: 'Alice' })
} catch (error) {
	if (error instanceof ConstraintError) {
		console.log('User already exists')
	}
}

// Batch insert
await store.add([user1, user2, user3])
```

### remove() — Delete

Remove records by key (silently succeeds if not found):

```typescript
// Single key
await store.remove('u1')

// Multiple keys
await store.remove(['u1', 'u2', 'u3'])
```

### has() — Existence Check

```typescript
// Single key
const exists = await store.has('u1') // boolean

// Multiple keys
const results = await store.has(['u1', 'u2']) // [true, false]
```

### Bulk Operations

```typescript
// Get all records
const allUsers = await store.all()

// With key range
const range = IDBKeyRange.bound('a', 'z')
const subset = await store.all(range)

// With limit
const first10 = await store.all(null, 10)

// Get all keys
const allKeys = await store.keys()

// Count records
const count = await store.count()

// Clear all records
await store.clear()
```

### Store Accessors

```typescript
store.getName()           // 'users'
store.getKeyPath()        // 'id' | null
store.getIndexNames()     // ['byEmail', 'byStatus']
store.hasAutoIncrement()  // false
```

---

## Index Operations

Access an index through `store.index(name)`:

```typescript
const byEmail = db.store('users').index('byEmail')
```

### Index Query Methods

Indexes support the same query methods as stores, but lookup by index key:

```typescript
// Get by index key (returns first match)
const user1 = await byEmail.get('alice@example.com')

// Resolve by index key
const user2 = await byEmail.resolve('alice@example.com')

// Get primary key for an index key
const primaryKey = await byEmail.getKey('alice@example.com')

// Bulk operations
const allByStatus = await db.store('users').index('byStatus').all(IDBKeyRange.only('active'))

// Count
const activeCount = await db.store('users').index('byStatus').count('active')
```

### Index Accessors

```typescript
byEmail.getName()         // 'byEmail'
byEmail.getKeyPath()      // 'email'
byEmail.isUnique()        // true
byEmail.isMultiEntry()    // false
```

---

## Query Builder

The query builder provides a fluent API for constructing queries. It maps directly to IndexedDB's `IDBKeyRange` operations for optimal performance.

### Basic Usage

```typescript
const results = await db.store('users').query()
	.where('status').equals('active')
	.orderBy('descending')
	.limit(10)
	.toArray()
```

### where() — Index Queries (Fast)

These operations use native `IDBKeyRange` and are highly efficient:

```typescript
// Exact match
db.where('status').equals('active')

// Range comparisons
db.where('age').greaterThan(18)
db.where('age').greaterThanOrEqual(18)
db.where('age').lessThan(65)
db.where('age').lessThanOrEqual(65)

// Between (inclusive by default)
db.where('age').between(18, 65)
db.where('age').between(18, 65, { lowerOpen: true, upperOpen: true })

// String prefix
db.where('lastName').startsWith('Smith')

// Multiple values (runs parallel queries, merges)
db.where('role').anyOf(['admin', 'moderator', 'vip'])
```

### Non-Indexable Types (Automatic Fallback)

IndexedDB only supports certain key types: `string`, `number`, `Date`, `ArrayBuffer`, and arrays of these.

**Boolean, null, undefined, and plain objects are NOT valid IndexedDB keys.**

The query builder automatically handles this by falling back to post-cursor filtering:

```typescript
// Boolean values - automatically uses filter (transparent to you)
const published = await db.store('posts').query()
	.where('published').equals(true)  // Works! Falls back to filter
	.toArray()

// This is equivalent to:
const published = await db.store('posts').query()
	.filter(post => post.published === true)
	.toArray()
```

> **Performance Note:** When using `equals()` with non-indexable types, the query scans all records. For best performance with boolean fields, consider storing them as `0`/`1` instead.

### filter() — Post-Cursor Filtering (Flexible)

For conditions that cannot use indexes:

```typescript
// String operations
db.filter(user => user.email.endsWith('@gmail.com'))
db.filter(user => user.name.includes('John'))

// Complex conditions
db.filter(user => user.age >= 18 && user.status === 'active')

// Regex
db.filter(user => /^J.*n$/.test(user.name))
```

### Combining where() and filter()

For best performance, use indexed `where()` first, then `filter()`:

```typescript
// Fast: narrow with index, then filter
const activeGmailUsers = await store.query()
	.where('status').equals('active')           // Uses index
	.filter(user => user.email.endsWith('@gmail.com'))  // Post-filter
	.toArray()
```

### Ordering and Pagination

```typescript
db.orderBy('ascending')   // Default
.orderBy('descending')
.limit(10)              // Maximum results
.offset(20)             // Skip first N results
```

### Terminal Operations

```typescript
// Get all matching records
const records = await query.toArray()

// Get first match only
const first = await query.first()

// Count matches
const count = await query.count()

// Get keys only
const keys = await query.keys()

// Memory-efficient iteration
for await (const record of query.iterate()) {
	processRecord(record)
	if (done) break
}
```

---

## Transactions

### Automatic Transactions

Most operations automatically create and manage transactions:

```typescript
// Each call uses its own transaction
await store.get('u1')
await store.set(user)
await store.remove('u1')

// Batch operations use a single transaction
await store.set([user1, user2, user3])  // Atomic
```

### Explicit Transactions

Use explicit transactions for multi-store atomic operations:

```typescript
// Read-only transaction
await db.read(['users', 'settings'], async (tx) => {
	const user = await tx.store('users').get('u1')
	const settings = await tx.store('settings').get('prefs')
	// Both reads are consistent
})

// Read-write transaction
await db.write(['users', 'posts'], async (tx) => {
	const user = await tx.store('users').resolve('u1')
	
	await tx.store('posts').set({
		id: crypto.randomUUID(),
		title: 'New Post',
		authorId: user.id
	})
	
	await tx.store('users').set({
		...user,
		postCount: user.postCount + 1
	})
	
	// Transaction commits on success, aborts on error
})
```

### Transaction Options

```typescript
await db.write(['users'], async (tx) => {
	await tx.store('users').set(user)
}, {
	durability: 'relaxed'  // Faster writes (Chrome)
})
```

| Durability  | Description                                       |
|-------------|---------------------------------------------------|
| `'default'` | OS/browser default behavior                       |
| `'strict'`  | Wait for data to be flushed to persistent storage |
| `'relaxed'` | May return before data is flushed (faster)        |

### Transaction Methods

```typescript
await db.write(['users'], async (tx) => {
	// Accessors
	tx.getMode()         // 'readonly' | 'readwrite'
	tx.getStoreNames()   // ['users']
	tx.isActive()        // true
	tx.isFinished()      // false
	
	// Control
	tx.abort()           // Roll back all changes
	tx.commit()          // Explicit commit (when supported)
})
```

---

## Cursors

### Async Generator Iteration

The preferred way to iterate over records:

```typescript
// Iterate all records
for await (const user of store.iterate()) {
	console.log(user.name)
	if (shouldStop) break  // Clean early termination
}

// With options
for await (const user of store.iterate({
	direction: 'previous',  // Reverse order
	query: IDBKeyRange.bound('a', 'm')  // Filter by key range
})) {
	console.log(user.name)
}

// Iterate keys only (more efficient)
for await (const key of store.iterateKeys()) {
	console.log(key)
}
```

### Manual Cursor (for Mutation)

Use manual cursors when you need to update or delete during iteration:

```typescript
await db.write(['users'], async (tx) => {
	let cursor = await tx.store('users').openCursor()
	
	while (cursor) {
		const user = cursor.getValue()
		
		if (user.status === 'inactive') {
			// Delete during iteration
			await cursor.delete()
		} else if (user.needsUpdate) {
			// Update during iteration
			await cursor.update({ ...user, updatedAt: Date.now() })
		}
		
		cursor = await cursor.continue()
	}
})
```

### Cursor Methods

```typescript
// Accessors
cursor.getKey()          // Current key
cursor.getPrimaryKey()   // Current primary key
cursor.getValue()        // Current record
cursor.getDirection()    // 'next' | 'previous' | ...

// Navigation
await cursor.continue()              // Next record
await cursor.continue(specificKey)   // Jump to key
await cursor.advance(5)              // Skip 5 records
await cursor.continuePrimaryKey(key, primaryKey)

// Mutation (in readwrite transaction)
await cursor.update(newValue)
await cursor.delete()
```

### Cursor Directions

| Direction          | Description                              |
|--------------------|------------------------------------------|
| `'next'`           | Ascending order, include duplicates      |
| `'nextunique'`     | Ascending order, skip duplicates         |
| `'previous'`       | Descending order, include duplicates     |
| `'previousunique'` | Descending order, skip duplicates        |

---

## Migrations

### Defining Migrations

Migrations run during version upgrades inside `onupgradeneeded`:

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
			migrate: (ctx) => {
				const store = ctx.transaction.objectStore('users')
				store.createIndex('byEmail', 'email', { unique: true })
			}
		},
		{
			// v2 -> v3: Normalize user names
			version: 3,
			migrate: async (ctx) => {
				const store = ctx.transaction.objectStore('users')
				const request = store.openCursor()
				
				await new Promise<void>((resolve, reject) => {
					request.onsuccess = () => {
						const cursor = request.result
						if (!cursor) {
							resolve()
							return
						}
						
						const user = cursor.value
						if (user.fullName && !user.firstName) {
							const [firstName, ...rest] = user.fullName.split(' ')
							cursor.update({
								...user,
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

### Migration Context

The migration function receives a context object:

```typescript
interface MigrationContext {
	readonly database: IDBDatabase      // Native database
	readonly transaction: IDBTransaction // Versionchange transaction
	readonly oldVersion: number          // Version before upgrade
	readonly newVersion: number          // Version after upgrade
}
```

### Common Migration Patterns

```typescript
// Create a new store
migrate: (ctx) => {
	ctx.database.createObjectStore('newStore', { keyPath: 'id' })
}

// Delete a store
migrate: (ctx) => {
	ctx.database.deleteObjectStore('oldStore')
}

// Add an index
migrate: (ctx) => {
	const store = ctx.transaction.objectStore('users')
	store.createIndex('byDate', 'createdAt')
}

// Remove an index
migrate: (ctx) => {
	const store = ctx.transaction.objectStore('users')
	store.deleteIndex('oldIndex')
}

// Transform data
migrate: async (ctx) => {
	const store = ctx.transaction.objectStore('users')
	const request = store.openCursor()
	
	await new Promise<void>((resolve, reject) => {
		request.onsuccess = () => {
			const cursor = request.result
			if (!cursor) {
				resolve()
				return
			}
			cursor.update(transformRecord(cursor.value))
			cursor.continue()
		}
		request.onerror = () => reject(request.error)
	})
}
```

---

## Reactivity & Events

### Change Events

Subscribe to data changes:

```typescript
// Database-level (all stores)
const unsubscribe = db.onChange((event) => {
	console.log(`${event.storeName}: ${event.type}`, event.keys)

	if (event.source === 'remote') {
		// Change from another tab
		refreshUI()
	}
})

unsubscribe()
```

```typescript
// Store-level
const unsubscribe = db.store('users').onChange((event) => {
	if (event.type === 'set') {
		invalidateCache(event.keys)
	}
})

// Cleanup
unsubscribe()
```

### Change Event Structure

```typescript
interface ChangeEvent {
	readonly storeName: string          // Store that changed
	readonly type: 'set' | 'add' | 'remove' | 'clear'
	readonly keys: readonly ValidKey[]  // Affected keys
	readonly source: 'local' | 'remote' // Origin of change
}
```

### Cross-Tab Synchronization

Enabled by default using `BroadcastChannel`:

```typescript
const db = await createDatabase({
	name: 'myApp',
	version: 1,
	stores: { users: {} },
	crossTabSync: true  // Default
})

// Changes in Tab 1
await db.store('users').set({ id: 'u1', name: 'Alice' })

// Tab 2 receives change event with source: 'remote'
db.onChange((event) => {
	if (event.source === 'remote') {
		console.log('Another tab made changes')
	}
})
```

### Error Events

```typescript
const unsubscribe = db.onError((error) => {
	console.error('Database error:', error)
	reportToAnalytics(error)
})
```

### Version Change Events

Triggered when another tab wants to upgrade the database:

```typescript
const unsubscribe = db.onVersionChange((event) => {
	console.log(`Upgrade requested: v${event.oldVersion} -> v${event.newVersion}`)
	// Typically close connection to allow upgrade
	db.close()
})
```

### Close Events

```typescript
const unsubscribe = db.onClose(() => {
	console.log('Database connection closed')
})
```

---

## Error Handling

### Error Classes

The library provides typed error classes for different failure modes:

```typescript
import {
	DatabaseError,
	NotFoundError,
	ConstraintError,
	QuotaExceededError,
	TransactionError,
	UpgradeError
} from '@mikesaintsg/indexeddb'
```

### Error Hierarchy

| Error Class          | Code                   | When Thrown                          |
|----------------------|------------------------|--------------------------------------|
| `DatabaseError`      | Various                | Base class for all errors            |
| `NotFoundError`      | `'NOT_FOUND'`          | `resolve()` when record missing      |
| `ConstraintError`    | `'CONSTRAINT_ERROR'`   | `add()` when key already exists      |
| `QuotaExceededError` | `'QUOTA_EXCEEDED'`     | Storage limit reached                |
| `TransactionError`   | `'TRANSACTION_*'`      | Transaction aborted or inactive      |
| `UpgradeError`       | `'UPGRADE_*'`          | Database upgrade failed or blocked   |

### Error Codes

```typescript
type DatabaseErrorCode =
	| 'OPEN_FAILED'
	| 'UPGRADE_FAILED'
	| 'UPGRADE_BLOCKED'
	| 'TRANSACTION_ABORTED'
	| 'TRANSACTION_INACTIVE'
	| 'CONSTRAINT_ERROR'
	| 'QUOTA_EXCEEDED'
	| 'NOT_FOUND'
	| 'DATA_ERROR'
	| 'READ_ONLY'
	| 'VERSION_ERROR'
	| 'INVALID_STATE'
	| 'TIMEOUT'
	| 'UNKNOWN_ERROR'
```

### Handling Errors

```typescript
// NotFoundError - resolve() when record missing
try {
	const user = await store.resolve('nonexistent')
} catch (error) {
	if (error instanceof NotFoundError) {
		console.log(`Key: ${error.key}, Store: ${error.storeName}`)
	}
}

// ConstraintError - add() when key exists
try {
	await store.add({ id: 'u1', name: 'Alice' })
} catch (error) {
	if (error instanceof ConstraintError) {
		console.log('Record already exists, updating instead')
		await store.set({ id: 'u1', name: 'Alice' })
	}
}

// QuotaExceededError - storage full
try {
	await store.set(largeData)
} catch (error) {
	if (error instanceof QuotaExceededError) {
		showStorageFullMessage()
	}
}

// TransactionError - transaction failed
try {
	await db.write(['users'], async (tx) => {
		// ...operations...
	})
} catch (error) {
	if (error instanceof TransactionError) {
		console.log(`Transaction failed: ${error.code}`)
	}
}

// Generic database error
try {
	await db.store('users').get('u1')
} catch (error) {
	if (error instanceof DatabaseError) {
		console.log(`Database error [${error.code}]: ${error.message}`)
	}
}
```

### Type Guards

```typescript
import {
	isNotFoundError,
	isConstraintError,
	isDatabaseError
} from '@mikesaintsg/indexeddb'

try {
	await store.resolve('u1')
} catch (error) {
	if (isNotFoundError(error)) {
		// error is typed as NotFoundError
	} else if (isDatabaseError(error)) {
		// error is typed as DatabaseError
	}
}
```

---

## Native Access

Every wrapper exposes its underlying native IndexedDB object via the `.native` property:

### Database

```typescript
const nativeDb: IDBDatabase = db.native

// Use native APIs for advanced patterns
const tx = nativeDb.transaction(['users'], 'readonly')
const objectStore = tx.objectStore('users')
const request = objectStore.count()
request.onsuccess = () => console.log(request.result)
```

### Store

```typescript
// Within a transaction context
const nativeStore: IDBObjectStore = store.native
```

### Index

```typescript
const nativeIndex: IDBIndex = store.index('byEmail').native
```

### Cursor

```typescript
const cursor = await store.openCursor()
if (cursor) {
	const nativeCursor: IDBCursorWithValue = cursor.native
}
```

### Transaction

```typescript
await db.write(['users'], async (tx) => {
	const nativeTx: IDBTransaction = tx.native
})
```

### When to Use Native Access

Use native access when you need:

- Features not exposed by the wrapper
- Maximum performance for specific operations
- Compatibility with other IndexedDB libraries
- Debugging with browser DevTools

---

## TypeScript Integration

### Schema Types

Define strongly-typed schemas for compile-time safety:

```typescript
// Record types
interface User {
	readonly id: string
	readonly name: string
	readonly email: string
	readonly age: number
	readonly roles: readonly string[]
}

interface Post {
	readonly id: string
	readonly title: string
	readonly content: string
	readonly authorId: string
	readonly publishedAt: Date
}

// Schema mapping store names to record types
interface AppSchema {
	readonly users: User
	readonly posts: Post
}

// Database is typed with schema
const db = await createDatabase<AppSchema>({
	name: 'myApp',
	version: 1,
	stores: {
		users: {},
		posts: {}
	}
})

// Store operations are type-safe
const user = await db.store('users').get('u1')
// user: User | undefined

const post = await db.store('posts').resolve('p1')
// post: Post (throws if not found)

// TypeScript catches invalid store names
db.store('invalid') // Error: Argument of type '"invalid"' is not assignable
```

### Readonly by Default

Return types use `readonly` for immutability:

```typescript
// Arrays are readonly
const users = await store.all()
// users: readonly User[]

const keys = await store.keys()
// keys: readonly ValidKey[]

// Attempting to mutate is a compile error
users.push(newUser) // Error: Property 'push' does not exist
```

### Strict Typing

The library is designed with TypeScript strict mode:

```typescript
// No `any` types
// No `!` non-null assertions
// No unsafe `as` casts

// Use type guards for narrowing
const user = await store.get('u1')
if (user) {
	// user is User, not User | undefined
	console.log(user.name)
}
```

### Key Types

```typescript
// ValidKey matches IDBValidKey
type ValidKey = IDBValidKey // number | string | Date | BufferSource | ValidKey[]

// KeyPath can be simple or compound
type KeyPath = string | readonly string[]
```

---

## Performance Tips

### 1. Batch Operations

Use array methods for automatic transaction batching:

```typescript
// ✅ One transaction, 100 operations
await store.set(arrayOf100Users)

// ❌ 100 transactions (slow)
for (const user of users) {
	await store.set(user)
}
```

### 2. Use Indexed Queries

Query builder with `where()` uses native indexes:

```typescript
// ✅ Fast: uses index
const active1 = await store.query()
	.where('status').equals('active')
	.toArray()

// ❌ Slow: scans all records
const active2 = await store.query()
	.filter(u => u.status === 'active')
	.toArray()
```

### 3. Combine where() and filter()

Narrow with index first, then filter:

```typescript
// ✅ Efficient: narrow with index, then filter
const results = await store.query()
	.where('status').equals('active')  // Uses index
	.filter(u => u.email.endsWith('@gmail.com'))  // Post-filter
	.toArray()
```

### 4. Use Async Generators

For large datasets, iterate instead of loading all:

```typescript
// ✅ Memory efficient: one record at a time
for await (const user of store.iterate()) {
	processUser(user)
	if (done) break
}

// ❌ Memory heavy: loads all records
const allUsers = await store.all()
for (const user of allUsers) {
	processUser(user)
}
```

### 5. Transaction Durability

Use relaxed durability for non-critical writes:

```typescript
await db.write(['logs'], async (tx) => {
	await tx.store('logs').set(logEntry)
}, { durability: 'relaxed' }) // Faster
```

### 6. Lazy Connection

The database opens on first operation, not on `createDatabase()`:

```typescript
const db = await createDatabase(options)  // Fast - just setup
await db.store('users').get('u1')         // Connection opens here
```

### 7. Key-Only Cursors

When you only need keys, use key cursors:

```typescript
// ✅ Efficient: key-only cursor
for await (const key of store.iterateKeys()) {
	console.log(key)
}

// ❌ Less efficient: full record cursor
for await (const user of store.iterate()) {
	console.log(user.id)
}
```

---

## API Reference

### Factory Functions

#### createDatabase\<Schema\>(options): Promise\<DatabaseInterface\<Schema\>\>

Creates or opens a database connection.

**Parameters:**
- `options.name` - Database name
- `options.version` - Database version (positive integer)
- `options.stores` - Store definitions
- `options.migrations` - Migration functions (optional)
- `options.crossTabSync` - Enable cross-tab sync (default: true)
- `options.onChange` - Change event callback (optional)
- `options.onError` - Error event callback (optional)
- `options.onBlocked` - Blocked event callback (optional)
- `options.onVersionChange` - Version change callback (optional)
- `options.onClose` - Close event callback (optional)

**Returns:** Promise resolving to DatabaseInterface

---

### DatabaseInterface\<Schema\>

#### Properties

| Property | Type          | Description               |
|----------|---------------|---------------------------|
| `native` | `IDBDatabase` | Native IndexedDB database |

#### Methods

| Method                               | Returns             | Description                  |
|--------------------------------------|---------------------|------------------------------|
| `getName()`                          | `string`            | Database name                |
| `getVersion()`                       | `number`            | Database version             |
| `getStoreNames()`                    | `readonly string[]` | All store names              |
| `isOpen()`                           | `boolean`           | Connection status            |
| `store(name)`                        | `StoreInterface<T>` | Get store interface          |
| `read(stores, operation)`            | `Promise<void>`     | Read transaction             |
| `write(stores, operation, options?)` | `Promise<void>`     | Write transaction            |
| `close()`                            | `void`              | Close connection             |
| `drop()`                             | `Promise<void>`     | Delete database              |
| `onChange(callback)`                 | `Unsubscribe`       | Subscribe to changes         |
| `onError(callback)`                  | `Unsubscribe`       | Subscribe to errors          |
| `onVersionChange(callback)`          | `Unsubscribe`       | Subscribe to version changes |
| `onClose(callback)`                  | `Unsubscribe`       | Subscribe to close           |

---

### StoreInterface\<T\>

#### Properties

| Property | Type             | Description         |
|----------|------------------|---------------------|
| `native` | `IDBObjectStore` | Native object store |

#### Methods

| Method                    | Returns                                | Description           |
|---------------------------|----------------------------------------|-----------------------|
| `getName()`               | `string`                               | Store name            |
| `getKeyPath()`            | `KeyPath \| null`                      | Key path              |
| `getIndexNames()`         | `readonly string[]`                    | Index names           |
| `hasAutoIncrement()`      | `boolean`                              | Auto-increment status |
| `get(key)`                | `Promise<T \| undefined>`              | Get by key            |
| `get(keys)`               | `Promise<readonly (T \| undefined)[]>` | Get multiple          |
| `resolve(key)`            | `Promise<T>`                           | Get or throw          |
| `resolve(keys)`           | `Promise<readonly T[]>`                | Get all or throw      |
| `set(value, key?)`        | `Promise<ValidKey>`                    | Upsert                |
| `set(values)`             | `Promise<readonly ValidKey[]>`         | Batch upsert          |
| `add(value, key?)`        | `Promise<ValidKey>`                    | Insert                |
| `add(values)`             | `Promise<readonly ValidKey[]>`         | Batch insert          |
| `remove(key)`             | `Promise<void>`                        | Delete                |
| `remove(keys)`            | `Promise<void>`                        | Batch delete          |
| `has(key)`                | `Promise<boolean>`                     | Check existence       |
| `has(keys)`               | `Promise<readonly boolean[]>`          | Batch check           |
| `all(query?, count?)`     | `Promise<readonly T[]>`                | Get all               |
| `keys(query?, count?)`    | `Promise<readonly ValidKey[]>`         | Get all keys          |
| `clear()`                 | `Promise<void>`                        | Clear store           |
| `count(query?)`           | `Promise<number>`                      | Count records         |
| `query()`                 | `QueryBuilderInterface<T>`             | Query builder         |
| `index(name)`             | `IndexInterface<T>`                    | Get index             |
| `iterate(options?)`       | `AsyncGenerator<T>`                    | Iterate records       |
| `iterateKeys(options?)`   | `AsyncGenerator<ValidKey>`             | Iterate keys          |
| `openCursor(options?)`    | `Promise<CursorInterface<T> \| null>`  | Manual cursor         |
| `openKeyCursor(options?)` | `Promise<KeyCursorInterface \| null>`  | Key cursor            |
| `onChange(callback)`      | `Unsubscribe`                          | Subscribe to changes  |

---

### IndexInterface\<T\>

#### Properties

| Property | Type       | Description  |
|----------|------------|--------------|
| `native` | `IDBIndex` | Native index |

#### Methods

| Method                    | Returns                                | Description       |
|---------------------------|----------------------------------------|-------------------|
| `getName()`               | `string`                               | Index name        |
| `getKeyPath()`            | `KeyPath`                              | Index key path    |
| `isUnique()`              | `boolean`                              | Unique constraint |
| `isMultiEntry()`          | `boolean`                              | Multi-entry mode  |
| `get(key)`                | `Promise<T \| undefined>`              | Get by index key  |
| `get(keys)`               | `Promise<readonly (T \| undefined)[]>` | Get multiple      |
| `resolve(key)`            | `Promise<T>`                           | Get or throw      |
| `resolve(keys)`           | `Promise<readonly T[]>`                | Get all or throw  |
| `getKey(key)`             | `Promise<ValidKey \| undefined>`       | Get primary key   |
| `all(query?, count?)`     | `Promise<readonly T[]>`                | Get all           |
| `keys(query?, count?)`    | `Promise<readonly ValidKey[]>`         | Get primary keys  |
| `count(query?)`           | `Promise<number>`                      | Count records     |
| `query()`                 | `QueryBuilderInterface<T>`             | Query builder     |
| `iterate(options?)`       | `AsyncGenerator<T>`                    | Iterate records   |
| `iterateKeys(options?)`   | `AsyncGenerator<ValidKey>`             | Iterate keys      |
| `openCursor(options?)`    | `Promise<CursorInterface<T> \| null>`  | Manual cursor     |
| `openKeyCursor(options?)` | `Promise<KeyCursorInterface \| null>`  | Key cursor        |

---

### QueryBuilderInterface\<T\>

#### Methods

| Method               | Returns                        | Description            |
|----------------------|--------------------------------|------------------------|
| `where(keyPath)`     | `WhereClauseInterface<T>`      | Add index filter       |
| `filter(predicate)`  | `QueryBuilderInterface<T>`     | Add post-cursor filter |
| `orderBy(direction)` | `QueryBuilderInterface<T>`     | Set ordering           |
| `limit(count)`       | `QueryBuilderInterface<T>`     | Limit results          |
| `offset(count)`      | `QueryBuilderInterface<T>`     | Skip results           |
| `toArray()`          | `Promise<readonly T[]>`        | Execute, return all    |
| `first()`            | `Promise<T \| undefined>`      | Execute, return first  |
| `count()`            | `Promise<number>`              | Execute, return count  |
| `keys()`             | `Promise<readonly ValidKey[]>` | Execute, return keys   |
| `iterate()`          | `AsyncGenerator<T>`            | Execute, iterate       |

---

### WhereClauseInterface\<T\>

#### Methods

| Method                            | Returns                    | Description      |
|-----------------------------------|----------------------------|------------------|
| `equals(value)`                   | `QueryBuilderInterface<T>` | Exact match      |
| `greaterThan(value)`              | `QueryBuilderInterface<T>` | Greater than     |
| `greaterThanOrEqual(value)`       | `QueryBuilderInterface<T>` | Greater or equal |
| `lessThan(value)`                 | `QueryBuilderInterface<T>` | Less than        |
| `lessThanOrEqual(value)`          | `QueryBuilderInterface<T>` | Less or equal    |
| `between(lower, upper, options?)` | `QueryBuilderInterface<T>` | Range query      |
| `startsWith(prefix)`              | `QueryBuilderInterface<T>` | String prefix    |
| `anyOf(values)`                   | `QueryBuilderInterface<T>` | Multiple values  |

---

### CursorInterface\<T\>

#### Properties

| Property | Type                 | Description   |
|----------|----------------------|---------------|
| `native` | `IDBCursorWithValue` | Native cursor |

#### Methods

| Method                                | Returns                               | Description         |
|---------------------------------------|---------------------------------------|---------------------|
| `getKey()`                            | `ValidKey`                            | Current key         |
| `getPrimaryKey()`                     | `ValidKey`                            | Current primary key |
| `getValue()`                          | `T`                                   | Current value       |
| `getDirection()`                      | `CursorDirection`                     | Cursor direction    |
| `continue(key?)`                      | `Promise<CursorInterface<T> \| null>` | Next record         |
| `continuePrimaryKey(key, primaryKey)` | `Promise<CursorInterface<T> \| null>` | Jump to key         |
| `advance(count)`                      | `Promise<CursorInterface<T> \| null>` | Skip records        |
| `update(value)`                       | `Promise<ValidKey>`                   | Update current      |
| `delete()`                            | `Promise<void>`                       | Delete current      |

---

### TransactionInterface\<Schema, K\>

#### Properties

| Property | Type             | Description        |
|----------|------------------|--------------------|
| `native` | `IDBTransaction` | Native transaction |

#### Methods

| Method            | Returns                        | Description          |
|-------------------|--------------------------------|----------------------|
| `getMode()`       | `TransactionMode`              | Transaction mode     |
| `getStoreNames()` | `readonly string[]`            | Store names in scope |
| `isActive()`      | `boolean`                      | Transaction active   |
| `isFinished()`    | `boolean`                      | Transaction finished |
| `store(name)`     | `TransactionStoreInterface<T>` | Get store            |
| `abort()`         | `void`                         | Abort transaction    |
| `commit()`        | `void`                         | Commit transaction   |

---

### Types

```typescript
type ValidKey = IDBValidKey
type KeyPath = string | readonly string[]
type TransactionMode = 'readonly' | 'readwrite'
type TransactionDurability = 'default' | 'strict' | 'relaxed'
type CursorDirection = 'next' | 'nextunique' | 'previous' | 'previousunique'
type OrderDirection = 'ascending' | 'descending'
type ChangeType = 'set' | 'add' | 'remove' | 'clear'
type ChangeSource = 'local' | 'remote'
type Unsubscribe = () => void
```

---

## License

MIT © Mike Garcia

