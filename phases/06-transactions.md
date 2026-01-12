# Phase 6: Transactions

> **Status:** ⏳ Pending  
> **Started:** —  
> **Target:** —  
> **Depends on:** Phase 5 (Query Builder) ⏳ Pending

## Objective

Implement explicit transaction control for multi-store atomic operations. By end of phase, users can perform coordinated reads and writes across multiple stores.

## Deliverables

| #   | Deliverable                                  | Status    | Assignee |
|-----|----------------------------------------------|-----------|----------|
| 6.1 | Transaction class implementation             | ⏳ Pending | —        |
| 6.2 | TransactionStore class (store within tx)     | ⏳ Pending | —        |
| 6.3 | `db.read()` method                           | ⏳ Pending | —        |
| 6.4 | `db.write()` method                          | ⏳ Pending | —        |
| 6.5 | Transaction durability options               | ⏳ Pending | —        |
| 6.6 | Transaction abort/commit control             | ⏳ Pending | —        |
| 6.7 | Transaction state tracking (active/finished) | ⏳ Pending | —        |
| 6.8 | Unit tests for all above                     | ⏳ Pending | —        |

**Status Legend:**
- ✅ Done
- 🔄 Active
- ⏳ Pending

## Current Focus: 6.1 Transaction Class

### Requirements

1. Implement `TransactionInterface<Schema, K>` from types.ts
2. Wrap native IDBTransaction
3. Track transaction state (active, finished)
4. Provide store access within transaction scope
5. Support abort/commit control
6. Handle transaction errors properly

### Interface Contract

```typescript
// From src/types.ts
interface TransactionInterface<Schema extends DatabaseSchema, K extends keyof Schema> {
	readonly native: IDBTransaction
	
	getMode(): TransactionMode
	getStoreNames(): readonly string[]
	isActive(): boolean
	isFinished(): boolean
	
	store<S extends K & string>(name: S): TransactionStoreInterface<Schema[S]>
	
	abort(): void
	commit(): void
}

interface TransactionStoreInterface<T> {
	readonly native: IDBObjectStore
	
	get(key: ValidKey): Promise<T | undefined>
	get(keys: readonly ValidKey[]): Promise<readonly (T | undefined)[]>
	resolve(key: ValidKey): Promise<T>
	resolve(keys: readonly ValidKey[]): Promise<readonly T[]>
	set(value: T, key?: ValidKey): Promise<ValidKey>
	set(values: readonly T[]): Promise<readonly ValidKey[]>
	add(value: T, key?: ValidKey): Promise<ValidKey>
	add(values: readonly T[]): Promise<readonly ValidKey[]>
	remove(key: ValidKey): Promise<void>
	remove(keys: readonly ValidKey[]): Promise<void>
	all(query?: IDBKeyRange | null, count?: number): Promise<readonly T[]>
	keys(query?: IDBKeyRange | null, count?: number): Promise<readonly ValidKey[]>
	clear(): Promise<void>
	count(query?: IDBKeyRange | ValidKey | null): Promise<number>
	index(name: string): IndexInterface<T>
	openCursor(options?: CursorOptions): Promise<CursorInterface<T> | null>
	openKeyCursor(options?: CursorOptions): Promise<KeyCursorInterface | null>
}
```

### Implementation Checklist

- [ ] Create `src/core/Transaction.ts`
- [ ] Implement TransactionInterface wrapper
- [ ] Track state with #active and #finished flags
- [ ] Implement accessor methods
- [ ] Implement `store()` returning TransactionStoreInterface
- [ ] Create `src/core/TransactionStore.ts`
- [ ] Implement all store operations bound to transaction
- [ ] Implement `abort()` calling native abort
- [ ] Implement `commit()` calling native commit (if available)
- [ ] Add `promisifyTransaction()` helper
- [ ] Implement `db.read()` method
- [ ] Implement `db.write()` method with options
- [ ] Add to barrel export

### Acceptance Criteria

```typescript
describe('Transaction', () => {
	describe('read', () => {
		it('provides consistent view across stores', async () => {
			await db.read(['users', 'settings'], async (tx) => {
				const user = await tx.store('users').get('u1')
				const settings = await tx.store('settings').get('prefs')
				// Both reads see same snapshot
			})
		})
	})

	describe('write', () => {
		it('commits on success', async () => {
			await db.write(['users'], async (tx) => {
				await tx.store('users').set({ id: 'u1', name: 'Alice' })
			})
			const user = await db.store('users').get('u1')
			expect(user?.name).toBe('Alice')
		})

		it('aborts on error', async () => {
			await db.store('users').set({ id: 'u1', name: 'Original' })
			await expect(db.write(['users'], async (tx) => {
				await tx.store('users').set({ id: 'u1', name: 'Changed' })
				throw new Error('Abort!')
			})).rejects.toThrow('Abort!')
			const user = await db.store('users').get('u1')
			expect(user?.name).toBe('Original') // Rolled back
		})

		it('supports durability option', async () => {
			await db.write(['users'], async (tx) => {
				await tx.store('users').set(user)
			}, { durability: 'relaxed' })
		})
	})

	describe('control', () => {
		it('can explicitly abort', async () => {
			await expect(db.write(['users'], async (tx) => {
				await tx.store('users').set({ id: 'u1', name: 'Test' })
				tx.abort()
			})).rejects.toThrow(TransactionError)
		})

		it('tracks active state', async () => {
			await db.write(['users'], async (tx) => {
				expect(tx.isActive()).toBe(true)
				expect(tx.isFinished()).toBe(false)
			})
		})
	})
})
```

### Blocked By

- Phase 5 must be complete

### Blocks

- Phase 7 (Reactivity) — transactions emit change events

## Notes

- `commit()` may not be available in all browsers
- Transaction becomes inactive after promise microtask
- Store operations must complete before tx auto-commits
- Consider adding transaction timeout handling
- Durability option passed to native transaction

## Phase Completion Criteria

All of the following must be true:

- [ ] All deliverables marked ✅ Done
- [ ] `npm run check` passes
- [ ] `npm run test` passes with >80% coverage on new code
- [ ] No `it.todo()` remaining in phase scope
- [ ] PLAN.md updated to show Phase 6 complete

