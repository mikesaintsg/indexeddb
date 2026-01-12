/**
 * Tests for helper functions and utilities
 *
 * @remarks
 * Comprehensive tests covering:
 * - Key extraction and validation
 * - Key comparison
 * - Array utilities
 * - Type guards
 * - Validation functions
 * - IDBKeyRange helpers
 * - Async utilities
 * - Edge cases
 */

import { describe, it, expect } from 'vitest'
import {
	extractKey,
	isValidKey,
	keysEqual,
	isArray,
	toArray,
	toStoreNames,
	isObject,
	isString,
	isPositiveInteger,
	isNonNegativeInteger,
	isFunction,
	assertValidVersion,
	assertValidName,
	startsWithRange,
	isKeyRange,
	createDeferred,
	toIDBCursorDirection,
	fromIDBCursorDirection,
	isCursor,
	isCursorWithValue,
} from '../src/helpers.js'

// ============================================================================
// isValidKey
// ============================================================================

describe('isValidKey', () => {
	describe('valid keys', () => {
		it('accepts positive numbers', () => {
			expect(isValidKey(1)).toBe(true)
			expect(isValidKey(42)).toBe(true)
			expect(isValidKey(3.14)).toBe(true)
			expect(isValidKey(Number.MAX_SAFE_INTEGER)).toBe(true)
		})

		it('accepts negative numbers', () => {
			expect(isValidKey(-1)).toBe(true)
			expect(isValidKey(-42)).toBe(true)
		})

		it('accepts zero', () => {
			expect(isValidKey(0)).toBe(true)
			expect(isValidKey(-0)).toBe(true)
		})

		it('accepts Infinity', () => {
			expect(isValidKey(Infinity)).toBe(true)
			expect(isValidKey(-Infinity)).toBe(true)
		})

		it('accepts strings', () => {
			expect(isValidKey('')).toBe(true)
			expect(isValidKey('a')).toBe(true)
			expect(isValidKey('hello world')).toBe(true)
			expect(isValidKey('unicode: 你好')).toBe(true)
		})

		it('accepts Date objects', () => {
			expect(isValidKey(new Date())).toBe(true)
			expect(isValidKey(new Date('2024-01-15'))).toBe(true)
			expect(isValidKey(new Date(0))).toBe(true)
		})

		it('accepts ArrayBuffer', () => {
			expect(isValidKey(new ArrayBuffer(0))).toBe(true)
			expect(isValidKey(new ArrayBuffer(8))).toBe(true)
		})

		it('accepts TypedArrays', () => {
			expect(isValidKey(new Uint8Array([1, 2, 3]))).toBe(true)
			expect(isValidKey(new Int32Array([1, 2, 3]))).toBe(true)
			expect(isValidKey(new Float64Array([1.5]))).toBe(true)
		})

		it('accepts DataView', () => {
			const buffer = new ArrayBuffer(8)
			expect(isValidKey(new DataView(buffer))).toBe(true)
		})

		it('accepts arrays of valid keys', () => {
			expect(isValidKey([1, 2, 3])).toBe(true)
			expect(isValidKey(['a', 'b', 'c'])).toBe(true)
			expect(isValidKey([1, 'a', new Date()])).toBe(true)
		})

		it('accepts nested arrays', () => {
			expect(isValidKey([[1, 2], [3, 4]])).toBe(true)
			expect(isValidKey(['a', ['b', 'c']])).toBe(true)
		})

		it('accepts empty array', () => {
			expect(isValidKey([])).toBe(true)
		})
	})

	describe('invalid keys', () => {
		it('rejects null', () => {
			expect(isValidKey(null)).toBe(false)
		})

		it('rejects undefined', () => {
			expect(isValidKey(undefined)).toBe(false)
		})

		it('rejects NaN', () => {
			expect(isValidKey(NaN)).toBe(false)
		})

		it('rejects objects', () => {
			expect(isValidKey({})).toBe(false)
			expect(isValidKey({ id: 1 })).toBe(false)
		})

		it('rejects functions', () => {
			expect(isValidKey(() => {})).toBe(false)
		})

		it('rejects symbols', () => {
			expect(isValidKey(Symbol('test'))).toBe(false)
		})

		it('rejects booleans', () => {
			expect(isValidKey(true)).toBe(false)
			expect(isValidKey(false)).toBe(false)
		})

		it('rejects Invalid Date', () => {
			expect(isValidKey(new Date('invalid'))).toBe(false)
		})

		it('rejects arrays containing invalid keys', () => {
			expect(isValidKey([1, null])).toBe(false)
			expect(isValidKey([1, undefined])).toBe(false)
			expect(isValidKey([1, {}])).toBe(false)
			expect(isValidKey([1, NaN])).toBe(false)
		})

		it('rejects RegExp', () => {
			expect(isValidKey(/test/)).toBe(false)
		})

		it('rejects Map and Set', () => {
			expect(isValidKey(new Map())).toBe(false)
			expect(isValidKey(new Set())).toBe(false)
		})
	})
})

