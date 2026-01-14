# IDBKeyRange Analysis & Implementation Improvement Ideas

> **Purpose:** Analysis of potential improvements to the IndexedDB wrapper based on deep understanding of IDBKeyRange and the package's philosophy of enhancing native APIs without abstracting them away.

---

## Current State Summary

The package currently provides excellent IDBKeyRange support through:

1. **WhereClauseInterface** — Maps fluent query methods directly to native IDBKeyRange operations:
   - `equals()` → `IDBKeyRange.only()`
   - `greaterThan()` → `IDBKeyRange.lowerBound(value, true)`
   - `greaterThanOrEqual()` → `IDBKeyRange.lowerBound(value, false)`
   - `lessThan()` → `IDBKeyRange.upperBound(value, true)`
   - `lessThanOrEqual()` → `IDBKeyRange.upperBound(value, false)`
   - `between()` → `IDBKeyRange.bound()`
   - `startsWith()` → `IDBKeyRange.bound(prefix, prefix + '\uffff')`
   - `anyOf()` → Multiple parallel queries with deduplication

2. **Direct IDBKeyRange exposure** — Methods like `all()`, `keys()`, and `count()` accept raw `IDBKeyRange` parameters, honoring the "enhance, don't abstract" philosophy.

3. **Helper utilities** — `startsWithRange()` and `isKeyRange()` in helpers.ts provide convenience without hiding the native API.

---

## Focused Improvement Ideas

### 1. Add `IDBKeyRange.includes()` Support to WhereClause

**Rationale:** IDBKeyRange has an `includes(key)` instance method that efficiently checks if a key falls within a range. This could enable a `contains()` method on queries.

**Current Gap:** No way to pre-filter based on whether a value would match an existing IDBKeyRange before iterating.

**Potential API:**
```typescript
// Check if a key would match the current range without fetching
const range = store.query().where('age').between(18, 65);
await range.includes(25); // true
await range.includes(15); // false
```

**Implementation Consideration:** This aligns with the philosophy of exposing native capabilities. The `IDBKeyRange.includes()` method is synchronous and O(1), making it efficient for validation before queries.

**Priority:** Low — niche use case, but aligns perfectly with the wrapper philosophy.

---

### 2. Expose IDBKeyRange Properties for Introspection

**Rationale:** Native IDBKeyRange exposes `lower`, `upper`, `lowerOpen`, and `upperOpen` properties. Currently these are not accessible through the QueryBuilder.

**Current Gap:** Users cannot inspect the bounds of a constructed query range.

**Potential API:**
```typescript
const query = store.query().where('age').between(18, 65);
const range = query.getRange(); // Returns IDBKeyRange | null

// Then users can inspect:
if (range) {
  console.log(range.lower, range.upper); // 18, 65
  console.log(range.lowerOpen, range.upperOpen); // false, false
}
```

**Implementation Consideration:** Add a `getRange()` method to QueryBuilderInterface that returns the underlying IDBKeyRange. This maintains transparency to native types.

**Priority:** Medium — useful for debugging and advanced use cases.

---

### 3. Add `noneOf()` / `notIn()` Method to WhereClause

**Rationale:** While `anyOf()` handles "match any of these values", there's no inverse operation.

**Current Gap:** Cannot efficiently query "all records where status is NOT in ['deleted', 'archived']".

**Potential API:**
```typescript
const active = await store.query()
  .where('status').noneOf(['deleted', 'archived'])
  .toArray();
```

**Implementation Consideration:** This cannot use native IDBKeyRange (no "not in" concept) and would require filter-based fallback. Document this clearly in TSDoc as a convenience method that uses post-cursor filtering.

**Priority:** Medium — common use case, but must be clearly documented as less efficient than positive queries.

---

### 4. Add Range Factory Helpers for Common Patterns

**Rationale:** Some IDBKeyRange patterns are common but verbose.

**Current Gap:** No convenience for "last N days" or "today's records" which require Date-based ranges.

**Potential API in helpers.ts:**
```typescript
/**
 * Creates an IDBKeyRange for dates within the last N days.
 *
 * @param days - Number of days to look back (max 3650 to prevent overflow)
 * @returns IDBKeyRange from (now - days) to now
 */
export function lastDaysRange(days: number): IDBKeyRange {
  if (days < 0 || days > 3650) {
    throw new Error('days must be between 0 and 3650');
  }
  const now = Date.now();
  const start = now - (days * 86400000); // 86400000 = 24 * 60 * 60 * 1000
  return IDBKeyRange.bound(start, now);
}

/**
 * Creates an IDBKeyRange for today only (midnight to end of day).
 * Uses exclusive upper bound for precision.
 */
export function todayRange(): IDBKeyRange {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfNextDay = startOfDay + 86400000;
  return IDBKeyRange.bound(startOfDay, startOfNextDay, false, true); // exclusive upper
}
```

