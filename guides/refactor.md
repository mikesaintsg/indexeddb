# IndexedDB Package:  Critical Fixes, Features, and Documentation

## Context

You are working on `mikesaintsg/indexeddb`, a zero-dependency, type-safe IndexedDB wrapper for SPAs/PWAs. The package follows strict TypeScript standards with ESM-only modules, `#` private fields, `readonly` preferences, and a specific naming taxonomy.

## Project Standards (CRITICAL)

- **ESM-only** with `.js` extensions in imports
- **No `any`**, no non-null assertions (`!`), no unsafe casts (`as`)
- **`#` private fields** (runtime-enforced), not `private` keyword
- **Named exports only**; no default exports
- **Tabs for indentation**
- **Full TSDoc** on public exports with `@param`, `@returns`, `@example`
- **Vitest** for testing; mirror source structure in `tests/`
- **Never create placeholder tests** that pass; use `it.todo()` for unimplemented

## Naming Conventions

- **Accessors:** `get`, `peek`, `at`, `has`, `is` (pure, no mutation)
- **Mutators:** `set`, `update`, `append`, `remove`, `delete`, `clear`
- **Transformers:** `to`, `as`, `clone` (pure, new instance)
- **Constructors:** `from`, `create`, `of` (factory functions)
- **Events:** `on` prefix, always return cleanup `() => void`

---

## Task 1: Fix Duplicate Constructor Assignments in Database.ts

**File:** `src/core/Database.ts`

**Problem:** The constructor has duplicate assignments around lines 56-60 and 67-71:
```typescript
this.#name = options.name
this.#version = options.version
this.#storeDefinitions = options.stores
this.#migrations = options.migrations ??  []
this.#onBlocked = options.onBlocked
```

**Action:** Remove the duplicate block (keep only one set of assignments).

---

## Task 2: Create TransactionIndex Class

**Problem:** `TransactionStore.index()` returns an `Index` instance that opens NEW transactions for each operation, breaking atomicity within explicit transactions.

**Solution:** Create `src/core/TransactionIndex.ts` that operates on the existing `IDBIndex` from the parent transaction. 

```typescript
/**
 * Transaction-bound Index implementation
 *
 * @remarks
 * Implements index operations within an existing transaction. 
 * All operations use the parent transaction's index - no new transactions created. 
 *
 * @packageDocumentation
 */

import type {
	CursorInterface,
	CursorOptions,
	KeyCursorInterface,
	KeyPath,
	ValidKey,
} from '../types. js'
import { NotFoundError, wrapError } from '../errors.js'
import { toIDBCursorDirection } from '../helpers.js'
import { Cursor } from './Cursor.js'
import { KeyCursor } from './KeyCursor.js'

/**
 * Index operations bound to a transaction. 
 *
 * @remarks
 * Unlike the standalone `Index` class, `TransactionIndex` does not create
 * new transactions.  All operations execute within the parent transaction,
 * maintaining atomicity guarantees.
 *
 * Note: `query()`, `iterate()`, and `iterateKeys()` are not available
 * on `TransactionIndex` as they require transaction lifecycle control.
 */
export class TransactionIndex<T> {
	readonly #index: IDBIndex
	readonly #storeName: string

	constructor(index: IDBIndex, storeName: string) {
		this. #index = index
		this.#storeName = storeName
	}

	// ─── Native Access ───────────────────────────────────────

	/**
	 * Access the underlying IDBIndex. 
	 */
	get native(): IDBIndex {
		return this.#index
	}

	// ─── Accessors ───────────────────────────────────────────

	/**
	 * Get the index name. 
	 */
	getName(): string {
		return this.#index.name
	}

	/**
	 * Get the index key path.
	 */
	getKeyPath(): KeyPath {
		const kp = this.#index.keyPath
		return Array.isArray(kp) ? kp : kp as string
	}

	/**
	 * Check if the index enforces uniqueness. 
	 */
	isUnique(): boolean {
		return this. #index.unique
	}

	/**
	 * Check if the index is multi-entry.
	 */
	isMultiEntry(): boolean {
		return this.#index.multiEntry
	}

	// ─── Get ─────────────────────────────────────────────────

	/**
	 * Get a record by index key.
	 *
	 * @param key - The index key to look up
	 * @returns The record or undefined if not found
	 */
	get(key: ValidKey): Promise<T | undefined>
	get(keys: readonly ValidKey[]): Promise<readonly (T | undefined)[]>
	async get(keyOrKeys: ValidKey | readonly ValidKey[]): Promise<T | undefined | readonly (T | undefined)[]> {
		if (Array.isArray(keyOrKeys)) {
			return Promise.all(
				keyOrKeys. map(k => this.#request(this.#index.get(k)) as Promise<T | undefined>),
			)
		}
		return this.#request(this.#index.get(keyOrKeys as IDBValidKey)) as Promise<T | undefined>
	}

	// ─── Resolve ─────────────────────────────────────────────

	/**
	 * Get a record by index key, throwing if not found. 
	 *
	 * @param key - The index key to look up
	 * @returns The record
	 * @throws NotFoundError if record doesn't exist
	 */
	resolve(key: ValidKey): Promise<T>
	resolve(keys: readonly ValidKey[]): Promise<readonly T[]>
	async resolve(keyOrKeys: ValidKey | readonly ValidKey[]): Promise<T | readonly T[]> {
		if (Array.isArray(keyOrKeys)) {
			return Promise.all(
				keyOrKeys. map(async k => {
					const result = await (this.#request(this.#index. get(k)) as Promise<T | undefined>)
					if (result === undefined) throw new NotFoundError(this.#storeName, k)
					return result
				}),
			)
		}
		const result = await (this.#request(this.#index.get(keyOrKeys as IDBValidKey)) as Promise<T | undefined>)
		if (result === undefined) throw new NotFoundError(this.#storeName, keyOrKeys as IDBValidKey)
		return result
	}

	// ─── Has ─────────────────────────────────────────────────

	/**
	 * Check if a record exists by index key.
	 *
	 * @param key - The index key to check
	 * @returns true if record exists
	 */
	has(key: ValidKey): Promise<boolean>
	has(keys: readonly ValidKey[]): Promise<readonly boolean[]>
	async has(keyOrKeys: ValidKey | readonly ValidKey[]): Promise<boolean | readonly boolean[]> {
		if (Array. isArray(keyOrKeys)) {
			return Promise.all(
				keyOrKeys.map(async k => {
					const count = await this.#request(this.#index.count(k))
					return count > 0
				}),
			)
		}
		const count = await this.#request(this.#index.count(keyOrKeys as IDBValidKey))
		return count > 0
	}

	// ─── Get Key ─────────────────────────────────────────────

	/**
	 * Get the primary key for an index key.
	 *
	 * @param key - The index key
	 * @returns The primary key or undefined
	 */
	async getKey(key: ValidKey): Promise<ValidKey | undefined> {
		return this.#request(this.#index.getKey(key))
	}

	// ─── Bulk Operations ─────────────────────────────────────

	/**
	 * Get all records matching a query.
	 *
	 * @param query - Optional key range
	 * @param count - Optional maximum count
	 * @returns Array of matching records
	 */
	async all(query?: IDBKeyRange | null, count?: number): Promise<readonly T[]> {
		return this.#request(this.#index. getAll(query ??  undefined, count)) as Promise<readonly T[]>
	}

	/**
	 * Get all keys matching a query. 
	 *
	 * @param query - Optional key range
	 * @param count - Optional maximum count
	 * @returns Array of matching keys
	 */
	async keys(query?: IDBKeyRange | null, count?: number): Promise<readonly ValidKey[]> {
		return this.#request(this.#index. getAllKeys(query ?? undefined, count)) as Promise<readonly ValidKey[]>
	}

	/**
	 * Count records matching a query. 
	 *
	 * @param query - Optional key or key range
	 * @returns Count of matching records
	 */
	async count(query?: IDBKeyRange | ValidKey | null): Promise<number> {
		return this.#request(this.#index. count(query as IDBValidKey | IDBKeyRange | undefined))
	}

	// ─── Cursors ─────────────────────────────────────────────

	/**
	 * Open a cursor over the index.
	 *
	 * @param options - Cursor options
	 * @returns Cursor or null if no records
	 */
	async openCursor(options?:  CursorOptions): Promise<CursorInterface<T> | null> {
		const direction = toIDBCursorDirection(options?.direction)
		const request = this.#index.openCursor(
			options?.query as IDBKeyRange | IDBValidKey | null ??  null,
			direction,
		)
		const cursor = await this.#request(request)
		return cursor ? new Cursor<T>(cursor, request) : null
	}

	/**
	 * Open a key cursor over the index. 
	 *
	 * @param options - Cursor options
	 * @returns Key cursor or null if no records
	 */
	async openKeyCursor(options?:  CursorOptions): Promise<KeyCursorInterface | null> {
		const direction = toIDBCursorDirection(options?.direction)
		const request = this.#index. openKeyCursor(
			options?.query as IDBKeyRange | IDBValidKey | null ?? null,
			direction,
		)
		const cursor = await this.#request(request)
		return cursor ? new KeyCursor(cursor, request) : null
	}

	// ─── Private Helpers ─────────────────────────────────────

	#request<R>(request: IDBRequest<R>): Promise<R> {
		return new Promise((resolve, reject) => {
			request. onsuccess = () => resolve(request.result)
			request.onerror = () => reject(wrapError(request. error, { storeName: this.#storeName }))
		})
	}
}
```

