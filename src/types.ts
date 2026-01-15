/**
 * @mikesaintsg/indexeddb
 *
 * Type definitions for the IndexedDB library. 
 * All public types and interfaces are defined here as the SOURCE OF TRUTH.
 */

// ============================================================================
// Utility Types
// ============================================================================

/** Cleanup function returned by event subscriptions */
export type Unsubscribe = () => void

/** Converts subscription methods to hook callbacks for options */
export type SubscriptionToHook<T> = {
	[K in keyof T]?: T[K] extends (callback: infer CB) => Unsubscribe ? CB : never
}

// ============================================================================
// Key Types
// ============================================================================

/** Valid IndexedDB key types */
export type ValidKey = IDBValidKey

/** Valid IndexedDB key path */
export type KeyPath = string | readonly string[]

// ============================================================================
// Database Info
// ============================================================================

/** Database name and version info from listDatabases() */
export interface DatabaseInfo {
	readonly name: string
	readonly version:  number
}

// ============================================================================
// Error Types
// ============================================================================

/** Database error codes */
export type DatabaseErrorCode =
	| 'NOT_FOUND'
	| 'CONSTRAINT'
	| 'DATA'
	| 'TRANSACTION_INACTIVE'
	| 'READ_ONLY'
	| 'VERSION'
	| 'ABORT'
	| 'TIMEOUT'
	| 'QUOTA_EXCEEDED'
	| 'UNKNOWN'
	| 'INVALID_STATE'
	| 'INVALID_ACCESS'

/** Base database error interface */
export interface DatabaseErrorData {
	readonly code: DatabaseErrorCode
	readonly storeName?: string
	readonly key?: ValidKey
	readonly cause?: Error
}

// ============================================================================
// Schema Types
// ============================================================================

/** Database schema type constraint */
export type DatabaseSchema = Record<string, unknown>

/** Index definition for an object store */
export interface IndexDefinition {
	readonly name: string
	readonly keyPath:  KeyPath
	readonly unique?: boolean
	readonly multiEntry?: boolean
}

/** TTL options for automatic expiration */
export interface TTLOptions {
	/**
	 * Field that stores expiration timestamp. 
	 * If not specified, internal `_expiresAt` field is used.
	 */
	readonly field?: string
	/**
	 * Default TTL in milliseconds.
	 * Individual records can override via SetOptions.
	 */
	readonly defaultMs?: number
}

/** Store definition for schema */
export interface StoreDefinition {
	readonly keyPath?:  KeyPath
	readonly autoIncrement?: boolean
	readonly indexes?: readonly IndexDefinition[]
	/** TTL configuration for automatic expiration */
	readonly ttl?: TTLOptions
}

/** Store definitions mapped by store name */
export type StoreDefinitions<Schema extends DatabaseSchema> = {
	readonly [K in keyof Schema]: StoreDefinition
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
	readonly durability?: TransactionDurability
}

/** Transaction operation callback */
export type TransactionOperation<
	Schema extends DatabaseSchema,
	K extends keyof Schema
> = (transaction: TransactionInterface<Schema, K>) => Promise<void> | void

// ============================================================================
// Cursor Types
// ============================================================================

/** Cursor direction */
export type CursorDirection = 'next' | 'nextunique' | 'previous' | 'previousunique'

/** Cursor options */
export interface CursorOptions {
	readonly query?: IDBKeyRange | ValidKey | null
	readonly direction?: CursorDirection
}

/** Iteration options (alias for consistency) */
export type IterateOptions = CursorOptions

// ============================================================================
// Query Types
// ============================================================================

/** Between options for range queries */
export interface BetweenOptions {
	readonly lowerOpen?: boolean
	readonly upperOpen?:  boolean
}

/** Order direction (explicit naming:  'ascending' not 'asc') */
export type OrderDirection = 'ascending' | 'descending'

// ============================================================================
// Bulk Operation Types
// ============================================================================

/** Bulk operation options */
export interface BulkOperationOptions {
	/** Progress callback for large operations */
	readonly onProgress?:  (completed: number, total: number) => void
}

