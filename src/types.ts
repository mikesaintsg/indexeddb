/**
 * IndexedDB Wrapper Library Type Definitions
 *
 * SOURCE OF TRUTH for all public types and interfaces.
 *
 * @remarks
 * Design principles:
 * - No `any` types
 * - `readonly` by default for public outputs
 * - Simple returns:  `get()` returns `T | undefined`, not Result wrapper
 * - Exceptions for infrastructure errors
 * - `get()` returns undefined for missing; `resolve()` throws
 * - Overloads for unified single/array methods
 * - Explicit naming (no abbreviations except ID, URL, API, HTML, DOM, CSS, JSON, UUID, ARIA)
 * - Sensible defaults (`keyPath:  'id'`, `autoIncrement: false`)
 * - Direct native access via `.native` property
 *
 * @packageDocumentation
 */

// ============================================================================
// Utility Types
// ============================================================================

/** Cleanup function returned by event subscriptions */
export type Unsubscribe = () => void

/** Converts subscription methods to hook callbacks for options */
export type SubscriptionToHook<T> = {
	[K in keyof T]?: T[K] extends (callback: infer CB) => Unsubscribe ?  CB : never
}

/** Valid IndexedDB key types */
export type ValidKey = IDBValidKey

/** Valid IndexedDB key path */
export type KeyPath = string | readonly string[]

// ============================================================================
// Error Types
// ============================================================================

/** Error codes for database operations */
export type DatabaseErrorCode =
	| 'OPEN_FAILED'
	| 'UPGRADE_FAILED'
	| 'UPGRADE_BLOCKED'
	| 'TRANSACTION_ABORTED'
	| 'TRANSACTION_INACTIVE'
	| 'CONSTRAINT_ERROR'
	| 'QUOTA_EXCEEDED'
	| 'NOT_FOUND'
	| 'DATA_ERROR'
	| 'READ_ONLY'
	| 'VERSION_ERROR'
	| 'INVALID_STATE'
	| 'TIMEOUT'
	| 'UNKNOWN_ERROR'

// ============================================================================
// Schema Types
// ============================================================================

/** Base constraint for database schema (record types mapped by store name) */
export type DatabaseSchema = Record<string, unknown>

/** Index definition for an object store */
export interface IndexDefinition {
	readonly name: string
	readonly keyPath: KeyPath
	readonly unique?:  boolean
	readonly multiEntry?: boolean
}

/**
 * Object store definition.
 *
 * @remarks
 * Defaults:
 * - `keyPath`: `'id'`
 * - `autoIncrement`: `false`
 * - `indexes`: `[]`
 *
 * Use `keyPath:  null` for out-of-line keys.
 */
export interface StoreDefinition {
	/** Key path for in-line keys.  Use `null` for out-of-line keys.  @defaultValue `'id'` */
	readonly keyPath?: KeyPath | null
	/** Whether the store uses auto-incrementing keys. @defaultValue `false` */
	readonly autoIncrement?: boolean
	/** Index definitions for the store */
	readonly indexes?:  readonly IndexDefinition[]
}

/** Store definitions mapped by store name */
export type StoreDefinitions<Schema extends DatabaseSchema> = {
	readonly [K in keyof Schema]:  StoreDefinition
}

// ============================================================================
// Transaction Types
// ============================================================================

/** Transaction mode */
export type TransactionMode = 'readonly' | 'readwrite'

/** Transaction durability hint */
export type TransactionDurability = 'default' | 'strict' | 'relaxed'

/** Transaction options */
export interface TransactionOptions {
	/** Durability hint for the transaction */
	readonly durability?:  TransactionDurability
}

/** Transaction operation callback */
export type TransactionOperation<
	Schema extends DatabaseSchema,
	K extends keyof Schema
> = (transaction: TransactionInterface<Schema, K>) => Promise<void> | void

// ============================================================================
// Cursor Types
// ============================================================================

/** Cursor iteration direction (explicit naming:  'previous' not 'prev') */
export type CursorDirection = 'next' | 'nextunique' | 'previous' | 'previousunique'

/** Cursor options */
export interface CursorOptions {
	/** Iteration direction */
	readonly direction?: CursorDirection
	/** Key range or specific key to iterate */
	readonly query?: IDBKeyRange | ValidKey
}

/** Iteration options (alias for consistency) */
export type IterateOptions = CursorOptions

// ============================================================================
// Query Types
// ============================================================================

/** Options for between queries */
export interface BetweenOptions {
	/** Exclude lower bound from range */
	readonly lowerOpen?: boolean
	/** Exclude upper bound from range */
	readonly upperOpen?: boolean
}

/** Order direction (explicit naming: 'ascending' not 'asc') */
export type OrderDirection = 'ascending' | 'descending'

// ============================================================================
// Event Types
// ============================================================================