**Update `src/core/TransactionStore.ts`:**

Replace the `index()` method:
```typescript
import { TransactionIndex } from './TransactionIndex. js'

// Change return type and implementation: 
index(name: string): TransactionIndex<T> {
	if (! this.#store. indexNames.contains(name)) {
		throw new Error(`Index "${name}" not found on store "${this.#storeName}"`)
	}
	const nativeIndex = this. #store.index(name)
	return new TransactionIndex<T>(nativeIndex, this.#storeName)
}
```

**Update `src/types.ts`:**

Add `TransactionIndexInterface` and update `TransactionStoreInterface. index()` return type:
```typescript
/**
 * Transaction-bound index interface. 
 *
 * @remarks
 * Subset of IndexInterface that operates within a transaction.
 * Does not include query(), iterate(), or iterateKeys() as these
 * require transaction lifecycle control. 
 */
export interface TransactionIndexInterface<T> {
	/** Access the underlying IDBIndex */
	readonly native: IDBIndex

	/** Get the index name */
	getName(): string

	/** Get the index key path */
	getKeyPath(): KeyPath

	/** Check if the index enforces uniqueness */
	isUnique(): boolean

	/** Check if the index is multi-entry */
	isMultiEntry(): boolean

	/** Get record(s) by index key */
	get(key: ValidKey): Promise<T | undefined>
	get(keys:  readonly ValidKey[]): Promise<readonly (T | undefined)[]>

	/** Get record(s) by index key, throwing if not found */
	resolve(key: ValidKey): Promise<T>
	resolve(keys: readonly ValidKey[]): Promise<readonly T[]>

	/** Check if record(s) exist by index key */
	has(key: ValidKey): Promise<boolean>
	has(keys: readonly ValidKey[]): Promise<readonly boolean[]>

	/** Get the primary key for an index key */
	getKey(key: ValidKey): Promise<ValidKey | undefined>

	/** Get all records matching a query */
	all(query?: IDBKeyRange | null, count?: number): Promise<readonly T[]>

	/** Get all keys matching a query */
	keys(query?:  IDBKeyRange | null, count?: number): Promise<readonly ValidKey[]>

	/** Count records matching a query */
	count(query?: IDBKeyRange | ValidKey | null): Promise<number>

	/** Open a cursor */
	openCursor(options?: CursorOptions): Promise<CursorInterface<T> | null>

	/** Open a key cursor */
	openKeyCursor(options?: CursorOptions): Promise<KeyCursorInterface | null>
}
```

Update `TransactionStoreInterface`:
```typescript
/** Get an index bound to this transaction */
index(name: string): TransactionIndexInterface<T>
```

**Add barrel export in `src/core/index.ts` (if exists) or update main exports.**

---

## Task 3: Fix `#extractPrimaryKey` for Compound Keys

**File:** `src/core/QueryBuilder.ts`

**Problem:** Current implementation doesn't handle compound key paths (arrays).

**Current code:**
```typescript
#extractPrimaryKey(item: T): ValidKey | undefined {
	const keyPath = this.#context.primaryKeyPath
	if (keyPath === null || typeof item !== 'object' || item === null) {
		return undefined
	}
	return (item as Record<string, unknown>)[keyPath] as ValidKey
}
```

**Fix:** Import and use `extractKey` from helpers:
```typescript
// Add to imports at top of file: 
import { extractKey } from '../helpers. js'

// Replace the method:
#extractPrimaryKey(item: T): ValidKey | undefined {
	const keyPath = this.#context. primaryKeyPath
	if (keyPath === null || typeof item !== 'object' || item === null) {
		return undefined
	}
	return extractKey(item, keyPath)
}
```

---

## Task 4: Add `has()` to Index

**File:** `src/core/Index. ts`

Add after the `getKey()` method:
```typescript
// ─── Has ─────────────────────────────────────────────────

/**
 * Check if a record exists by index key. 
 *
 * @param key - The index key to check
 * @returns true if at least one record exists with this index key
 *
 * @example
 * ```ts
 * const emailExists = await db.store('users').index('byEmail').has('alice@test.com')
 * ```
 */
has(key:  ValidKey): Promise<boolean>

/**
 * Check if records exist by index keys.
 *
 * @param keys - The index keys to check
 * @returns Array of booleans indicating existence
 */
has(keys: readonly ValidKey[]): Promise<readonly boolean[]>

async has(keyOrKeys: ValidKey | readonly ValidKey[]): Promise<boolean | readonly boolean[]> {
	const db = await this.#ensureOpen()
	const tx = db.transaction([this.#storeName], 'readonly')
	const store = tx.objectStore(this.#storeName)
	const index = store.index(this. #indexName)

	if (Array.isArray(keyOrKeys)) {
		return await Promise.all(
			keyOrKeys. map(async k => {
				const count = await this.#request(index.count(k))
				return count > 0
			}),
		)
	}

	const count = await this. #request(index. count(keyOrKeys as IDBValidKey))
	return count > 0
}
```

**Update `src/types.ts` `IndexInterface`:**
```typescript
/**
 * Check if record(s) exist by index key.
 *
 * @param key - The index key to check
 * @returns true if at least one record exists
 */
has(key:  ValidKey): Promise<boolean>

/**
 * Check if records exist by index keys.
 *
 * @param keys - The index keys to check
 * @returns Array of booleans indicating existence
 */
has(keys: readonly ValidKey[]): Promise<readonly boolean[]>
```

---

## Task 5: Add `has()` to TransactionStore

**File:** `src/core/TransactionStore.ts`

