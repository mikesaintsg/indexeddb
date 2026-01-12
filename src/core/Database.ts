/**
 * Database implementation
 *
 * @remarks
 * Implements DatabaseInterface with lazy connection opening.
 * Uses native IndexedDB APIs directly.
 *
 * @packageDocumentation
 */

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
} from '../helpers.js'
import {
	DEFAULT_KEY_PATH,
	DEFAULT_AUTO_INCREMENT,
	ERROR_MESSAGES,
} from '../constants.js'
import { Store } from './Store.js'
import { Transaction } from './Transaction.js'
import { toStoreNames, promisifyTransaction } from '../helpers.js'

/**
 * Database connection implementation.
 */
export class Database<Schema extends DatabaseSchema>
implements DatabaseInterface<Schema> {

	readonly #name: string
	readonly #version: number
	readonly #storeDefinitions: StoreDefinitions<Schema>
	readonly #migrations: readonly Migration[]
	readonly #onBlocked: BlockedCallback | undefined
	readonly #crossTabSync: boolean

	#db: IDBDatabase | null = null
	#opening: Promise<IDBDatabase> | null = null
	#closed = false
	#channel: BroadcastChannel | null = null

	readonly #changeListeners = new Set<ChangeCallback>()
	readonly #errorListeners = new Set<ErrorCallback>()
	readonly #versionChangeListeners = new Set<VersionChangeCallback>()
	readonly #closeListeners = new Set<() => void>()

	readonly #stores = new Map<string, Store<unknown>>()

	constructor(options: DatabaseOptions<Schema>) {
		assertValidName(options.name)
		assertValidVersion(options.version)

		this.#name = options.name
		this.#version = options.version
		this.#storeDefinitions = options.stores
		this.#migrations = options.migrations ?? []
		this.#onBlocked = options.onBlocked
		this.#crossTabSync = options.crossTabSync !== false

		// Initialize BroadcastChannel for cross-tab sync
		if (this.#crossTabSync && typeof BroadcastChannel !== 'undefined') {
			this.#channel = new BroadcastChannel(`idb:${options.name}`)
			this.#channel.onmessage = (event: MessageEvent<ChangeEvent>) => {
				this.#handleRemoteChange(event.data)
			}
		}

		this.#name = options.name
		this.#version = options.version
		this.#storeDefinitions = options.stores
		this.#migrations = options.migrations ?? []
		this.#onBlocked = options.onBlocked

		if (options.onChange) this.#changeListeners.add(options.onChange)
		if (options.onError) this.#errorListeners.add(options.onError)
		if (options.onVersionChange) this.#versionChangeListeners.add(options.onVersionChange)
		if (options.onClose) this.#closeListeners.add(options.onClose)
	}

	// ─── Native Access ───────────────────────────────────────

	get native(): IDBDatabase {
		if (!this.#db) {
			throw new InvalidStateError(ERROR_MESSAGES.DATABASE_NOT_OPEN)
		}
		return this.#db
	}

	// ─── Accessors ───────────────────────────────────────────

	getName(): string {
		return this.#name
	}

	getVersion(): number {
		return this.#version
	}

	getStoreNames(): readonly string[] {
		if (this.#db) {
			return Array.from(this.#db.objectStoreNames)
		}
		return Object.keys(this.#storeDefinitions)
	}

	isOpen(): boolean {
		return this.#db !== null && !this.#closed
	}

	// ─── Store Access ────────────────────────────────────────

	store<K extends keyof Schema & string>(name: K): StoreInterface<Schema[K]> {
		if (!(name in this.#storeDefinitions)) {
			throw new InvalidStateError(ERROR_MESSAGES.STORE_NOT_FOUND(name))
		}

		let store = this.#stores.get(name)
		if (!store) {
			store = new Store<unknown>(this, name, this.#storeDefinitions[name] as StoreDefinition)
			this.#stores.set(name, store)
		}

		return store as unknown as StoreInterface<Schema[K]>
	}

	// ─── Transactions ────────────────────────────────────────

	async read<K extends keyof Schema & string>(
		storeNames: K | readonly K[],
		operation: TransactionOperation<Schema, K>,
	): Promise<void> {
		const db = await this.ensureOpen()
		const names = toStoreNames(storeNames)

		const nativeTx = db.transaction([...names], 'readonly')
		const tx = new Transaction<Schema, K>(nativeTx)

		try {
			await operation(tx)
			// Wait for transaction to complete
			await promisifyTransaction(nativeTx)
		} catch (error) {
			// If operation throws, abort the transaction
			if (tx.isActive()) {
				try {
					tx.abort()
				} catch {
					// Transaction may have already been aborted
				}
			}
			throw error
		}
	}

	async write<K extends keyof Schema & string>(
		storeNames: K | readonly K[],
		operation: TransactionOperation<Schema, K>,
		options?: TransactionOptions,
	): Promise<void> {
		const db = await this.ensureOpen()
		const names = toStoreNames(storeNames)

		// Create transaction with durability option if supported
		const txOptions: IDBTransactionOptions | undefined = options?.durability
			? { durability: options.durability }
			: undefined

		const namesArray = [...names]
		const nativeTx = txOptions
			? db.transaction(namesArray, 'readwrite', txOptions)
			: db.transaction(namesArray, 'readwrite')

		const tx = new Transaction<Schema, K>(nativeTx)

		try {
			await operation(tx)
			// Wait for transaction to complete
			await promisifyTransaction(nativeTx)
		} catch (error) {
			// If operation throws, abort the transaction
			if (tx.isActive()) {
				try {
					tx.abort()
				} catch {
					// Transaction may have already been aborted
				}
			}
			throw error
		}
	}

	// ─── Lifecycle ───────────────────────────────────────────

	close(): void {
		// Close BroadcastChannel
		if (this.#channel) {
			this.#channel.close()
			this.#channel = null
		}

		if (this.#db) {
			this.#db.close()
			this.#db = null
		}
		this.#closed = true
		this.#opening = null

		for (const callback of this.#closeListeners) {
			try { callback() } catch { /* ignore */ }
		}
	}

	async drop(): Promise<void> {
		this.close()

		return new Promise((resolve, reject) => {
			const request = indexedDB.deleteDatabase(this.#name)
			request.onsuccess = () => resolve()
			request.onerror = () => reject(wrapError(request.error))
			request.onblocked = () => { /* wait for other connections */ }
		})
	}

	// ─── Subscriptions ───────────────────────────────────────

	onChange(callback: ChangeCallback): Unsubscribe {
		this.#changeListeners.add(callback)
		return () => this.#changeListeners.delete(callback)
	}

	onError(callback: ErrorCallback): Unsubscribe {
		this.#errorListeners.add(callback)
		return () => this.#errorListeners.delete(callback)
	}

	onVersionChange(callback: VersionChangeCallback): Unsubscribe {
		this.#versionChangeListeners.add(callback)
		return () => this.#versionChangeListeners.delete(callback)
	}

	onClose(callback: () => void): Unsubscribe {
		this.#closeListeners.add(callback)
		return () => this.#closeListeners.delete(callback)
	}

	// ─── Internal Methods (for Store) ────────────────────────

	/**
	 * Ensures database is open.
	 * @internal
	 */
	async ensureOpen(): Promise<IDBDatabase> {
		if (this.#closed) {
			throw new InvalidStateError(ERROR_MESSAGES.DATABASE_CLOSED)
		}

		if (this.#db) return this.#db
		if (this.#opening) return this.#opening

		this.#opening = this.#open()

		try {
			this.#db = await this.#opening
			return this.#db
		} catch (error) {
			this.#opening = null
			throw error
		}
	}

	/**
	 * Emits a change event to all listeners.
	 * @internal
	 */
	emitChange(event: ChangeEvent): void {
		// Notify local listeners
		for (const callback of this.#changeListeners) {
			try {
				callback(event)
			} catch (err) {
				this.#emitError(err instanceof Error ? err : new Error(String(err)))
			}
		}

		// Broadcast to other tabs (only for local changes)
		if (event.source === 'local' && this.#channel) {
			try {
				this.#channel.postMessage(event)
			} catch {
				// BroadcastChannel may be closed
			}
		}
	}

	/**
	 * Handles a change event received from another tab.
	 */
	#handleRemoteChange(event: ChangeEvent): void {
		// Mark as remote and emit to listeners
		const remoteEvent: ChangeEvent = {
			...event,
			source: 'remote',
		}

		for (const callback of this.#changeListeners) {
			try {
				callback(remoteEvent)
			} catch (err) {
				this.#emitError(err instanceof Error ? err : new Error(String(err)))
			}
		}

		// Also notify the specific store's listeners
		const store = this.#stores.get(event.storeName)
		if (store) {
			store.emitRemoteChange(remoteEvent)
		}
	}

	// ─── Private Methods ─────────────────────────────────────

	async #open(): Promise<IDBDatabase> {
		return new Promise((resolve, reject) => {
			const request = indexedDB.open(this.#name, this.#version)

			request.onerror = () => {
				reject(new OpenError(`Failed to open database "${this.#name}"`, request.error))
			}

			request.onsuccess = () => {
				const db = request.result
				this.#setupDatabaseHandlers(db)
				resolve(db)
			}

			request.onupgradeneeded = (event) => {
				const db = request.result
				const tx = request.transaction

				if (!tx) {
					reject(new UpgradeError('UPGRADE_FAILED', 'No transaction available during upgrade'))
					return
				}

				try {
					this.#performUpgrade(db, tx, event.oldVersion, event.newVersion ?? this.#version)
				} catch (error) {
					tx.abort()
					reject(error instanceof UpgradeError ? error : new UpgradeError(
						'UPGRADE_FAILED',
						error instanceof Error ? error.message : 'Upgrade failed',
						error,
					))
				}
			}

			request.onblocked = (event) => {
				if (this.#onBlocked) {
					this.#onBlocked({
						oldVersion: event.oldVersion,
						newVersion: event.newVersion ?? this.#version,
					})
				}
			}
		})
	}

	#setupDatabaseHandlers(db: IDBDatabase): void {
		db.onversionchange = (event) => {
			for (const callback of this.#versionChangeListeners) {
				try {
					callback({ oldVersion: event.oldVersion, newVersion: event.newVersion })
				} catch { /* ignore */ }
			}
		}

		db.onclose = () => {
			this.#db = null
			this.#closed = true
			for (const callback of this.#closeListeners) {
				try { callback() } catch { /* ignore */ }
			}
		}

		db.onerror = (event) => {
			const target = event.target as IDBRequest | null
			const error = target?.error ?? new Error('Unknown database error')
			this.#emitError(error instanceof Error ? error : new Error(String(error)))
		}
	}

	#performUpgrade(db: IDBDatabase, tx: IDBTransaction, oldVersion: number, newVersion: number): void {
		// Create stores from schema
		for (const [name, definition] of Object.entries(this.#storeDefinitions)) {
			if (!db.objectStoreNames.contains(name)) {
				this.#createStore(db, name, definition)
			}
		}

		// Run migrations in order
		const migrationsToRun = this.#migrations
			.filter(m => m.version > oldVersion && m.version <= newVersion)
			.sort((a, b) => a.version - b.version)

		for (const migration of migrationsToRun) {
			void migration.migrate({ database: db, transaction: tx, oldVersion, newVersion })
		}
	}

	#createStore(db: IDBDatabase, name: string, definition: StoreDefinition): void {
		const keyPath = definition.keyPath === undefined ? DEFAULT_KEY_PATH : definition.keyPath
		const autoIncrement = definition.autoIncrement ?? DEFAULT_AUTO_INCREMENT

		const options: IDBObjectStoreParameters = { autoIncrement }
		if (keyPath !== null) {
			options.keyPath = keyPath as string | string[]
		}

		const store = db.createObjectStore(name, options)

		for (const indexDef of definition.indexes ?? []) {
			this.#createIndex(store, indexDef)
		}
	}

	#createIndex(store: IDBObjectStore, definition: IndexDefinition): void {
		store.createIndex(
			definition.name,
			definition.keyPath as string | string[],
			{ unique: definition.unique ?? false, multiEntry: definition.multiEntry ?? false },
		)
	}

	#emitError(error: Error): void {
		for (const callback of this.#errorListeners) {
			try { callback(error) } catch { /* ignore */ }
		}
	}
}
