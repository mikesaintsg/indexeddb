# @mikesaintsg Ecosystem Instructions

> Concise, actionable constraints for the `@mikesaintsg` package ecosystem. All rules from `copilot-instructions.md` apply.

---

## Absolute Constraints

| Rule                | Requirement                                                        |
|---------------------|--------------------------------------------------------------------|
| **No `any`**        | Use `unknown` and narrow with type guards                          |
| **No `!`**          | Handle nullability explicitly                                      |
| **No `as`**         | Narrow from `unknown`, no unsafe casts                             |
| **No dependencies** | Native APIs only unless explicitly requested                       |
| **No re-exports**   | Types in `types.ts` only; `index.ts` is the only barrel            |
| **Symbols matter**  | Never remove unused code — implement it or add TODO                |
| **Types first**     | Define interfaces in `src/types.ts` before implementation          |

---

## File Placement

| Content             | Location                  |
|---------------------|---------------------------|
| Types/interfaces    | `src/types.ts`            |
| Helpers/type guards | `src/helpers.ts`          |
| Constants           | `src/constants.ts`        |
| Factory functions   | `src/factories.ts`        |
| Implementations     | `src/core/[domain].ts`    |
| Tests               | `tests/` (mirrors `src/`) |
| Barrel exports      | `src/index.ts`            |

**Implementation files contain ONLY class implementations.** Extract all types, helpers, and constants.

---

## Method Naming

### Prefixes

| Prefix       | Returns             | Use                         |
|--------------|---------------------|-----------------------------|
| `get`        | `T \| undefined`    | Optional lookup             |
| `resolve`    | `T` (throws)        | Required lookup             |
| `all`        | `readonly T[]`      | Bulk retrieval              |
| `is`, `has`  | `boolean`           | Existence/state check       |
| `create`     | instance            | Factory function            |
| `on`         | `Unsubscribe`       | Event subscription          |
| `destroy`    | `void`              | Cleanup entire resource     |
| `close`      | `void`              | Close connection (reopen)   |
| `drop`       | `void`              | Delete table/store          |

### Batch Operations

**Use array overloads, NOT separate methods:**

```typescript
// ✅ CORRECT
execute(call: ToolCall): Promise<ToolResult>
execute(calls: readonly ToolCall[]): Promise<readonly ToolResult[]>

// ❌ WRONG
execute(call: ToolCall): Promise<ToolResult>
executeAll(calls: readonly ToolCall[]): Promise<readonly ToolResult[]>
```

---

## Interface Naming

| Type                     | Suffix      | Example                    |
|--------------------------|-------------|----------------------------|
| Behavioral (has methods) | `Interface` | `EngineInterface`          |
| Data-only                | None        | `Message`, `Document`      |
| Subscriptions            | None        | `EngineSubscriptions`      |
| Options                  | None        | `EngineOptions`            |

---

## Factory Pattern

**Required adapter is ALWAYS the first parameter:**

```typescript
// ✅ CORRECT
createEngine(provider, options?)
createVectorStore(embedding, options?)
createToolRegistry(formatAdapter, options?)
createContextBuilder(tokenAdapter, options)

// ❌ WRONG
createEngine({ provider: adapter })
```

**All optional adapters are opt-in** — nothing enabled by default.

---

## Package Architecture

### Package Overview

| Package            | Required First Param         |
|--------------------|------------------------------|
| `inference`        | `ProviderAdapterInterface`   |
| `vectorstore`      | `EmbeddingAdapterInterface`  |
| `contextprotocol`  | `ToolFormatAdapterInterface` |
| `contextbuilder`   | `TokenCounterInterface`      |
| `rater`            | N/A                          |

### Interface Ownership

| Interface                      | Defined In | Implemented In |
|--------------------------------|------------|----------------|
| `EmbeddingAdapterInterface`    | `core`     | `adapters`     |
| `ToolFormatAdapterInterface`   | `core`     | `adapters`     |
| `RetryAdapterInterface`        | `core`     | `adapters`     |
| `RateLimitAdapterInterface`    | `core`     | `adapters`     |
| `ProviderAdapterInterface`     | `core`     | `adapters`     |
| `TokenCounterInterface`        | `core`     | `inference`    |
| `StreamHandleInterface`        | `core`     | `inference`    |
| `Message`, `GenerationOptions` | `core`     | —              |
| Persistence adapters           | `core`     | `adapters`     |

### Adapter Categories

