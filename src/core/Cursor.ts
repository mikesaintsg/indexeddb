/**
 * Cursor implementation
 *
 * @remarks
 * Implements CursorInterface for iterating over records with values.
 * Supports navigation and mutation (update/delete).
 *
 * @packageDocumentation
 */

import type {
	CursorInterface,
	CursorDirection,
	ValidKey,
} from '../types.js'
import { wrapError } from '../errors.js'
import { fromIDBCursorDirection } from '../helpers.js'

/**
 * Cursor implementation for iterating over records.
 */
export class Cursor<T> implements CursorInterface<T> {
	readonly #cursor: IDBCursorWithValue
	readonly #request: IDBRequest<IDBCursorWithValue | null>

	constructor(cursor: IDBCursorWithValue, request: IDBRequest<IDBCursorWithValue | null>) {
		this.#cursor = cursor
		this.#request = request
	}

	// ─── Native Access ───────────────────────────────────────

	get native(): IDBCursorWithValue {
		return this.#cursor
	}

	// ─── Accessors ───────────────────────────────────────────

	getKey(): ValidKey {
		return this.#cursor.key
	}

	getPrimaryKey(): ValidKey {
		return this.#cursor.primaryKey
	}

	getValue(): T {
		return this.#cursor.value as T
	}

	getDirection(): CursorDirection {
		return fromIDBCursorDirection(this.#cursor.direction)
	}

	// ─── Navigation ──────────────────────────────────────────

	async continue(key?: ValidKey): Promise<CursorInterface<T> | null> {
		return new Promise((resolve, reject) => {
			this.#request.onsuccess = () => {
				const next = this.#request.result
				resolve(next ? new Cursor<T>(next, this.#request) : null)
			}
			this.#request.onerror = () => reject(wrapError(this.#request.error))

			if (key !== undefined) {
				this.#cursor.continue(key)
			} else {
				this.#cursor.continue()
			}
		})
	}

	async continuePrimaryKey(key: ValidKey, primaryKey: ValidKey): Promise<CursorInterface<T> | null> {
		return new Promise((resolve, reject) => {
			this.#request.onsuccess = () => {
				const next = this.#request.result
				resolve(next ? new Cursor<T>(next, this.#request) : null)
			}
			this.#request.onerror = () => reject(wrapError(this.#request.error))

			this.#cursor.continuePrimaryKey(key, primaryKey)
		})
	}

	async advance(count: number): Promise<CursorInterface<T> | null> {
		return new Promise((resolve, reject) => {
			this.#request.onsuccess = () => {
				const next = this.#request.result
				resolve(next ? new Cursor<T>(next, this.#request) : null)
			}
			this.#request.onerror = () => reject(wrapError(this.#request.error))

			this.#cursor.advance(count)
		})
	}

	// ─── Mutation ────────────────────────────────────────────

	async update(value: T): Promise<ValidKey> {
		return new Promise((resolve, reject) => {
			const request = this.#cursor.update(value)
			request.onsuccess = () => resolve(request.result)
			request.onerror = () => reject(wrapError(request.error))
		})
	}

	async delete(): Promise<void> {
		return new Promise((resolve, reject) => {
			const request = this.#cursor.delete()
			request.onsuccess = () => resolve()
			request.onerror = () => reject(wrapError(request.error))
		})
	}
}
