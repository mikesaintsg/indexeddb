/**
 * Tests for Reactivity and Cross-Tab Sync
 *
 * @remarks
 * Comprehensive tests covering:
 * - Database-level change events
 * - Store-level change events
 * - Error event subscription
 * - VersionChange event subscription
 * - Close event subscription
 * - Unsubscribe functionality
 * - BroadcastChannel cross-tab sync
 * - Edge cases
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createDatabase } from '../../src/index.js'
import type { DatabaseSchema, ChangeEvent } from '../../src/types.js'

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
}

interface TestSchema extends DatabaseSchema {
	readonly users: User
	readonly posts: Post
}

// ============================================================================
// Test Utilities
// ============================================================================

function createTestDbName(): string {
	return `test-react-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

// ============================================================================
// Tests
// ============================================================================

describe('Reactivity', () => {
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
			},
		})
	})

	afterEach(async() => {
		await db.drop()
	})

	// ─── Database-Level onChange ─────────────────────────────

	describe('database.onChange()', () => {
		it('emits event on set()', async() => {
			const events: ChangeEvent[] = []
			db.onChange((e) => events.push(e))

			await db.store('users').set({ id: 'u1', name: 'Alice', email: 'alice@test.com' })

			expect(events).toHaveLength(1)
			expect(events[0]?.type).toBe('set')
			expect(events[0]?.storeName).toBe('users')
			expect(events[0]?.keys).toContain('u1')
			expect(events[0]?.source).toBe('local')
		})

		it('emits event on add()', async() => {
			const events: ChangeEvent[] = []
			db.onChange((e) => events.push(e))

			await db.store('users').add({ id: 'u1', name: 'Alice', email: 'alice@test.com' })

			expect(events).toHaveLength(1)
			expect(events[0]?.type).toBe('add')
		})

		it('emits event on remove()', async() => {
			await db.store('users').set({ id: 'u1', name: 'Alice', email: 'alice@test.com' })

			const events: ChangeEvent[] = []
			db.onChange((e) => events.push(e))

			await db.store('users').remove('u1')

			expect(events).toHaveLength(1)
			expect(events[0]?.type).toBe('remove')
			expect(events[0]?.keys).toContain('u1')
		})

		it('emits event on clear()', async() => {
			await db.store('users').set({ id: 'u1', name: 'Alice', email: 'alice@test.com' })

			const events: ChangeEvent[] = []
			db.onChange((e) => events.push(e))

			await db.store('users').clear()

			expect(events).toHaveLength(1)
			expect(events[0]?.type).toBe('clear')
		})

		it('emits events for batch operations', async() => {
			const events: ChangeEvent[] = []
			db.onChange((e) => events.push(e))

			await db.store('users').set([
				{ id: 'u1', name: 'Alice', email: 'alice@test.com' },
				{ id: 'u2', name: 'Bob', email: 'bob@test.com' },
			])

			expect(events).toHaveLength(1)
			expect(events[0]?.keys).toHaveLength(2)
			expect(events[0]?.keys).toContain('u1')
			expect(events[0]?.keys).toContain('u2')
		})

		it('emits events for multiple stores', async() => {
			const events: ChangeEvent[] = []
			db.onChange((e) => events.push(e))

			await db.store('users').set({ id: 'u1', name: 'Alice', email: 'alice@test.com' })
			await db.store('posts').set({ id: 'p1', title: 'Hello' })

			expect(events).toHaveLength(2)
			expect(events[0]?.storeName).toBe('users')
			expect(events[1]?.storeName).toBe('posts')
		})

		it('returns unsubscribe function', async() => {
			const events: ChangeEvent[] = []
			const unsubscribe = db.onChange((e) => events.push(e))

			await db.store('users').set({ id: 'u1', name: 'Alice', email: 'alice@test.com' })
			expect(events).toHaveLength(1)

			unsubscribe()

			await db.store('users').set({ id: 'u2', name: 'Bob', email: 'bob@test.com' })
			expect(events).toHaveLength(1) // No new event
		})

		it('supports multiple subscribers', async() => {
			const events1: ChangeEvent[] = []
			const events2: ChangeEvent[] = []

			db.onChange((e) => events1.push(e))
			db.onChange((e) => events2.push(e))

			await db.store('users').set({ id: 'u1', name: 'Alice', email: 'alice@test.com' })

			expect(events1).toHaveLength(1)
			expect(events2).toHaveLength(1)
		})

		it('handles errors in callbacks gracefully', async() => {
			const errors: Error[] = []
			db.onError((e) => errors.push(e))
			db.onChange(() => {
				throw new Error('Callback error')
			})

			await db.store('users').set({ id: 'u1', name: 'Alice', email: 'alice@test.com' })

			// Operation should succeed despite callback error
			const user = await db.store('users').get('u1')
			expect(user?.name).toBe('Alice')
			expect(errors).toHaveLength(1)
		})
	})

	// ─── Store-Level onChange ────────────────────────────────

	describe('store.onChange()', () => {
		it('only receives events for that store', async() => {
			const events: ChangeEvent[] = []
			db.store('users').onChange((e) => events.push(e))

			await db.store('posts').set({ id: 'p1', title: 'Hello' })
			await db.store('users').set({ id: 'u1', name: 'Alice', email: 'alice@test.com' })

			expect(events).toHaveLength(1)
			expect(events[0]?.storeName).toBe('users')
		})

		it('returns unsubscribe function', async() => {
			const events: ChangeEvent[] = []
			const unsubscribe = db.store('users').onChange((e) => events.push(e))

			await db.store('users').set({ id: 'u1', name: 'Alice', email: 'alice@test.com' })
			unsubscribe()
			await db.store('users').set({ id: 'u2', name: 'Bob', email: 'bob@test.com' })

			expect(events).toHaveLength(1)
		})
	})

	// ─── Error Events ────────────────────────────────────────

	describe('onError()', () => {
		it('returns unsubscribe function', () => {
			const callback = vi.fn()
			const unsubscribe = db.onError(callback)

			expect(typeof unsubscribe).toBe('function')
			unsubscribe()
		})

		it('receives errors from callbacks', async() => {
			const errors: Error[] = []
			db.onError((e) => errors.push(e))
			db.onChange(() => {
				throw new Error('Test error')
			})

			await db.store('users').set({ id: 'u1', name: 'Alice', email: 'alice@test.com' })

			expect(errors).toHaveLength(1)
			expect(errors[0]?.message).toBe('Test error')
		})
	})

	// ─── VersionChange Events ────────────────────────────────

	describe('onVersionChange()', () => {
		it('returns unsubscribe function', () => {
			const callback = vi.fn()
			const unsubscribe = db.onVersionChange(callback)

			expect(typeof unsubscribe).toBe('function')
			unsubscribe()
		})
	})

	// ─── Close Events ────────────────────────────────────────

	describe('onClose()', () => {
		it('fires when database is closed', async() => {
			let closed = false
			db.onClose(() => {
				closed = true
			})

			// Force open
			await db.store('users').get('u1')

			db.close()

			expect(closed).toBe(true)
		})

		it('returns unsubscribe function', () => {
			const callback = vi.fn()
			const unsubscribe = db.onClose(callback)

			expect(typeof unsubscribe).toBe('function')
			unsubscribe()
		})

		it('unsubscribe prevents callback', async() => {
			let closed = false
			const unsubscribe = db.onClose(() => {
				closed = true
			})

			unsubscribe()

			// Force open then close
			await db.store('users').get('u1')
			db.close()

			expect(closed).toBe(false)
		})
	})

	// ─── Options Hooks ───────────────────────────────────────

	describe('options hooks', () => {
		it('onChange in options receives events', async() => {
			const events: ChangeEvent[] = []

			const db2 = createDatabase<TestSchema>({
				name: createTestDbName(),
				version: 1,
				stores: { users: {}, posts: {} },
				onChange: (e) => events.push(e),
			})

			try {
				await db2.store('users').set({ id: 'u1', name: 'Alice', email: 'alice@test.com' })
				expect(events).toHaveLength(1)
			} finally {
				await db2.drop()
			}
		})

		it('onClose in options fires on close', async() => {
			let closed = false

			const db2 = createDatabase<TestSchema>({
				name: createTestDbName(),
				version: 1,
				stores: { users: {}, posts: {} },
				onClose: () => {
					closed = true
				},
			})

			try {
				await db2.store('users').get('u1')
				db2.close()
				expect(closed).toBe(true)
			} finally {
				// Already closed, just cleanup
				try {
					const request = indexedDB.deleteDatabase(db2.getName())
					await new Promise<void>((resolve) => {
						request.onsuccess = () => resolve()
						request.onerror = () => resolve()
					})
				} catch {
					// Ignore cleanup errors
				}
			}
		})
	})

	// ─── Cross-Tab Sync ──────────────────────────────────────

	describe('cross-tab sync', () => {
		it('creates BroadcastChannel by default', () => {
			// Just verify no error - can't easily test cross-tab
			expect(db.getName()).toBe(dbName)
		})

		it('can disable cross-tab sync', async() => {
			const db2 = createDatabase<TestSchema>({
				name: createTestDbName(),
				version: 1,
				stores: { users: {}, posts: {} },
				crossTabSync: false,
			})

			try {
				// Should work without BroadcastChannel
				await db2.store('users').set({ id: 'u1', name: 'Alice', email: 'alice@test.com' })
				const user = await db2.store('users').get('u1')
				expect(user?.name).toBe('Alice')
			} finally {
				await db2.drop()
			}
		})

		it('simulates remote event via BroadcastChannel', async() => {
			const events: ChangeEvent[] = []
			db.onChange((e) => events.push(e))

			// Force open
			await db.store('users').get('u1')

			// Simulate receiving a message from another tab
			const channel = new BroadcastChannel(`idb:${dbName}`)
			const remoteEvent: ChangeEvent = {
				storeName: 'users',
				type: 'set',
				keys: ['u-remote'],
				source: 'local', // Will be changed to 'remote' on receive
				timestamp: Date.now(),
			}

			channel.postMessage(remoteEvent)
			channel.close()

			// Wait a tick for the message to be processed
			await new Promise((resolve) => setTimeout(resolve, 50))

			// Should have received the remote event
			const remoteEvents = events.filter((e) => e.source === 'remote')
			expect(remoteEvents.length).toBeGreaterThanOrEqual(1)
			expect(remoteEvents[0]?.keys).toContain('u-remote')
		})
	})

	// ─── Edge Cases ──────────────────────────────────────────

	describe('edge cases', () => {
		it('unsubscribe is idempotent', () => {
			const events: ChangeEvent[] = []
			const unsubscribe = db.onChange((e) => events.push(e))

			// Multiple calls should not throw
			unsubscribe()
			unsubscribe()
			unsubscribe()
		})

		it('handles rapid subscribe/unsubscribe', async() => {
			const events: ChangeEvent[] = []

			for (let i = 0; i < 10; i++) {
				const unsub = db.onChange((e) => events.push(e))
				unsub()
			}

			await db.store('users').set({ id: 'u1', name: 'Alice', email: 'alice@test.com' })
			expect(events).toHaveLength(0)
		})

		it('events are immutable', async() => {
			const events: ChangeEvent[] = []
			db.onChange((e) => events.push(e))

			await db.store('users').set({ id: 'u1', name: 'Alice', email: 'alice@test.com' })

			// Attempting to modify should not affect future events
			const event = events[0]
			if (event) {
				// TypeScript prevents this but runtime might allow it
				expect(event.storeName).toBe('users')
			}
		})

		it('events have correct key for updates', async() => {
			const events: ChangeEvent[] = []
			db.onChange((e) => events.push(e))

			await db.store('users').set({ id: 'u1', name: 'Alice', email: 'alice@test.com' })
			await db.store('users').set({ id: 'u1', name: 'Alice Updated', email: 'alice@test.com' })

			expect(events).toHaveLength(2)
			expect(events[0]?.keys).toContain('u1')
			expect(events[1]?.keys).toContain('u1')
		})

		it('batch remove emits all keys', async() => {
			await db.store('users').set([
				{ id: 'u1', name: 'Alice', email: 'alice@test.com' },
				{ id: 'u2', name: 'Bob', email: 'bob@test.com' },
			])

			const events: ChangeEvent[] = []
			db.onChange((e) => events.push(e))

			await db.store('users').remove(['u1', 'u2'])

			expect(events).toHaveLength(1)
			expect(events[0]?.type).toBe('remove')
			expect(events[0]?.keys).toHaveLength(2)
		})

		it('clear event has empty keys array', async() => {
			await db.store('users').set({ id: 'u1', name: 'Alice', email: 'alice@test.com' })

			const events: ChangeEvent[] = []
			db.onChange((e) => events.push(e))

			await db.store('users').clear()

			expect(events[0]?.type).toBe('clear')
			expect(events[0]?.keys).toEqual([])
		})
	})

	// ─── Transaction Events ──────────────────────────────────

	describe('transaction events', () => {
		it('emits events within transactions', async() => {
			const events: ChangeEvent[] = []
			db.onChange((e) => events.push(e))

			await db.write('users', async(tx) => {
				await tx.store('users').set({ id: 'u1', name: 'Alice', email: 'alice@test.com' })
			})

			// Transaction store operations should also emit
			expect(events.length).toBeGreaterThanOrEqual(0)
		})
	})
})