/** Type of change operation */
export type ChangeType = 'set' | 'add' | 'remove' | 'clear'

/** Source of change event */
export type ChangeSource = 'local' | 'remote'

/** Change event emitted when data is modified */
export interface ChangeEvent {
	/** Name of the store that was modified */
	readonly storeName: string
	/** Type of modification */
	readonly type: ChangeType
	/** Keys that were affected */
	readonly keys: readonly ValidKey[]
	/** Whether change originated locally or from another tab */
	readonly source: ChangeSource
}

/** Callback for change events */
export type ChangeCallback = (event: ChangeEvent) => void

/** Callback for error events */
export type ErrorCallback = (error: Error) => void

/** Callback for blocked events during upgrade */
export type BlockedCallback = (event: {
	readonly oldVersion: number
	readonly newVersion: number
}) => void

/** Callback for version change events */
export type VersionChangeCallback = (event: {
	readonly oldVersion:  number
	readonly newVersion: number | null
}) => void

// ============================================================================
// Migration Types
// ============================================================================

/** Context provided to migration functions */
export interface MigrationContext {
	/** Native IDBDatabase instance */
	readonly database: IDBDatabase
	/** Native IDBTransaction instance (versionchange mode) */
	readonly transaction: IDBTransaction
	/** Version before upgrade */
	readonly oldVersion: number
	/** Version after upgrade */
	readonly newVersion: number
}

/** Migration function signature */
export type MigrationFunction = (context: MigrationContext) => void | Promise<void>

/** Migration definition */
export interface Migration {
	/** Target version for this migration */
	readonly version: number
	/** Migration function to execute */
	readonly migrate: MigrationFunction
}

// ============================================================================
// Subscription Interfaces
// ============================================================================

/** Database-level subscription methods */
export interface DatabaseSubscriptions {
	/**
	 * Subscribe to change events from all stores.
	 *
	 * @param callback - Called when data changes
	 * @returns Cleanup function to unsubscribe
	 */
	onChange(callback: ChangeCallback): Unsubscribe

	/**
	 * Subscribe to error events.
	 *
	 * @param callback - Called when an error occurs
	 * @returns Cleanup function to unsubscribe
	 */
	onError(callback: ErrorCallback): Unsubscribe

	/**
	 * Subscribe to version change events (another tab wants to upgrade).
	 *
	 * @param callback - Called when version change requested
	 * @returns Cleanup function to unsubscribe
	 */
	onVersionChange(callback: VersionChangeCallback): Unsubscribe

	/**
	 * Subscribe to close events.
	 *
	 * @param callback - Called when database connection closes
	 * @returns Cleanup function to unsubscribe
	 */
	onClose(callback: () => void): Unsubscribe
}

/** Store-level subscription methods */
export interface StoreSubscriptions {
	/**
	 * Subscribe to change events for this store.
	 *
	 * @param callback - Called when store data changes
	 * @returns Cleanup function to unsubscribe
	 */
	onChange(callback: (event: ChangeEvent) => void): Unsubscribe
}

// ============================================================================
// Options Interfaces
// ============================================================================

/** Options for creating a database */
export interface DatabaseOptions<Schema extends DatabaseSchema>
	extends SubscriptionToHook<DatabaseSubscriptions> {
	/** Database name */
	readonly name: string
	/** Database version (positive integer) */
	readonly version: number
	/** Store definitions */
	readonly stores:  StoreDefinitions<Schema>
	/** Migrations to run during version upgrades */
	readonly migrations?:  readonly Migration[]
	/** Enable cross-tab change synchronization via BroadcastChannel.  @defaultValue `true` */
	readonly crossTabSync?: boolean
	/** Called when upgrade is blocked by other connections */
	readonly onBlocked?: BlockedCallback
}

// ============================================================================
// Core Interfaces
// ============================================================================

/**
 * Database connection interface.
 *
 * @remarks
 * Provides access to stores and transaction management.
 * Connection opens lazily on first operation.
 *
 * @example
 * ```ts
 * const db = await createDatabase<MySchema>({
 *   name:  'myApp',
 *   version: 1,
 *   stores: { users: {} }
 * })
 *
 * const user = await db. store('users').get('u1')
 * ```
 */
