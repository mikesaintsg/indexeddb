/**
 * Key cursor implementation
 *
 * @remarks
 * Implements KeyCursorInterface for iterating over keys only.
 * More efficient than full cursor when values aren't needed.
 *
 * @packageDocumentation
 */

import type {
	KeyCursorInterface,
	CursorDirection,
	ValidKey,
} from '../types.js'
import { wrapError } from '../errors.js'
import { fromIDBCursorDirection } from '../helpers.js'

/**
 * Key cursor implementation for iterating over keys.
 */
export class KeyCursor implements KeyCursorInterface {
	readonly #cursor: IDBCursor
	readonly #request: IDBRequest<IDBCursor | null>

	constructor(cursor: IDBCursor, request: IDBRequest<IDBCursor | null>) {
		this.#cursor = cursor
		this.#request = request
	}

	// ─── Native Access ───────────────────────────────────────

	get native(): IDBCursor {
		return this.#cursor
	}

	// ─── Accessors ───────────────────────────────────────────

	getKey(): ValidKey {
		return this.#cursor.key
	}

	getPrimaryKey(): ValidKey {
		return this.#cursor.primaryKey
	}

	getDirection(): CursorDirection {
		return fromIDBCursorDirection(this.#cursor.direction)
	}

	// ─── Navigation ──────────────────────────────────────────

	async continue(key?: ValidKey): Promise<KeyCursorInterface | null> {
		return new Promise((resolve, reject) => {
			this.#request.onsuccess = () => {
				const next = this.#request.result
				resolve(next ? new KeyCursor(next, this.#request) : null)
			}
			this.#request.onerror = () => reject(wrapError(this.#request.error))

			if (key !== undefined) {
				this.#cursor.continue(key)
			} else {
				this.#cursor.continue()
			}
		})
	}

	async continuePrimaryKey(key: ValidKey, primaryKey: ValidKey): Promise<KeyCursorInterface | null> {
		return new Promise((resolve, reject) => {
			this.#request.onsuccess = () => {
				const next = this.#request.result
				resolve(next ? new KeyCursor(next, this.#request) : null)
			}
			this.#request.onerror = () => reject(wrapError(this.#request.error))

			this.#cursor.continuePrimaryKey(key, primaryKey)
		})
	}

	async advance(count: number): Promise<KeyCursorInterface | null> {
		return new Promise((resolve, reject) => {
			this.#request.onsuccess = () => {
				const next = this.#request.result
				resolve(next ? new KeyCursor(next, this.#request) : null)
			}
			this.#request.onerror = () => reject(wrapError(this.#request.error))

			this.#cursor.advance(count)
		})
	}
}
