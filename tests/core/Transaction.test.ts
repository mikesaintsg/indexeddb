/**
 * Tests for Transaction and TransactionStore
 *
 * @remarks
 * Comprehensive tests covering:
 * - Explicit read transactions
 * - Explicit write transactions
 * - Transaction state tracking
 * - Abort and rollback behavior
 * - Multi-store atomic operations
 * - Durability options
 * - Edge cases
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createDatabase, TransactionError, isTransactionError } from '../../src/index.js'
import type { DatabaseSchema } from '../../src/types.js'

// ============================================================================
// Test Schema
// ============================================================================

interface User {
	readonly id: string
	readonly name: string
	readonly email: string
}

interface Post {
	readonly id: string
	readonly title: string
	readonly authorId: string
}

interface Settings {
	readonly id: string
	readonly value: string
}

interface TestSchema extends DatabaseSchema {
	readonly users: User
	readonly posts: Post
	readonly settings: Settings
}

// ============================================================================
// Test Utilities
// ============================================================================

function createTestDbName(): string {
	return `test-tx-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

// ============================================================================
// Tests
// ============================================================================

describe('Transaction', () => {
	let dbName: string
	let db: ReturnType<typeof createDatabase<TestSchema>>

	beforeEach(() => {
		dbName = createTestDbName()
		db = createDatabase<TestSchema>({
			name: dbName,
			version: 1,
			stores: {
				users: {},
				posts: {},
				settings: {},
			},
		})
	})

	afterEach(async() => {
		await db.drop()
	})

	// ─── Read Transactions ───────────────────────────────────

	describe('read()', () => {
		it('creates readonly transaction', async() => {
			await db.read('users', (tx) => {
				expect(tx.getMode()).toBe('readonly')
			})
		})

		it('provides store access within transaction', async() => {
			await db.store('users').set({ id: 'u1', name: 'Alice', email: 'alice@test.com' })

			await db.read('users', async(tx) => {
				const store = tx.store('users')
				const user = await store.get('u1')
				expect(user?.name).toBe('Alice')
			})
		})

		it('provides consistent view across stores', async() => {
			await db.store('users').set({ id: 'u1', name: 'Alice', email: 'alice@test.com' })
			await db.store('posts').set({ id: 'p1', title: 'Hello', authorId: 'u1' })

			await db.read(['users', 'posts'], async(tx) => {
				const user = await tx.store('users').get('u1')
				const post = await tx.store('posts').get('p1')

				expect(user?.name).toBe('Alice')
				expect(post?.authorId).toBe('u1')
			})
		})

		it('accepts single store name', async() => {
			await db.read('users', (tx) => {
				expect(tx.getStoreNames()).toContain('users')
			})
		})

		it('accepts array of store names', async() => {
			await db.read(['users', 'posts'], (tx) => {
				const storeNames = tx.getStoreNames()
				expect(storeNames).toContain('users')
				expect(storeNames).toContain('posts')
			})
		})

		it('cannot write in readonly transaction', async() => {
			await db.read('users', async(tx) => {
				const store = tx.store('users')
				// Attempting to write should throw
				await expect(store.set({ id: 'u1', name: 'Alice', email: 'a@test.com' }))
					.rejects.toThrow()
			})
		})
	})

	// ─── Write Transactions ──────────────────────────────────

	describe('write()', () => {
		it('creates readwrite transaction', async() => {
			await db.write('users', (tx) => {
				expect(tx.getMode()).toBe('readwrite')
			})
		})

		it('commits on success', async() => {
			await db.write('users', async(tx) => {
				await tx.store('users').set({ id: 'u1', name: 'Alice', email: 'alice@test.com' })
			})

			const user = await db.store('users').get('u1')
			expect(user?.name).toBe('Alice')
		})

		it('aborts on error', async() => {
			await db.store('users').set({ id: 'u1', name: 'Original', email: 'orig@test.com' })

			await expect(db.write('users', async(tx) => {
				await tx.store('users').set({ id: 'u1', name: 'Changed', email: 'new@test.com' })
				throw new Error('Abort!')
			})).rejects.toThrow('Abort!')

			// Verify original data was preserved
			const user = await db.store('users').get('u1')
			expect(user?.name).toBe('Original')
		})

		it('supports multi-store atomic operations', async() => {
			await db.write(['users', 'posts'], async(tx) => {
				await tx.store('users').set({ id: 'u1', name: 'Alice', email: 'alice@test.com' })
				await tx.store('posts').set({ id: 'p1', title: 'Hello', authorId: 'u1' })
			})

			const user = await db.store('users').get('u1')
			const post = await db.store('posts').get('p1')

			expect(user?.name).toBe('Alice')
			expect(post?.title).toBe('Hello')
		})

		it('rolls back all stores on error', async() => {
			await db.store('users').set({ id: 'u1', name: 'Original', email: 'orig@test.com' })

			await expect(db.write(['users', 'posts'], async(tx) => {
				await tx.store('users').set({ id: 'u1', name: 'Changed', email: 'new@test.com' })
				await tx.store('posts').set({ id: 'p1', title: 'New Post', authorId: 'u1' })
				throw new Error('Rollback everything!')
			})).rejects.toThrow('Rollback everything!')

			// Both stores should be unchanged
			const user = await db.store('users').get('u1')
			const post = await db.store('posts').get('p1')

			expect(user?.name).toBe('Original')
			expect(post).toBeUndefined()
		})

		it('supports durability option', async() => {
			// Just verify it doesn't throw
			await db.write(['users'], async(tx) => {
				await tx.store('users').set({ id: 'u1', name: 'Alice', email: 'alice@test.com' })
			}, { durability: 'relaxed' })

			const user = await db.store('users').get('u1')
			expect(user?.name).toBe('Alice')
		})

		it('supports strict durability', async() => {
			await db.write(['users'], async(tx) => {
				await tx.store('users').set({ id: 'u1', name: 'Alice', email: 'alice@test.com' })
			}, { durability: 'strict' })

			const user = await db.store('users').get('u1')
			expect(user?.name).toBe('Alice')
		})
	})

	// ─── Transaction State ───────────────────────────────────

	describe('state tracking', () => {
		it('isActive() returns true during operation', async() => {
			await db.write('users', (tx) => {
				expect(tx.isActive()).toBe(true)
			})
		})

		it('isFinished() returns false during operation', async() => {
			await db.write('users', (tx) => {
				expect(tx.isFinished()).toBe(false)
			})
		})

		it('exposes native IDBTransaction', async() => {
			await db.write('users', (tx) => {
				expect(tx.native).toBeInstanceOf(IDBTransaction)
			})
		})
	})

	// ─── Abort Control ───────────────────────────────────────

	describe('abort()', () => {
		it('explicitly aborts transaction', async() => {
			await db.store('users').set({ id: 'u1', name: 'Original', email: 'orig@test.com' })

			await expect(db.write('users', async(tx) => {
				await tx.store('users').set({ id: 'u1', name: 'Changed', email: 'new@test.com' })
				tx.abort()
			})).rejects.toThrow()

			// Data should be unchanged
			const user = await db.store('users').get('u1')
			expect(user?.name).toBe('Original')
		})

		it('throws TransactionError on abort', async() => {
			try {
				await db.write('users', (tx) => {
					tx.abort()
				})
				expect.fail('Should have thrown')
			} catch (error) {
				expect(isTransactionError(error)).toBe(true)
			}
		})

		it('cannot abort finished transaction', async() => {
			let savedTx: { abort(): void } | undefined

			await db.write('users', (tx) => {
				savedTx = tx
			})

			expect(() => savedTx?.abort()).toThrow()
		})
	})

	// ─── Store Access Errors ─────────────────────────────────

	describe('store access', () => {
		it('throws for out-of-scope store', async() => {
			await db.write('users', (tx) => {
				expect(() => tx.store('posts' as 'users')).toThrow(TransactionError)
			})
		})

		it('throws when accessing store on inactive transaction', async() => {
			let savedTx: { store(name: 'users'): unknown } | undefined

			await db.write('users', (tx) => {
				savedTx = tx
			})

			// Transaction is now finished
			expect(() => savedTx?.store('users')).toThrow()
		})
	})

	// ─── TransactionStore Operations ─────────────────────────

	describe('TransactionStore', () => {
		it('get() returns undefined for missing', async() => {
			await db.read('users', async(tx) => {
				const user = await tx.store('users').get('nonexistent')
				expect(user).toBeUndefined()
			})
		})

		it('get() with array returns array', async() => {
			await db.store('users').set({ id: 'u1', name: 'Alice', email: 'a@test.com' })

			await db.read('users', async(tx) => {
				const results = await tx.store('users').get(['u1', 'u2'])
				if (!Array.isArray(results)) {
					expect.fail('Expected array')
					return
				}
				expect(results).toHaveLength(2)
				expect(results[0]?.name).toBe('Alice')
				expect(results[1]).toBeUndefined()
			})
		})

		it('resolve() throws for missing', async() => {
			await db.read('users', async(tx) => {
				await expect(tx.store('users').resolve('missing')).rejects.toThrow()
			})
		})

		it('set() creates new record', async() => {
			await db.write('users', async(tx) => {
				const key = await tx.store('users').set({ id: 'u1', name: 'Alice', email: 'a@test.com' })
				expect(key).toBe('u1')
			})

			const user = await db.store('users').get('u1')
			expect(user?.name).toBe('Alice')
		})

		it('set() with array batches operations', async() => {
			await db.write('users', async(tx) => {
				const keys = await tx.store('users').set([
					{ id: 'u1', name: 'Alice', email: 'a@test.com' },
					{ id: 'u2', name: 'Bob', email: 'b@test.com' },
				])

				if (!Array.isArray(keys)) {
					expect.fail('Expected array')
					return
				}
				expect(keys).toHaveLength(2)
			})

			const all = await db.store('users').all()
			expect(all).toHaveLength(2)
		})

		it('add() throws for duplicate', async() => {
			await db.store('users').set({ id: 'u1', name: 'Alice', email: 'a@test.com' })

			await expect(db.write('users', async(tx) => {
				await tx.store('users').add({ id: 'u1', name: 'Duplicate', email: 'd@test.com' })
			})).rejects.toThrow()
		})

		it('remove() deletes record', async() => {
			await db.store('users').set({ id: 'u1', name: 'Alice', email: 'a@test.com' })

			await db.write('users', async(tx) => {
				await tx.store('users').remove('u1')
			})

			const user = await db.store('users').get('u1')
			expect(user).toBeUndefined()
		})

		it('all() returns all records', async() => {
			await db.store('users').set([
				{ id: 'u1', name: 'Alice', email: 'a@test.com' },
				{ id: 'u2', name: 'Bob', email: 'b@test.com' },
			])

			await db.read('users', async(tx) => {
				const all = await tx.store('users').all()
				expect(all).toHaveLength(2)
			})
		})

		it('keys() returns all keys', async() => {
			await db.store('users').set([
				{ id: 'u1', name: 'Alice', email: 'a@test.com' },
				{ id: 'u2', name: 'Bob', email: 'b@test.com' },
			])

			await db.read('users', async(tx) => {
				const keys = await tx.store('users').keys()
				expect(keys).toHaveLength(2)
				expect(keys).toContain('u1')
				expect(keys).toContain('u2')
			})
		})

		it('count() returns record count', async() => {
			await db.store('users').set([
				{ id: 'u1', name: 'Alice', email: 'a@test.com' },
				{ id: 'u2', name: 'Bob', email: 'b@test.com' },
			])

			await db.read('users', async(tx) => {
				const count = await tx.store('users').count()
				expect(count).toBe(2)
			})
		})

		it('clear() removes all records', async() => {
			await db.store('users').set([
				{ id: 'u1', name: 'Alice', email: 'a@test.com' },
				{ id: 'u2', name: 'Bob', email: 'b@test.com' },
			])

			await db.write('users', async(tx) => {
				await tx.store('users').clear()
			})

			const count = await db.store('users').count()
			expect(count).toBe(0)
		})

		it('native property returns IDBObjectStore', async() => {
			await db.write('users', (tx) => {
				expect(tx.store('users').native).toBeInstanceOf(IDBObjectStore)
			})
		})

		it('has() returns true for existing key', async () => {
			await db.write(['users'], async (tx) => {
				const store = tx.store('users')
				await store.set({ id: 'u1', name: 'Alice', email: 'alice@example.com' })

				const exists = await store.has('u1')

				expect(exists).toBe(true)
			})
		})

		it('has() returns false for non-existing key', async () => {
			await db.read(['users'], async (tx) => {
				const store = tx.store('users')

				const exists = await store.has('nonexistent')

				expect(exists).toBe(false)
			})
		})

		it('has() checks multiple keys', async () => {
			await db.write(['users'], async (tx) => {
				const store = tx.store('users')
				await store.set([
					{ id: 'u1', name: 'Alice', email: 'alice@example.com' },
					{ id: 'u2', name: 'Bob', email: 'bob@example.com' },
				])

				const exists = await store.has(['u1', 'u2', 'u3'])

				expect(exists).toEqual([true, true, false])
			})
		})
	})

	// ─── Complex Scenarios ───────────────────────────────────

	describe('complex scenarios', () => {
		it('read then write pattern', async() => {
			await db.store('users').set({ id: 'u1', name: 'Alice', email: 'alice@test.com' })

			// Read the current state
			let currentName = ''
			await db.read('users', async(tx) => {
				const user = await tx.store('users').get('u1')
				currentName = user?.name ?? ''
			})

			// Write based on read value
			await db.write('users', async(tx) => {
				await tx.store('users').set({
					id: 'u1',
					name: `${currentName} Updated`,
					email: 'alice@test.com',
				})
			})

			const user = await db.store('users').get('u1')
			expect(user?.name).toBe('Alice Updated')
		})

		it('handles concurrent transactions', async() => {
			await db.store('users').set({ id: 'u1', name: 'Original', email: 'o@test.com' })

			// Run two writes concurrently
			const p1 = db.write('users', async(tx) => {
				const user = await tx.store('users').get('u1')
				await tx.store('users').set({ ...user!, name: 'First' })
			})

			const p2 = db.write('posts', async(tx) => {
				await tx.store('posts').set({ id: 'p1', title: 'Post', authorId: 'u1' })
			})

			await Promise.all([p1, p2])

			// Both should have completed
			const user = await db.store('users').get('u1')
			const post = await db.store('posts').get('p1')

			expect(user?.name).toBe('First')
			expect(post?.title).toBe('Post')
		})

		it('transfer pattern (move between stores)', async() => {
			await db.store('users').set({ id: 'u1', name: 'Alice', email: 'a@test.com' })
			await db.store('settings').set({ id: 's1', value: 'user:u1' })

			await db.write(['users', 'posts', 'settings'], async(tx) => {
				const user = await tx.store('users').resolve('u1')
				await tx.store('posts').set({ id: 'p1', title: 'New Post', authorId: user.id })
				await tx.store('settings').set({ id: 's1', value: 'lastPost:p1' })
			})

			const settings = await db.store('settings').get('s1')
			expect(settings?.value).toBe('lastPost:p1')
		})
	})

	// ─── Edge Cases ──────────────────────────────────────────

	describe('edge cases', () => {
		it('empty transaction completes successfully', async() => {
			await db.write('users', () => {
				// Do nothing
			})
			// Should not throw
		})

		it('handles async operations in sequence', async() => {
			await db.write('users', async(tx) => {
				await tx.store('users').set({ id: 'u1', name: 'First', email: '1@test.com' })
				await tx.store('users').set({ id: 'u2', name: 'Second', email: '2@test.com' })
				await tx.store('users').set({ id: 'u3', name: 'Third', email: '3@test.com' })
			})

			const all = await db.store('users').all()
			expect(all).toHaveLength(3)
		})

		it('handles parallel operations within transaction', async() => {
			await db.write('users', async(tx) => {
				await Promise.all([
					tx.store('users').set({ id: 'u1', name: 'First', email: '1@test.com' }),
					tx.store('users').set({ id: 'u2', name: 'Second', email: '2@test.com' }),
					tx.store('users').set({ id: 'u3', name: 'Third', email: '3@test.com' }),
				])
			})

			const all = await db.store('users').all()
			expect(all).toHaveLength(3)
		})

		it('single store name works same as array', async() => {
			await db.write('users', (tx) => {
				expect(tx.getStoreNames()).toHaveLength(1)
			})

			await db.write(['users'], (tx) => {
				expect(tx.getStoreNames()).toHaveLength(1)
			})
		})
	})
})
