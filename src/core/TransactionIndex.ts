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
	TransactionIndexInterface,
	ValidKey,
} from '../types.js'
import { NotFoundError, wrapError } from '../errors.js'
import { toIDBCursorDirection } from '../helpers.js'
import { Cursor } from './Cursor.js'
import { KeyCursor } from './KeyCursor.js'

/**
 * Index operations bound to a transaction.
 *
 * @remarks
 * Unlike the standalone `Index` class, `TransactionIndex` does not create
 * new transactions. All operations execute within the parent transaction,
 * maintaining atomicity guarantees.
 *
 * Note: `query()`, `iterate()`, and `iterateKeys()` are not available
 * on `TransactionIndex` as they require transaction lifecycle control.
 */
export class TransactionIndex<T> implements TransactionIndexInterface<T> {
	readonly #index: IDBIndex
	readonly #storeName: string

	constructor(index: IDBIndex, storeName: string) {
		this.#index = index
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
		return Array.isArray(kp) ? kp : kp
	}

	/**
	 * Check if the index enforces uniqueness.
	 */
	isUnique(): boolean {
		return this.#index.unique
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
				keyOrKeys.map(k => this.#request(this.#index.get(k)) as Promise<T | undefined>),
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
				keyOrKeys.map(async k => {
					const result = await (this.#request(this.#index.get(k)) as Promise<T | undefined>)
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
		if (Array.isArray(keyOrKeys)) {
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
		return this.#request(this.#index.getAll(query ?? undefined, count)) as Promise<readonly T[]>
	}

	/**
	 * Get all keys matching a query.
	 *
	 * @param query - Optional key range
	 * @param count - Optional maximum count
	 * @returns Array of matching keys
	 */
	async keys(query?: IDBKeyRange | null, count?: number): Promise<readonly ValidKey[]> {
		return this.#request(this.#index.getAllKeys(query ?? undefined, count)) as Promise<readonly ValidKey[]>
	}

	/**
	 * Count records matching a query.
	 *
	 * @param query - Optional key or key range
	 * @returns Count of matching records
	 */
	async count(query?: IDBKeyRange | ValidKey | null): Promise<number> {
		return this.#request(this.#index.count(query as IDBValidKey | IDBKeyRange | undefined))
	}

	// ─── Cursors ─────────────────────────────────────────────

	/**
	 * Open a cursor over the index.
	 *
	 * @param options - Cursor options
	 * @returns Cursor or null if no records
	 */
	async openCursor(options?: CursorOptions): Promise<CursorInterface<T> | null> {
		const direction = toIDBCursorDirection(options?.direction)
		const request = this.#index.openCursor(
			options?.query as IDBKeyRange | IDBValidKey | null ?? null,
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
	async openKeyCursor(options?: CursorOptions): Promise<KeyCursorInterface | null> {
		const direction = toIDBCursorDirection(options?.direction)
		const request = this.#index.openKeyCursor(
			options?.query as IDBKeyRange | IDBValidKey | null ?? null,
			direction,
		)
		const cursor = await this.#request(request)
		return cursor ? new KeyCursor(cursor, request) : null
	}

	// ─── Private Helpers ─────────────────────────────────────

	#request<R>(request: IDBRequest<R>): Promise<R> {
		return new Promise((resolve, reject) => {
			request.onsuccess = () => resolve(request.result)
			request.onerror = () => reject(wrapError(request.error, { storeName: this.#storeName }))
		})
	}
}
