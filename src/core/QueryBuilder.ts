/**
 * Query Builder implementation
 *
 * @remarks
 * Implements QueryBuilderInterface for fluent query construction.
 * Uses IDBKeyRange for indexed queries and cursor iteration for results.
 *
 * @packageDocumentation
 */

import type {
	QueryBuilderInterface,
	WhereClauseInterface,
	OrderDirection,
	ValidKey,
	BetweenOptions,
} from '../types.js'
import { toIDBCursorDirection } from '../helpers.js'
import { wrapError } from '../errors.js'

/** Internal query state */
interface QueryState<T> {
	/** Key path being queried (primary key or index) */
	keyPath: string | null
	/** IDBKeyRange for indexed query */
	range: IDBKeyRange | null
	/** Array of values for anyOf queries */
	anyOfValues: readonly ValidKey[] | null
	/** Post-cursor filter predicates */
	filters: readonly ((value: T) => boolean)[]
	/** Sort direction */
	direction: OrderDirection
	/** Maximum results to return */
	limitCount: number | null
	/** Number of results to skip */
	offsetCount: number
}

/** Context needed to execute queries */
interface QueryContext {
	/** Store name */
	storeName: string
	/** Primary key path */
	primaryKeyPath: string | null
	/** Available index names */
	indexNames: readonly string[]
	/** Function to get open database */
	ensureOpen: () => Promise<IDBDatabase>
}

/**
 * Creates initial query state.
 */
function createInitialState<T>(): QueryState<T> {
	return {
		keyPath: null,
		range: null,
		anyOfValues: null,
		filters: [],
		direction: 'ascending',
		limitCount: null,
		offsetCount: 0,
	}
}

/**
 * Query Builder implementation.
 */
export class QueryBuilder<T> implements QueryBuilderInterface<T> {
	readonly #context: QueryContext
	readonly #state: QueryState<T>

	constructor(context: QueryContext, state?: QueryState<T>) {
		this.#context = context
		this.#state = state ?? createInitialState<T>()
	}

	// ─── Query Building ──────────────────────────────────────