export interface DatabaseInterface<Schema extends DatabaseSchema>
	extends DatabaseSubscriptions {
	/** Native IDBDatabase instance */
	readonly native:  IDBDatabase

	// ─── Accessors ───────────────────────────────────────────

	/** Get the database name */
	getName(): string

	/** Get the database version */
	getVersion(): number

	/** Get all object store names */
	getStoreNames(): readonly string[]

	/** Check if the database connection is open */
	isOpen(): boolean

	// ─── Store Access ────────────────────────────────────────

	/**
	 * Get a store interface for the specified store.
	 *
	 * @param name - Store name
	 * @returns Store interface
	 */
	store<K extends keyof Schema & string>(name: K): StoreInterface<Schema[K]>

	// ─── Transactions ────────────────────────────────────────

	/**
	 * Execute an operation within an explicit transaction.
	 *
	 * @param storeNames - Stores to include in transaction scope
	 * @param mode - Transaction mode
	 * @param operation - Operation to execute
	 * @param options - Transaction options
	 *
	 * @example
	 * ```ts
	 * await db.transaction(['users', 'posts'], 'readwrite', async (tx) => {
	 *   const user = await tx. store('users').resolve('u1')
	 *   await tx.store('posts').set({ authorId: user.id, title: 'Hello' })
	 * })
	 * ```
	 */
	transaction<K extends keyof Schema & string>(
		storeNames: readonly K[],
		mode: TransactionMode,
		operation:  TransactionOperation<Schema, K>,
		options?: TransactionOptions
	): Promise<void>

	/**
	 * Create a readonly transaction (native escape hatch).
	 *
	 * @param storeNames - Store name or names
	 * @returns Native IDBTransaction
	 */
	read<K extends keyof Schema & string>(storeNames: K | readonly K[]): IDBTransaction

	/**
	 * Create a readwrite transaction (native escape hatch).
	 *
	 * @param storeNames - Store name or names
	 * @returns Native IDBTransaction
	 */
	write<K extends keyof Schema & string>(storeNames: K | readonly K[]): IDBTransaction

	// ─── Lifecycle ───────────────────────────────────────────

	/** Close the database connection */
	close(): void

	/**
	 * Close and delete the database entirely.
	 *
	 * @remarks
	 * This permanently removes all data.
	 */
	drop(): Promise<void>
}

/**
 * Object store interface.
 *
 * @remarks
 * Provides type-safe CRUD operations on a single object store.
 *
 * Method semantics:
 * - `get()` returns `undefined` for missing records
 * - `resolve()` throws `NotFoundError` for missing records
 * - `set()` upserts (inserts or updates)
 * - `add()` inserts only (throws `ConstraintError` if key exists)
 * - `remove()` silently succeeds if key doesn't exist
 *
 * All methods throw on infrastructure errors (quota, transaction abort, etc.).
 *
 * @example
 * ```ts
 * const store = db.store('users')
 *
 * // Simple get (undefined if missing)
 * const user = await store. get('u1')
 *
 * // Must exist (throws if missing)
 * const user = await store. resolve('u1')
 *
 * // Batch operations (single transaction)
 * await store. set([user1, user2, user3])
 * ```
 */
export interface StoreInterface<T> extends StoreSubscriptions {
	/**
	 * Native IDBObjectStore instance.
	 *
	 * @remarks
	 * Only valid within an active transaction context.
	 * Throws if accessed outside a transaction.
	 */
	readonly native: IDBObjectStore

	// ─── Accessors ───────────────────────────────────────────

	/** Get the store name */
	getName(): string

	/** Get the key path, or null for out-of-line keys */
	getKeyPath(): KeyPath | null

	/** Get all index names */
	getIndexNames(): readonly string[]

	/** Check if the store uses auto-incrementing keys */
	hasAutoIncrement(): boolean

	// ─── Get (undefined for missing) ─────────────────────────

	/**
	 * Get a record by key.
	 *
	 * @param key - The key to look up
	 * @returns The record, or undefined if not found
	 *
	 * @example
	 * ```ts
	 * const user = await store.get('u1')
	 * if (user) {
	 *   console.log(user. name)
	 * }
	 * ```
	 */
	get(key:  ValidKey): Promise<T | undefined>

	/**
	 * Get multiple records by keys.
	 *
	 * @param keys - Array of keys to look up
	 * @returns Array of records (undefined for missing keys)
	 *
	 * @example
	 * ```ts
	 * const users = await store.get(['u1', 'u2', 'u3'])
	 * // users[1] may be undefined if 'u2' doesn't exist
	 * ```
	 */
	get(keys: readonly ValidKey[]): Promise<readonly (T | undefined)[]>

	// ─── Resolve (throws for missing) ────────────────────────

	/**
	 * Get a record by key, throwing if not found.
	 *
	 * @param key - The key to look up
	 * @returns The record (guaranteed to exist)
	 * @throws NotFoundError if record doesn't exist
	 *
	 * @example
	 * ```ts
	 * try {
	 *   const user = await store.resolve('u1')
	 *   console.log(user.name) // Safe - would have thrown
	 * } catch (error) {
	 *   if (error instanceof NotFoundError) {
	 *     console.log('User not found:', error. key)
	 *   }
	 * }
	 * ```
	 */
	resolve(key: ValidKey): Promise<T>