/** Set operation options */
export interface SetOptions {
	/**
	 * Override default TTL for this record.
	 * Use `null` to disable expiration for this record.
	 * Use `undefined` to use store default. 
	 */
	readonly ttl?: number | null
}

// ============================================================================
// Change Event Types
// ============================================================================

/** Change operation type */
export type ChangeType = 'set' | 'add' | 'remove' | 'clear'

/** Source of change event */
export type ChangeSource = 'local' | 'remote'

/** Change event emitted when data is modified */
export interface ChangeEvent {
	readonly type: ChangeType
	readonly storeName: string
	readonly key?:  ValidKey
	readonly value?: unknown
	readonly source: ChangeSource
	readonly timestamp: number
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
	readonly oldVersion: number
	readonly newVersion: number | null
}) => void

// ============================================================================
// Migration Types
// ============================================================================

/** Migration context passed to migration functions */
export interface MigrationContext {
	readonly db: IDBDatabase
	readonly transaction: IDBTransaction
	readonly oldVersion: number
	readonly newVersion: number
	createStore(name: string, options?:  IDBObjectStoreParameters): IDBObjectStore
	deleteStore(name: string): void
	getStore(name: string): IDBObjectStore
}

/** Migration function signature */
export type MigrationFunction = (context: MigrationContext) => void | Promise<void>

/** Migration definition */
export interface Migration {
	readonly version: number
	readonly migrate: MigrationFunction
}

// ============================================================================
// Subscription Interfaces
// ============================================================================

/** Database-level subscription methods */
export interface DatabaseSubscriptions {
	/**
	 * Subscribe to data changes across all stores.
	 * @param callback - Called when data is modified
	 * @returns Cleanup function
	 */
	onChange(callback: ChangeCallback): Unsubscribe

	/**
	 * Subscribe to database errors.
	 * @param callback - Called when an error occurs
	 * @returns Cleanup function
	 */
	onError(callback: ErrorCallback): Unsubscribe

	/**
	 * Subscribe to version change events.
	 * @param callback - Called when another connection upgrades the database
	 * @returns Cleanup function
	 */
	onVersionChange(callback: VersionChangeCallback): Unsubscribe

	/**
	 * Subscribe to database close events.
	 * @param callback - Called when the database is closed
	 * @returns Cleanup function
	 */
	onClose(callback: () => void): Unsubscribe
}

/** Store-level subscription methods */
export interface StoreSubscriptions {
	/**
	 * Subscribe to changes in this store.
	 * @param callback - Called when data in this store is modified
	 * @returns Cleanup function
	 */
	onChange(callback: (event: ChangeEvent) => void): Unsubscribe
}

// ============================================================================
// Options Interfaces
// ============================================================================

/** Database creation options */
export interface DatabaseOptions<Schema extends DatabaseSchema>
	extends SubscriptionToHook<DatabaseSubscriptions> {
	readonly name: string
	readonly version: number
	readonly stores: StoreDefinitions<Schema>
	readonly migrations?: readonly Migration[]
}

// ============================================================================
// Export/Import Types
// ============================================================================

/** Exported data format */
export interface ExportedData<Schema extends DatabaseSchema> {
	readonly version: number
	readonly exportedAt: number
	readonly databaseName: string
	readonly databaseVersion: number
	readonly stores: {
		readonly [K in keyof Schema]?: readonly Schema[K][]
	}
}

/** Import options */
export interface ImportOptions {
	readonly clearExisting?: boolean
	readonly onProgress?: (storeName: string, completed: number, total: number) => void
}

// ============================================================================
// Storage Types
// ============================================================================

/** Storage estimate information */
export interface StorageEstimate {
	readonly usage: number
	readonly quota: number
	readonly available: number
	readonly percentUsed: number
}

// ============================================================================
// Prune Types
// ============================================================================

/** Prune result information */
export interface PruneResult {
	readonly prunedCount: number
	readonly remainingCount: number
}

// ============================================================================
// Behavioral Interfaces
// ============================================================================

/**
 * Database interface - main entry point for IndexedDB operations. 
 *
 * Provides type-safe access to object stores, transactions,
 * and database lifecycle management.
 */
