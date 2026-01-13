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
		return this.#store
	}

	// ─── Get ─────────────────────────────────────────────────

	get(key: ValidKey): Promise<T | undefined>
	get(keys: readonly ValidKey[]): Promise<readonly (T | undefined)[]>
	async get(keyOrKeys: ValidKey | readonly ValidKey[]): Promise<T | undefined | readonly (T | undefined)[]> {
		if (Array.isArray(keyOrKeys)) {
			return Promise.all(
				keyOrKeys.map(k => this.#request(this.#store.get(k)) as Promise<T | undefined>),
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
				keyOrKeys.map(async k => {
					const result = await (this.#request(this.#store.get(k)) as Promise<T | undefined>)
					if (result === undefined) throw new NotFoundError(this.#storeName, k)
					return result
				}),
			)
		}

		const result = await (this.#request(this.#store.get(keyOrKeys as IDBValidKey)) as Promise<T | undefined>)
		if (result === undefined) throw new NotFoundError(this.#storeName, keyOrKeys as IDBValidKey)
		return result
	}

	// ─── Set ─────────────────────────────────────────────────

	set(value: T, key?: ValidKey): Promise<ValidKey>
	set(values: readonly T[]): Promise<readonly ValidKey[]>
	async set(valueOrValues: T | readonly T[], key?: ValidKey): Promise<ValidKey | readonly ValidKey[]> {
		if (Array.isArray(valueOrValues)) {
			return Promise.all(
				valueOrValues.map(v => this.#request(this.#store.put(v))),
			) as Promise<readonly ValidKey[]>
		}

		return this.#request(this.#store.put(valueOrValues, key))
	}

	// ─── Add ─────────────────────────────────────────────────

	add(value: T, key?: ValidKey): Promise<ValidKey>
	add(values: readonly T[]): Promise<readonly ValidKey[]>
	async add(valueOrValues: T | readonly T[], key?: ValidKey): Promise<ValidKey | readonly ValidKey[]> {
		if (Array.isArray(valueOrValues)) {
			return Promise.all(
				valueOrValues.map(v => this.#request(this.#store.add(v))),
			) as Promise<readonly ValidKey[]>
		}

		return this.#request(this.#store.add(valueOrValues, key))
	}

	// ─── Remove ──────────────────────────────────────────────

	remove(key: ValidKey): Promise<void>
	remove(keys: readonly ValidKey[]): Promise<void>
	async remove(keyOrKeys: ValidKey | readonly ValidKey[]): Promise<void> {
		if (Array.isArray(keyOrKeys)) {
			await Promise.all(
				keyOrKeys.map(k => this.#request(this.#store.delete(k))),
			)
			return
		}

		await this.#request(this.#store.delete(keyOrKeys as IDBValidKey))
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

		const count = await this.#request(this.#store.count(keyOrKeys as IDBValidKey))
		return count > 0
	}

	// ─── Bulk Operations ─────────────────────────────────────

	async all(query?: IDBKeyRange | null, count?: number): Promise<readonly T[]> {
		return this.#request(this.#store.getAll(query ?? undefined, count)) as Promise<readonly T[]>
	}

	async keys(query?: IDBKeyRange | null, count?: number): Promise<readonly ValidKey[]> {
		return this.#request(this.#store.getAllKeys(query ?? undefined, count)) as Promise<readonly ValidKey[]>
	}

	async clear(): Promise<void> {
		await this.#request(this.#store.clear())
	}

	async count(query?: IDBKeyRange | ValidKey | null): Promise<number> {
		return this.#request(this.#store.count(query as IDBValidKey | IDBKeyRange | undefined))
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
	 * maintaining atomicity guarantees. Unlike standalone Index, this does not
	 * create new transactions.
	 */
	index(name: string): TransactionIndexInterface<T> {
		if (!this.#store.indexNames.contains(name)) {
			throw new Error(`Index "${name}" not found on store "${this.#storeName}"`)
		}

		const nativeIndex = this.#store.index(name)
		return new TransactionIndex<T>(nativeIndex, this.#storeName)
	}

	// ─── Cursors ─────────────────────────────────────────────

	async openCursor(options?: CursorOptions): Promise<CursorInterface<T> | null> {
		const direction = toIDBCursorDirection(options?.direction)
		const request = this.#store.openCursor(
			options?.query as IDBKeyRange | IDBValidKey | null ?? null,
			direction,
		)

		const cursor = await this.#request(request)
		return cursor ? new Cursor<T>(cursor, request) : null
	}

	async openKeyCursor(options?: CursorOptions): Promise<KeyCursorInterface | null> {
		const direction = toIDBCursorDirection(options?.direction)
		const request = this.#store.openKeyCursor(
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
