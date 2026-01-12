# Phase 5: Query Builder

> **Status:** ⏳ Pending  
> **Started:** —  
> **Target:** —  
> **Depends on:** Phase 4 (Indexes & Cursors) ⏳ Pending

## Objective

Implement the fluent query builder that maps to IndexedDB's IDBKeyRange operations. By end of phase, users can build complex queries with where clauses, filters, and pagination.

## Deliverables

| # | Deliverable | Status | Assignee |
|---|-------------|--------|----------|
| 5.1 | QueryBuilder class implementation | ⏳ Pending | — |
| 5.2 | WhereClause class implementation | ⏳ Pending | — |
| 5.3 | `equals()` — IDBKeyRange.only() | ⏳ Pending | — |
| 5.4 | `greaterThan/lessThan` — bounds | ⏳ Pending | — |
| 5.5 | `between()` — IDBKeyRange.bound() | ⏳ Pending | — |
| 5.6 | `startsWith()` — string prefix | ⏳ Pending | — |
| 5.7 | `anyOf()` — multi-value queries | ⏳ Pending | — |
| 5.8 | `filter()` — post-cursor predicate | ⏳ Pending | — |
| 5.9 | `orderBy()`, `limit()`, `offset()` | ⏳ Pending | — |
| 5.10 | Terminal operations (toArray, first, count, keys) | ⏳ Pending | — |
| 5.11 | `iterate()` async generator | ⏳ Pending | — |
| 5.12 | Unit tests for all above | ⏳ Pending | — |

**Status Legend:**
- ✅ Done
- 🔄 Active
- ⏳ Pending

## Current Focus: 5.1 QueryBuilder Class

### Requirements

1. Implement `QueryBuilderInterface<T>` from types.ts
2. Fluent API with method chaining
3. `where()` uses native IDBKeyRange (fast)
4. `filter()` applies post-cursor (flexible)
5. Combine where + filter for best performance
6. Support pagination with limit/offset

### Interface Contract

```typescript
// From src/types.ts
interface QueryBuilderInterface<T> {
	where(keyPath: string): WhereClauseInterface<T>
	filter(predicate: (value: T) => boolean): QueryBuilderInterface<T>
	orderBy(direction: OrderDirection): QueryBuilderInterface<T>
	limit(count: number): QueryBuilderInterface<T>
	offset(count: number): QueryBuilderInterface<T>
	
	toArray(): Promise<readonly T[]>
	first(): Promise<T | undefined>
	count(): Promise<number>
	keys(): Promise<readonly ValidKey[]>
	iterate(): AsyncGenerator<T, void, unknown>
}

interface WhereClauseInterface<T> {
	equals(value: ValidKey): QueryBuilderInterface<T>
	greaterThan(value: ValidKey): QueryBuilderInterface<T>
	greaterThanOrEqual(value: ValidKey): QueryBuilderInterface<T>
	lessThan(value: ValidKey): QueryBuilderInterface<T>
	lessThanOrEqual(value: ValidKey): QueryBuilderInterface<T>
	between(lower: ValidKey, upper: ValidKey, options?: BetweenOptions): QueryBuilderInterface<T>
	startsWith(prefix: string): QueryBuilderInterface<T>
	anyOf(values: readonly ValidKey[]): QueryBuilderInterface<T>
}
```

### Implementation Checklist

- [ ] Create `src/core/QueryBuilder.ts`
- [ ] Implement QueryBuilder with internal state
- [ ] Track keyPath, range, filters, order, limit, offset
- [ ] Implement `where()` returning WhereClause
- [ ] Create `src/core/WhereClause.ts`
- [ ] Implement all WhereClause methods
- [ ] Map to IDBKeyRange operations
- [ ] Implement `filter()` accumulating predicates
- [ ] Implement `orderBy()` setting cursor direction
- [ ] Implement `limit()` and `offset()`
- [ ] Implement `toArray()` terminal operation
- [ ] Implement `first()` — limit(1).toArray()[0]
- [ ] Implement `count()` — cursor count with filters
- [ ] Implement `keys()` — key-only cursor
- [ ] Implement `iterate()` async generator
- [ ] Add Store.query() method
- [ ] Add to barrel export

### Acceptance Criteria

```typescript
describe('QueryBuilder', () => {
	describe('where', () => {
		it('equals uses IDBKeyRange.only', async () => {
			await store.set([
				{ id: 'u1', status: 'active' },
				{ id: 'u2', status: 'inactive' }
			])
			const results = await store.query()
				.where('status').equals('active')
				.toArray()
			expect(results).toHaveLength(1)
			expect(results[0].id).toBe('u1')
		})

		it('between uses IDBKeyRange.bound', async () => {
			await store.set([
				{ id: 'u1', age: 20 },
				{ id: 'u2', age: 30 },
				{ id: 'u3', age: 40 }
			])
			const results = await store.query()
				.where('age').between(25, 35)
				.toArray()
			expect(results).toHaveLength(1)
		})

		it('startsWith matches prefix', async () => {
			await store.set([
				{ id: 'u1', name: 'Alice' },
				{ id: 'u2', name: 'Albert' },
				{ id: 'u3', name: 'Bob' }
			])
			const results = await store.query()
				.where('name').startsWith('Al')
				.toArray()
			expect(results).toHaveLength(2)
		})
	})

	describe('filter', () => {
		it('applies post-cursor predicate', async () => {
			const results = await store.query()
				.filter(u => u.email.endsWith('@gmail.com'))
				.toArray()
			// All results have gmail emails
		})
	})

	describe('combined', () => {
		it('uses index then filters', async () => {
			const results = await store.query()
				.where('status').equals('active')
				.filter(u => u.age >= 21)
				.limit(10)
				.toArray()
		})
	})
})
```

---

## anyOf Implementation

### Requirements

1. Run parallel queries for each value
2. Merge results by primary key (dedupe)
3. Apply filters after merge
4. Return in consistent order

### Implementation Strategy

```typescript
async function anyOf<T>(
	index: IDBIndex,
	values: readonly ValidKey[]
): Promise<T[]> {
	const results = new Map<ValidKey, T>()
	
	await Promise.all(values.map(async (value) => {
		const items = await promisifyRequest(index.getAll(value))
		for (const item of items) {
			const key = extractPrimaryKey(item)
			results.set(key, item)
		}
	}))
	
	return Array.from(results.values())
}
```

### Blocked By

- Phase 4 must be complete

### Blocks

- Phase 6 (Transactions) — query builder used in transactions

## Notes

- Warn in console if where() keyPath has no index
- Cache index existence check
- Filter predicates accumulate (AND logic)
- Offset implemented by advancing cursor
- Consider query validation before execution

## Phase Completion Criteria

All of the following must be true:

- [ ] All deliverables marked ✅ Done
- [ ] `npm run check` passes
- [ ] `npm run test` passes with >80% coverage on new code
- [ ] No `it.todo()` remaining in phase scope
- [ ] PLAN.md updated to show Phase 5 complete