export interface DatabaseInterface<Schema extends DatabaseSchema>
	extends DatabaseSubscriptions {
	/** Native IDBDatabase for escape hatch access */
	readonly native: IDBDatabase

	// ---- Accessors ----

	/** Get the database name */
	getName(): string

	/** Get the database version */
	getVersion(): number

	/** Get all object store names */
	getStoreNames(): readonly string[]

	/** Check if the database connection is open */
	isOpen(): boolean

	// ---- Store Access ----

	/**
	 * Get a store interface for operations.
	 * @param name - Store name from schema
	 */
	store<K extends keyof Schema & string>(name: K): StoreInterface<Schema[K]>

	// ---- Transactions ----

	/**
	 * Execute a read-only transaction.
	 * @param storeNames - Store(s) to include in transaction
	 * @param operation - Transaction operation callback
	 */
	read<K extends keyof Schema & string>(
		storeNames: K | readonly K[],
		operation:  TransactionOperation<Schema, K>
	): Promise<void>

	/**
	 * Execute a read-write transaction.
	 * @param storeNames - Store(s) to include in transaction
	 * @param operation - Transaction operation callback
	 * @param options - Transaction options
	 */
	write<K extends keyof Schema & string>(
		storeNames: K | readonly K[],
		operation: TransactionOperation<Schema, K>,
		options?:  TransactionOptions
	): Promise<void>

	// ---- Lifecycle ----

	/** Close the database connection (can be reopened) */
	close(): void

	/** Delete the entire database */
	drop(): Promise<void>

	// ---- Export/Import ----

	/** Export all data to portable format */
	export(): Promise<ExportedData<Schema>>

	/**
	 * Import data from exported format.
	 * @param data - Exported data
	 * @param options - Import options
	 */
	import(data: ExportedData<Schema>, options?: ImportOptions): Promise<void>

	// ---- Storage ----

	/** Get storage usage estimate */
	getStorageEstimate(): Promise<StorageEstimate>
}

/**
 * Store interface - provides operations on a single object store.
 *
 * Supports CRUD operations, queries, cursors, and iteration
 * with full TypeScript type safety.
 */
export interface StoreInterface<T> extends StoreSubscriptions {
	/** Native IDBObjectStore for escape hatch access (within transaction) */
	readonly native: IDBObjectStore

	// ---- Accessors ----

	/** Get the store name */
	getName(): string

	/** Get the key path, or null for out-of-line keys */
	getKeyPath(): KeyPath | null

	/** Get all index names */
	getIndexNames(): readonly string[]

	/** Check if the store uses auto-incrementing keys */
	hasAutoIncrement(): boolean

	/** Check if the store has TTL enabled */
	hasTTL(): boolean

	// ---- Get Operations ----

	/**
	 * Get record by key (returns undefined if not found).
	 * @param key - Record key
	 */
	get(key: ValidKey): Promise<T | undefined>

	/**
	 * Get multiple records by keys.
	 * @param keys - Record keys
	 */
	get(keys: readonly ValidKey[]): Promise<readonly (T | undefined)[]>

	/**
	 * Get record by key (throws NotFoundError if not found).
	 * @param key - Record key
	 */
	resolve(key: ValidKey): Promise<T>

	/**
	 * Get multiple records by keys (throws if any not found).
	 * @param keys - Record keys
	 */
	resolve(keys: readonly ValidKey[]): Promise<readonly T[]>

	// ---- Set Operations ----

	/**
	 * Insert or update a record.
	 * @param value - Record value
	 * @param key - Optional key for out-of-line stores
	 */
	set(value: T, key?: ValidKey): Promise<ValidKey>

	/**
	 * Insert or update a record with options.
	 * @param value - Record value
	 * @param options - Set options including TTL override
	 */
	set(value: T, options:  SetOptions): Promise<ValidKey>

	/**
	 * Insert or update multiple records.
	 * @param values - Record values
	 * @param options - Bulk operation options
	 */
	set(values: readonly T[], options?:  BulkOperationOptions): Promise<readonly ValidKey[]>

	// ---- Add Operations ----

