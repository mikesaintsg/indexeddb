/**
 * Shared helper functions and type guards for indexeddb package
 *
 * @remarks
 * Contains core utility functions:
 * - Promise wrappers for IndexedDB requests
 * - Type guards for validation
 * - Key extraction and comparison utilities
 *
 * @packageDocumentation
 */

import type { CursorDirection, Deferred, KeyPath, ValidKey } from './types.js'
import { TransactionError, wrapError } from './errors.js'
import type { ErrorContext } from './errors.js'

// ============================================================================
// Promise Wrappers
// ============================================================================

/**
 * Wraps an IDBRequest in a Promise.
 *
 * @param request - The IndexedDB request to promisify
 * @param context - Optional error context for better error messages
 * @returns Promise that resolves with the request result
 *
 * @example
 * ```ts
 * const result = await promisifyRequest(store.get('u1'))
 * ```
 */
export function promisifyRequest<T>(
	request: IDBRequest<T>,
	context?: ErrorContext,
): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result)
		request.onerror = () => reject(wrapError(request.error, context))
	})
}

/**
 * Wraps an IDBTransaction completion in a Promise.
 *
 * @param transaction - The IndexedDB transaction to promisify
 * @returns Promise that resolves when transaction completes
 *
 * @example
 * ```ts
 * const tx = db.transaction(['users'], 'readwrite')
 * // ... perform operations
 * await promisifyTransaction(tx)
 * ```
 */
export function promisifyTransaction(transaction: IDBTransaction): Promise<void> {
	return new Promise((resolve, reject) => {
		transaction.oncomplete = () => resolve()
		transaction.onerror = () => {
			reject(wrapError(transaction.error))
		}
		transaction.onabort = () => {
			reject(new TransactionError(
				'TRANSACTION_ABORTED',
				transaction.error?.message ?? 'Transaction was aborted',
				transaction.error,
			))
		}
	})
}

/**
 * Wraps an IDBOpenDBRequest in a Promise.
 *
 * @param request - The open database request
 * @returns Promise that resolves with the database
 *
 * @remarks
 * Does not handle onupgradeneeded - caller must set that separately.
 */
export function promisifyOpenRequest(request: IDBOpenDBRequest): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result)
		request.onerror = () => reject(wrapError(request.error))
	})
}

// ============================================================================
// Key Utilities
// ============================================================================

/**
 * Extracts the key from a value using the specified key path.
 *
 * @param value - Object to extract key from
 * @param keyPath - Path to the key property
 * @returns The extracted key value
 *
 * @example
 * ```ts
 * const key = extractKey({ id: 'u1', name: 'Alice' }, 'id')
 * // key = 'u1'
 *
 * const compoundKey = extractKey({ first: 'A', last: 'B' }, ['first', 'last'])
 * // compoundKey = ['A', 'B']
 * ```
 */
export function extractKey(value: unknown, keyPath: KeyPath): ValidKey | undefined {
	if (typeof value !== 'object' || value === null) {
		return undefined
	}

	if (typeof keyPath === 'string') {
		return extractKeyByPath(value as Record<string, unknown>, keyPath)
	}

	// Compound key path
	const keys: ValidKey[] = []
	for (const path of keyPath) {
		const key = extractKeyByPath(value as Record<string, unknown>, path)
		if (key === undefined) {
			return undefined
		}
		keys.push(key)
	}
	return keys
}

/**
 * Extracts a key value by dot-separated path.
 */
function extractKeyByPath(obj: Record<string, unknown>, path: string): ValidKey | undefined {
	const parts = path.split('.')
	let current: unknown = obj

	for (const part of parts) {
		if (typeof current !== 'object' || current === null) {
			return undefined
		}
		current = (current as Record<string, unknown>)[part]
	}

	if (isValidKey(current)) {
		return current
	}
	return undefined
}

/**
 * Checks if a value is a valid IndexedDB key.
 *
 * @param value - Value to check
 * @returns true if value is a valid IDBValidKey
 *
 * @remarks
 * Valid keys are: number, string, Date, ArrayBuffer, ArrayBufferView,
 * or an array of valid keys.
 */
