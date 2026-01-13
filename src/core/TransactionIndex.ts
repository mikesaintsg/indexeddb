/**
 * Transaction Index implementation
 *
 * @remarks
 * Implements TransactionIndexInterface for atomic index operations
 * within a transaction. All operations use the parent transaction's
 * IDBIndex, ensuring atomicity.
 *
 * Unlike Index class, this does NOT create new transactions for each operation.
 *
 * @packageDocumentation
 */

import type {
	TransactionIndexInterface,
	IndexDefinition,
	CursorInterface,
	KeyCursorInterface,
	KeyPath,
	ValidKey,
	CursorOptions,
} from '../types.js'
import { NotFoundError, wrapError } from '../errors.js'
import { toIDBCursorDirection } from '../helpers.js'
import { Cursor } from './Cursor.js'
import { KeyCursor } from './KeyCursor.js'

/**
 * Index operations bound to a transaction.
 */
export class TransactionIndex<T> implements TransactionIndexInterface<T> {
	readonly #index: IDBIndex
	readonly #storeName: string
	readonly #indexName: string
	readonly #definition: IndexDefinition

	constructor(
		index: IDBIndex,
		storeName: string,
		indexName: string,
		definition: IndexDefinition,
	) {
		this.#index = index
		this.#storeName = storeName
		this.#indexName = indexName
		this.#definition = definition
	}

	// ─── Native Access ───────────────────────────────────────

	get native(): IDBIndex {
		return this.#index
	}

	// ─── Accessors ───────────────────────────────────────────

	getName(): string {
		return this.#indexName
	}

	getKeyPath(): KeyPath {
		return this.#definition.keyPath
	}

	isUnique(): boolean {
		return this.#definition.unique ?? false
	}

	isMultiEntry(): boolean {
		return this.#definition.multiEntry ?? false
	}

	// ─── Get ─────────────────────────────────────────────────

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

	// ─── Get Key ─────────────────────────────────────────────

	async getKey(key: ValidKey): Promise<ValidKey | undefined> {
		return this.#request(this.#index.getKey(key))
	}

	// ─── Bulk Operations ─────────────────────────────────────

	async all(query?: IDBKeyRange | null, count?: number): Promise<readonly T[]> {
		return this.#request(this.#index.getAll(query ?? undefined, count)) as Promise<readonly T[]>
	}

	async keys(query?: IDBKeyRange | null, count?: number): Promise<readonly ValidKey[]> {
		return this.#request(this.#index.getAllKeys(query ?? undefined, count)) as Promise<readonly ValidKey[]>
	}

	async count(query?: IDBKeyRange | ValidKey | null): Promise<number> {
		return this.#request(this.#index.count(query as IDBValidKey | IDBKeyRange | undefined))
	}

	// ─── Cursors ─────────────────────────────────────────────

	async openCursor(options?: CursorOptions): Promise<CursorInterface<T> | null> {
		const direction = toIDBCursorDirection(options?.direction)
		const request = this.#index.openCursor(
			options?.query as IDBKeyRange | IDBValidKey | null ?? null,
			direction,
		)

		const cursor = await this.#request(request)
		return cursor ? new Cursor<T>(cursor, request) : null
	}

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
			request.onerror = () => reject(wrapError(request.error, {
				storeName: this.#storeName,
				indexName: this.#indexName,
			}))
		})
	}
}