	/**
	 * Insert a new record (throws if key exists).
	 * @param value - Record value
	 * @param key - Optional key for out-of-line stores
	 */
	add(value: T, key?: ValidKey): Promise<ValidKey>

	/**
	 * Insert multiple new records. 
	 * @param values - Record values
	 * @param options - Bulk operation options
	 */
	add(values:  readonly T[], options?: BulkOperationOptions): Promise<readonly ValidKey[]>

	// ---- Remove Operations ----

	/**
	 * Remove a record by key.
	 * @param key - Record key
	 */
	remove(key: ValidKey): Promise<void>

	/**
	 * Remove multiple records by keys.
	 * @param keys - Record keys
	 */
	remove(keys: readonly ValidKey[]): Promise<void>

	// ---- Existence Check ----

	/**
	 * Check if a record exists.
	 * @param key - Record key
	 */
	has(key: ValidKey): Promise<boolean>

	/**
	 * Check if multiple records exist.
	 * @param keys - Record keys
	 */
	has(keys: readonly ValidKey[]): Promise<readonly boolean[]>

	// ---- Bulk Retrieval ----

	/**
	 * Get all records.
	 * @param query - Optional key range
	 * @param count - Optional maximum count
	 */
	all(query?: IDBKeyRange | null, count?: number): Promise<readonly T[]>

	/**
	 * Get all keys.
	 * @param query - Optional key range
	 * @param count - Optional maximum count
	 */
	keys(query?: IDBKeyRange | null, count?: number): Promise<readonly ValidKey[]>

	/** Remove all records */
	clear(): Promise<void>

	/**
	 * Count records. 
	 * @param query - Optional key range or key
	 */
	count(query?: IDBKeyRange | ValidKey | null): Promise<number>

	// ---- TTL Operations ----

	/**
	 * Remove expired records.
	 * Only available if store has TTL enabled.
	 * @returns Prune result with counts
	 */
	prune(): Promise<PruneResult>

	/**
	 * Check if a record is expired.
	 * @param key - Record key
	 */
	isExpired(key:  ValidKey): Promise<boolean>

	// ---- Query Builder ----

	/** Create a query builder for complex queries */
	query(): QueryBuilderInterface<T>

	// ---- Index Access ----

	/**
	 * Get an index interface. 
	 * @param name - Index name
	 */
	index(name: string): IndexInterface<T>

	// ---- Iteration ----

	/**
	 * Iterate all records.
	 * @param options - Cursor options
	 */
	iterate(options?: IterateOptions): AsyncGenerator<T, void, unknown>

	/**
	 * Iterate all keys.
	 * @param options - Cursor options
	 */
	iterateKeys(options?: IterateOptions): AsyncGenerator<ValidKey, void, unknown>

	// ---- Cursors ----

	/**
	 * Open a cursor for manual iteration/mutation.
	 * @param options - Cursor options
	 */
	openCursor(options?: CursorOptions): Promise<CursorInterface<T> | null>

	/**
	 * Open a key cursor. 
	 * @param options - Cursor options
	 */
	openKeyCursor(options?: CursorOptions): Promise<KeyCursorInterface | null>
}

/**
 * Index interface - provides operations on an index.
 *
 * Supports lookups, queries, and iteration by index key.
 */
export interface IndexInterface<T> {
	/** Native IDBIndex for escape hatch access */
	readonly native: IDBIndex

	// ---- Accessors ----

	/** Get the index name */
	getName(): string

	/** Get the index key path */
	getKeyPath(): KeyPath

	/** Check if the index enforces uniqueness */
	isUnique(): boolean

	/** Check if the index is multi-entry */
	isMultiEntry(): boolean

	// ---- Get Operations ----

	/**
	 * Get record by index key. 
	 * @param key - Index key
	 */
	get(key: ValidKey): Promise<T | undefined>

	/**
	 * Get multiple records by index keys.
	 * @param keys - Index keys
	 */
	get(keys: readonly ValidKey[]): Promise<readonly (T | undefined)[]>

	/**
	 * Get record by index key (throws if not found).
	 * @param key - Index key
	 */
	resolve(key: ValidKey): Promise<T>

