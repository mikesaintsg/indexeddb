# Phase [N]: [Phase Name]

> **Status:** ⏳ Pending | 🔄 In Progress | ✅ Complete
> **Started:** [YYYY-MM-DD]
> **Target:** [YYYY-MM-DD]
> **Depends on:** Phase [N-1] ([Name]) [Status]

## Objective

[What this phase accomplishes. By end of phase, the library should be functional for X use cases.]

## Deliverables

| # | Deliverable | Status | Assignee |
|---|-------------|--------|----------|
| [N].1 | [Deliverable 1] | ⏳ Pending | — |
| [N].2 | [Deliverable 2] | ⏳ Pending | — |
| [N].3 | [Deliverable 3] | ⏳ Pending | — |
| [N].4 | [Deliverable 4] | ⏳ Pending | — |
| [N].5 | Unit tests for all above | ⏳ Pending | — |

**Status Legend:**
- ✅ Done
- 🔄 Active
- ⏳ Pending

## Current Focus: [N].[X] [Deliverable Name]

### Requirements

1. [Requirement 1]
2. [Requirement 2]
3. [Requirement 3]

### Interface Contract

```typescript
// From src/types.ts — DO NOT MODIFY without updating this doc
export interface [InterfaceName] {
	[method1](): [ReturnType]
	[method2](): [ReturnType]
}
```

### Implementation Checklist

- [ ] Create `src/core/[domain]/[FileName].ts`
- [ ] Implement constructor with options
- [ ] Implement [method 1]
- [ ] Implement [method 2]
- [ ] Implement [method 3]
- [ ] Wire up subscription methods (if applicable)
- [ ] Add to barrel export

### Acceptance Criteria

```typescript
// This test must pass before marking [N].[X] complete
describe('[Component]', () => {
	it('[test case 1]', () => {
		// Test implementation
	})

	it('[test case 2]', () => {
		// Test implementation
	})
})
```

### Blocked By

[Nothing currently. | List blockers]

### Blocks

- [N].[Y] ([Deliverable]) — [reason]
- [N].[Z] ([Deliverable]) — [reason]

## Notes

- [Important implementation note 1]
- [Important implementation note 2]
- Remember: Use `#` private fields, not `private` keyword

## Phase Completion Criteria

All of the following must be true:

- [ ] All deliverables marked ✅ Done
- [ ] `npm run check` passes
- [ ] `npm run test` passes with >80% coverage on new code
- [ ] No `it.todo()` remaining in phase scope
- [ ] PLAN.md updated to show Phase [N] complete
