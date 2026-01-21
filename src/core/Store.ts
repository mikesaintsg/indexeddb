/**
 * Store implementation
 *
 * @remarks
 * Implements StoreInterface with automatic transaction management.
 * Each operation creates its own transaction for atomic execution.
 *
 * @packageDocumentation
 */

import type { PruneResult, Unsubscribe } from '@mikesaintsg/core'
import type {
	BulkOperationOptions,
	ChangeEvent,
	CursorInterface,
	CursorOptions,
	DatabaseSchema,
	IndexedDBSetOptions,
	IndexInterface,
	IterateOptions,
	KeyCursorInterface,
	KeyPath,
	QueryBuilderInterface,
	StoreDefinition,
	StoreInterface,
	ValidKey,
} from '../types.js'
import type { Database } from './Database.js'
import { NotFoundError, wrapError } from '../errors.js'
import { DEFAULT_AUTO_INCREMENT, DEFAULT_KEY_PATH, ERROR_MESSAGES } from '../constants.js'
import { toIDBCursorDirection } from '../helpers.js'
import { Index } from './Index.js'
import { Cursor } from './Cursor.js'
import { KeyCursor } from './KeyCursor.js'
import { QueryBuilder } from './QueryBuilder.js'

/**
 * Object store implementation.
 */
export class Store<T> implements StoreInterface<T> {
	readonly #database: Database<DatabaseSchema>
	readonly #name: string
	readonly #definition: StoreDefinition
	readonly #changeListeners = new Set<(event: ChangeEvent) => void>()

	constructor(database: Database<DatabaseSchema>, name: string, definition: StoreDefinition) {
		this.#database = database
		this.#name = name
		this.#definition = definition
	}

	// ─── Native Access ───────────────────────────────────────

	get native(): IDBObjectStore {
		throw new Error(ERROR_MESSAGES.NATIVE_ACCESS_NO_TRANSACTION)
	}

	// ─── Accessors ───────────────────────────────────────────

	getName(): string {
		return this.#name
	}