// ============================================================================
// extractKey
// ============================================================================

describe('extractKey', () => {
	describe('simple key paths', () => {
		it('extracts string key', () => {
			expect(extractKey({ id: 'u1' }, 'id')).toBe('u1')
		})

		it('extracts number key', () => {
			expect(extractKey({ id: 42 }, 'id')).toBe(42)
		})

		it('extracts Date key', () => {
			const date = new Date()
			expect(extractKey({ createdAt: date }, 'createdAt')).toBe(date)
		})

		it('returns undefined for missing property', () => {
			expect(extractKey({ name: 'Alice' }, 'id')).toBeUndefined()
		})

		it('returns undefined for invalid key type', () => {
			expect(extractKey({ id: {} }, 'id')).toBeUndefined()
			expect(extractKey({ id: null }, 'id')).toBeUndefined()
		})
	})

	describe('nested key paths', () => {
		it('extracts from nested object', () => {
			expect(extractKey({ user: { id: 'u1' } }, 'user.id')).toBe('u1')
		})

		it('extracts deeply nested', () => {
			const obj = { a: { b: { c: { d: 'value' } } } }
			expect(extractKey(obj, 'a.b.c.d')).toBe('value')
		})

		it('returns undefined for broken chain', () => {
			expect(extractKey({ user: null }, 'user.id')).toBeUndefined()
			expect(extractKey({ user: 'string' }, 'user.id')).toBeUndefined()
		})
	})

	describe('compound key paths', () => {
		it('extracts compound key', () => {
			const obj = { first: 'a', last: 'b' }
			expect(extractKey(obj, ['first', 'last'])).toEqual(['a', 'b'])
		})

		it('returns undefined if any key missing', () => {
			const obj = { first: 'a' }
			expect(extractKey(obj, ['first', 'last'])).toBeUndefined()
		})

		it('extracts nested compound key', () => {
			const obj = { user: { first: 'a' }, meta: { created: 123 } }
			expect(extractKey(obj, ['user.first', 'meta.created'])).toEqual(['a', 123])
		})
	})

	describe('edge cases', () => {
		it('returns undefined for non-object', () => {
			expect(extractKey(null, 'id')).toBeUndefined()
			expect(extractKey(undefined, 'id')).toBeUndefined()
			expect(extractKey('string', 'id')).toBeUndefined()
			expect(extractKey(42, 'id')).toBeUndefined()
		})

		it('handles empty string key path', () => {
			expect(extractKey({ '': 'value' }, '')).toBe('value')
		})

		it('handles array values correctly', () => {
			const obj = { tags: ['a', 'b'] }
			expect(extractKey(obj, 'tags')).toEqual(['a', 'b'])
		})
	})
})

// ============================================================================
// keysEqual
// ============================================================================