	/**
	 * Get multiple records by index keys (throws if any not found).
	 * @param keys - Index keys
	 */
	resolve(keys: readonly ValidKey[]): Promise<readonly T[]>

	/**
	 * Get the primary key for an index key.
	 * @param key - Index key
	 */
	getKey(key: ValidKey): Promise<ValidKey | undefined>

	// ---- Existence Check ----

	/**
	 * Check if a record exists by index key.
	 * @param key - Index key
	 */
	has(key: ValidKey): Promise<boolean>

	/**
	 * Check if multiple records exist by index keys.
	 * @param keys - Index keys
	 */
	has(keys: readonly ValidKey[]): Promise<readonly boolean[]>

	// ---- Bulk Retrieval ----

	/**
	 * Get all records by index. 
	 * @param query - Optional key range
	 * @param count - Optional maximum count
	 */
	all(query?: IDBKeyRange | null, count?: number): Promise<readonly T[]>

	/**
	 * Get all primary keys by index.
	 * @param query - Optional key range
	 * @param count - Optional maximum count
	 */
	keys(query?: IDBKeyRange | null, count?: number): Promise<readonly ValidKey[]>

	/**
	 * Count records by index.
	 * @param query - Optional key range or key
	 */
	count(query?: IDBKeyRange | ValidKey | null): Promise<number>

	// ---- Query Builder ----

	/** Create a query builder for this index */
	query(): QueryBuilderInterface<T>

	// ---- Iteration ----

	/**
	 * Iterate records by index.
	 * @param options - Cursor options
	 */
	iterate(options?:  IterateOptions): AsyncGenerator<T, void, unknown>

	/**
	 * Iterate keys by index.
	 * @param options - Cursor options
	 */
	iterateKeys(options?: IterateOptions): AsyncGenerator<ValidKey, void, unknown>

	// ---- Cursors ----

	/**
	 * Open a cursor on this index.
	 * @param options - Cursor options
	 */
	openCursor(options?: CursorOptions): Promise<CursorInterface<T> | null>

	/**
	 * Open a key cursor on this index.
	 * @param options - Cursor options
	 */
	openKeyCursor(options?: CursorOptions): Promise<KeyCursorInterface | null>
}

/**
 * Transaction interface - scoped database operations.
 *
 * Provides atomic operations across multiple stores
 * with automatic commit on success or abort on error.
 */
export interface TransactionInterface<
	Schema extends DatabaseSchema,
	K extends keyof Schema
> {
	/** Native IDBTransaction for escape hatch access */
	readonly native: IDBTransaction

	// ---- Accessors ----

	/** Get the transaction mode */
	getMode(): TransactionMode

	/** Get the store names in this transaction's scope */
	getStoreNames(): readonly string[]

	/** Check if the transaction is still active */
	isActive(): boolean

	/** Check if the transaction has finished (committed or aborted) */
	isFinished(): boolean

	// ---- Store Access ----

	/**
	 * Get a store interface within this transaction.
	 * @param name - Store name
	 */
	store<S extends K & string>(name: S): TransactionStoreInterface<Schema[S]>

	// ---- Control ----

	/** Abort the transaction */
	abort(): void

	/** Explicitly commit the transaction */
	commit(): void
}

/**
 * Transaction index interface - index operations within a transaction.
 */
export interface TransactionIndexInterface<T> {
	/** Native IDBIndex for escape hatch access */
	readonly native: IDBIndex

	// ---- Accessors ----

	/** Get the index name */
	getName(): string

	/** Get the index key path */
	getKeyPath(): KeyPath

	/** Check if the index enforces uniqueness */
	isUnique(): boolean

	/** Check if the index is multi-entry */
	isMultiEntry(): boolean

	// ---- Operations ----

	/** Get record(s) by index key */
	get(key: ValidKey): Promise<T | undefined>
	get(keys: readonly ValidKey[]): Promise<readonly (T | undefined)[]>

	/** Get record(s) by index key, throwing if not found */
	resolve(key: ValidKey): Promise<T>
	resolve(keys:  readonly ValidKey[]): Promise<readonly T[]>

	/** Check if record(s) exist by index key */
	has(key: ValidKey): Promise<boolean>
	has(keys: readonly ValidKey[]): Promise<readonly boolean[]>