Add after the bulk operations section:
```typescript
// ─── Has ─────────────────────────────────────────────────

/**
 * Check if a record exists by primary key.
 *
 * @param key - The key to check
 * @returns true if record exists
 */
has(key: ValidKey): Promise<boolean>

/**
 * Check if records exist by primary keys. 
 *
 * @param keys - The keys to check
 * @returns Array of booleans indicating existence
 */
has(keys: readonly ValidKey[]): Promise<readonly boolean[]>

async has(keyOrKeys: ValidKey | readonly ValidKey[]): Promise<boolean | readonly boolean[]> {
	if (Array.isArray(keyOrKeys)) {
		return Promise.all(
			keyOrKeys.map(async k => {
				const count = await this.#request(this.#store.count(k))
				return count > 0
			}),
		)
	}

	const count = await this.#request(this.#store.count(keyOrKeys as IDBValidKey))
	return count > 0
}
```

**Update `src/types.ts` `TransactionStoreInterface`:**
```typescript
/** Check if record(s) exist by primary key */
has(key: ValidKey): Promise<boolean>
has(keys: readonly ValidKey[]): Promise<readonly boolean[]>
```

---

## Task 6: Add Bulk Operation Progress Callbacks

**File:** `src/types.ts`

Add new interface:
```typescript
/**
 * Options for bulk operations. 
 */
export interface BulkOperationOptions {
	/**
	 * Progress callback for bulk operations. 
	 *
	 * @param current - Current item index (1-based)
	 * @param total - Total number of items
	 */
	readonly onProgress?: (current:  number, total: number) => void
}
```

**File:** `src/core/Store.ts`

Update the `set()` and `add()` method signatures and implementations: 

```typescript
// Update set() overloads:
set(value: T, key?: ValidKey): Promise<ValidKey>
set(values: readonly T[], options?: BulkOperationOptions): Promise<readonly ValidKey[]>

async set(
	valueOrValues: T | readonly T[],
	keyOrOptions?: ValidKey | BulkOperationOptions,
): Promise<ValidKey | readonly ValidKey[]> {
	const db = await this. #database. ensureOpen()
	const tx = db. transaction([this.#name], 'readwrite')
	const store = tx.objectStore(this.#name)

	if (Array.isArray(valueOrValues)) {
		const options = keyOrOptions as BulkOperationOptions | undefined
		const keys:  ValidKey[] = []
		const total = valueOrValues. length

		for (let i = 0; i < total; i++) {
			const key = await this.#request(store.put(valueOrValues[i]))
			keys.push(key)
			options?.onProgress?.(i + 1, total)
		}

		await this.#awaitTransaction(tx)
		this.#emitChange('set', keys)
		return keys as readonly ValidKey[]
	}

	const key = keyOrOptions as ValidKey | undefined
	const resultKey = await this. #request(store. put(valueOrValues, key))
	await this.#awaitTransaction(tx)
	this.#emitChange('set', [resultKey])
	return resultKey
}

// Update add() overloads:
add(value:  T, key?: ValidKey): Promise<ValidKey>
add(values: readonly T[], options?: BulkOperationOptions): Promise<readonly ValidKey[]>

async add(
	valueOrValues: T | readonly T[],
	keyOrOptions?: ValidKey | BulkOperationOptions,
): Promise<ValidKey | readonly ValidKey[]> {
	const db = await this.#database.ensureOpen()
	const tx = db.transaction([this.#name], 'readwrite')
	const store = tx.objectStore(this.#name)

	if (Array.isArray(valueOrValues)) {
		const options = keyOrOptions as BulkOperationOptions | undefined
		const keys: ValidKey[] = []
		const total = valueOrValues. length

		for (let i = 0; i < total; i++) {
			const key = await this.#request(store.add(valueOrValues[i]))
			keys.push(key)
			options?.onProgress?.(i + 1, total)
		}

		await this.#awaitTransaction(tx)
		this.#emitChange('add', keys)
		return keys as readonly ValidKey[]
	}

	const key = keyOrOptions as ValidKey | undefined
	const resultKey = await this.#request(store.add(valueOrValues, key))
	await this. #awaitTransaction(tx)
	this.#emitChange('add', [resultKey])
	return resultKey
}
```

**Update `src/types.ts` `StoreInterface`:**
```typescript
/**
 * Insert or update a record. 
 */
set(value: T, key?: ValidKey): Promise<ValidKey>

/**
 * Insert or update multiple records.
 *
 * @param values - Records to set
 * @param options - Optional progress callback
 */
set(values: readonly T[], options?: BulkOperationOptions): Promise<readonly ValidKey[]>

/**
 * Insert a new record (fails if key exists).
 */
add(value: T, key?: ValidKey): Promise<ValidKey>

/**
 * Insert multiple new records. 
 *
 * @param values - Records to add
 * @param options - Optional progress callback
 */
add(values: readonly T[], options?: BulkOperationOptions): Promise<readonly ValidKey[]>
```

---

## Task 7: Add Export/Import APIs

**File:** `src/types.ts`

Add interfaces: 
```typescript
/**
 * Exported database data structure.
 */
export interface ExportedData {
	/** Database version at time of export */
	readonly version: number
	/** Store data keyed by store name */
	readonly stores:  Readonly<Record<string, readonly unknown[]>>
	/** ISO timestamp of export */
	readonly exportedAt: string
}

/**
 * Options for import operation.
 */
export interface ImportOptions {
	/** If true, clears stores before importing.  Default:  true */
	readonly clearExisting?: boolean
	/** Progress callback */
	readonly onProgress?: (storeName: string, current: number, total:  number) => void
}
```

Add to `DatabaseInterface`:
```typescript
/**
 * Export all database data.
 *
 * @returns Exported data structure with all store contents
 *
 * @example
 * ```ts
 * const backup = await db.export()
 * localStorage.setItem('backup', JSON.stringify(backup))
 * ```
 */
export(): Promise<ExportedData>

/**
 * Import data into the database.
 *
 * @param data - Previously exported data
 * @param options - Import options
 *
 * @remarks
 * By default, clears existing data before import.
 * Only imports data for stores that exist in current schema.
 *
 * @example
 * ```ts
 * const backup = JSON.parse(localStorage. getItem('backup'))
 * await db.import(backup)
 * ```
 */
import(data: ExportedData, options?: ImportOptions): Promise<void>
```

**File:** `src/core/Database.ts`

Add imports at top: 
```typescript
import type { ExportedData, ImportOptions } from '../types.js'
import { promisifyRequest } from '../helpers. js'
```

Add methods after `drop()`:
```typescript
// ─── Export/Import ───────────────────────────────────────

/**
 * Export all database data.
 *
 * @returns Exported data structure
 */
async export(): Promise<ExportedData> {
	const db = await this.ensureOpen()
	const storeNames = Array.from(db.objectStoreNames)
	const stores:  Record<string, unknown[]> = {}

	for (const name of storeNames) {
		const tx = db.transaction([name], 'readonly')
		const store = tx.objectStore(name)
		const request = store.getAll()
		stores[name] = await promisifyRequest(request)
	}

	return {
		version: this.#version,
		stores,
		exportedAt: new Date().toISOString(),
	}
}

/**
 * Import data into the database.
 *
 * @param data - Previously exported data
 * @param options - Import options
 */
async import(data: ExportedData, options?: ImportOptions): Promise<void> {
	const db = await this.ensureOpen()
	const clearExisting = options?. clearExisting !== false

	for (const [name, records] of Object.entries(data.stores)) {
		if (! db.objectStoreNames.contains(name)) {
			continue
		}

		const tx = db.transaction([name], 'readwrite')
		const store = tx. objectStore(name)
		const total = records.length

		if (clearExisting) {
			await promisifyRequest(store.clear())
		}

		for (let i = 0; i < total; i++) {
			await promisifyRequest(store.put(records[i]))
			options?.onProgress? .(name, i + 1, total)
		}

		await promisifyTransaction(tx)
	}
}
```