describe('keysEqual', () => {
	describe('primitive keys', () => {
		it('compares equal numbers', () => {
			expect(keysEqual(1, 1)).toBe(true)
			expect(keysEqual(0, 0)).toBe(true)
			expect(keysEqual(-1, -1)).toBe(true)
			expect(keysEqual(3.14, 3.14)).toBe(true)
		})

		it('compares unequal numbers', () => {
			expect(keysEqual(1, 2)).toBe(false)
			expect(keysEqual(0, 1)).toBe(false)
		})

		it('compares equal strings', () => {
			expect(keysEqual('a', 'a')).toBe(true)
			expect(keysEqual('', '')).toBe(true)
			expect(keysEqual('hello', 'hello')).toBe(true)
		})

		it('compares unequal strings', () => {
			expect(keysEqual('a', 'b')).toBe(false)
			expect(keysEqual('a', 'A')).toBe(false)
		})

		it('handles type mismatch', () => {
			expect(keysEqual(1, '1' as unknown as number)).toBe(false)
		})
	})

	describe('Date keys', () => {
		it('compares equal dates', () => {
			const d1 = new Date('2024-01-15T12:00:00Z')
			const d2 = new Date('2024-01-15T12:00:00Z')
			expect(keysEqual(d1, d2)).toBe(true)
		})

		it('compares unequal dates', () => {
			const d1 = new Date('2024-01-15')
			const d2 = new Date('2024-01-16')
			expect(keysEqual(d1, d2)).toBe(false)
		})

		it('compares same reference', () => {
			const d = new Date()
			expect(keysEqual(d, d)).toBe(true)
		})
	})

	describe('ArrayBuffer keys', () => {
		it('compares equal buffers', () => {
			const b1 = new Uint8Array([1, 2, 3]).buffer
			const b2 = new Uint8Array([1, 2, 3]).buffer
			expect(keysEqual(b1, b2)).toBe(true)
		})

		it('compares unequal buffers', () => {
			const b1 = new Uint8Array([1, 2, 3]).buffer
			const b2 = new Uint8Array([1, 2, 4]).buffer
			expect(keysEqual(b1, b2)).toBe(false)
		})

		it('compares buffers of different lengths', () => {
			const b1 = new Uint8Array([1, 2]).buffer
			const b2 = new Uint8Array([1, 2, 3]).buffer
			expect(keysEqual(b1, b2)).toBe(false)
		})

		it('compares empty buffers', () => {
			const b1 = new ArrayBuffer(0)
			const b2 = new ArrayBuffer(0)
			expect(keysEqual(b1, b2)).toBe(true)
		})
	})

	describe('TypedArray keys', () => {
		it('compares equal typed arrays', () => {
			const a1 = new Uint8Array([1, 2, 3])
			const a2 = new Uint8Array([1, 2, 3])
			expect(keysEqual(a1, a2)).toBe(true)
		})

		it('compares unequal typed arrays', () => {
			const a1 = new Uint8Array([1, 2, 3])
			const a2 = new Uint8Array([1, 2, 4])
			expect(keysEqual(a1, a2)).toBe(false)
		})
	})

	describe('array keys', () => {
		it('compares equal arrays', () => {
			expect(keysEqual([1, 2, 3], [1, 2, 3])).toBe(true)
			expect(keysEqual(['a', 'b'], ['a', 'b'])).toBe(true)
			expect(keysEqual([], [])).toBe(true)
		})

		it('compares unequal arrays', () => {
			expect(keysEqual([1, 2, 3], [1, 2, 4])).toBe(false)
			expect(keysEqual([1, 2], [1, 2, 3])).toBe(false)
		})

		it('compares nested arrays', () => {
			expect(keysEqual([[1, 2], [3, 4]], [[1, 2], [3, 4]])).toBe(true)
			expect(keysEqual([[1, 2], [3, 4]], [[1, 2], [3, 5]])).toBe(false)
		})

		it('compares mixed type arrays', () => {
			const d = new Date('2024-01-15')
			expect(keysEqual([1, 'a', d], [1, 'a', new Date('2024-01-15')])).toBe(true)
		})
	})

	describe('same reference', () => {
		it('returns true for same reference', () => {
			const arr = [1, 2, 3]
			expect(keysEqual(arr, arr)).toBe(true)

			const date = new Date()
			expect(keysEqual(date, date)).toBe(true)
		})
	})
})