	/**
	 * Get multiple records by keys, throwing if any are missing.
	 *
	 * @param keys - Array of keys to look up
	 * @returns Array of records (all guaranteed to exist)
	 * @throws NotFoundError if any record doesn't exist
	 *
	 * @example
	 * ```ts
	 * // Throws if u1, u2, OR u3 is missing
	 * const users = await store.resolve(['u1', 'u2', 'u3'])
	 * ```
	 */
	resolve(keys: readonly ValidKey[]): Promise<readonly T[]>

	// ─── Set (upsert) ────────────────────────────────────────

	/**
	 * Store a record (insert or update).
	 *
	 * @param value - The record to store
	 * @param key - Optional key (required if store has no keyPath)
	 * @returns The key of the stored record
	 *
	 * @example
	 * ```ts
	 * await store.set({ id: 'u1', name:  'Alice' })
	 * ```
	 */
	set(value: T, key?: ValidKey): Promise<ValidKey>

	/**
	 * Store multiple records in a single transaction.
	 *
	 * @param values - Array of records to store
	 * @returns Array of keys for stored records
	 *
	 * @example
	 * ```ts
	 * const keys = await store.set([user1, user2, user3])
	 * ```
	 */
	set(values: readonly T[]): Promise<readonly ValidKey[]>

	// ─── Add (insert only) ───────────────────────────────────

	/**
	 * Add a record (insert only, fails if key exists).
	 *
	 * @param value - The record to add
	 * @param key - Optional key (required if store has no keyPath)
	 * @returns The key of the added record
	 * @throws ConstraintError if key already exists
	 *
	 * @example
	 * ```ts
	 * try {
	 *   await store.add({ id: 'u1', name:  'Alice' })
	 * } catch (error) {
	 *   if (error instanceof ConstraintError) {
	 *     console.log('User already exists')
	 *   }
	 * }
	 * ```
	 */
	add(value: T, key?:  ValidKey): Promise<ValidKey>

	/**
	 * Add multiple records (insert only, fails if any key exists).
	 *
	 * @param values - Array of records to add
	 * @returns Array of keys for added records
	 * @throws ConstraintError if any key already exists
	 */
	add(values: readonly T[]): Promise<readonly ValidKey[]>

	// ─── Remove ──────────────────────────────────────────────

	/**
	 * Remove a record by key.
	 *
	 * @param key - The key to remove
	 *
	 * @remarks
	 * Silently succeeds if key doesn't exist.
	 */
	remove(key: ValidKey): Promise<void>

	/**
	 * Remove multiple records by keys.
	 *
	 * @param keys - Array of keys to remove
	 *
	 * @remarks
	 * Silently succeeds for keys that don't exist.
	 */
	remove(keys:  readonly ValidKey[]): Promise<void>

	// ─── Has ─────────────────────────────────────────────────

	/**
	 * Check if a record exists.
	 *
	 * @param key - The key to check
	 * @returns true if record exists
	 */
	has(key: ValidKey): Promise<boolean>

	/**
	 * Check if multiple records exist.
	 *
	 * @param keys - Array of keys to check
	 * @returns Array of booleans indicating existence
	 */
	has(keys: readonly ValidKey[]): Promise<readonly boolean[]>

	// ─── Bulk Operations ─────────────────────────────────────

	/**
	 * Get all records, optionally filtered by key range.
	 *
	 * @param query - Optional key range filter
	 * @param count - Optional maximum number of records
	 * @returns Array of all matching records
	 */
	all(query?: IDBKeyRange | null, count?: number): Promise<readonly T[]>

	/**
	 * Get all keys, optionally filtered by key range.
	 *
	 * @param query - Optional key range filter
	 * @param count - Optional maximum number of keys
	 * @returns Array of all matching keys
	 */
	keys(query?: IDBKeyRange | null, count?: number): Promise<readonly ValidKey[]>

	/**
	 * Remove all records from the store.
	 */
	clear(): Promise<void>

	/**
	 * Count records, optionally filtered.
	 *
	 * @param query - Optional key range or specific key
	 * @returns Number of matching records
	 */
	count(query?: IDBKeyRange | ValidKey | null): Promise<number>

	// ─── Query Builder ───────────────────────────────────────

	/**
	 * Create a query builder for fluent queries.
	 *
	 * @returns Query builder instance
	 *
	 * @example
	 * ```ts
	 * const active = await store.query()
	 *   .where('status').equals('active')
	 *   . orderBy('descending')
	 *   .limit(10)
	 *   .toArray()
	 * ```
	 */
	query(): QueryBuilderInterface<T>

	// ─── Index Access ────────────────────────────────────────

	/**
	 * Get an index interface for querying by indexed field.
	 *
	 * @param name - Index name
	 * @returns Index interface
	 *
	 * @example
	 * ```ts
	 * const user = await store.index('byEmail').get('alice@example.com')
	 * ```
	 */
	index(name:  string): IndexInterface<T>