| Category        | Purpose                | Examples                      |
|-----------------|------------------------|-------------------------------|
| **Source**      | Generate/retrieve data | Provider, Embedding           |
| **Persistence** | Store/load data        | IndexedDB, OPFS, HTTP         |
| **Transform**   | Transform formats      | ToolFormat, Token, Similarity |
| **Policy**      | Apply policies         | Retry, RateLimit              |
| **Enhancement** | Add capabilities       | Cache, Batch, Reranker        |

---

## Project Structure

```
src/
├── index.ts              # Barrel exports only
├── types.ts              # All types (SOURCE OF TRUTH)
├── helpers.ts            # Pure functions, type guards
├── constants.ts          # Immutable constants
├── factories.ts          # Factory functions
└── core/
    └── [Class].ts    	  # Implementation
tests/
├── setup.ts
└── core/
    └── [Class].test.ts
```

### Folder Rules

- **Nest related items** — Group by domain/category
- **Max 3-4 levels** — Don't over-nest
- **PascalCase** for class files: `Engine.ts`
- **camelCase** for function files: `helpers.ts`
- **Use barrel exports** — `index.ts` per folder

---

## Type Definition Order

```typescript
// 1. Imports
import type { Unsubscribe } from '@mikesaintsg/core'

// 2. Data interfaces (no suffix)
export interface Message { ... }

// 3. Subscriptions interface
export interface EngineSubscriptions { ... }

// 4. Options interface
export interface EngineOptions extends SubscriptionToHook<EngineSubscriptions> { ... }

// 5. Behavioral interface (with suffix)
export interface EngineInterface extends EngineSubscriptions { ... }

// 6. Factory function type
export type CreateEngine = (
	provider: ProviderAdapterInterface,
	options?: EngineOptions
) => EngineInterface
```

---

## Options Pattern

```typescript
export interface SystemOptions extends SubscriptionToHook<SystemSubscriptions> {
	// Required configuration
	readonly budget: TokenBudget

	// Opt-in adapters
	readonly persistence?: PersistenceAdapterInterface
	readonly retry?: RetryAdapterInterface
	readonly cache?: CacheAdapterInterface

	// Optional configuration
	readonly debug?: boolean
}
```

---

## Subscriptions Pattern

```typescript
// Interface
export interface SystemSubscriptions {
	onEvent(callback: (data: EventData) => void): Unsubscribe
}

// Options get hooks via SubscriptionToHook<T>
export interface SystemOptions extends SubscriptionToHook<SystemSubscriptions> {
	// onEvent?: (data: EventData) => void  ← auto-generated
}

// Implementation
class System {
	#listeners = new Set<(data: EventData) => void>()

	onEvent(callback: (data: EventData) => void): Unsubscribe {
		this.#listeners.add(callback)
		return () => this.#listeners.delete(callback)
	}
}
```

---

## Symbol Preservation

**NEVER remove symbols to satisfy linters.**

1. Check `types.ts` for interface contract
2. Implement the symbol if possible
3. Add TODO comment if blocked:

```typescript
// TODO: [Feature] Description of intended purpose
// Context: when to implement, dependencies
```

---

## Test Imports

**Use aliased package imports:**

```typescript
// ✅ CORRECT
import { createEngine } from '@mikesaintsg/inference'

// ❌ WRONG
import { createEngine } from '../../../src/factories.js'
```

---

## ESM Requirements

- Always use `.js` extensions in imports
- Named exports only (no default exports)
- Use `export type *` for types in barrel

---

## TypeScript Rules

- Use `#` private fields, not `private` keyword
- Prefer `readonly` in interfaces and return types
- Use `readonly T[]` over `T[]` in public APIs
- Constrain generics: `<T extends object>`
- Use discriminated unions with explicit discriminants

---

## Quality Commands

```powershell
npm run check    # Typecheck
npm run format   # Lint/fix
npm run build    # Build
npm test         # Tests
```

---

## Checklist

Before commit:

- [ ] Types in `src/types.ts` first
- [ ] Required adapter is first parameter
- [ ] Optional adapters are opt-in
- [ ] Batch operations use array overloads
- [ ] `get()` → `T | undefined`, `resolve()` → throws
- [ ] `all()` for bulk (not `getAll()`)
- [ ] Interface suffix for behavioral interfaces
- [ ] No `any`, `!`, or unsafe `as`
- [ ] ESM imports with `.js` extensions
- [ ] Tests use aliased imports
- [ ] All quality commands pass