// ============================================================================
// Array Utilities
// ============================================================================

describe('isArray', () => {
	it('returns true for arrays', () => {
		expect(isArray([])).toBe(true)
		expect(isArray([1, 2, 3])).toBe(true)
		expect(isArray(['a', 'b'])).toBe(true)
	})

	it('returns true for readonly arrays', () => {
		const arr: readonly number[] = [1, 2, 3]
		expect(isArray(arr)).toBe(true)
	})

	it('returns false for non-arrays', () => {
		expect(isArray('string')).toBe(false)
		expect(isArray(42)).toBe(false)
		expect(isArray({})).toBe(false)
		expect(isArray(null)).toBe(false)
	})
})

describe('toArray', () => {
	it('wraps single value in array', () => {
		expect(toArray('single')).toEqual(['single'])
		expect(toArray(42)).toEqual([42])
	})

	it('returns array as-is', () => {
		const arr = [1, 2, 3]
		expect(toArray(arr)).toBe(arr)
	})

	it('handles objects', () => {
		const obj = { id: 1 }
		expect(toArray(obj)).toEqual([obj])
	})
})

describe('toStoreNames', () => {
	it('wraps single name in array', () => {
		expect(toStoreNames('users')).toEqual(['users'])
	})

	it('returns array as-is', () => {
		const names = ['users', 'posts'] as const
		expect(toStoreNames(names)).toBe(names)
	})
})

// ============================================================================
// Type Guards
// ============================================================================

describe('isObject', () => {
	it('returns true for plain objects', () => {
		expect(isObject({})).toBe(true)
		expect(isObject({ a: 1 })).toBe(true)
	})

	it('returns false for null', () => {
		expect(isObject(null)).toBe(false)
	})

	it('returns false for arrays', () => {
		expect(isObject([])).toBe(false)
		expect(isObject([1, 2])).toBe(false)
	})

	it('returns false for primitives', () => {
		expect(isObject('string')).toBe(false)
		expect(isObject(42)).toBe(false)
		expect(isObject(true)).toBe(false)
	})

	it('returns true for class instances', () => {
		expect(isObject(new Date())).toBe(true)
		expect(isObject(new Map())).toBe(true)
	})
})

describe('isString', () => {
	it('returns true for strings', () => {
		expect(isString('')).toBe(true)
		expect(isString('hello')).toBe(true)
	})

	it('returns false for non-strings', () => {
		expect(isString(42)).toBe(false)
		expect(isString(null)).toBe(false)
		expect(isString(undefined)).toBe(false)

		expect(isString(new String('test'))).toBe(false)
	})
})

describe('isPositiveInteger', () => {
	it('returns true for positive integers', () => {
		expect(isPositiveInteger(1)).toBe(true)
		expect(isPositiveInteger(42)).toBe(true)
		expect(isPositiveInteger(Number.MAX_SAFE_INTEGER)).toBe(true)
	})

	it('returns false for zero', () => {
		expect(isPositiveInteger(0)).toBe(false)
	})

	it('returns false for negative integers', () => {
		expect(isPositiveInteger(-1)).toBe(false)
	})

	it('returns false for floats', () => {
		expect(isPositiveInteger(1.5)).toBe(false)
		expect(isPositiveInteger(0.1)).toBe(false)
	})

	it('returns false for non-numbers', () => {
		expect(isPositiveInteger('1')).toBe(false)
		expect(isPositiveInteger(NaN)).toBe(false)
		expect(isPositiveInteger(Infinity)).toBe(false)
	})
})