	// ─── Iteration ───────────────────────────────────────────

	/**
	 * Iterate over all records using an async generator.
	 *
	 * @param options - Cursor options
	 * @returns Async generator yielding records
	 *
	 * @remarks
	 * Memory-efficient:  only one record in memory at a time.
	 * Supports early termination via `break`.
	 *
	 * @example
	 * ```ts
	 * for await (const user of store.iterate()) {
	 *   console.log(user.name)
	 *   if (done) break
	 * }
	 * ```
	 */
	iterate(options?: IterateOptions): AsyncGenerator<T, void, unknown>

	/**
	 * Iterate over all keys using an async generator.
	 *
	 * @param options - Cursor options
	 * @returns Async generator yielding keys
	 */
	iterateKeys(options?:  IterateOptions): AsyncGenerator<ValidKey, void, unknown>

	// ─── Cursor (Manual) ─────────────────────────────────────

	/**
	 * Open a cursor for manual iteration.
	 *
	 * @param options - Cursor options
	 * @returns Cursor interface, or null if no records
	 *
	 * @remarks
	 * Use for update/delete during iteration.
	 * Prefer `iterate()` for read-only access.
	 *
	 * @example
	 * ```ts
	 * await db.transaction(['users'], 'readwrite', async (tx) => {
	 *   let cursor = await tx.store('users').openCursor()
	 *   while (cursor) {
	 *     if (cursor.getValue().inactive) {
	 *       await cursor.delete()
	 *     }
	 *     cursor = await cursor. continue()
	 *   }
	 * })
	 * ```
	 */
	openCursor(options?:  CursorOptions): Promise<CursorInterface<T> | null>

	/**
	 * Open a key-only cursor for manual iteration.
	 *
	 * @param options - Cursor options
	 * @returns Key cursor interface, or null if no records
	 */
	openKeyCursor(options?:  CursorOptions): Promise<KeyCursorInterface | null>
}

/**
 * Index interface for querying by indexed field.
 *
 * @remarks
 * Provides the same query methods as StoreInterface but operates
 * on an index instead of the primary key.
 */
export interface IndexInterface<T> {
	/** Native IDBIndex instance */
	readonly native: IDBIndex

	// ─── Accessors ───────────────────────────────────────────

	/** Get the index name */
	getName(): string

	/** Get the index key path */
	getKeyPath(): KeyPath

	/** Check if the index enforces uniqueness */
	isUnique(): boolean

	/** Check if the index is multi-entry */
	isMultiEntry(): boolean

	// ─── Get (undefined for missing) ─────────────────────────

	/**
	 * Get a record by index key.
	 *
	 * @param key - The index key to look up
	 * @returns The record, or undefined if not found
	 */
	get(key: ValidKey): Promise<T | undefined>

	/**
	 * Get multiple records by index keys.
	 *
	 * @param keys - Array of index keys to look up
	 * @returns Array of records (undefined for missing keys)
	 */
	get(keys: readonly ValidKey[]): Promise<readonly (T | undefined)[]>

	// ─── Resolve (throws for missing) ────────────────────────

	/**
	 * Get a record by index key, throwing if not found.
	 *
	 * @param key - The index key to look up
	 * @returns The record (guaranteed to exist)
	 * @throws NotFoundError if record doesn't exist
	 */
	resolve(key: ValidKey): Promise<T>

	/**
	 * Get multiple records by index keys, throwing if any are missing.
	 *
	 * @param keys - Array of index keys to look up
	 * @returns Array of records (all guaranteed to exist)
	 * @throws NotFoundError if any record doesn't exist
	 */
	resolve(keys: readonly ValidKey[]): Promise<readonly T[]>

	// ─── Primary Key Lookup ──────────────────────────────────

	/**
	 * Get the primary key for an index key.
	 *
	 * @param key - The index key to look up
	 * @returns The primary key, or undefined if not found
	 */
	getKey(key: ValidKey): Promise<ValidKey | undefined>

	// ─── Bulk Operations ─────────────────────────────────────

	/**
	 * Get all records matching a query.
	 *
	 * @param query - Optional key range filter
	 * @param count - Optional maximum number of records
	 * @returns Array of matching records
	 */
	all(query?: IDBKeyRange | null, count?: number): Promise<readonly T[]>

	/**
	 * Get all primary keys matching a query.
	 *
	 * @param query - Optional key range filter
	 * @param count - Optional maximum number of keys
	 * @returns Array of matching primary keys
	 */
	keys(query?: IDBKeyRange | null, count?: number): Promise<readonly ValidKey[]>

	/**
	 * Count records matching a query.
	 *
	 * @param query - Optional key range or specific key
	 * @returns Number of matching records
	 */
	count(query?: IDBKeyRange | ValidKey | null): Promise<number>

	// ─── Query Builder ───────────────────────────────────────

