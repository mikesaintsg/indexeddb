# Phase 4: Indexes & Cursors

> **Status:** ✅ Complete  
> **Started:** 2026-01-12  
> **Completed:** 2026-01-12  
> **Depends on:** Phase 3 (Store Operations) ✅ Complete

## Objective

Implement index queries and cursor-based iteration with async generators. By end of phase, users can query by index and iterate efficiently over records.

## Deliverables

| #    | Deliverable                         | Status    | Assignee |
|------|-------------------------------------|-----------|----------|
| 4.1  | Index class implementation          | ✅ Done    | —        |
| 4.2  | Index get/resolve methods           | ✅ Done    | —        |
| 4.3  | Index getKey for primary key lookup | ✅ Done    | —        |
| 4.4  | Index bulk operations               | ✅ Done    | —        |
| 4.5  | Cursor class implementation         | ✅ Done    | —        |
| 4.6  | KeyCursor class implementation      | ✅ Done    | —        |
| 4.7  | Async generator `iterate()`         | ✅ Done    | —        |
| 4.8  | Async generator `iterateKeys()`     | ✅ Done    | —        |
| 4.9  | Store.index() accessor              | ✅ Done    | —        |
| 4.10 | openCursor/openKeyCursor methods    | ✅ Done    | —        |
| 4.11 | Unit tests for all above            | ✅ Done    | —        |

**Status Legend:**
- ✅ Done
- 🔄 Active
- ⏳ Pending

## Current Focus: 4.1 Index Class

### Requirements

1. Implement `IndexInterface<T>` from types.ts
2. Query by index key instead of primary key
3. Support get/resolve for index lookups
4. getKey returns primary key for index key
5. Expose `.native` property for IDBIndex

### Interface Contract

```typescript
// From src/types.ts
interface IndexInterface<T> {
	readonly native: IDBIndex
	getName(): string
	getKeyPath(): KeyPath
	isUnique(): boolean
	isMultiEntry(): boolean
	
	get(key: ValidKey): Promise<T | undefined>
	get(keys: readonly ValidKey[]): Promise<readonly (T | undefined)[]>
	
	resolve(key: ValidKey): Promise<T>
	resolve(keys: readonly ValidKey[]): Promise<readonly T[]>
	
	getKey(key: ValidKey): Promise<ValidKey | undefined>
	
	all(query?: IDBKeyRange | null, count?: number): Promise<readonly T[]>
	keys(query?: IDBKeyRange | null, count?: number): Promise<readonly ValidKey[]>
	count(query?: IDBKeyRange | ValidKey | null): Promise<number>
	
	query(): QueryBuilderInterface<T>
	iterate(options?: IterateOptions): AsyncGenerator<T, void, unknown>
	iterateKeys(options?: IterateOptions): AsyncGenerator<ValidKey, void, unknown>
	openCursor(options?: CursorOptions): Promise<CursorInterface<T> | null>
	openKeyCursor(options?: CursorOptions): Promise<KeyCursorInterface | null>
}
```

### Implementation Checklist

- [ ] Create `src/core/Index.ts`
- [ ] Implement constructor with store and index name
- [ ] Implement accessor methods
- [ ] Implement `get()` with single/array overloads
- [ ] Implement `resolve()` with NotFoundError
- [ ] Implement `getKey()` for primary key lookup
- [ ] Implement `all()`, `keys()`, `count()`
- [ ] Wire up to Store.index()
- [ ] Add to barrel export

### Acceptance Criteria

```typescript
describe('Index', () => {
	it('looks up by index key', async () => {
		await store.set({ id: 'u1', email: 'alice@test.com', name: 'Alice' })
		const user = await store.index('byEmail').get('alice@test.com')
		expect(user?.name).toBe('Alice')
	})

	it('getKey returns primary key', async () => {
		await store.set({ id: 'u1', email: 'alice@test.com', name: 'Alice' })
		const key = await store.index('byEmail').getKey('alice@test.com')
		expect(key).toBe('u1')
	})
})
```

---

## Cursor Implementation

### Requirements

1. Implement `CursorInterface<T>` with navigation and mutation
2. Implement `KeyCursorInterface` for key-only iteration
3. Navigation returns null at end
4. Mutation methods (update/delete) in readwrite transactions
5. Async generators for memory-efficient iteration

### Interface Contract

```typescript
// From src/types.ts
interface CursorInterface<T> {
	readonly native: IDBCursorWithValue
	getKey(): ValidKey
	getPrimaryKey(): ValidKey
	getValue(): T
	getDirection(): CursorDirection
	
	continue(key?: ValidKey): Promise<CursorInterface<T> | null>
	continuePrimaryKey(key: ValidKey, primaryKey: ValidKey): Promise<CursorInterface<T> | null>
	advance(count: number): Promise<CursorInterface<T> | null>
	
	update(value: T): Promise<ValidKey>
	delete(): Promise<void>
}
```

### Implementation Checklist

- [ ] Create `src/core/Cursor.ts`
- [ ] Implement CursorInterface wrapper
- [ ] Implement navigation methods returning new cursor or null
- [ ] Implement update/delete mutations
- [ ] Create `src/core/KeyCursor.ts`
- [ ] Implement KeyCursorInterface
- [ ] Implement `iterate()` async generator on Store
- [ ] Implement `iterateKeys()` async generator
- [ ] Implement `openCursor()` and `openKeyCursor()`
- [ ] Add to barrel export

### Acceptance Criteria

```typescript
describe('Cursor', () => {
	it('iterates with async generator', async () => {
		await store.set([{ id: 'u1' }, { id: 'u2' }])
		const ids: string[] = []
		for await (const user of store.iterate()) {
			ids.push(user.id)
		}
		expect(ids).toEqual(['u1', 'u2'])
	})

	it('supports early termination', async () => {
		await store.set([{ id: 'u1' }, { id: 'u2' }, { id: 'u3' }])
		let count = 0
		for await (const user of store.iterate()) {
			count++
			if (count === 1) break
		}
		expect(count).toBe(1)
	})

	it('can update during iteration', async () => {
		await db.write(['users'], async (tx) => {
			let cursor = await tx.store('users').openCursor()
			while (cursor) {
				await cursor.update({ ...cursor.getValue(), updated: true })
				cursor = await cursor.continue()
			}
		})
	})
})
```

### Blocked By

- Phase 3 must be complete

### Blocks

- Phase 5 (Query Builder) — uses cursors for iteration

## Notes

- Async generator uses `yield` inside cursor loop
- Handle cursor `null` to end iteration
- Cursor wrapper holds reference to native cursor
- Consider cleanup on early `break` from generator
- Index cursors share implementation with store cursors

## Phase Completion Criteria

All of the following must be true:

- [ ] All deliverables marked ✅ Done
- [ ] `npm run check` passes
- [ ] `npm run test` passes with >80% coverage on new code
- [ ] No `it.todo()` remaining in phase scope
- [ ] PLAN.md updated to show Phase 4 complete

