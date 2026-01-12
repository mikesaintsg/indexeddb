/**
 * Transaction implementation
 *
 * @remarks
 * Implements TransactionInterface for explicit transaction control.
 * Wraps IDBTransaction with state tracking and store access.
 *
 * @packageDocumentation
 */

import type {
	DatabaseSchema,
	TransactionInterface,
	TransactionStoreInterface,
	TransactionMode,
} from '../types.js'
import { TransactionStore } from './TransactionStore.js'
import { TransactionError } from '../errors.js'

/**
 * Transaction implementation for multi-store atomic operations.
 */
export class Transaction<
	Schema extends DatabaseSchema,
	K extends keyof Schema
> implements TransactionInterface<Schema, K> {
	readonly #transaction: IDBTransaction
	readonly #storeNames: readonly string[]
	#active = true
	#finished = false

	constructor(transaction: IDBTransaction) {
		this.#transaction = transaction
		this.#storeNames = Array.from(transaction.objectStoreNames)

		// Track transaction completion
		transaction.oncomplete = () => {
			this.#active = false
			this.#finished = true
		}

		transaction.onabort = () => {
			this.#active = false
			this.#finished = true
		}

		transaction.onerror = () => {
			this.#active = false
			this.#finished = true
		}
	}

	// ─── Native Access ───────────────────────────────────────

	get native(): IDBTransaction {
		return this.#transaction
	}

	// ─── Accessors ───────────────────────────────────────────

	getMode(): TransactionMode {
		return this.#transaction.mode as TransactionMode
	}

	getStoreNames(): readonly string[] {
		return this.#storeNames
	}

	isActive(): boolean {
		return this.#active
	}

	isFinished(): boolean {
		return this.#finished
	}

	// ─── Store Access ────────────────────────────────────────

	store<S extends K & string>(name: S): TransactionStoreInterface<Schema[S]> {
		if (!this.#storeNames.includes(name)) {
			throw new TransactionError(
				'INVALID_STATE',
				`Store "${name}" is not in transaction scope. Scoped stores: ${this.#storeNames.join(', ')}`,
			)
		}

		if (!this.#active) {
			throw new TransactionError(
				'TRANSACTION_INACTIVE',
				'Transaction is no longer active',
			)
		}

		const objectStore = this.#transaction.objectStore(name)
		return new TransactionStore<Schema[S]>(objectStore, name)
	}

	// ─── Control ─────────────────────────────────────────────

	abort(): void {
		if (this.#finished) {
			throw new TransactionError(
				'INVALID_STATE',
				'Cannot abort: transaction already finished',
			)
		}

		this.#transaction.abort()
		this.#active = false
		this.#finished = true
	}

	commit(): void {
		if (this.#finished) {
			throw new TransactionError(
				'INVALID_STATE',
				'Cannot commit: transaction already finished',
			)
		}

		// IDBTransaction.commit() may not be available in all browsers
		if (typeof this.#transaction.commit === 'function') {
			this.#transaction.commit()
		}

		// Even without explicit commit, mark as finishing
		// Transaction will auto-commit when all requests complete
	}
}
