# Phase 7: Reactivity

> **Status:** ⏳ Pending  
> **Started:** —  
> **Target:** —  
> **Depends on:** Phase 6 (Transactions) ⏳ Pending

## Objective

Implement change events and cross-tab synchronization using BroadcastChannel. By end of phase, users can subscribe to data changes and sync across browser tabs.

## Deliverables

| #   | Deliverable                          | Status    | Assignee |
|-----|--------------------------------------|-----------|----------|
| 7.1 | DatabaseSubscriptions implementation | ⏳ Pending | —        |
| 7.2 | StoreSubscriptions implementation    | ⏳ Pending | —        |
| 7.3 | Change event emission on mutations   | ⏳ Pending | —        |
| 7.4 | BroadcastChannel integration         | ⏳ Pending | —        |
| 7.5 | Cross-tab sync (remote events)       | ⏳ Pending | —        |
| 7.6 | Error event subscription             | ⏳ Pending | —        |
| 7.7 | Version change event subscription    | ⏳ Pending | —        |
| 7.8 | Close event subscription             | ⏳ Pending | —        |
| 7.9 | Unit tests for all above             | ⏳ Pending | —        |

**Status Legend:**
- ✅ Done
- 🔄 Active
- ⏳ Pending

## Current Focus: 7.1 DatabaseSubscriptions

### Requirements

1. Implement `DatabaseSubscriptions` interface
2. `onChange()` — database-level change events
3. `onError()` — error events
4. `onVersionChange()` — upgrade notifications
5. `onClose()` — connection close events
6. All subscriptions return unsubscribe function

### Interface Contract

```typescript
// From src/types.ts
interface ChangeEvent {
	readonly storeName: string
	readonly type: 'set' | 'add' | 'remove' | 'clear'
	readonly keys: readonly ValidKey[]
	readonly source: 'local' | 'remote'
}

interface DatabaseSubscriptions {
	onChange(callback: ChangeCallback): Unsubscribe
	onError(callback: ErrorCallback): Unsubscribe
	onVersionChange(callback: VersionChangeCallback): Unsubscribe
	onClose(callback: () => void): Unsubscribe
}

interface StoreSubscriptions {
	onChange(callback: (event: ChangeEvent) => void): Unsubscribe
}
```

### Implementation Checklist

- [ ] Add listener sets to Database class
- [ ] Implement `onChange()` subscription
- [ ] Implement `onError()` subscription
- [ ] Implement `onVersionChange()` subscription
- [ ] Implement `onClose()` subscription
- [ ] Implement `StoreSubscriptions` on Store class
- [ ] Create private `#emitChange()` method
- [ ] Hook change emission into set/add/remove/clear
- [ ] Initialize BroadcastChannel in Database
- [ ] Broadcast local changes to channel
- [ ] Listen for remote changes from channel
- [ ] Mark event source as 'local' or 'remote'
- [ ] Clean up channel on close/destroy
- [ ] Add to barrel export

### Acceptance Criteria

```typescript
describe('Reactivity', () => {
	describe('onChange', () => {
		it('emits on set', async () => {
			const events: ChangeEvent[] = []
			db.onChange((e) => events.push(e))
			
			await db.store('users').set({ id: 'u1', name: 'Alice' })
			
			expect(events).toHaveLength(1)
			expect(events[0].type).toBe('set')
			expect(events[0].keys).toEqual(['u1'])
			expect(events[0].source).toBe('local')
		})

		it('emits on remove', async () => {
			const events: ChangeEvent[] = []
			db.onChange((e) => events.push(e))
			
			await db.store('users').remove('u1')
			
			expect(events[0].type).toBe('remove')
		})

		it('emits on clear', async () => {
			const events: ChangeEvent[] = []
			db.onChange((e) => events.push(e))
			
			await db.store('users').clear()
			
			expect(events[0].type).toBe('clear')
		})
	})

	describe('store-level', () => {
		it('only receives events for that store', async () => {
			const events: ChangeEvent[] = []
			db.store('users').onChange((e) => events.push(e))
			
			await db.store('posts').set({ id: 'p1', title: 'Hello' })
			await db.store('users').set({ id: 'u1', name: 'Alice' })
			
			expect(events).toHaveLength(1)
			expect(events[0].storeName).toBe('users')
		})
	})

	describe('unsubscribe', () => {
		it('stops receiving events', async () => {
			const events: ChangeEvent[] = []
			const unsubscribe = db.onChange((e) => events.push(e))
			
			await db.store('users').set({ id: 'u1' })
			unsubscribe()
			await db.store('users').set({ id: 'u2' })
			
			expect(events).toHaveLength(1)
		})
	})

	describe('cross-tab', () => {
		it('receives remote events via BroadcastChannel', async () => {
			// This test requires multi-tab simulation
			// Mark source as 'remote' for events from channel
		})
	})
})
```

### BroadcastChannel Implementation

```typescript
class Database<Schema> {
	#channel: BroadcastChannel | null = null
	#changeListeners = new Set<ChangeCallback>()

	constructor(options: DatabaseOptions<Schema>) {
		if (options.crossTabSync !== false) {
			this.#channel = new BroadcastChannel(`idb:${options.name}`)
			this.#channel.onmessage = (event) => {
				this.#emitChange({ ...event.data, source: 'remote' })
			}
		}
	}

	#emitChange(event: ChangeEvent): void {
		for (const callback of this.#changeListeners) {
			callback(event)
		}
	}

	#notifyChange(storeName: string, type: ChangeType, keys: ValidKey[]): void {
		const event: ChangeEvent = { storeName, type, keys, source: 'local' }
		this.#emitChange(event)
		this.#channel?.postMessage(event)
	}

	close(): void {
		this.#channel?.close()
		this.#db?.close()
	}
}
```

### Blocked By

- Phase 6 must be complete

### Blocks

- Phase 8 (Polish) — events integrated

## Notes

- BroadcastChannel is same-origin only
- Events posted after transaction commit
- Consider debouncing rapid changes
- Cross-tab tests may need special setup
- Clean up listeners on database close

## Phase Completion Criteria

All of the following must be true:

- [ ] All deliverables marked ✅ Done
- [ ] `npm run check` passes
- [ ] `npm run test` passes with >80% coverage on new code
- [ ] No `it.todo()` remaining in phase scope
- [ ] PLAN.md updated to show Phase 7 complete