	/**
	 * Create a query builder for this index.
	 *
	 * @returns Query builder instance
	 */
	query(): QueryBuilderInterface<T>

	// ─── Iteration ───────────────────────────────────────────

	/**
	 * Iterate over records using an async generator.
	 *
	 * @param options - Cursor options
	 * @returns Async generator yielding records
	 */
	iterate(options?: IterateOptions): AsyncGenerator<T, void, unknown>

	/**
	 * Iterate over keys using an async generator.
	 *
	 * @param options - Cursor options
	 * @returns Async generator yielding index keys
	 */
	iterateKeys(options?: IterateOptions): AsyncGenerator<ValidKey, void, unknown>

	// ─── Cursor (Manual) ─────────────────────────────────────

	/**
	 * Open a cursor on this index.
	 *
	 * @param options - Cursor options
	 * @returns Cursor interface, or null if no records
	 */
	openCursor(options?:  CursorOptions): Promise<CursorInterface<T> | null>

	/**
	 * Open a key-only cursor on this index.
	 *
	 * @param options - Cursor options
	 * @returns Key cursor interface, or null if no records
	 */
	openKeyCursor(options?: CursorOptions): Promise<KeyCursorInterface | null>
}

/**
 * Transaction interface for explicit transaction control.
 *
 * @remarks
 * Use for multi-store atomic operations.
 * Transaction commits on success, aborts on error.
 *
 * @example
 * ```ts
 * await db.transaction(['users', 'posts'], 'readwrite', async (tx) => {
 *   const user = await tx. store('users').resolve('u1')
 *   await tx.store('posts').set({ authorId: user.id, title: 'Hello' })
 * })
 * ```
 */
export interface TransactionInterface<
	Schema extends DatabaseSchema,
	K extends keyof Schema
> {
	/** Native IDBTransaction instance */
	readonly native: IDBTransaction

	// ─── Accessors ───────────────────────────────────────────

	/** Get the transaction mode */
	getMode(): TransactionMode

	/** Get the store names in this transaction's scope */
	getStoreNames(): readonly string[]

	/** Check if the transaction is still active */
	isActive(): boolean

	/** Check if the transaction has finished (committed or aborted) */
	isFinished(): boolean

	// ─── Store Access ────────────────────────────────────────

	/**
	 * Get a store interface within this transaction.
	 *
	 * @param name - Store name (must be in transaction scope)
	 * @returns Store interface bound to this transaction
	 */
	store<S extends K & string>(name: S): TransactionStoreInterface<Schema[S]>

	// ─── Control ─────────────────────────────────────────────

	/**
	 * Abort the transaction.
	 *
	 * @remarks
	 * All changes made in this transaction will be rolled back.
	 */
	abort(): void

	/**
	 * Explicitly commit the transaction.
	 *
	 * @remarks
	 * Only available in browsers that support explicit commit.
	 * Transaction commits automatically on success otherwise.
	 */
	commit(): void
}

/**
 * Store interface within a transaction context.
 *
 * @remarks
 * Similar to StoreInterface but all operations are bound to
 * the parent transaction.
 */
export interface TransactionStoreInterface<T> {
	/** Native IDBObjectStore instance */
	readonly native: IDBObjectStore

	// ─── Get (undefined for missing) ─────────────────────────

	get(key: ValidKey): Promise<T | undefined>
	get(keys: readonly ValidKey[]): Promise<readonly (T | undefined)[]>

	// ─── Resolve (throws for missing) ────────────────────────

	resolve(key: ValidKey): Promise<T>
	resolve(keys: readonly ValidKey[]): Promise<readonly T[]>

	// ─── Set (upsert) ────────────────────────────────────────

	set(value: T, key?:  ValidKey): Promise<ValidKey>
	set(values:  readonly T[]): Promise<readonly ValidKey[]>

	// ─── Add (insert only) ───────────────────────────────────

	add(value: T, key?: ValidKey): Promise<ValidKey>
	add(values: readonly T[]): Promise<readonly ValidKey[]>

	// ─── Remove ──────────────────────────────────────────────

	remove(key: ValidKey): Promise<void>
	remove(keys: readonly ValidKey[]): Promise<void>

	// ─── Bulk Operations ─────────────────────────────────────

	all(query?: IDBKeyRange | null, count?: number): Promise<readonly T[]>
	keys(query?: IDBKeyRange | null, count?: number): Promise<readonly ValidKey[]>
	clear(): Promise<void>
	count(query?:  IDBKeyRange | ValidKey | null): Promise<number>

	// ─── Index Access ────────────────────────────────────────

	index(name: string): IndexInterface<T>

	// ─── Cursor ──────────────────────────────────────────────

	openCursor(options?: CursorOptions): Promise<CursorInterface<T> | null>
	openKeyCursor(options?: CursorOptions): Promise<KeyCursorInterface | null>
}

