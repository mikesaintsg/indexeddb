/**
 * Index implementation
 *
 * @remarks
 * Implements IndexInterface for querying by indexed fields.
 * Provides same query methods as Store but operates on index keys.
 *
 * @packageDocumentation
 */

import type {
	IndexInterface,
	IndexDefinition,
	CursorInterface,
	KeyCursorInterface,
	QueryBuilderInterface,
	KeyPath,
	ValidKey,
	CursorOptions,
	IterateOptions,
} from '../types.js'
import { NotFoundError, wrapError } from '../errors.js'
import { toIDBCursorDirection } from '../helpers.js'
import { Cursor } from './Cursor.js'
import { KeyCursor } from './KeyCursor.js'
import { QueryBuilder } from './QueryBuilder.js'

/**
 * Index implementation for querying by indexed fields.
 */
export class Index<T> implements IndexInterface<T> {
	readonly #storeName: string
	readonly #indexName: string
	readonly #definition: IndexDefinition
	readonly #ensureOpen: () => Promise<IDBDatabase>

	constructor(
		storeName: string,
		indexName: string,
		definition: IndexDefinition,
		ensureOpen: () => Promise<IDBDatabase>,
	) {
		this.#storeName = storeName
		this.#indexName = indexName
		this.#definition = definition
		this.#ensureOpen = ensureOpen
	}

	// ─── Native Access ───────────────────────────────────────

	get native(): IDBIndex {
		throw new Error('Index.native requires active transaction. Use openCursor() or iterate().')
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
		const db = await this.#ensureOpen()
		const tx = db.transaction([this.#storeName], 'readonly')
		const store = tx.objectStore(this.#storeName)
		const index = store.index(this.#indexName)

		if (Array.isArray(keyOrKeys)) {
			return await Promise.all(
				keyOrKeys.map(k => this.#request(index.get(k)) as Promise<T | undefined>),
			)
		}

		return this.#request(index.get(keyOrKeys as IDBValidKey)) as Promise<T | undefined>
	}

	// ─── Resolve ─────────────────────────────────────────────

	resolve(key: ValidKey): Promise<T>
	resolve(keys: readonly ValidKey[]): Promise<readonly T[]>
	async resolve(keyOrKeys: ValidKey | readonly ValidKey[]): Promise<T | readonly T[]> {
		const db = await this.#ensureOpen()
		const tx = db.transaction([this.#storeName], 'readonly')
		const store = tx.objectStore(this.#storeName)
		const index = store.index(this.#indexName)

		if (Array.isArray(keyOrKeys)) {
			return await Promise.all(
				keyOrKeys.map(async k => {
					const result = await (this.#request(index.get(k)) as Promise<T | undefined>)
					if (result === undefined) throw new NotFoundError(this.#storeName, k)
					return result
				}),
			)
		}

		const result = await (this.#request(index.get(keyOrKeys as IDBValidKey)) as Promise<T | undefined>)
		if (result === undefined) throw new NotFoundError(this.#storeName, keyOrKeys as IDBValidKey)
		return result
	}

	// ─── Get Key ─────────────────────────────────────────────

	async getKey(key: ValidKey): Promise<ValidKey | undefined> {
		const db = await this.#ensureOpen()
		const tx = db.transaction([this.#storeName], 'readonly')
		const store = tx.objectStore(this.#storeName)
		const index = store.index(this.#indexName)
		return this.#request(index.getKey(key))
	}

	// ─── Bulk Operations ─────────────────────────────────────

	async all(query?: IDBKeyRange | null, count?: number): Promise<readonly T[]> {
		const db = await this.#ensureOpen()
		const tx = db.transaction([this.#storeName], 'readonly')
		const store = tx.objectStore(this.#storeName)
		const index = store.index(this.#indexName)
		return this.#request(index.getAll(query ?? undefined, count)) as Promise<readonly T[]>
	}

	async keys(query?: IDBKeyRange | null, count?: number): Promise<readonly ValidKey[]> {
		const db = await this.#ensureOpen()
		const tx = db.transaction([this.#storeName], 'readonly')
		const store = tx.objectStore(this.#storeName)
		const index = store.index(this.#indexName)
		return this.#request(index.getAllKeys(query ?? undefined, count)) as Promise<readonly ValidKey[]>
	}

	async count(query?: IDBKeyRange | ValidKey | null): Promise<number> {
		const db = await this.#ensureOpen()
		const tx = db.transaction([this.#storeName], 'readonly')
		const store = tx.objectStore(this.#storeName)
		const index = store.index(this.#indexName)
		return this.#request(index.count(query as IDBValidKey | IDBKeyRange | undefined))
	}

	// ─── Query Builder ───────────────────────────────────────

	query(): QueryBuilderInterface<T> {
		return new QueryBuilder<T>({
			storeName: this.#storeName,
			primaryKeyPath: null, // Will query by index
			indexNames: [this.#indexName],
			ensureOpen: this.#ensureOpen,
		})
	}

	// ─── Iteration ───────────────────────────────────────────

	async *iterate(options?: IterateOptions): AsyncGenerator<T, void, unknown> {
		const db = await this.#ensureOpen()
		const tx = db.transaction([this.#storeName], 'readonly')
		const store = tx.objectStore(this.#storeName)
		const index = store.index(this.#indexName)

		const direction = toIDBCursorDirection(options?.direction)
		const request = index.openCursor(
			options?.query as IDBKeyRange | IDBValidKey | null ?? null,
			direction,
		)

		let cursor = await this.#request(request)

		while (cursor) {
			yield cursor.value as T

			// Advance cursor
			const nextPromise = new Promise<IDBCursorWithValue | null>((resolve) => {
				request.onsuccess = () => resolve(request.result)
			})
			cursor.continue()
			cursor = await nextPromise
		}
	}

	async *iterateKeys(options?: IterateOptions): AsyncGenerator<ValidKey, void, unknown> {
		const db = await this.#ensureOpen()
		const tx = db.transaction([this.#storeName], 'readonly')
		const store = tx.objectStore(this.#storeName)
		const index = store.index(this.#indexName)

		const direction = toIDBCursorDirection(options?.direction)
		const request = index.openKeyCursor(
			options?.query as IDBKeyRange | IDBValidKey | null ?? null,
			direction,
		)

		let cursor = await this.#request(request)

		while (cursor) {
			yield cursor.key

			// Advance cursor
			const nextPromise = new Promise<IDBCursor | null>((resolve) => {
				request.onsuccess = () => resolve(request.result)
			})
			cursor.continue()
			cursor = await nextPromise
		}
	}

	// ─── Cursors ─────────────────────────────────────────────

	async openCursor(options?: CursorOptions): Promise<CursorInterface<T> | null> {
		const db = await this.#ensureOpen()
		const tx = db.transaction([this.#storeName], 'readonly')
		const store = tx.objectStore(this.#storeName)
		const index = store.index(this.#indexName)

		const direction = toIDBCursorDirection(options?.direction)
		const request = index.openCursor(
			options?.query as IDBKeyRange | IDBValidKey | null ?? null,
			direction,
		)

		const cursor = await this.#request(request)
		return cursor ? new Cursor<T>(cursor, request) : null
	}

	async openKeyCursor(options?: CursorOptions): Promise<KeyCursorInterface | null> {
		const db = await this.#ensureOpen()
		const tx = db.transaction([this.#storeName], 'readonly')
		const store = tx.objectStore(this.#storeName)
		const index = store.index(this.#indexName)

		const direction = toIDBCursorDirection(options?.direction)
		const request = index.openKeyCursor(
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