export function isValidKey(value: unknown): value is ValidKey {
	if (value === undefined || value === null) {
		return false
	}

	const type = typeof value

	// Primitives
	if (type === 'number') {
		return !Number.isNaN(value)
	}
	if (type === 'string') {
		return true
	}

	// Date
	if (value instanceof Date) {
		return !Number.isNaN(value.getTime())
	}

	// Binary
	if (value instanceof ArrayBuffer) {
		return true
	}
	if (ArrayBuffer.isView(value)) {
		return true
	}

	// Array of keys
	if (Array.isArray(value)) {
		return value.every(isValidKey)
	}

	return false
}

/**
 * Compares two keys for equality.
 *
 * @param a - First key
 * @param b - Second key
 * @returns true if keys are equal
 *
 * @remarks
 * Handles all valid key types including arrays and binary data.
 */
export function keysEqual(a: ValidKey, b: ValidKey): boolean {
	// Same reference
	if (a === b) {
		return true
	}

	// Type mismatch
	if (typeof a !== typeof b) {
		return false
	}

	// Primitives (already covered by ===)
	if (typeof a === 'number' || typeof a === 'string') {
		return a === b
	}

	// Date
	if (a instanceof Date && b instanceof Date) {
		return a.getTime() === b.getTime()
	}

	// Binary data
	if (a instanceof ArrayBuffer && b instanceof ArrayBuffer) {
		return arrayBuffersEqual(a, b)
	}

	if (ArrayBuffer.isView(a) && ArrayBuffer.isView(b)) {
		return arrayBuffersEqual(a.buffer, b.buffer)
	}

	// Array (compound key)
	if (Array.isArray(a) && Array.isArray(b)) {
		if (a.length !== b.length) {
			return false
		}
		for (let i = 0; i < a.length; i++) {
			const aVal = a[i]
			const bVal = b[i]
			if (aVal === undefined || bVal === undefined) {
				return false
			}
			if (!keysEqual(aVal, bVal)) {
				return false
			}
		}
		return true
	}

	return false
}

/**
 * Compares two ArrayBuffers for equality.
 */
function arrayBuffersEqual(a: ArrayBuffer, b: ArrayBuffer): boolean {
	if (a.byteLength !== b.byteLength) {
		return false
	}
	const viewA = new Uint8Array(a)
	const viewB = new Uint8Array(b)
	for (let i = 0; i < viewA.length; i++) {
		if (viewA[i] !== viewB[i]) {
			return false
		}
	}
	return true
}

// ============================================================================
// Array Utilities
// ============================================================================

/**
 * Checks if input is an array.
 *
 * @remarks
 * Used to differentiate between single and batch operations.
 */
export function isArray<T>(value: T | readonly T[]): value is readonly T[] {
	return Array.isArray(value)
}

/**
 * Normalizes input to always be an array.
 */
export function toArray<T>(value: T | readonly T[]): readonly T[] {
	if (Array.isArray(value)) {
		return value
	}
	return [value] as readonly T[]
}

/**
 * Normalizes store names to always be an array.
 */