	getKeyPath(): KeyPath | null {
		if (this.#definition.keyPath === undefined) return DEFAULT_KEY_PATH
		return this.#definition.keyPath
	}

	getIndexNames(): readonly string[] {
		return (this.#definition.indexes ?? []).map(idx => idx.name)
	}

	hasAutoIncrement(): boolean {
		return this.#definition.autoIncrement ?? DEFAULT_AUTO_INCREMENT
	}

	hasTTL(): boolean {
		return this.#definition.ttl !== undefined
	}

	// ─── Get ─────────────────────────────────────────────────

	get(key: ValidKey): Promise<T | undefined>
	get(keys: readonly ValidKey[]): Promise<readonly (T | undefined)[]>
	async get(keyOrKeys: ValidKey | readonly ValidKey[]): Promise<T | undefined | readonly (T | undefined)[]> {
		const db = await this.#database.ensureOpen()
		const tx = db.transaction([this.#name], 'readonly')
		const store = tx.objectStore(this.#name)

		if (Array.isArray(keyOrKeys)) {
			const results = await Promise.all(
				keyOrKeys.map(k => this.#request(store.get(k)) as Promise<T | undefined>),
			)
			// Filter expired records if TTL is enabled
			if (this.hasTTL()) {
				return results.map(r => (r !== undefined && this.#isRecordExpired(r)) ? undefined : r)
			}
			return results
		}

		const result = await this.#request(store.get(keyOrKeys as IDBValidKey)) as T | undefined
		// Filter expired record if TTL is enabled
		if (result !== undefined && this.hasTTL() && this.#isRecordExpired(result)) {
			return undefined
		}
		return result
	}

	// ─── Resolve ─────────────────────────────────────────────

	resolve(key: ValidKey): Promise<T>
	resolve(keys: readonly ValidKey[]): Promise<readonly T[]>
	async resolve(keyOrKeys: ValidKey | readonly ValidKey[]): Promise<T | readonly T[]> {
		const db = await this.#database.ensureOpen()
		const tx = db.transaction([this.#name], 'readonly')
		const store = tx.objectStore(this.#name)

		if (Array.isArray(keyOrKeys)) {
			return await Promise.all(
				keyOrKeys.map(async k => {
					const result = await (this.#request(store.get(k)) as Promise<T | undefined>)
					if (result === undefined) throw new NotFoundError(this.#name, k)
					return result
				}),
			)
		}

		const result = await (this.#request(store.get(keyOrKeys as IDBValidKey)) as Promise<T | undefined>)
		if (result === undefined) throw new NotFoundError(this.#name, keyOrKeys as IDBValidKey)
		return result
	}

	// ─── Has ─────────────────────────────────────────────────

	has(key: ValidKey): Promise<boolean>
	has(keys: readonly ValidKey[]): Promise<readonly boolean[]>
	async has(keyOrKeys: ValidKey | readonly ValidKey[]): Promise<boolean | readonly boolean[]> {
		const db = await this.#database.ensureOpen()
		const tx = db.transaction([this.#name], 'readonly')
		const store = tx.objectStore(this.#name)

		if (Array.isArray(keyOrKeys)) {
			return await Promise.all(
				keyOrKeys.map(async k => {
					const count = await this.#request(store.count(k))
					return count > 0
				}),
			)
		}

		const count = await this.#request(store.count(keyOrKeys as IDBValidKey))
		return count > 0
	}

	// ─── Set ─────────────────────────────────────────────────

	set(value: T, key?: ValidKey): Promise<ValidKey>
	set(value: T, options: IndexedDBSetOptions): Promise<ValidKey>
	set(values: readonly T[], options?: BulkOperationOptions): Promise<readonly ValidKey[]>
	async set(
		valueOrValues: T | readonly T[],
		keyOrOptions?: ValidKey | IndexedDBSetOptions | BulkOperationOptions,
	): Promise<ValidKey | readonly ValidKey[]> {
		const db = await this.#database.ensureOpen()
		const tx = db.transaction([this.#name], 'readwrite')
		const store = tx.objectStore(this.#name)

		if (Array.isArray(valueOrValues)) {
			const options = keyOrOptions as BulkOperationOptions | undefined
			const onProgress = options?.onProgress
			const total = valueOrValues.length
			const keys: ValidKey[] = []

			for (let i = 0; i < total; i++) {
				const key = await this.#request(store.put(valueOrValues[i]))
				keys.push(key)
				if (onProgress) {
					onProgress(i + 1, total)
				}
			}
			await this.#awaitTransaction(tx)
			this.#emitChange('set', keys)
			return keys as readonly ValidKey[]
		}

		const key = keyOrOptions as ValidKey | undefined
		const resultKey = await this.#request(store.put(valueOrValues, key))
		await this.#awaitTransaction(tx)
		this.#emitChange('set', [resultKey])
		return resultKey
	}

	// ─── Add ─────────────────────────────────────────────────

	add(value: T, key?: ValidKey): Promise<ValidKey>
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
			const onProgress = options?.onProgress
			const total = valueOrValues.length
			const keys: ValidKey[] = []

			for (let i = 0; i < total; i++) {
				const key = await this.#request(store.add(valueOrValues[i]))
				keys.push(key)
				if (onProgress) {
					onProgress(i + 1, total)
				}
			}
			await this.#awaitTransaction(tx)
			this.#emitChange('add', keys)
			return keys as readonly ValidKey[]
		}

		const key = keyOrOptions as ValidKey | undefined
		const resultKey = await this.#request(store.add(valueOrValues, key))
		await this.#awaitTransaction(tx)
		this.#emitChange('add', [resultKey])
		return resultKey
	}

	// ─── Remove ──────────────────────────────────────────────

	remove(key: ValidKey): Promise<void>
	remove(keys: readonly ValidKey[]): Promise<void>
	async remove(keyOrKeys: ValidKey | readonly ValidKey[]): Promise<void> {
		const db = await this.#database.ensureOpen()
		const tx = db.transaction([this.#name], 'readwrite')
		const store = tx.objectStore(this.#name)

		if (Array.isArray(keyOrKeys)) {
			await Promise.all(
				keyOrKeys.map(k => this.#request(store.delete(k))),
			)
			await this.#awaitTransaction(tx)
			this.#emitChange('remove', keyOrKeys.map(k => k))
			return
		}

		await this.#request(store.delete(keyOrKeys as IDBValidKey))
		await this.#awaitTransaction(tx)
		this.#emitChange('remove', [keyOrKeys as ValidKey])
	}

	// ─── Bulk Operations ─────────────────────────────────────

	async all(query?: IDBKeyRange | null, count?: number): Promise<readonly T[]> {
		const db = await this.#database.ensureOpen()
		const tx = db.transaction([this.#name], 'readonly')
		const store = tx.objectStore(this.#name)
		const records = await this.#request(store.getAll(query ?? undefined, count)) as T[]

		// Filter expired records if TTL is enabled
		if (this.hasTTL()) {
			return records.filter(record => !this.#isRecordExpired(record))
		}

		return records
	}

	async keys(query?: IDBKeyRange | null, count?: number): Promise<readonly ValidKey[]> {
		const db = await this.#database.ensureOpen()
		const tx = db.transaction([this.#name], 'readonly')
		const store = tx.objectStore(this.#name)
		return this.#request(store.getAllKeys(query ?? undefined, count)) as Promise<readonly ValidKey[]>
	}

	async clear(): Promise<void> {
		const db = await this.#database.ensureOpen()
		const tx = db.transaction([this.#name], 'readwrite')
		const store = tx.objectStore(this.#name)
		await this.#request(store.clear())
		await this.#awaitTransaction(tx)
		this.#emitChange('clear', [])
	}

	async count(query?: IDBKeyRange | ValidKey | null): Promise<number> {
		const db = await this.#database.ensureOpen()
		const tx = db.transaction([this.#name], 'readonly')
		const store = tx.objectStore(this.#name)
		return this.#request(store.count(query as IDBValidKey | IDBKeyRange | undefined))
	}

	// ─── TTL Operations ──────────────────────────────────────

	async prune(): Promise<PruneResult> {
		if (!this.hasTTL()) {
			const count = await this.count()
			return { prunedCount: 0, remainingCount: count }
		}

		const db = await this.#database.ensureOpen()
		const tx = db.transaction([this.#name], 'readwrite')
		const store = tx.objectStore(this.#name)

		const ttlConfig = this.#definition.ttl
		const expiresField = ttlConfig?.field ?? '_expiresAt'
		const now = Date.now()

		let prunedCount = 0
		const prunedKeys: ValidKey[] = []

		const request = store.openCursor()
		await new Promise<void>((resolve, reject) => {
			request.onsuccess = () => {
				const cursor = request.result
				if (cursor) {
					const record = cursor.value as Record<string, unknown>
					const expiresAt = record[expiresField]
					if (typeof expiresAt === 'number' && expiresAt <= now) {
						prunedKeys.push(cursor.primaryKey)
						void cursor.delete()
						prunedCount++
					}
					void cursor.continue()
				} else {
					resolve()
				}
			}
			request.onerror = () => reject(request.error ?? new Error('Cursor operation failed'))
		})

		await this.#awaitTransaction(tx)

		if (prunedCount > 0) {
			this.#emitChange('remove', prunedKeys)
		}

		const remainingCount = await this.count()
		return { prunedCount, remainingCount }
	}

	async isExpired(key: ValidKey): Promise<boolean> {
		if (!this.hasTTL()) {
			return false
		}

		// Use raw database access to get record without TTL filtering
		const db = await this.#database.ensureOpen()
		const tx = db.transaction([this.#name], 'readonly')
		const store = tx.objectStore(this.#name)
		const record = await this.#request(store.get(key)) as Record<string, unknown> | undefined

		if (!record) {
			return false
		}

		const ttlConfig = this.#definition.ttl
		const expiresField = ttlConfig?.field ?? '_expiresAt'
		const expiresAt = record[expiresField]

		if (typeof expiresAt === 'number') {
			return expiresAt <= Date.now()
		}

		return false
	}

	// ─── Index Access ────────────────────────────────────────

	index(name: string): IndexInterface<T> {
		// Verify index exists in definition
		const indexes = this.#definition.indexes ?? []
		const indexDef = indexes.find(idx => idx.name === name)
		if (!indexDef) {
			throw new Error(`Index "${name}" not found on store "${this.#name}"`)
		}

		return new Index<T>(
			this.#name,
			name,
			indexDef,
			() => this.#database.ensureOpen(),
		)
	}

	// ─── Query Builder ───────────────────────────────────────

	query(): QueryBuilderInterface<T> {
		const keyPath = this.getKeyPath()
		return new QueryBuilder<T>({
			storeName: this.#name,
			primaryKeyPath: typeof keyPath === 'string' ? keyPath : null,
			indexNames: this.getIndexNames(),
			ensureOpen: () => this.#database.ensureOpen(),
		})
	}

	// ─── Iteration ───────────────────────────────────────────

	async *iterate(options?: IterateOptions): AsyncGenerator<T, void, unknown> {
		const db = await this.#database.ensureOpen()
		const tx = db.transaction([this.#name], 'readonly')
		const store = tx.objectStore(this.#name)

		const direction = toIDBCursorDirection(options?.direction)
		const request = store.openCursor(
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
		const db = await this.#database.ensureOpen()
		const tx = db.transaction([this.#name], 'readonly')
		const store = tx.objectStore(this.#name)

		const direction = toIDBCursorDirection(options?.direction)
		const request = store.openKeyCursor(
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
		const db = await this.#database.ensureOpen()
		const tx = db.transaction([this.#name], 'readonly')
		const store = tx.objectStore(this.#name)

		const direction = toIDBCursorDirection(options?.direction)
		const request = store.openCursor(
			options?.query as IDBKeyRange | IDBValidKey | null ?? null,
			direction,
		)

		const cursor = await this.#request(request)
		return cursor ? new Cursor<T>(cursor, request) : null
	}

	async openKeyCursor(options?: CursorOptions): Promise<KeyCursorInterface | null> {
		const db = await this.#database.ensureOpen()
		const tx = db.transaction([this.#name], 'readonly')
		const store = tx.objectStore(this.#name)

		const direction = toIDBCursorDirection(options?.direction)
		const request = store.openKeyCursor(
			options?.query as IDBKeyRange | IDBValidKey | null ?? null,
			direction,
		)

		const cursor = await this.#request(request)
		return cursor ? new KeyCursor(cursor, request) : null
	}

	// ─── Subscriptions ───────────────────────────────────────

	onChange(callback: (event: ChangeEvent) => void): Unsubscribe {
		this.#changeListeners.add(callback)
		return () => this.#changeListeners.delete(callback)
	}

	// ─── Private Helpers ─────────────────────────────────────

	#request<R>(request: IDBRequest<R>): Promise<R> {
		return new Promise((resolve, reject) => {
			request.onsuccess = () => resolve(request.result)
			request.onerror = () => reject(wrapError(request.error, { storeName: this.#name }))
		})
	}

	#awaitTransaction(tx: IDBTransaction): Promise<void> {
		return new Promise((resolve, reject) => {
			tx.oncomplete = () => resolve()
			tx.onerror = () => reject(wrapError(tx.error))
			tx.onabort = () => reject(wrapError(tx.error))
		})
	}

	/**
	 * Checks if a record is expired (synchronous check).
	 * @param record - The record to check
	 * @returns true if record is expired
	 */
	#isRecordExpired(record: T): boolean {
		if (!this.hasTTL()) {
			return false
		}

		const ttlConfig = this.#definition.ttl
		const expiresField = ttlConfig?.field ?? '_expiresAt'
		const expiresAt = (record as Record<string, unknown>)[expiresField]

		if (typeof expiresAt === 'number') {
			return expiresAt <= Date.now()
		}

		return false
	}

	#emitChange(type: ChangeEvent['type'], keys: readonly ValidKey[]): void {
		const firstKey = keys.length > 0 ? keys[0] : undefined
		const baseEvent = {
			storeName: this.#name,
			type,
			keys,
			source: 'local' as const,
			timestamp: Date.now(),
		}
		const event: ChangeEvent = firstKey !== undefined
			? { ...baseEvent, key: firstKey }
			: baseEvent

		for (const callback of this.#changeListeners) {
			try { callback(event) } catch { /* ignore */ }
		}

		this.#database.emitChange(event)
	}

	/**
	 * Emits a remote change event to store listeners.
	 * @internal
	 */
	emitRemoteChange(event: ChangeEvent): void {
		for (const callback of this.#changeListeners) {
			try { callback(event) } catch { /* ignore */ }
		}
	}
}
