# Prompts

Copy-paste prompts for AI-assisted development. Each section contains ready-to-use prompts.

---

## Start Project

```
Starting new project: [Name]

**What:** [One sentence]
**Environment:** browser / node / isomorphic
**Type:** library / application / cli

MVP scope:
- [Feature 1]
- [Feature 2]
- [Feature 3]

Please:
1. Read `.github/copilot-instructions.md`
2. Create PLAN.md with architecture and phases
3. Create phases/01-foundation.md with deliverables
4. Propose initial types for src/types.ts

Do NOT write implementation code yet.
```

---

## Continue

```
Continuing [Project Name].

Read PLAN.md and the active phase file.
Summarize: phase, deliverable, progress, next task.
Propose how to proceed. Wait for confirmation.
```

**Quick resume:**
```
Continue [Project Name]. Read PLAN.md, confirm status, proceed.
```

**Context recovery:**
```
Reset context. Read PLAN.md, active phase file, src/types.ts, src/factories.ts.
Report: what exists, what's in progress, what's next.
```

---

## Implement

```
Implement deliverable [X.Y]: [Name]

1. Check src/types.ts for required interfaces
2. Create types if needed
3. Implement in src/core/[domain]/
4. Extract helpers/constants to centralized files
5. Add factory to src/factories.ts
6. Update src/index.ts exports
7. Create tests
8. Run: npm run check; npm run format; npm test
9. Update phase file checklist
```

**Types only:**
```
For [X.Y], implement ONLY types in src/types.ts. No implementation yet.
```

**Tests first:**
```
For [X.Y], write tests first. Show me tests, then implement to pass them.
```

---

## Refactor

```
Refactor [file/component] to [goal].

Constraints:
- No behavior changes
- All tests must pass
- Run quality gates after

Show approach first, wait for approval.
```

---

## Analyze

```
Analyze [file/component/codebase].

Report:
- Purpose and responsibilities
- Public API surface
- Dependencies
- Potential issues
- Improvement suggestions
```

**Find issues:**
```
Find potential issues in [scope]: bugs, type safety, edge cases, performance.
```

---

## Debug

```
Debug: [describe the problem]

Expected: [what should happen]
Actual: [what happens instead]
Error: [error message if any]

Investigate and fix. Run tests after.
```

---

## Complete Phase

```
Complete Phase [X].

1. Verify all deliverables done
2. Run all quality gates
3. Update phase file status to ✅ Done
4. Create phases/[XX]-[next].md
5. Update PLAN.md phase table
```

---

## End Session

```
End session.

1. Run quality gates
2. Update PLAN.md session state
3. List files to commit
4. Note any blockers for next session
```

---

## Quality Gates

Run after every deliverable:
```powershell
npm run check; npm run format; npm test
```

---

## Reminders

Copy these into prompts as needed:

**Read first:**
```
Read .github/copilot-instructions.md, PLAN.md, and the active phase file before proceeding.
```

**Types first:**
```
Define interfaces in src/types.ts before implementing.
```

**No internal definitions:**
```
Extract all types, helpers, constants to centralized files. Implementation files contain ONLY class implementations.
```

**Factory pattern:**
```
Required adapter is first parameter. Optional adapters are opt-in in options object.
```

**Batch operations:**
```
Use array overloads, not separate methods (execute, not executeAll).
```

**Naming:**
```
get() returns T | undefined. resolve() throws. all() for bulk retrieval.
```

**Wait for approval:**
```
Propose approach first. Wait for confirmation before implementing.
```

**Update tracking:**
```
Update phase file checklist and PLAN.md session state after each deliverable.
```