export function toStoreNames<K extends string>(names: K | readonly K[]): readonly K[] {
	if (Array.isArray(names)) {
		return names as readonly K[]
	}
	return [names] as readonly K[]
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Checks if value is an object (not null, not array).
 */
export function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Checks if value is a string.
 */
export function isString(value: unknown): value is string {
	return typeof value === 'string'
}

/**
 * Checks if value is a positive integer.
 */
export function isPositiveInteger(value: unknown): value is number {
	return typeof value === 'number' &&
		Number.isInteger(value) &&
		value > 0
}

/**
 * Checks if value is a non-negative integer.
 */
export function isNonNegativeInteger(value: unknown): value is number {
	return typeof value === 'number' &&
		Number.isInteger(value) &&
		value >= 0
}

/**
 * Checks if value is a function.
 */
export function isFunction(value: unknown): value is (...args: unknown[]) => unknown {
	return typeof value === 'function'
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Asserts that a database version is valid.
 *
 * @param version - Version number to validate
 * @throws {Error} if version is invalid
 */
export function assertValidVersion(version: number): void {
	if (!isPositiveInteger(version)) {
		throw new Error(`Database version must be a positive integer, got: ${String(version)}`)
	}
}

/**
 * Asserts that a database name is valid.
 *
 * @param name - Database name to validate
 * @throws {Error} if name is invalid
 */
export function assertValidName(name: string): void {
	if (name.length === 0) {
		throw new Error('Database name must be a non-empty string')
	}
}

// ============================================================================
// IDBKeyRange Helpers
// ============================================================================

/**
 * Creates an IDBKeyRange for a "starts with" query.
 *
 * @param prefix - String prefix to match
 * @returns IDBKeyRange that matches strings starting with prefix
 *
 * @example
 * ```ts
 * const range = startsWithRange('Al')
 * // Matches: 'Alice', 'Albert', 'Alabama'
 * // Does not match: 'Bob', 'alice' (case-sensitive)
 * ```
 */
export function startsWithRange(prefix: string): IDBKeyRange {
	// Use high Unicode character as upper bound
	return IDBKeyRange.bound(prefix, prefix + '\uffff', false, false)
}

/**
 * Checks if a value is an IDBKeyRange.
 */
export function isKeyRange(value: unknown): value is IDBKeyRange {
	return value instanceof IDBKeyRange
}

// ============================================================================
// Async Utilities
// ============================================================================

/**
 * Creates a deferred promise.
 */
export function createDeferred<T>(): Deferred<T> {
	let resolve!: (value: T) => void
	let reject!: (reason: unknown) => void

	const promise = new Promise<T>((res, rej) => {
		resolve = res
		reject = rej
	})

	return { promise, resolve, reject }
}

// ============================================================================
// Cursor Utilities
// ============================================================================

/**
 * Converts CursorDirection to IDBCursorDirection.
 *
 * @remarks
 * Our interface uses 'previous' for clarity (per design guidelines),
 * but IndexedDB uses 'prev'. This function handles the conversion.
 *
 * @param direction - Our CursorDirection value
 * @returns IDBCursorDirection value
 */
export function toIDBCursorDirection(direction: CursorDirection | undefined): IDBCursorDirection {
	if (direction === undefined) return 'next'
	if (direction === 'previous') return 'prev'
	if (direction === 'previousunique') return 'prevunique'
	return direction as IDBCursorDirection
}

/**
 * Converts IDBCursorDirection to CursorDirection.
 *
 * @param direction - IDB's cursor direction value
 * @returns Our CursorDirection value
 */
export function fromIDBCursorDirection(direction: IDBCursorDirection): CursorDirection {
	if (direction === 'prev') return 'previous'
	if (direction === 'prevunique') return 'previousunique'
	return direction as CursorDirection
}

// ============================================================================
// IDB Type Validators
// ============================================================================

/**
 * Checks if a value is an IDBCursorWithValue.
 */
export function isCursorWithValue(value: unknown): value is IDBCursorWithValue {
	return value !== null &&
		typeof value === 'object' &&
		'value' in value &&
		'key' in value &&
		'primaryKey' in value
}

/**
 * Checks if a value is an IDBCursor (including IDBCursorWithValue).
 */
export function isCursor(value: unknown): value is IDBCursor {
	return value !== null &&
		typeof value === 'object' &&
		'key' in value &&
		'primaryKey' in value &&
		'direction' in value
}

// ============================================================================
// Promise Cursor Helpers
// ============================================================================

/**
 * Promisifies cursor navigation and returns null-safe result.
 *
 * @param request - The cursor request to wait on
 * @returns Promise resolving to the cursor result or null
 */
export function promisifyCursorRequest<T extends IDBCursor | IDBCursorWithValue>(
	request: IDBRequest<T | null>,
): Promise<T | null> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result)
		request.onerror = () => reject(wrapError(request.error))
	})
}

// ============================================================================
// IDBFactory Helpers
// ============================================================================