---

## Task 8: Add Storage Quota API

**File:** `src/types.ts`

Add interface:
```typescript
/**
 * Storage usage estimate.
 */
export interface StorageEstimate {
	/** Bytes currently used */
	readonly usage: number
	/** Total quota in bytes */
	readonly quota: number
	/** Available bytes (quota - usage) */
	readonly available:  number
}
```

Add to `DatabaseInterface`:
```typescript
/**
 * Get storage usage estimate.
 *
 * @returns Storage estimate with usage, quota, and available space
 *
 * @remarks
 * Uses the StorageManager API.  Returns zeros if API unavailable.
 *
 * @example
 * ```ts
 * const { usage, quota, available } = await db. getStorageEstimate()
 * console.log(`Using ${(usage / 1024 / 1024).toFixed(2)}MB of ${(quota / 1024 / 1024).toFixed(2)}MB`)
 * ```
 */
getStorageEstimate(): Promise<StorageEstimate>
```

**File:** `src/core/Database. ts`

Add method: 
```typescript
/**
 * Get storage usage estimate.
 */
async getStorageEstimate(): Promise<StorageEstimate> {
	if (typeof navigator === 'undefined' || !navigator.storage?. estimate) {
		return { usage: 0, quota: 0, available: 0 }
	}

	const estimate = await navigator.storage.estimate()
	const usage = estimate.usage ??  0
	const quota = estimate.quota ?? 0

	return {
		usage,
		quota,
		available:  quota - usage,
	}
}
```

---

## Task 9: Add Tests for Binary Keys