	/** Get the primary key for an index key */
	getKey(key: ValidKey): Promise<ValidKey | undefined>

	/** Get all records matching a query */
	all(query?:  IDBKeyRange | null, count?: number): Promise<readonly T[]>

	/** Get all keys matching a query */
	keys(query?: IDBKeyRange | null, count?: number): Promise<readonly ValidKey[]>

	/** Count records matching a query */
	count(query?: IDBKeyRange | ValidKey | null): Promise<number>

	/** Open a cursor */
	openCursor(options?:  CursorOptions): Promise<CursorInterface<T> | null>

	/** Open a key cursor */
	openKeyCursor(options?: CursorOptions): Promise<KeyCursorInterface | null>
}

/**
 * Transaction store interface - store operations within a transaction.
 */
export interface TransactionStoreInterface<T> {
	/** Native IDBObjectStore for escape hatch access */
	readonly native: IDBObjectStore

	// ---- Get Operations ----

	get(key: ValidKey): Promise<T | undefined>
	get(keys: readonly ValidKey[]): Promise<readonly (T | undefined)[]>

	resolve(key: ValidKey): Promise<T>
	resolve(keys:  readonly ValidKey[]): Promise<readonly T[]>

	// ---- Mutate Operations ----

	set(value: T, key?: ValidKey): Promise<ValidKey>
	set(values: readonly T[]): Promise<readonly ValidKey[]>

	add(value: T, key?: ValidKey): Promise<ValidKey>
	add(values:  readonly T[]): Promise<readonly ValidKey[]>

	remove(key: ValidKey): Promise<void>
	remove(keys: readonly ValidKey[]): Promise<void>

	// ---- Existence ----

	has(key: ValidKey): Promise<boolean>
	has(keys: readonly ValidKey[]): Promise<readonly boolean[]>

	// ---- Bulk ----

	all(query?: IDBKeyRange | null, count?: number): Promise<readonly T[]>
	keys(query?: IDBKeyRange | null, count?: number): Promise<readonly ValidKey[]>
	clear(): Promise<void>
	count(query?: IDBKeyRange | ValidKey | null): Promise<number>

	// ---- Index ----

	index(name: string): TransactionIndexInterface<T>

	// ---- Cursors ----

	openCursor(options?: CursorOptions): Promise<CursorInterface<T> | null>
	openKeyCursor(options?: CursorOptions): Promise<KeyCursorInterface | null>
}

/**
 * Cursor interface - manual iteration and mutation.
 */
export interface CursorInterface<T> {
	/** Native IDBCursorWithValue for escape hatch access */
	readonly native: IDBCursorWithValue

	// ---- Accessors ----

	/** Get the current key */
	getKey(): ValidKey

	/** Get the current primary key */
	getPrimaryKey(): ValidKey

	/** Get the current value */
	getValue(): T

	/** Get the cursor direction */
	getDirection(): CursorDirection

	// ---- Navigation ----

	/**
	 * Advance to next record.
	 * @param key - Optional key to advance to
	 */
	continue(key?: ValidKey): Promise<CursorInterface<T> | null>

	/**
	 * Advance to specific key and primary key.
	 * @param key - Index key
	 * @param primaryKey - Primary key
	 */
	continuePrimaryKey(key: ValidKey, primaryKey: ValidKey): Promise<CursorInterface<T> | null>

	/**
	 * Skip multiple records.
	 * @param count - Number of records to skip
	 */
	advance(count: number): Promise<CursorInterface<T> | null>

	// ---- Mutation ----

	/**
	 * Update current record.
	 * @param value - New value
	 */
	update(value: T): Promise<ValidKey>

	/** Delete current record */
	delete(): Promise<void>
}

/**
 * Key cursor interface - iteration without loading values.
 */
export interface KeyCursorInterface {
	/** Native IDBCursor for escape hatch access */
	readonly native: IDBCursor

	// ---- Accessors ----

	/** Get the current key */
	getKey(): ValidKey

	/** Get the current primary key */
	getPrimaryKey(): ValidKey

	/** Get the cursor direction */
	getDirection(): CursorDirection