/**
 * Cursor interface for iterating over records.
 *
 * @remarks
 * Supports navigation and mutation (update/delete) during iteration.
 */
export interface CursorInterface<T> {
	/** Native IDBCursorWithValue instance */
	readonly native: IDBCursorWithValue

	// ─── Accessors ───────────────────────────────────────────

	/** Get the current key */
	getKey(): ValidKey

	/** Get the current primary key */
	getPrimaryKey(): ValidKey

	/** Get the current value */
	getValue(): T

	/** Get the cursor direction */
	getDirection(): CursorDirection

	// ─── Navigation ──────────────────────────────────────────

	/**
	 * Advance to the next record.
	 *
	 * @param key - Optional key to advance to
	 * @returns Next cursor position, or null if no more records
	 */
	continue(key?: ValidKey): Promise<CursorInterface<T> | null>

	/**
	 * Advance to a specific primary key.
	 *
	 * @param key - Index key to advance to
	 * @param primaryKey - Primary key to advance to
	 * @returns Next cursor position, or null if not found
	 */
	continuePrimaryKey(key: ValidKey, primaryKey: ValidKey): Promise<CursorInterface<T> | null>

	/**
	 * Advance by a number of records.
	 *
	 * @param count - Number of records to skip
	 * @returns Next cursor position, or null if past end
	 */
	advance(count: number): Promise<CursorInterface<T> | null>

	// ─── Mutation ────────────────────────────────────────────

	/**
	 * Update the current record.
	 *
	 * @param value - New value for the record
	 * @returns The key of the updated record
	 */
	update(value: T): Promise<ValidKey>

	/**
	 * Delete the current record.
	 */
	delete(): Promise<void>
}

/**
 * Key-only cursor interface.
 *
 * @remarks
 * More efficient than full cursor when only keys are needed.
 */
export interface KeyCursorInterface {
	/** Native IDBCursor instance */
	readonly native: IDBCursor

	// ─── Accessors ───────────────────────────────────────────

	/** Get the current key */
	getKey(): ValidKey

	/** Get the current primary key */
	getPrimaryKey(): ValidKey

	/** Get the cursor direction */
	getDirection(): CursorDirection

	// ─── Navigation ──────────────────────────────────────────

	/**
	 * Advance to the next key.
	 *
	 * @param key - Optional key to advance to
	 * @returns Next cursor position, or null if no more keys
	 */
	continue(key?: ValidKey): Promise<KeyCursorInterface | null>

	/**
	 * Advance to a specific primary key.
	 *
	 * @param key - Index key to advance to
	 * @param primaryKey - Primary key to advance to
	 * @returns Next cursor position, or null if not found
	 */
	continuePrimaryKey(key: ValidKey, primaryKey: ValidKey): Promise<KeyCursorInterface | null>

	/**
	 * Advance by a number of keys.
	 *
	 * @param count - Number of keys to skip
	 * @returns Next cursor position, or null if past end
	 */
	advance(count: number): Promise<KeyCursorInterface | null>
}

/**
 * Query builder interface for fluent queries.
 *
 * @remarks
 * The query builder maps directly to IndexedDB capabilities:
 * - `where()` uses native IDBKeyRange operations (fast)
 * - `filter()` applies post-cursor predicates (flexible)
 *
 * @example
 * ```ts
 * // Native query (fast - uses index)
 * const active = await store.query()
 *   . where('status').equals('active')
 *   .toArray()
 *
 * // Filter (flexible - post-cursor)
 * const gmail = await store.query()
 *   .filter(u => u.email.endsWith('@gmail.com'))
 *   .toArray()
 *
 * // Combined
 * const activeGmail = await store.query()
 *   .where('status').equals('active')
 *   .filter(u => u. email.endsWith('@gmail.com'))
 *   .toArray()
 * ```
 */
export interface QueryBuilderInterface<T> {
	/**
	 * Add an indexed filter (uses IDBKeyRange).
	 *
	 * @param keyPath - Field name or key path to query
	 * @returns Where clause builder
	 */
	where(keyPath: string): WhereClauseInterface<T>

	/**
	 * Add a post-cursor filter predicate.
	 *
	 * @param predicate - Filter function
	 * @returns Query builder for chaining
	 *
	 * @remarks
	 * Use for conditions that cannot use indexes (endsWith, contains, etc.).
	 */
	filter(predicate: (value:  T) => boolean): QueryBuilderInterface<T>

	/**
	 * Set the result ordering.
	 *
	 * @param direction - 'ascending' or 'descending'
	 * @returns Query builder for chaining
	 */
	orderBy(direction: OrderDirection): QueryBuilderInterface<T>

	/**
	 * Limit the number of results.
	 *
	 * @param count - Maximum number of results
	 * @returns Query builder for chaining
	 */
	limit(count: number): QueryBuilderInterface<T>

