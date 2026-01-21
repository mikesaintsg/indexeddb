/**
 * Integration Tests: Cross-Tab Synchronization
 *
 * @remarks
 * Tests for BroadcastChannel-based cross-tab synchronization
 * of database changes.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createDatabase } from '../../src/index.js'
import type { DatabaseSchema, ChangeEvent } from '../../src/types.js'

// ============================================================================
// Test Schema
// ============================================================================

interface Item {
	readonly id: string
	readonly name: string
	readonly value: number
}

interface TestSchema extends DatabaseSchema {
	readonly items: Item
}

// ============================================================================
// Test Utilities
// ============================================================================

function createTestDbName(): string {
	return `test-crosstab-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

// ============================================================================
// Integration Tests
// ============================================================================

describe('Integration: Cross-Tab', () => {
	let dbName: string
	let db1: ReturnType<typeof createDatabase<TestSchema>>
	let db2: ReturnType<typeof createDatabase<TestSchema>> | null = null

	beforeEach(() => {
		dbName = createTestDbName()
		db1 = createDatabase<TestSchema>({
			name: dbName,
			version: 1,
			stores: { items: {} },
		})
	})

	afterEach(async() => {
		if (db2) {
			db2.close()
			db2 = null
		}
		await db1.drop()
	})

	// ─── BroadcastChannel Setup ──────────────────────────────

	describe('BroadcastChannel setup', () => {
		it('creates channel by default', async() => {
			// Just verify db opens without error
			await db1.store('items').get('test')
			expect(db1.isOpen()).toBe(true)
		})

		it('can disable cross-tab sync', async() => {
			const noSyncDb = createDatabase<TestSchema>({
				name: createTestDbName(),
				version: 1,
				stores: { items: {} },
				crossTabSync: false,
			})

			try {
				await noSyncDb.store('items').set({ id: 'i1', name: 'Test', value: 1 })
				expect(await noSyncDb.store('items').has('i1')).toBe(true)
			} finally {
				await noSyncDb.drop()
			}
		})
	})

	// ─── Cross-Tab Events ────────────────────────────────────

	describe('cross-tab events', () => {
		it('simulates remote event via BroadcastChannel', async() => {
			const events: ChangeEvent[] = []
			db1.onChange((e) => events.push(e))

			// Force db1 open
			await db1.store('items').get('test')

			// Simulate another tab sending a change
			const channel = new BroadcastChannel(`idb:${dbName}`)
			const remoteEvent: ChangeEvent = {
				storeName: 'items',
				type: 'set',
				keys: ['remote-item'],
				source: 'local', // Sender marks as local
				timestamp: Date.now(),
			}
			channel.postMessage(remoteEvent)
			channel.close()

			// Wait for message to propagate
			await delay(50)

			// Should receive with source: 'remote'
			const remoteEvents = events.filter((e) => e.source === 'remote')
			expect(remoteEvents.length).toBeGreaterThanOrEqual(1)
			expect(remoteEvents[0]?.keys).toContain('remote-item')
		})

		it('receives multiple remote events', async() => {
			const events: ChangeEvent[] = []
			db1.onChange((e) => events.push(e))

			await db1.store('items').get('test')

			const channel = new BroadcastChannel(`idb:${dbName}`)

			// Send multiple events
			channel.postMessage({
				storeName: 'items',
				type: 'set',
				keys: ['item1'],
				source: 'local',
			})
			channel.postMessage({
				storeName: 'items',
				type: 'set',
				keys: ['item2'],
				source: 'local',
			})
			channel.postMessage({
				storeName: 'items',
				type: 'remove',
				keys: ['item1'],
				source: 'local',
			})

			channel.close()
			await delay(100)

			const remoteEvents = events.filter((e) => e.source === 'remote')
			expect(remoteEvents.length).toBeGreaterThanOrEqual(3)
		})

		it('local changes broadcast to channel', async() => {
			const receivedMessages: ChangeEvent[] = []

			// Set up listener on channel
			const channel = new BroadcastChannel(`idb:${dbName}`)
			channel.onmessage = (e: MessageEvent<ChangeEvent>) => {
				receivedMessages.push(e.data)
			}

			// Make local change
			await db1.store('items').set({ id: 'i1', name: 'Test', value: 1 })

			await delay(50)
			channel.close()

			// Should have broadcast the change
			expect(receivedMessages.length).toBeGreaterThanOrEqual(1)
			expect(receivedMessages[0]?.type).toBe('set')
			expect(receivedMessages[0]?.keys).toContain('i1')
		})
	})

	// ─── Two Database Connections ────────────────────────────

	describe('two connections same database', () => {
		it('both connections see same data', async() => {
			db2 = createDatabase<TestSchema>({
				name: dbName,
				version: 1,
				stores: { items: {} },
			})

			// Write via db1
			await db1.store('items').set({ id: 'i1', name: 'Shared', value: 100 })

			// Read via db2
			const item = await db2.store('items').get('i1')
			expect(item?.name).toBe('Shared')
		})

		it('db2 receives change events from db1', async() => {
			const db2Events: ChangeEvent[] = []

			db2 = createDatabase<TestSchema>({
				name: dbName,
				version: 1,
				stores: { items: {} },
			})

			// Set up listener on db2
			db2.onChange((e) => db2Events.push(e))

			// Force both open
			await db1.store('items').get('test')
			await db2.store('items').get('test')

			// Make change via db1
			await db1.store('items').set({ id: 'i1', name: 'From DB1', value: 1 })

			await delay(100)

			// db2 should receive remote event
			const remoteEvents = db2Events.filter((e) => e.source === 'remote')
			expect(remoteEvents.length).toBeGreaterThanOrEqual(1)
		})

		it('bidirectional sync', async() => {
			const db1Events: ChangeEvent[] = []
			const db2Events: ChangeEvent[] = []

			db2 = createDatabase<TestSchema>({
				name: dbName,
				version: 1,
				stores: { items: {} },
			})

			db1.onChange((e) => db1Events.push(e))
			db2.onChange((e) => db2Events.push(e))

			// Force both open
			await db1.store('items').get('test')
			await db2.store('items').get('test')

			// Change from db1
			await db1.store('items').set({ id: 'from1', name: 'From 1', value: 1 })
			await delay(50)

			// Change from db2
			await db2.store('items').set({ id: 'from2', name: 'From 2', value: 2 })
			await delay(50)

			// db1 should have received remote event for 'from2'
			const db1Remote = db1Events.filter((e) => e.source === 'remote')
			expect(db1Remote.some((e) => e.keys?.includes('from2'))).toBe(true)

			// db2 should have received remote event for 'from1'
			const db2Remote = db2Events.filter((e) => e.source === 'remote')
			expect(db2Remote.some((e) => e.keys?.includes('from1'))).toBe(true)
		})
	})

	// ─── Edge Cases ──────────────────────────────────────────

	describe('edge cases', () => {
		it('handles channel close gracefully', async() => {
			await db1.store('items').set({ id: 'i1', name: 'Before close', value: 1 })

			// Close the database (which closes the channel)
			db1.close()

			// Should not throw
			expect(db1.isOpen()).toBe(false)
		})

		it('batch operations send single event', async() => {
			const receivedMessages: ChangeEvent[] = []
			const channel = new BroadcastChannel(`idb:${dbName}`)
			channel.onmessage = (e: MessageEvent<ChangeEvent>) => {
				receivedMessages.push(e.data)
			}

			await db1.store('items').set([
				{ id: 'i1', name: 'Item 1', value: 1 },
				{ id: 'i2', name: 'Item 2', value: 2 },
				{ id: 'i3', name: 'Item 3', value: 3 },
			])

			await delay(50)
			channel.close()

			// Should be a single event with all keys
			expect(receivedMessages).toHaveLength(1)
			expect(receivedMessages[0]?.keys).toHaveLength(3)
		})

		it('clear operation broadcasts', async() => {
			await db1.store('items').set([
				{ id: 'i1', name: 'Item 1', value: 1 },
				{ id: 'i2', name: 'Item 2', value: 2 },
			])

			const receivedMessages: ChangeEvent[] = []
			const channel = new BroadcastChannel(`idb:${dbName}`)
			channel.onmessage = (e: MessageEvent<ChangeEvent>) => {
				receivedMessages.push(e.data)
			}

			await db1.store('items').clear()

			await delay(50)
			channel.close()

			const clearEvent = receivedMessages.find((e) => e.type === 'clear')
			expect(clearEvent).toBeDefined()
		})
	})
})