	// ---- Navigation ----

	continue(key?: ValidKey): Promise<KeyCursorInterface | null>
	continuePrimaryKey(key: ValidKey, primaryKey: ValidKey): Promise<KeyCursorInterface | null>
	advance(count: number): Promise<KeyCursorInterface | null>
}

/**
 * Query builder interface - fluent query construction.
 */
export interface QueryBuilderInterface<T> {
	/**
	 * Start a where clause on a key path.
	 * @param keyPath - Field to query
	 */
	where(keyPath: string): WhereClauseInterface<T>

	/**
	 * Add a filter predicate (post-cursor).
	 * @param predicate - Filter function
	 */
	filter(predicate: (value: T) => boolean): QueryBuilderInterface<T>

	/** Sort ascending */
	ascending(): QueryBuilderInterface<T>

	/** Sort descending */
	descending(): QueryBuilderInterface<T>

	/** Get the constructed IDBKeyRange */
	getRange(): IDBKeyRange | null

	/**
	 * Limit result count.
	 * @param count - Maximum results
	 */
	limit(count: number): QueryBuilderInterface<T>

	/**
	 * Skip initial results.
	 * @param count - Results to skip
	 */
	offset(count: number): QueryBuilderInterface<T>

	// ---- Terminal Operations ----

	/** Execute and return all matching records */
	toArray(): Promise<readonly T[]>

	/** Execute and return first matching record */
	first(): Promise<T | undefined>

	/** Execute and return count of matching records */
	count(): Promise<number>

	/** Execute and return all matching keys */
	keys(): Promise<readonly ValidKey[]>

	/** Execute and iterate matching records */
	iterate(): AsyncGenerator<T, void, unknown>
}

/**
 * Where clause interface - query conditions.
 */
export interface WhereClauseInterface<T> {
	/**
	 * Exact match (handles non-indexable types).
	 * @param value - Value to match
	 */
	equals(value: ValidKey | boolean | null | undefined): QueryBuilderInterface<T>

	/**
	 * Greater than comparison.
	 * @param value - Lower bound (exclusive)
	 */
	greaterThan(value: ValidKey): QueryBuilderInterface<T>

	/**
	 * Greater than or equal comparison.
	 * @param value - Lower bound (inclusive)
	 */
	greaterThanOrEqual(value:  ValidKey): QueryBuilderInterface<T>

	/**
	 * Less than comparison.
	 * @param value - Upper bound (exclusive)
	 */
	lessThan(value: ValidKey): QueryBuilderInterface<T>

	/**
	 * Less than or equal comparison.
	 * @param value - Upper bound (inclusive)
	 */
	lessThanOrEqual(value:  ValidKey): QueryBuilderInterface<T>

	/**
	 * Range query. 
	 * @param lower - Lower bound
	 * @param upper - Upper bound
	 * @param options - Bound inclusivity options
	 */
	between(lower: ValidKey, upper: ValidKey, options?:  BetweenOptions): QueryBuilderInterface<T>

	/**
	 * String prefix match.
	 * @param prefix - Prefix to match
	 */
	startsWith(prefix:  string): QueryBuilderInterface<T>

	/**
	 * Match any of the values.
	 * @param values - Values to match
	 */
	anyOf(values: readonly ValidKey[]): QueryBuilderInterface<T>

	/**
	 * Match none of the values.
	 * @param values - Values to exclude
	 */
	noneOf(values: readonly ValidKey[]): QueryBuilderInterface<T>

	/**
	 * String suffix match (filter-based).
	 * @param suffix - Suffix to match
	 */
	endsWith(suffix:  string): QueryBuilderInterface<T>
}

// ============================================================================
// Factory Function Types
// ============================================================================

/** Factory function type for creating databases */
export type CreateDatabase = <Schema extends DatabaseSchema>(
	options: DatabaseOptions<Schema>
) => Promise<DatabaseInterface<Schema>>

// ============================================================================
// Internal Utility Types
// ============================================================================

/** Deferred promise wrapper */
export interface Deferred<T> {
	readonly promise: Promise<T>
	resolve(value: T): void
	reject(error: Error): void
}