/**
 * Lists all IndexedDB databases for this origin.
 *
 * @returns Promise resolving to an array of database info
 *
 * @remarks
 * Returns the native `indexedDB.databases()` result.
 * Returns an empty array if the browser doesn't support this API.
 *
 * @example
 * ```ts
 * const databases = await listDatabases()
 * for (const db of databases) {
 *   console.log(`${db.name} v${db.version}`)
 * }
 * ```
 */
export async function listDatabases(): Promise<readonly { name: string; version: number }[]> {
	if (typeof indexedDB.databases !== 'function') {
		return []
	}
	const databases = await indexedDB.databases()
	return databases.map(db => ({
		name: db.name ?? '',
		version: db.version ?? 0,
	}))
}

/**
 * Compares two IndexedDB keys.
 *
 * @param first - First key to compare
 * @param second - Second key to compare
 * @returns -1 if first < second, 0 if equal, 1 if first > second
 *
 * @remarks
 * Wraps the native `indexedDB.cmp()` function.
 * Throws if either value is not a valid IndexedDB key.
 *
 * @example
 * ```ts
 * compareKeys('a', 'b')  // -1
 * compareKeys('a', 'a')  // 0
 * compareKeys('b', 'a')  // 1
 *
 * // For sorting
 * keys.sort((a, b) => compareKeys(a, b))
 * ```
 */
export function compareKeys(first: ValidKey, second: ValidKey): number {
	return indexedDB.cmp(first, second)
}

// ============================================================================
// Date Range Helpers
// ============================================================================

/**
 * Creates an IDBKeyRange for dates within the last N days.
 *
 * @param days - Number of days to look back (must be between 0 and 3650)
 * @returns IDBKeyRange from (now - days) to now
 *
 * @remarks
 * Uses timestamp values (milliseconds since epoch).
 * Store your dates as `Date.now()` or `new Date().getTime()` for compatibility.
 *
 * @example
 * ```ts
 * // Get posts from the last 7 days
 * const range = lastDaysRange(7)
 * const recentPosts = await store.all(range)
 * ```
 */
export function lastDaysRange(days: number): IDBKeyRange {
	if (days < 0 || days > 3650 || !Number.isInteger(days)) {
		throw new Error('days must be an integer between 0 and 3650')
	}
	const now = Date.now()
	const start = now - (days * 86400000) // 86400000 = 24 * 60 * 60 * 1000
	return IDBKeyRange.bound(start, now)
}

/**
 * Creates an IDBKeyRange for today only (midnight to end of day).
 *
 * @returns IDBKeyRange for today with exclusive upper bound
 *
 * @remarks
 * Uses timestamp values (milliseconds since epoch).
 * The upper bound is exclusive (start of next day).
 *
 * @example
 * ```ts
 * // Get today's entries
 * const range = todayRange()
 * const todayEntries = await store.all(range)
 * ```
 */
export function todayRange(): IDBKeyRange {
	const now = new Date()
	const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
	const startOfNextDay = startOfDay + 86400000
	return IDBKeyRange.bound(startOfDay, startOfNextDay, false, true)
}

/**
 * Creates an IDBKeyRange for a custom date range.
 *
 * @param start - Start date (inclusive)
 * @param end - End date (inclusive by default)
 * @param options - Bound options (lowerOpen, upperOpen)
 * @returns IDBKeyRange for the specified date range
 *
 * @remarks
 * Accepts Date objects and converts them to timestamps.
 * Uses timestamp values (milliseconds since epoch).
 *
 * @example
 * ```ts
 * // Get entries for Q1 2024
 * const range = dateRange(
 *   new Date('2024-01-01'),
 *   new Date('2024-03-31T23:59:59.999')
 * )
 * const q1Entries = await store.all(range)
 * ```
 */
export function dateRange(
	start: Date,
	end: Date,
	options?: { readonly lowerOpen?: boolean; readonly upperOpen?: boolean },
): IDBKeyRange {
	return IDBKeyRange.bound(
		start.getTime(),
		end.getTime(),
		options?.lowerOpen ?? false,
		options?.upperOpen ?? false,
	)
}