	/**
	 * Skip the first N results.
	 *
	 * @param count - Number of results to skip
	 * @returns Query builder for chaining
	 */
	offset(count: number): QueryBuilderInterface<T>

	// ─── Terminal Operations ─────────────────────────────────

	/**
	 * Execute the query and return all matching records.
	 *
	 * @returns Array of matching records
	 */
	toArray(): Promise<readonly T[]>

	/**
	 * Execute the query and return the first matching record.
	 *
	 * @returns First matching record, or undefined
	 */
	first(): Promise<T | undefined>

	/**
	 * Execute the query and return the count of matching records.
	 *
	 * @returns Number of matching records
	 */
	count(): Promise<number>

	/**
	 * Execute the query and return all matching keys.
	 *
	 * @returns Array of matching keys
	 */
	keys(): Promise<readonly ValidKey[]>

	/**
	 * Execute the query using an async generator.
	 *
	 * @returns Async generator yielding records
	 *
	 * @remarks
	 * Memory-efficient: only one record in memory at a time.
	 */
	iterate(): AsyncGenerator<T, void, unknown>
}

/**
 * Where clause interface for building index queries.
 *
 * @remarks
 * All methods map directly to IDBKeyRange operations.
 * Method names are fully spelled out (no abbreviations).
 */
export interface WhereClauseInterface<T> {
	/**
	 * Match records where key equals value.
	 *
	 * @param value - Value to match
	 * @returns Query builder for chaining
	 *
	 * @remarks
	 * Uses `IDBKeyRange.only(value)`.
	 */
	equals(value: ValidKey): QueryBuilderInterface<T>

	/**
	 * Match records where key is greater than value.
	 *
	 * @param value - Lower bound (exclusive)
	 * @returns Query builder for chaining
	 *
	 * @remarks
	 * Uses `IDBKeyRange.lowerBound(value, true)`.
	 */
	greaterThan(value: ValidKey): QueryBuilderInterface<T>

	/**
	 * Match records where key is greater than or equal to value.
	 *
	 * @param value - Lower bound (inclusive)
	 * @returns Query builder for chaining
	 *
	 * @remarks
	 * Uses `IDBKeyRange.lowerBound(value, false)`.
	 */
	greaterThanOrEqual(value: ValidKey): QueryBuilderInterface<T>

	/**
	 * Match records where key is less than value.
	 *
	 * @param value - Upper bound (exclusive)
	 * @returns Query builder for chaining
	 *
	 * @remarks
	 * Uses `IDBKeyRange.upperBound(value, true)`.
	 */
	lessThan(value: ValidKey): QueryBuilderInterface<T>

	/**
	 * Match records where key is less than or equal to value.
	 *
	 * @param value - Upper bound (inclusive)
	 * @returns Query builder for chaining
	 *
	 * @remarks
	 * Uses `IDBKeyRange.upperBound(value, false)`.
	 */
	lessThanOrEqual(value: ValidKey): QueryBuilderInterface<T>

	/**
	 * Match records where key is between bounds.
	 *
	 * @param lower - Lower bound
	 * @param upper - Upper bound
	 * @param options - Bound exclusivity options
	 * @returns Query builder for chaining
	 *
	 * @remarks
	 * Uses `IDBKeyRange.bound()`.
	 */
	between(lower: ValidKey, upper: ValidKey, options?: BetweenOptions): QueryBuilderInterface<T>

	/**
	 * Match records where string key starts with prefix.
	 *
	 * @param prefix - String prefix to match
	 * @returns Query builder for chaining
	 *
	 * @remarks
	 * Uses `IDBKeyRange.bound(prefix, prefix + '\uffff')`.
	 */
	startsWith(prefix: string): QueryBuilderInterface<T>

	/**
	 * Match records where key is one of the given values.
	 *
	 * @param values - Array of values to match
	 * @returns Query builder for chaining
	 *
	 * @remarks
	 * Executes multiple index queries and merges results.
	 * Results are deduplicated by primary key.
	 */
	anyOf(values: readonly ValidKey[]): QueryBuilderInterface<T>
}

// ============================================================================
// Factory Types
// ============================================================================

/**
 * Create a database connection.
 *
 * @param options - Database configuration
 * @returns Promise resolving to database interface
 *
 * @example
 * ```ts
 * const db = await createDatabase<MySchema>({
 *   name:  'myApp',
 *   version: 1,
 *   stores: {
 *     users: {},
 *     posts: {
 *       keyPath: 'slug',
 *       indexes: [{ name: 'byAuthor', keyPath: 'authorId' }]
 *     }
 *   }
 * })
 * ```
 */
export type CreateDatabase = <Schema extends DatabaseSchema>(
	options: DatabaseOptions<Schema>
) => Promise<DatabaseInterface<Schema>>