describe('isNonNegativeInteger', () => {
	it('returns true for zero', () => {
		expect(isNonNegativeInteger(0)).toBe(true)
	})

	it('returns true for positive integers', () => {
		expect(isNonNegativeInteger(1)).toBe(true)
		expect(isNonNegativeInteger(100)).toBe(true)
	})

	it('returns false for negative integers', () => {
		expect(isNonNegativeInteger(-1)).toBe(false)
	})

	it('returns false for floats', () => {
		expect(isNonNegativeInteger(0.5)).toBe(false)
	})
})

describe('isFunction', () => {
	it('returns true for functions', () => {
		expect(isFunction(() => {})).toBe(true)
		expect(isFunction(function() {})).toBe(true)
		expect(isFunction(async() => {})).toBe(true)
		expect(isFunction(class {})).toBe(true)
	})

	it('returns false for non-functions', () => {
		expect(isFunction({})).toBe(false)
		expect(isFunction(null)).toBe(false)
		expect(isFunction('function')).toBe(false)
	})
})

// ============================================================================
// Validation
// ============================================================================

describe('assertValidVersion', () => {
	it('accepts positive integers', () => {
		expect(() => assertValidVersion(1)).not.toThrow()
		expect(() => assertValidVersion(42)).not.toThrow()
		expect(() => assertValidVersion(1000)).not.toThrow()
	})

	it('throws for zero', () => {
		expect(() => assertValidVersion(0)).toThrow()
	})

	it('throws for negative numbers', () => {
		expect(() => assertValidVersion(-1)).toThrow()
	})

	it('throws for floats', () => {
		expect(() => assertValidVersion(1.5)).toThrow()
	})

	it('throws for non-numbers', () => {
		expect(() => assertValidVersion('1' as unknown as number)).toThrow()
		expect(() => assertValidVersion(NaN)).toThrow()
	})
})

describe('assertValidName', () => {
	it('accepts non-empty strings', () => {
		expect(() => assertValidName('mydb')).not.toThrow()
		expect(() => assertValidName('a')).not.toThrow()
		expect(() => assertValidName('my-database_v2')).not.toThrow()
	})

	it('throws for empty string', () => {
		expect(() => assertValidName('')).toThrow()
	})
})

// ============================================================================
// IDBKeyRange Helpers
// ============================================================================

describe('startsWithRange', () => {
	it('creates range for prefix', () => {
		const range = startsWithRange('Al')

		expect(range).toBeInstanceOf(IDBKeyRange)
		expect(range.lower).toBe('Al')
		expect(range.lowerOpen).toBe(false)
		expect(range.upperOpen).toBe(false)
	})

	it('creates range for empty prefix (matches all)', () => {
		const range = startsWithRange('')

		expect(range).toBeInstanceOf(IDBKeyRange)
		expect(range.lower).toBe('')
	})

	it('upper bound includes high unicode', () => {
		const range = startsWithRange('test')

		// Upper should be 'test\uffff'
		expect(range.upper).toBe('test\uffff')
	})
})

describe('isKeyRange', () => {
	it('returns true for IDBKeyRange', () => {
		expect(isKeyRange(IDBKeyRange.only('test'))).toBe(true)
		expect(isKeyRange(IDBKeyRange.lowerBound(1))).toBe(true)
		expect(isKeyRange(IDBKeyRange.upperBound(10))).toBe(true)
		expect(isKeyRange(IDBKeyRange.bound(1, 10))).toBe(true)
	})

	it('returns false for non-ranges', () => {
		expect(isKeyRange(null)).toBe(false)
		expect(isKeyRange(undefined)).toBe(false)
		expect(isKeyRange({})).toBe(false)
		expect(isKeyRange({ lower: 1, upper: 10 })).toBe(false)
	})
})

// ============================================================================
// Async Utilities
// ============================================================================