**Implementation Consideration:** Add to helpers.ts alongside `startsWithRange()`. Export from index.ts. These are pure helper functions that return native IDBKeyRange — fully aligned with package philosophy.

**Priority:** Low — convenience utilities that don't add core functionality.

---

### 5. Optimize `anyOf()` for Single Values

**Rationale:** When `anyOf([singleValue])` is called, it currently goes through the anyOf execution path with Map deduplication, which is overkill.

**Current Gap:** Minor performance inefficiency.

**Potential Fix:**
```typescript
anyOf(values: readonly ValidKey[]): QueryBuilderInterface<T> {
  // Optimize single value to use IDBKeyRange.only()
  if (values.length === 1 && values[0] !== undefined) {
    return new QueryBuilder<T>(this.#context, {
      ...this.#state,
      range: IDBKeyRange.only(values[0]),
    });
  }
  
  return new QueryBuilder<T>(this.#context, {
    ...this.#state,
    anyOfValues: values,
  });
}
```

**Priority:** Low — micro-optimization.

---

### 6. Add `endsWith()` to WhereClauseInterface

**Rationale:** While `startsWith()` maps efficiently to IDBKeyRange.bound(), there's no `endsWith()`.

**Current Gap:** Cannot query "all emails ending with @gmail.com".

**Potential API:**
```typescript
const gmailUsers = await store.query()
  .where('email').endsWith('@gmail.com')
  .toArray();
```

**Implementation Consideration:** This CANNOT use native IDBKeyRange (no suffix matching in IndexedDB). Must be implemented as filter-based fallback. Document clearly in TSDoc that this uses post-cursor filtering and is O(n).

**Priority:** Medium — very common use case, but must be transparent about performance implications.

---

### 7. Consider Adding `contains()` / `like()` Methods

**Rationale:** Full-text substring search is a very common need.

**Current Gap:** Must use `.filter(u => u.name.includes('search'))` which requires knowledge of the filter API.

**Potential API:**
```typescript
const results = await store.query()
  .where('name').contains('alice')
  .toArray();
```

**Implementation Consideration:**
- Cannot use IDBKeyRange (IndexedDB has no LIKE operator)
- Would be pure filter-based fallback
- Must be clearly documented as O(n) table scan
- Consider not adding to avoid users assuming index efficiency

**Priority:** Low — may conflict with package philosophy of not hiding performance characteristics.

**Alternative:** Keep as `.filter()` which makes the performance cost obvious.

---

### 8. Document IDBKeyRange Passing for Advanced Users

**Rationale:** The package already supports passing raw `IDBKeyRange` to `all()`, `keys()`, `count()`, and cursor methods. This isn't prominently documented.

**Current Gap:** Advanced users may not realize they can create custom ranges.

**Potential Enhancement:** Add documentation/examples showing:
```typescript
// Custom compound range
const customRange = IDBKeyRange.bound(
  [2024, 1],  // January 2024
  [2024, 12], // December 2024
);
const records = await store.all(customRange);

// Using IDBKeyRange directly with cursors
for await (const item of store.iterate({ query: customRange })) {
  // ...
}
```

**Priority:** Medium — documentation enhancement aligns with transparency philosophy.

---

## Recommendations Summary

| Idea | Priority | Effort | Aligns with Philosophy |
|------|----------|--------|------------------------|
| `getRange()` introspection | Medium | Low | ✅ Yes — exposes native type |
| Date range helpers | Low | Low | ✅ Yes — returns native IDBKeyRange |
| `anyOf()` single-value optimization | Low | Low | ✅ Yes — performance improvement |
| `noneOf()` method | Medium | Medium | ⚠️ Partial — filter-based fallback |
| `endsWith()` method | Medium | Low | ⚠️ Partial — filter-based fallback |
| `contains()` method | Low | Low | ❌ Risky — hides O(n) performance |
| IDBKeyRange documentation | Medium | Low | ✅ Yes — transparency |
| `includes()` support | Low | Low | ✅ Yes — exposes native capability |

---

## Key Principle Reminders

The package philosophy is to **enhance native IndexedDB without abstracting it away**. Any improvements should:

1. **Expose native types** — Return `IDBKeyRange` where possible, not wrapper objects
2. **Be transparent about performance** — If a method uses filter fallback (O(n)), document it clearly
3. **Keep methods honest** — Don't add SQL-like methods that imply index efficiency when they use table scans
4. **Enable advanced users** — Allow raw `IDBKeyRange` passing for custom scenarios
5. **Zero dependencies** — All helpers use native APIs only

---

## Non-Goals

These should NOT be implemented as they conflict with package philosophy:

- ❌ Custom query language/DSL that hides IDBKeyRange
- ❌ Full-text search abstraction (use dedicated full-text solutions)
- ❌ SQL-like syntax that implies relational capabilities
- ❌ Query result caching (users should manage their own cache)
- ❌ Compound index auto-generation (schema is user's responsibility)

---

*End of Analysis*