	where(keyPath: string): WhereClauseInterface<T> {
		return new WhereClause<T>(this.#context, {
			...this.#state,
			keyPath,
		})
	}

	filter(predicate: (value: T) => boolean): QueryBuilderInterface<T> {
		return new QueryBuilder<T>(this.#context, {
			...this.#state,
			filters: [...this.#state.filters, predicate],
		})
	}

	orderBy(direction: OrderDirection): QueryBuilderInterface<T> {
		return new QueryBuilder<T>(this.#context, {
			...this.#state,
			direction,
		})
	}

	limit(count: number): QueryBuilderInterface<T> {
		return new QueryBuilder<T>(this.#context, {
			...this.#state,
			limitCount: count,
		})
	}

	offset(count: number): QueryBuilderInterface<T> {
		return new QueryBuilder<T>(this.#context, {
			...this.#state,
			offsetCount: count,
		})
	}

	// ─── Terminal Operations ─────────────────────────────────

	async toArray(): Promise<readonly T[]> {
		const results: T[] = []

		for await (const item of this.iterate()) {
			results.push(item)
		}

		return results
	}

	async first(): Promise<T | undefined> {
		// Optimize: only need 1 result
		const limited = new QueryBuilder<T>(this.#context, {
			...this.#state,
			limitCount: 1,
		})

		for await (const item of limited.iterate()) {
			return item
		}

		return undefined
	}

	async count(): Promise<number> {
		// If no filters, we can use native count
		if (this.#state.filters.length === 0 && this.#state.anyOfValues === null) {
			const db = await this.#context.ensureOpen()
			const tx = db.transaction([this.#context.storeName], 'readonly')
			const store = tx.objectStore(this.#context.storeName)

			const source = this.#getSource(store)
			const request = source.count(this.#state.range ?? undefined)

			return this.#promisifyRequest(request)
		}

		// With filters, we need to iterate
		let count = 0
		for await (const _ of this.iterate()) {
			count++
		}
		return count
	}

	async keys(): Promise<readonly ValidKey[]> {
		const keys: ValidKey[] = []
		const db = await this.#context.ensureOpen()
		const tx = db.transaction([this.#context.storeName], 'readonly')
		const store = tx.objectStore(this.#context.storeName)

		const source = this.#getSource(store)
		const direction = toIDBCursorDirection(
			this.#state.direction === 'ascending' ? 'next' : 'previous',
		)

		// For anyOf queries
		if (this.#state.anyOfValues !== null) {
			const allKeys = await this.#executeAnyOfKeys(store)
			return this.#applyLimitOffset(allKeys)
		}

		const request = source.openKeyCursor(this.#state.range ?? undefined, direction)

		let skipped = 0
		let collected = 0
		let cursor = await this.#promisifyRequest(request)

		while (cursor) {
			// Skip offset
			if (skipped < this.#state.offsetCount) {
				skipped++
				cursor.continue()
				cursor = await this.#promisifyRequest(request)
				continue
			}

			// Check limit
			if (this.#state.limitCount !== null && collected >= this.#state.limitCount) {
				break
			}

			// If we have filters, we need to check the value
			if (this.#state.filters.length > 0) {
				// Need to get the actual value to filter
				const valueRequest = store.get(cursor.primaryKey)
				const value = await this.#promisifyRequest(valueRequest) as T | undefined

				if (value !== undefined && this.#passesFilters(value)) {
					keys.push(cursor.primaryKey)
					collected++
				}
			} else {
				keys.push(cursor.primaryKey)
				collected++
			}

			cursor.continue()
			cursor = await this.#promisifyRequest(request)
		}

		return keys
	}

	async *iterate(): AsyncGenerator<T, void, unknown> {
		const db = await this.#context.ensureOpen()
		const tx = db.transaction([this.#context.storeName], 'readonly')
		const store = tx.objectStore(this.#context.storeName)

		// Handle anyOf specially
		if (this.#state.anyOfValues !== null) {
			const results = await this.#executeAnyOf(store)
			const limited = this.#applyLimitOffset(results)

			for (const item of limited) {
				yield item
			}
			return
		}

		const source = this.#getSource(store)
		const direction = toIDBCursorDirection(
			this.#state.direction === 'ascending' ? 'next' : 'previous',
		)

		const request = source.openCursor(this.#state.range ?? undefined, direction)

		let skipped = 0
		let yielded = 0

		let cursor = await this.#promisifyRequest(request)

		while (cursor) {
			const value = cursor.value as T

			// Apply filters
			if (!this.#passesFilters(value)) {
				cursor.continue()
				cursor = await this.#promisifyRequest(request)
				continue
			}

			// Skip offset
			if (skipped < this.#state.offsetCount) {
				skipped++
				cursor.continue()
				cursor = await this.#promisifyRequest(request)
				continue
			}

			// Check limit
			if (this.#state.limitCount !== null && yielded >= this.#state.limitCount) {
				break
			}

			yield value
			yielded++

			cursor.continue()
			cursor = await this.#promisifyRequest(request)
		}
	}

	// ─── Private Helpers ─────────────────────────────────────

	#getSource(store: IDBObjectStore): IDBObjectStore | IDBIndex {
		const keyPath = this.#state.keyPath

		// If no keyPath specified, use store
		if (keyPath === null) {
			return store
		}

		// If keyPath matches primary key, use store
		if (keyPath === this.#context.primaryKeyPath) {
			return store
		}

		// Otherwise try to use an index
		if (this.#context.indexNames.includes(keyPath)) {
			return store.index(keyPath)
		}

		// Check if there's an index with this keyPath
		for (const indexName of this.#context.indexNames) {
			try {
				const index = store.index(indexName)
				if (index.keyPath === keyPath) {
					return index
				}
			} catch {
				// Index doesn't exist
			}
		}

		// No matching index, fall back to store (will be filtered)
		return store
	}

	#passesFilters(value: T): boolean {
		for (const filter of this.#state.filters) {
			if (!filter(value)) {
				return false
			}
		}
		return true
	}

	async #executeAnyOf(store: IDBObjectStore): Promise<T[]> {
		if (this.#state.anyOfValues === null) return []

		const keyPath = this.#state.keyPath
		const results = new Map<string, T>()

		// Execute parallel queries for each value
		const promises = this.#state.anyOfValues.map(async(value) => {
			let items: T[] = []

			if (keyPath === null || keyPath === this.#context.primaryKeyPath) {
				// Query by primary key
				const item = await this.#promisifyRequest(store.get(value)) as T | undefined
				items = item ? [item] : []
			} else if (this.#context.indexNames.includes(keyPath)) {
				// Query by index name
				const index = store.index(keyPath)
				items = await this.#promisifyRequest(index.getAll(value)) as T[]
			} else {
				// Try to find index by keyPath
				for (const indexName of this.#context.indexNames) {
					try {
						const index = store.index(indexName)
						if (index.keyPath === keyPath) {
							items = await this.#promisifyRequest(index.getAll(value)) as T[]
							break
						}
					} catch {
						// Index doesn't exist
					}
				}
			}

			// Apply filters and dedupe by primary key
			for (const item of items) {
				if (this.#passesFilters(item)) {
					const pk = this.#extractPrimaryKey(item)
					if (pk !== undefined) {
						results.set(this.#keyToString(pk), item)
					}
				}
			}
		})

		await Promise.all(promises)

		// Convert to array and sort if needed
		const resultArray = Array.from(results.values())

		if (this.#state.direction === 'descending') {
			resultArray.reverse()
		}

		return resultArray
	}

	async #executeAnyOfKeys(store: IDBObjectStore): Promise<ValidKey[]> {
		if (this.#state.anyOfValues === null) return []

		const keyPath = this.#state.keyPath
		const results = new Set<string>()
		const keysList: ValidKey[] = []

		const promises = this.#state.anyOfValues.map(async(value) => {
			let keys: ValidKey[]

			if (keyPath === null || keyPath === this.#context.primaryKeyPath) {
				// Query by primary key - check existence
				const count = await this.#promisifyRequest(store.count(value))
				keys = count > 0 ? [value] : []
			} else if (this.#context.indexNames.includes(keyPath)) {
				const index = store.index(keyPath)
				keys = await this.#promisifyRequest(index.getAllKeys(value))
			} else {
				keys = []
			}

			for (const key of keys) {
				const keyStr = this.#keyToString(key)
				if (!results.has(keyStr)) {
					results.add(keyStr)
					keysList.push(key)
				}
			}
		})

		await Promise.all(promises)

		if (this.#state.direction === 'descending') {
			keysList.reverse()
		}

		return keysList
	}

	#extractPrimaryKey(item: T): ValidKey | undefined {
		const keyPath = this.#context.primaryKeyPath

		if (keyPath === null || typeof item !== 'object' || item === null) {
			return undefined
		}

		return (item as Record<string, unknown>)[keyPath] as ValidKey | undefined
	}

	#applyLimitOffset<U>(items: U[]): U[] {
		let result = items

		if (this.#state.offsetCount > 0) {
			result = result.slice(this.#state.offsetCount)
		}

		if (this.#state.limitCount !== null) {
			result = result.slice(0, this.#state.limitCount)
		}

		return result
	}

	#promisifyRequest<R>(request: IDBRequest<R>): Promise<R> {
		return new Promise((resolve, reject) => {
			request.onsuccess = () => resolve(request.result)
			request.onerror = () => reject(wrapError(request.error, { storeName: this.#context.storeName }))
		})
	}

	/**
	 * Converts a key to a string for use as a Map/Set key.
	 * Handles all valid IndexedDB key types safely.
	 */
	#keyToString(key: ValidKey): string {
		if (typeof key === 'string') return key
		if (typeof key === 'number') return `n:${key}`
		if (key instanceof Date) return `d:${key.getTime()}`
		if (key instanceof ArrayBuffer) return `b:${Array.from(new Uint8Array(key)).join(',')}`
		if (ArrayBuffer.isView(key)) return `b:${Array.from(new Uint8Array(key.buffer)).join(',')}`
		if (Array.isArray(key)) return `a:${JSON.stringify(key)}`
		return JSON.stringify(key)
	}
}

/**
 * Where Clause implementation.
 */
export class WhereClause<T> implements WhereClauseInterface<T> {
	readonly #context: QueryContext
	readonly #state: QueryState<T>

	constructor(context: QueryContext, state: QueryState<T>) {
		this.#context = context
		this.#state = state
	}

	equals(value: ValidKey): QueryBuilderInterface<T> {
		return new QueryBuilder<T>(this.#context, {
			...this.#state,
			range: IDBKeyRange.only(value),
		})
	}

	greaterThan(value: ValidKey): QueryBuilderInterface<T> {
		return new QueryBuilder<T>(this.#context, {
			...this.#state,
			range: IDBKeyRange.lowerBound(value, true),
		})
	}

	greaterThanOrEqual(value: ValidKey): QueryBuilderInterface<T> {
		return new QueryBuilder<T>(this.#context, {
			...this.#state,
			range: IDBKeyRange.lowerBound(value, false),
		})
	}

	lessThan(value: ValidKey): QueryBuilderInterface<T> {
		return new QueryBuilder<T>(this.#context, {
			...this.#state,
			range: IDBKeyRange.upperBound(value, true),
		})
	}

	lessThanOrEqual(value: ValidKey): QueryBuilderInterface<T> {
		return new QueryBuilder<T>(this.#context, {
			...this.#state,
			range: IDBKeyRange.upperBound(value, false),
		})
	}

	between(lower: ValidKey, upper: ValidKey, options?: BetweenOptions): QueryBuilderInterface<T> {
		return new QueryBuilder<T>(this.#context, {
			...this.#state,
			range: IDBKeyRange.bound(
				lower,
				upper,
				options?.lowerOpen ?? false,
				options?.upperOpen ?? false,
			),
		})
	}

	startsWith(prefix: string): QueryBuilderInterface<T> {
		return new QueryBuilder<T>(this.#context, {
			...this.#state,
			range: IDBKeyRange.bound(prefix, prefix + '\uffff', false, false),
		})
	}

	anyOf(values: readonly ValidKey[]): QueryBuilderInterface<T> {
		return new QueryBuilder<T>(this.#context, {
			...this.#state,
			anyOfValues: values,
		})
	}
}