describe('createDeferred', () => {
	it('creates a deferred promise', () => {
		const deferred = createDeferred<number>()

		expect(deferred.promise).toBeInstanceOf(Promise)
		expect(typeof deferred.resolve).toBe('function')
		expect(typeof deferred.reject).toBe('function')
	})

	it('resolves when resolve is called', async() => {
		const deferred = createDeferred<string>()

		setTimeout(() => deferred.resolve('done'), 0)

		const result = await deferred.promise
		expect(result).toBe('done')
	})

	it('rejects when reject is called', async() => {
		const deferred = createDeferred<string>()

		setTimeout(() => deferred.reject(new Error('failed')), 0)

		await expect(deferred.promise).rejects.toThrow('failed')
	})

	it('can be resolved synchronously before await', async() => {
		const deferred = createDeferred<number>()
		deferred.resolve(42)

		const result = await deferred.promise
		expect(result).toBe(42)
	})
})

// ============================================================================
// Cursor Direction Helpers Tests
// ============================================================================

describe('toIDBCursorDirection', () => {
	it('returns "next" for undefined', () => {
		expect(toIDBCursorDirection(undefined)).toBe('next')
	})

	it('returns "next" for "next"', () => {
		expect(toIDBCursorDirection('next')).toBe('next')
	})

	it('returns "prev" for "previous"', () => {
		expect(toIDBCursorDirection('previous')).toBe('prev')
	})

	it('returns "nextunique" for "nextunique"', () => {
		expect(toIDBCursorDirection('nextunique')).toBe('nextunique')
	})

	it('returns "prevunique" for "previousunique"', () => {
		expect(toIDBCursorDirection('previousunique')).toBe('prevunique')
	})
})

describe('fromIDBCursorDirection', () => {
	it('returns "next" for "next"', () => {
		expect(fromIDBCursorDirection('next')).toBe('next')
	})

	it('returns "previous" for "prev"', () => {
		expect(fromIDBCursorDirection('prev')).toBe('previous')
	})

	it('returns "nextunique" for "nextunique"', () => {
		expect(fromIDBCursorDirection('nextunique')).toBe('nextunique')
	})

	it('returns "previousunique" for "prevunique"', () => {
		expect(fromIDBCursorDirection('prevunique')).toBe('previousunique')
	})
})

// ============================================================================
// IDB Type Guards Tests
// ============================================================================

describe('isCursor', () => {
	it('returns false for null', () => {
		expect(isCursor(null)).toBe(false)
	})

	it('returns false for undefined', () => {
		expect(isCursor(undefined)).toBe(false)
	})

	it('returns false for primitives', () => {
		expect(isCursor(42)).toBe(false)
		expect(isCursor('cursor')).toBe(false)
		expect(isCursor(true)).toBe(false)
	})

	it('returns true for cursor-like objects', () => {
		const cursorLike = {
			key: 'test',
			primaryKey: 'test',
			direction: 'next',
		}
		expect(isCursor(cursorLike)).toBe(true)
	})

	it('returns false for incomplete cursor-like objects', () => {
		expect(isCursor({ key: 'test' })).toBe(false)
		expect(isCursor({ primaryKey: 'test' })).toBe(false)
	})
})

describe('isCursorWithValue', () => {
	it('returns false for null', () => {
		expect(isCursorWithValue(null)).toBe(false)
	})

	it('returns false for undefined', () => {
		expect(isCursorWithValue(undefined)).toBe(false)
	})

	it('returns true for cursor-with-value-like objects', () => {
		const cursorLike = {
			key: 'test',
			primaryKey: 'test',
			value: { id: 1 },
		}
		expect(isCursorWithValue(cursorLike)).toBe(true)
	})

	it('returns false for cursor-like without value', () => {
		const cursorLike = {
			key: 'test',
			primaryKey: 'test',
			direction: 'next',
		}
		expect(isCursorWithValue(cursorLike)).toBe(false)
	})
})