**File:** `tests/helpers.test.ts` (create if doesn't exist)

```typescript
import { describe, it, expect } from 'vitest'
import { isValidKey, keysEqual, extractKey } from '../src/helpers.js'

describe('isValidKey', () => {
	it('identifies ArrayBuffer as valid key', () => {
		const buffer = new ArrayBuffer(8)
		expect(isValidKey(buffer)).toBe(true)
	})

	it('identifies Uint8Array as valid key', () => {
		const array = new Uint8Array([1, 2, 3, 4])
		expect(isValidKey(array)).toBe(true)
	})

	it('identifies Int32Array as valid key', () => {
		const array = new Int32Array([1, 2, 3])
		expect(isValidKey(array)).toBe(true)
	})

	it('identifies Float64Array as valid key', () => {
		const array = new Float64Array([1. 5, 2.5])
		expect(isValidKey(array)).toBe(true)
	})

	it('rejects boolean as invalid key', () => {
		expect(isValidKey(true)).toBe(false)
		expect(isValidKey(false)).toBe(false)
	})

	it('rejects null and undefined as invalid keys', () => {
		expect(isValidKey(null)).toBe(false)
		expect(isValidKey(undefined)).toBe(false)
	})

	it('rejects plain objects as invalid keys', () => {
		expect(isValidKey({ id: 1 })).toBe(false)
	})

	it('rejects NaN as invalid key', () => {
		expect(isValidKey(NaN)).toBe(false)
	})

	it('accepts nested arrays of valid keys', () => {
		expect(isValidKey([1, 'a', new Date()])).toBe(true)
		expect(isValidKey([[1, 2], ['a', 'b']])).toBe(true)
	})

	it('rejects arrays containing invalid keys', () => {
		expect(isValidKey([1, null, 'a'])).toBe(false)
		expect(isValidKey([true, 'a'])).toBe(false)
	})
})

describe('keysEqual', () => {
	it('compares ArrayBuffer instances correctly', () => {
		const a = new Uint8Array([1, 2, 3, 4]).buffer
		const b = new Uint8Array([1, 2, 3, 4]).buffer
		const c = new Uint8Array([1, 2, 3, 5]).buffer

		expect(keysEqual(a, b)).toBe(true)
		expect(keysEqual(a, c)).toBe(false)
	})

	it('compares ArrayBufferView instances correctly', () => {
		const a = new Uint8Array([1, 2, 3])
		const b = new Uint8Array([1, 2, 3])
		const c = new Uint8Array([1, 2, 4])

		expect(keysEqual(a, b)).toBe(true)
		expect(keysEqual(a, c)).toBe(false)
	})

	it('compares ArrayBuffers of different lengths', () => {
		const a = new Uint8Array([1, 2, 3]).buffer
		const b = new Uint8Array([1, 2]).buffer

		expect(keysEqual(a, b)).toBe(false)
	})

	it('compares empty ArrayBuffers', () => {
		const a = new ArrayBuffer(0)
		const b = new ArrayBuffer(0)

		expect(keysEqual(a, b)).toBe(true)
	})
})

describe('extractKey with binary values', () => {
	it('extracts ArrayBuffer from object', () => {
		const buffer = new ArrayBuffer(4)
		const obj = { id: buffer, name: 'test' }
		const extracted = extractKey(obj, 'id')

		expect(extracted).toBeInstanceOf(ArrayBuffer)
		expect(keysEqual(extracted as ArrayBuffer, buffer)).toBe(true)
	})

	it('extracts Uint8Array from object', () => {
		const array = new Uint8Array([1, 2, 3])
		const obj = { key: array, data: 'test' }
		const extracted = extractKey(obj, 'key')

		expect(extracted).toBeInstanceOf(Uint8Array)
	})
})
```

---

## Task 10: Add Tests for Compound Indexes

**File:** `tests/compound-indexes.test.ts` (create new file)

```typescript
import { describe, it, expect } from 'vitest'
import { extractKey, isValidKey } from '../src/helpers. js'

describe('compound key paths', () => {
	describe('extractKey with compound paths', () => {
		it('extracts compound key from object', () => {
			const obj = {
				firstName: 'John',
				lastName: 'Smith',
				age:  30,
			}

			const key = extractKey(obj, ['lastName', 'firstName'])
			expect(key).toEqual(['Smith', 'John'])
		})

		it('extracts compound key with different types', () => {
			const obj = {
				name: 'Alice',
				createdAt: new Date('2024-01-01'),
				priority: 5,
			}

			const key = extractKey(obj, ['name', 'createdAt', 'priority'])
			expect(key).toEqual(['Alice', new Date('2024-01-01'), 5])
		})

		it('returns undefined if any path segment missing', () => {
			const obj = {
				firstName: 'John',
				// lastName missing
			}

			const key = extractKey(obj, ['lastName', 'firstName'])
			expect(key).toBeUndefined()
		})

		it('handles nested paths in compound keys', () => {
			const obj = {
				user: { name: 'Alice' },
				meta: { createdAt: new Date('2024-01-01') },
			}

			const key = extractKey(obj, ['user. name', 'meta.createdAt'])
			expect(key).toEqual(['Alice', new Date('2024-01-01')])
		})

		it('returns undefined for null/undefined objects', () => {
			expect(extractKey(null, ['a', 'b'])).toBeUndefined()
			expect(extractKey(undefined, ['a', 'b'])).toBeUndefined()
		})

		it('returns undefined for non-objects', () => {
			expect(extractKey('string', ['a'])).toBeUndefined()
			expect(extractKey(123, ['a'])).toBeUndefined()
		})
	})

	describe('isValidKey with compound keys', () => {
		it('validates array of valid keys', () => {
			expect(isValidKey(['Smith', 'John'])).toBe(true)
			expect(isValidKey(['Alice', new Date(), 5])).toBe(true)
		})

		it('rejects array containing invalid keys', () => {
			expect(isValidKey(['Smith', null])).toBe(false)
			expect(isValidKey(['Alice', undefined])).toBe(false)
			expect(isValidKey(['Smith', { nested: true }])).toBe(false)
		})

		it('validates nested key arrays', () => {
			expect(isValidKey([['a', 'b'], ['c', 'd']])).toBe(true)
		})
	})
})

describe('compound index definition', () => {
	it('compound keyPath type is valid', () => {
		// Type check:  compound keyPath should be allowed
		const indexDef = {
			name: 'byNameDate',
			keyPath: ['lastName', 'createdAt'] as const,
			unique: false,
		}

		expect(Array.isArray(indexDef.keyPath)).toBe(true)
		expect(indexDef.keyPath).toHaveLength(2)
	})
})
```

---

## Task 11: Documentation Updates

**File:** `guides/indexeddb.md`

Add these sections after the existing content (find appropriate locations):

### Transaction Atomicity Section

Add after "## Transactions" section: 

```markdown
### Transaction Atomicity

Understanding when operations share transactions is critical for data consistency. 

#### Automatic Transactions (Single Operation)

Individual store methods create their own auto-committing transactions: 

```ts
// Each operation is a separate transaction
await store.set(user1)  // Transaction 1: commits immediately
await store.set(user2)  // Transaction 2: commits immediately

// If set(user2) fails, user1 is already committed
```

#### Explicit Transactions (Atomic Groups)

Use `db.read()` and `db.write()` for atomic operations:

```ts
// All operations share one transaction
await db. write(['users', 'logs'], async (tx) => {
  const users = tx.store('users')
  const logs = tx.store('logs')
  
  await users.set(newUser)
  await logs.add({ action: 'user_created', userId: newUser.id })
  
  // If either fails, both are rolled back
})
```

#### TransactionStore vs Store

Within explicit transactions, use `tx.store()` which returns a `TransactionStore`:

```ts
await db.write(['users'], async (tx) => {
  const store = tx.store('users')  // TransactionStore, not Store
  
  // All operations use the parent transaction
  await store. set(user1)
  await store. set(user2)
  
  // Index operations also use parent transaction
  const idx = store.index('byEmail')  // TransactionIndex
  const exists = await idx.has('alice@test. com')
})
```

#### ⚠️ Common Pitfall:  Mixing Transaction Scopes

```ts
// ❌ WRONG:  iterate() creates its own transaction
await db.write(['users'], async (tx) => {
  const store = tx.store('users')
  
  // This uses a DIFFERENT transaction! 
  for await (const user of db.store('users').iterate()) {
    await store.set({ ... user, updated: true })  // Different tx! 
  }
})

// ✅ CORRECT: Use cursor within transaction
await db. write(['users'], async (tx) => {
  const store = tx.store('users')
  const cursor = await store.openCursor()
  
  while (cursor) {
    await cursor.update({ ... cursor.getValue(), updated: true })
    cursor = await cursor.continue()
  }
})
```
```

### Compound Indexes Section

Add after "## Index Operations" section:

```markdown
### Compound Indexes

Compound indexes allow querying by multiple fields simultaneously. 

#### Defining Compound Indexes

```ts
const db = await createDatabase<AppSchema>({
  name: 'app',
  version:  1,
  stores: {
    users: {
      keyPath: 'id',
      indexes:  [
        // Single-field index
        { name: 'byEmail', keyPath: 'email', unique: true },
        
        // Compound index:  lastName + firstName
        { name: 'byFullName', keyPath:  ['lastName', 'firstName'] },
        
        // Compound index with date
        { name: 'byStatusDate', keyPath: ['status', 'createdAt'] },
      ]
    }
  }
})
```

#### Querying Compound Indexes

Queries must provide values in the same order as the keyPath:

```ts
// Get user by full name
const user = await db.store('users')
  .index('byFullName')
  .get(['Smith', 'John'])  // [lastName, firstName]

// Range query on compound index
const activeUsers = await db. store('users')
  .index('byStatusDate')
  .all(IDBKeyRange.bound(
    ['active', new Date('2024-01-01')],
    ['active', new Date('2024-12-31')]
  ))
```

#### Compound Index Ordering

Records are sorted by the first key, then by subsequent keys:

```ts
// Results ordered by lastName, then firstName
const users = await db.store('users')
  .index('byFullName')
  .all()

// ['Adams', 'Alice']
// ['Adams', 'Bob']
// ['Smith', 'Alice']
// ['Smith', 'John']
```

#### Prefix Queries

You can query by the first N fields of a compound index: 

```ts
// All users with lastName 'Smith'
const smiths = await db.store('users')
  .index('byFullName')
  .all(IDBKeyRange. bound(
    ['Smith'],
    ['Smith', '\uffff']  // All firstNames under 'Smith'
  ))
```
```

### Binary Keys Section

Add after "### Key Types" in TypeScript Integration section:

```markdown
### Binary Keys

IndexedDB supports `ArrayBuffer` and typed arrays as keys.

#### Using Binary Keys

```ts
// ArrayBuffer as key
const binaryKey = new Uint8Array([0x01, 0x02, 0x03, 0x04]).buffer
await store.set({ data: 'binary-keyed-record' }, binaryKey)

// Retrieve by binary key
const record = await store. get(binaryKey)

// Typed array (automatically uses underlying buffer)
const typedKey = new Uint8Array([0x01, 0x02, 0x03, 0x04])
await store.set({ data: 'typed-array-key' }, typedKey)
```

#### Binary Key Comparison

Binary keys are compared byte-by-byte: 

```ts
import { keysEqual } from '@mikesaintsg/indexeddb'

const a = new Uint8Array([1, 2, 3]).buffer
const b = new Uint8Array([1, 2, 3]).buffer
const c = new Uint8Array([1, 2, 4]).buffer

keysEqual(a, b)  // true (same bytes)
keysEqual(a, c)  // false (different bytes)
```

#### Use Cases for Binary Keys

- **Content-addressable storage:** Hash as key
- **Composite keys:** Pack multiple values into binary
- **External system IDs:** UUIDs in binary form (16 bytes vs 36 chars)

```ts
// SHA-256 hash as key
async function hashKey(content: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder()
  const data = encoder.encode(content)
  return crypto.subtle.digest('SHA-256', data)
}

const key = await hashKey('content to hash')
await store.set({ content: 'content to hash' }, key)
```
```

### Performance Patterns Section

Add as new section before "## API Reference": 

```markdown
## Performance Patterns

### 1. Batch Operations

Use array overloads for bulk writes:

```ts
// ❌ Slow: N separate transactions
for (const user of users) {
  await store.set(user)
}

// ✅ Fast: Single transaction
await store.set(users)

// With progress tracking
await store.set(users, {
  onProgress: (current, total) => {
    updateProgressBar(current / total)
  }
})
```

### 2. Use Indexed Queries

Prefer `where()` over `filter()` for large datasets:

```ts
// ❌ Slow:  Scans all records
const active = await store.query()
  .filter(u => u.status === 'active')
  .toArray()

// ✅ Fast:  Uses index
const active = await store.query()
  .where('status').equals('active')
  .toArray()
```

### 3. Combine where() and filter()

Use index for initial filtering, post-filter for complex logic:

```ts
// Index narrows to 1000 records, filter checks 1000 (not 100,000)
const results = await store.query()
  .where('category').equals('electronics')  // Index:  fast
  .filter(p => p.price < 100 && p.inStock)  // Filter: flexible
  .toArray()
```

### 4. Async Generators for Memory Efficiency

Process large datasets without loading all into memory:

```ts
// ❌ Loads all 1M records into memory
const all = await store. all()
for (const record of all) {
  process(record)
}

// ✅ Streams records one at a time
for await (const record of store.iterate()) {
  process(record)
  if (shouldStop) break  // Early termination
}
```

### 5. Transaction Durability

Use relaxed durability for non-critical writes:

```ts
// Default: waits for disk flush (safest)
await db.write(['logs'], async (tx) => {
  await tx.store('logs').add(logEntry)
})

// Relaxed: may lose data on crash (fastest)
await db.write(['logs'], async (tx) => {
  await tx.store('logs').add(logEntry)
}, { durability: 'relaxed' })

// Strict: ensures fsync (slowest, most durable)
await db.write(['orders'], async (tx) => {
  await tx.store('orders').add(order)
}, { durability: 'strict' })
```

### 6. Key-Only Cursors

When you only need keys, use key cursors:

```ts
// ❌ Loads full records just to get keys
for await (const record of store.iterate()) {
  processKey(record.id)
}

// ✅ Only fetches keys
for await (const key of store.iterateKeys()) {
  processKey(key)
}
```

### 7. Limit Results Early

Always limit when you don't need all results: 

```ts
// ❌ Fetches all, then takes first 10
const all = await store.query()
  .where('status').equals('pending')
  .toArray()
const first10 = all.slice(0, 10)

// ✅ Stops after 10
const first10 = await store.query()
  .where('status').equals('pending')
  .limit(10)
  .toArray()
```

### 8. Pagination with Cursors

For efficient pagination: 

```ts
async function getPage(
  store: StoreInterface<User>,
  pageSize: number,
  afterKey?:  ValidKey
): Promise<User[]> {
  const results:  User[] = []
  
  const options:  CursorOptions = afterKey
    ? { query: IDBKeyRange.lowerBound(afterKey, true) }
    : {}
  
  for await (const user of store.iterate(options)) {
    results.push(user)
    if (results.length >= pageSize) break
  }
  
  return results
}

// Usage
const page1 = await getPage(store, 20)
const page2 = await getPage(store, 20, page1.at(-1)?. id)
```
```

---

## Verification Checklist

After completing all tasks, verify:

- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes  
- [ ] `pnpm test` passes
- [ ] All new public methods have TSDoc
- [ ] All new types are exported
- [ ] No duplicate code in Database.ts constructor
- [ ] TransactionStore. index() returns TransactionIndex
- [ ] extractKey handles compound paths
- [ ] Binary key tests pass
- [ ] Compound index tests pass

---

## Commit Message

```
feat: add critical fixes, high-value features, and documentation

Fixes:
- Remove duplicate constructor assignments in Database.ts
- Create TransactionIndex for atomic index operations in transactions
- Fix extractPrimaryKey to handle compound key paths

Features:
- Add has() to Index and TransactionStore for API consistency
- Add bulk operation progress callbacks (onProgress)
- Add export()/import() for data portability
- Add getStorageEstimate() for storage quota management

Tests:
- Add binary key validation and comparison tests
- Add compound index extraction and validation tests

Docs:
- Add transaction atomicity section
- Add compound indexes section  
- Add binary keys section
- Add performance patterns section

---

## File Structure Summary

After all changes, these files should be modified or created:

### Modified Files

| File | Changes |
|------|---------|
| `src/core/Database.ts` | Remove duplicate assignments, add `export()`, `import()`, `getStorageEstimate()` |
| `src/core/Store.ts` | Update `set()` and `add()` to support `BulkOperationOptions` with `onProgress` |
| `src/core/Index.ts` | Add `has()` method |
| `src/core/TransactionStore.ts` | Add `has()` method, change `index()` to return `TransactionIndex` |
| `src/core/QueryBuilder.ts` | Fix `#extractPrimaryKey` to use `extractKey` helper |
| `src/types.ts` | Add new interfaces and update existing ones |
| `guides/indexeddb.md` | Add 4 new documentation sections |

### New Files

| File | Purpose |
|------|---------|
| `src/core/TransactionIndex.ts` | Transaction-bound index implementation |
| `tests/helpers. test.ts` | Binary key tests (create if doesn't exist) |
| `tests/compound-indexes.test.ts` | Compound index tests |

---

## Type Exports Update

**File:** `src/types.ts`

Ensure all new types are exported.  Add to the file:

```typescript
// Near the top with other exports, add:
export type { BulkOperationOptions } from './types. js'
export type { ExportedData, ImportOptions } from './types. js'
export type { StorageEstimate } from './types.js'
export type { TransactionIndexInterface } from './types. js'
```

If using barrel exports in `src/index.ts`, update:

```typescript
// src/index.ts
export {
	createDatabase,
} from './factories. js'

export {
	// Errors
	DatabaseError,
	NotFoundError,
	ConstraintError,
	QuotaExceededError,
	TransactionError,
	UpgradeError,
	OpenError,
	DataError,
	ReadOnlyError,
	VersionError,
	InvalidStateError,
	TimeoutError,
	// Type guards
	isDatabaseError,
	isNotFoundError,
	isConstraintError,
	isQuotaExceededError,
	isTransactionError,
	isUpgradeError,
	isOpenError,
	isDataError,
	hasErrorCode,
	wrapError,
} from './errors.js'

export {
	// Helpers
	isValidKey,
	keysEqual,
	extractKey,
	startsWithRange,
} from './helpers.js'

// Re-export all types
export type * from './types.js'
```

---

## Additional Implementation Details

### TransactionIndex Export

**File:** `src/core/index.ts` (create if doesn't exist, or update existing barrel)

```typescript
export { Cursor } from './Cursor.js'
export { Database } from './Database. js'
export { Index } from './Index. js'
export { KeyCursor } from './KeyCursor.js'
export { QueryBuilder, WhereClause } from './QueryBuilder.js'
export { Store } from './Store. js'
export { Transaction } from './Transaction. js'
export { TransactionIndex } from './TransactionIndex.js'
export { TransactionStore } from './TransactionStore.js'
```

### Import Statement Updates

**File:** `src/core/TransactionStore.ts`

Update imports at top of file:

```typescript
import type {
	TransactionIndexInterface,
	ValidKey,
	CursorInterface,
	KeyCursorInterface,
	CursorOptions,
} from '../types.js'
import { NotFoundError, wrapError } from '../errors.js'
import { toIDBCursorDirection } from '../helpers. js'
import { Cursor } from './Cursor.js'
import { KeyCursor } from './KeyCursor.js'
import { TransactionIndex } from './TransactionIndex.js'
```

**File:** `src/core/Database.ts`

Update imports at top of file:

```typescript
import type {
	DatabaseSchema,
	DatabaseOptions,
	DatabaseInterface,
	StoreDefinitions,
	StoreDefinition,
	IndexDefinition,
	StoreInterface,
	TransactionOptions,
	TransactionOperation,
	ChangeCallback,
	ChangeEvent,
	ErrorCallback,
	VersionChangeCallback,
	BlockedCallback,
	Unsubscribe,
	Migration,
	ExportedData,
	ImportOptions,
	StorageEstimate,
} from '../types.js'
import {
	OpenError,
	UpgradeError,
	InvalidStateError,
	wrapError,
} from '../errors.js'
import {
	assertValidName,
	assertValidVersion,
	promisifyRequest,
	promisifyTransaction,
} from '../helpers.js'
```

**File:** `src/core/QueryBuilder.ts`

Update imports at top of file:

```typescript
import type {
	QueryBuilderInterface,
	WhereClauseInterface,
	OrderDirection,
	ValidKey,
	BetweenOptions,
} from '../types.js'
import { toIDBCursorDirection, isValidKey, extractKey } from '../helpers.js'
import { wrapError } from '../errors.js'
```

---

## Full TransactionStore. ts Updated Implementation

For reference, here's the complete updated `TransactionStore.ts`:

```typescript
/**
 * Transaction Store implementation
 *
 * @remarks
 * Implements TransactionStoreInterface for store operations within a transaction. 
 * All operations are bound to the parent transaction.
 *
 * @packageDocumentation
 */

import type {
	TransactionStoreInterface,
	TransactionIndexInterface,
	ValidKey,
	CursorInterface,
	KeyCursorInterface,
	CursorOptions,
} from '../types.js'
import { NotFoundError, wrapError } from '../errors.js'
import { toIDBCursorDirection } from '../helpers.js'
import { Cursor } from './Cursor.js'
import { KeyCursor } from './KeyCursor.js'
import { TransactionIndex } from './TransactionIndex.js'

/**
 * Store operations bound to a transaction. 
 */
export class TransactionStore<T> implements TransactionStoreInterface<T> {
	readonly #store: IDBObjectStore
	readonly #storeName: string

	constructor(store: IDBObjectStore, storeName: string) {
		this.#store = store
		this.#storeName = storeName
	}

	// ─── Native Access ───────────────────────────────────────

	get native(): IDBObjectStore {
		return this. #store
	}

	// ─── Get ─────────────────────────────────────────────────

	get(key: ValidKey): Promise<T | undefined>
	get(keys: readonly ValidKey[]): Promise<readonly (T | undefined)[]>
	async get(keyOrKeys: ValidKey | readonly ValidKey[]): Promise<T | undefined | readonly (T | undefined)[]> {
		if (Array.isArray(keyOrKeys)) {
			return Promise.all(
				keyOrKeys. map(k => this.#request(this.#store.get(k)) as Promise<T | undefined>),
			)
		}

		return this.#request(this.#store.get(keyOrKeys as IDBValidKey)) as Promise<T | undefined>
	}

	// ─── Resolve ─────────────────────────────────────────────

	resolve(key: ValidKey): Promise<T>
	resolve(keys: readonly ValidKey[]): Promise<readonly T[]>
	async resolve(keyOrKeys: ValidKey | readonly ValidKey[]): Promise<T | readonly T[]> {
		if (Array.isArray(keyOrKeys)) {
			return Promise.all(
				keyOrKeys. map(async k => {
					const result = await (this.#request(this.#store.get(k)) as Promise<T | undefined>)
					if (result === undefined) throw new NotFoundError(this.#storeName, k)
					return result
				}),
			)
		}

		const result = await (this. #request(this. #store.get(keyOrKeys as IDBValidKey)) as Promise<T | undefined>)
		if (result === undefined) throw new NotFoundError(this.#storeName, keyOrKeys as IDBValidKey)
		return result
	}

	// ─── Has ─────────────────────────────────────────────────

	/**
	 * Check if a record exists by primary key. 
	 *
	 * @param key - The key to check
	 * @returns true if record exists
	 */
	has(key: ValidKey): Promise<boolean>

	/**
	 * Check if records exist by primary keys.
	 *
	 * @param keys - The keys to check
	 * @returns Array of booleans indicating existence
	 */
	has(keys: readonly ValidKey[]): Promise<readonly boolean[]>

	async has(keyOrKeys: ValidKey | readonly ValidKey[]): Promise<boolean | readonly boolean[]> {
		if (Array.isArray(keyOrKeys)) {
			return Promise.all(
				keyOrKeys.map(async k => {
					const count = await this.#request(this.#store.count(k))
					return count > 0
				}),
			)
		}

		const count = await this. #request(this. #store.count(keyOrKeys as IDBValidKey))
		return count > 0
	}

	// ─── Set ─────────────────────────────────────────────────

	set(value: T, key?:  ValidKey): Promise<ValidKey>
	set(values: readonly T[]): Promise<readonly ValidKey[]>
	async set(valueOrValues: T | readonly T[], key?: ValidKey): Promise<ValidKey | readonly ValidKey[]> {
		if (Array.isArray(valueOrValues)) {
			return Promise.all(
				valueOrValues.map(v => this.#request(this.#store.put(v))),
			) as Promise<readonly ValidKey[]>
		}

		return this.#request(this.#store.put(valueOrValues, key))
	}

	// ─── Add ────────────────────────────────────────────��────

	add(value:  T, key?: ValidKey): Promise<ValidKey>
	add(values: readonly T[]): Promise<readonly ValidKey[]>
	async add(valueOrValues: T | readonly T[], key?:  ValidKey): Promise<ValidKey | readonly ValidKey[]> {
		if (Array. isArray(valueOrValues)) {
			return Promise.all(
				valueOrValues.map(v => this.#request(this.#store. add(v))),
			) as Promise<readonly ValidKey[]>
		}

		return this.#request(this.#store.add(valueOrValues, key))
	}

	// ─── Remove ──────────────────────────────────────────────

	remove(key: ValidKey): Promise<void>
	remove(keys:  readonly ValidKey[]): Promise<void>
	async remove(keyOrKeys: ValidKey | readonly ValidKey[]): Promise<void> {
		if (Array.isArray(keyOrKeys)) {
			await Promise.all(
				keyOrKeys. map(k => this.#request(this.#store.delete(k))),
			)
			return
		}

		await this.#request(this.#store.delete(keyOrKeys as IDBValidKey))
	}

	// ─── Bulk Operations ─────────────────────────────────────

	async all(query?:  IDBKeyRange | null, count?: number): Promise<readonly T[]> {
		return this.#request(this.#store.getAll(query ??  undefined, count)) as Promise<readonly T[]>
	}

	async keys(query?: IDBKeyRange | null, count?: number): Promise<readonly ValidKey[]> {
		return this.#request(this.#store. getAllKeys(query ?? undefined, count)) as Promise<readonly ValidKey[]>
	}

	async clear(): Promise<void> {
		await this.#request(this.#store. clear())
	}

	async count(query?: IDBKeyRange | ValidKey | null): Promise<number> {
		return this.#request(this.#store. count(query as IDBValidKey | IDBKeyRange | undefined))
	}

	// ─── Index Access ────────────────────────────────────────

	/**
	 * Get an index bound to this transaction.
	 *
	 * @param name - Index name
	 * @returns TransactionIndex for atomic operations
	 *
	 * @remarks
	 * Returns a TransactionIndex that operates within the parent transaction,
	 * maintaining atomicity guarantees.  Unlike standalone Index, this does not
	 * create new transactions.
	 */
	index(name: string): TransactionIndexInterface<T> {
		if (! this.#store.indexNames.contains(name)) {
			throw new Error(`Index "${name}" not found on store "${this.#storeName}"`)
		}

		const nativeIndex = this. #store.index(name)
		return new TransactionIndex<T>(nativeIndex, this.#storeName)
	}

	// ─── Cursors ─────────────────────────────────────────────

	async openCursor(options?: CursorOptions): Promise<CursorInterface<T> | null> {
		const direction = toIDBCursorDirection(options?.direction)
		const request = this.#store.openCursor(
			options?.query as IDBKeyRange | IDBValidKey | null ??  null,
			direction,
		)

		const cursor = await this.#request(request)
		return cursor ? new Cursor<T>(cursor, request) : null
	}

	async openKeyCursor(options?:  CursorOptions): Promise<KeyCursorInterface | null> {
		const direction = toIDBCursorDirection(options?.direction)
		const request = this.#store. openKeyCursor(
			options?.query as IDBKeyRange | IDBValidKey | null ?? null,
			direction,
		)

		const cursor = await this.#request(request)
		return cursor ? new KeyCursor(cursor, request) : null
	}

	// ─── Private Helpers ─────────────────────────────────────

	#request<R>(request: IDBRequest<R>): Promise<R> {
		return new Promise((resolve, reject) => {
			request. onsuccess = () => resolve(request.result)
			request.onerror = () => reject(wrapError(request. error, { storeName: this.#storeName }))
		})
	}
}
```

---

## Integration Test Recommendation

After implementing all changes, create an integration test to verify the complete flow:

**File:** `tests/integration. test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createDatabase } from '../src/factories.js'
import type { DatabaseInterface } from '../src/types.js'

interface User {
	readonly id: string
	readonly firstName: string
	readonly lastName: string
	readonly email: string
	readonly createdAt:  Date
	readonly active: boolean
}

interface AppSchema {
	readonly users: User
}

describe('Integration Tests', () => {
	let db: DatabaseInterface<AppSchema>

	beforeEach(async () => {
		db = createDatabase<AppSchema>({
			name: `test-db-${Date.now()}`,
			version: 1,
			stores: {
				users: {
					keyPath: 'id',
					indexes:  [
						{ name: 'byEmail', keyPath:  'email', unique: true },
						{ name: 'byFullName', keyPath:  ['lastName', 'firstName'] },
					],
				},
			},
		})
	})

	afterEach(async () => {
		await db.drop()
	})

	describe('TransactionIndex atomicity', () => {
		it('index operations use parent transaction', async () => {
			const user:  User = {
				id: 'u1',
				firstName: 'John',
				lastName: 'Smith',
				email:  'john@test.com',
				createdAt: new Date(),
				active: true,
			}

			await db.write(['users'], async (tx) => {
				const store = tx.store('users')
				await store.set(user)

				// Index should see the uncommitted write
				const idx = store.index('byEmail')
				const found = await idx.has('john@test.com')
				expect(found).toBe(true)

				const retrieved = await idx.get('john@test. com')
				expect(retrieved?. id).toBe('u1')
			})
		})
	})

	describe('Compound indexes', () => {
		it('queries compound index correctly', async () => {
			const users: User[] = [
				{ id:  'u1', firstName: 'Alice', lastName: 'Smith', email: 'a@test.com', createdAt: new Date(), active: true },
				{ id: 'u2', firstName: 'Bob', lastName: 'Smith', email: 'b@test.com', createdAt:  new Date(), active: true },
				{ id: 'u3', firstName:  'Alice', lastName: 'Jones', email: 'c@test.com', createdAt: new Date(), active: true },
			]

			await db.store('users').set(users)

			const smithAlice = await db. store('users')
				.index('byFullName')
				.get(['Smith', 'Alice'])

			expect(smithAlice?. id).toBe('u1')
		})
	})

	describe('Export/Import', () => {
		it('exports and imports data correctly', async () => {
			const users: User[] = [
				{ id: 'u1', firstName:  'Alice', lastName: 'Smith', email: 'a@test.com', createdAt: new Date('2024-01-01'), active: true },
				{ id: 'u2', firstName: 'Bob', lastName: 'Jones', email: 'b@test.com', createdAt:  new Date('2024-01-02'), active: false },
			]

			await db.store('users').set(users)

			const exported = await db.export()
			expect(exported. stores.users).toHaveLength(2)
			expect(exported. version).toBe(1)

			// Clear and reimport
			await db.store('users').clear()
			expect(await db.store('users').count()).toBe(0)

			await db.import(exported)
			expect(await db. store('users').count()).toBe(2)
		})
	})

	describe('Progress callbacks', () => {
		it('calls onProgress during bulk set', async () => {
			const users: User[] = Array.from({ length: 10 }, (_, i) => ({
				id: `u${i}`,
				firstName: `First${i}`,
				lastName: `Last${i}`,
				email: `user${i}@test.com`,
				createdAt: new Date(),
				active: true,
			}))

			const progressCalls: Array<{ current: number; total:  number }> = []

			await db. store('users').set(users, {
				onProgress:  (current, total) => {
					progressCalls.push({ current, total })
				},
			})

			expect(progressCalls).toHaveLength(10)
			expect(progressCalls[0]).toEqual({ current:  1, total: 10 })
			expect(progressCalls[9]).toEqual({ current: 10, total: 10 })
		})
	})

	describe('Storage estimate', () => {
		it('returns storage estimate', async () => {
			const estimate = await db.getStorageEstimate()

			expect(typeof estimate. usage).toBe('number')
			expect(typeof estimate.quota).toBe('number')
			expect(typeof estimate.available).toBe('number')
			expect(estimate.available).toBe(estimate.quota - estimate.usage)
		})
	})

	describe('has() methods', () => {
		it('Index.has() works correctly', async () => {
			await db.store('users').set({
				id: 'u1',
				firstName: 'Alice',
				lastName:  'Smith',
				email: 'alice@test.com',
				createdAt: new Date(),
				active: true,
			})

			const idx = db.store('users').index('byEmail')

			expect(await idx.has('alice@test.com')).toBe(true)
			expect(await idx.has('bob@test.com')).toBe(false)

			const results = await idx.has(['alice@test.com', 'bob@test.com'])
			expect(results).toEqual([true, false])
		})

		it('TransactionStore.has() works correctly', async () => {
			await db.store('users').set({
				id: 'u1',
				firstName: 'Alice',
				lastName: 'Smith',
				email: 'alice@test.com',
				createdAt: new Date(),
				active: true,
			})

			await db.read(['users'], async (tx) => {
				const store = tx. store('users')

				expect(await store.has('u1')).toBe(true)
				expect(await store. has('u2')).toBe(false)

				const results = await store.has(['u1', 'u2'])
				expect(results).toEqual([true, false])
			})
		})
	})
})
```

---

## Final Verification Steps

After completing all implementations: 

1. **Run type checking:**
   ```powershell
   pnpm typecheck
   ```

2. **Run linting:**
   ```powershell
   pnpm lint
   ```

3. **Run tests:**
   ```powershell
   pnpm test
   ```

4. **Build the package:**
   ```powershell
   pnpm build
   ```

5. **Verify exports work:**
   ```typescript
   import {
     createDatabase,
     isValidKey,
     keysEqual,
     extractKey,
   } from '@mikesaintsg/indexeddb'
   
   import type {
     DatabaseInterface,
     StoreInterface,
     IndexInterface,
     TransactionIndexInterface,
     BulkOperationOptions,
     ExportedData,
     ImportOptions,
     StorageEstimate,
   } from '@mikesaintsg/indexeddb'
   ```

---

## Summary

This prompt covers: 

| Category | Items |
|----------|-------|
| **Critical Fixes** | 3 (duplicate assignments, TransactionIndex, extractPrimaryKey) |
| **New Features** | 4 (has(), progress callbacks, export/import, storage estimate) |
| **New Files** | 3 (TransactionIndex.ts, helpers.test.ts, compound-indexes.test. ts) |
| **Modified Files** | 7 (Database, Store, Index, TransactionStore, QueryBuilder, types, guide) |
| **Documentation Sections** | 4 (atomicity, compound indexes, binary keys, performance) |
| **Test Files** | 3 (helpers, compound-indexes, integration) |

The implementation maintains all project standards:  ESM-only, `#` private fields, `readonly` preferences, full TSDoc, tabs for indentation, and Vitest for testing.