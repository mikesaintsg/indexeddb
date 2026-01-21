# ActionLoop

> **Version 1.0.0** — Complete implementation with 231 tests passing

## 1. Executive Summary

ActionLoop is a **Predictive Procedural Action Loop System (PPALS)** that unites deterministic business procedures with adaptive predictions to guide users through complex, multistep workflows. The framework combines static rule enforcement with dynamic weight learning to deliver real-time, context-aware recommendations without violating business constraints.

**Core Architecture:**
- **ProceduralGraph**: Static, deterministic graph encoding all valid workflow transitions
- **PredictiveGraph**: Dynamic overlay tracking frequency, recency, and actor-specific weights
- **WorkflowEngine**: Runtime orchestrator executing the continuous observe-update-predict-recommend cycle

**Business Value:**
- **Accelerated User Journeys**: Reduce decision paralysis with contextual next-step recommendations
- **Maintained Compliance**: Predictions never violate ProceduralGraph rules
- **Adaptive Learning**: Workflows improve automatically as usage patterns emerge
- **Process Optimization**: Discover bottlenecks, loops, and automation opportunities
- **Sub-50ms Latency**: Real-time recommendations suitable for interactive UIs

**Installation:**
```bash
npm install @mikesaintsg/actionloop
```

---

## 2. Introduction & Motivation

Multistep processes often follow rigid procedures but still leave users guessing what to do next. Most workflow platforms force a choice between: 

- **Rigid Compliance**: Hard-coded flows that never break rules but feel brittle
- **Adaptive Intelligence**: Data-driven recommendations that improve UX but risk rule violations

ActionLoop's two-graph architecture delivers both.  The ProceduralGraph defines every allowed path to guarantee correctness. At runtime, the PredictiveGraph learns which transitions users take most often, ranking suggestions by frequency, recency, and context—while never proposing anything outside the static rules.

By integrating with the broader `@mikesaintsg` ecosystem, teams can combine workflow guidance with navigation, persistence, cross-tab synchronization, and other capabilities.

---

## 3. Architectural Overview

```text
┌─────────────────┐     ┌──────────────────┐     ┌────────────────────┐
│ ProceduralGraph │────▶│ PredictiveGraph  │────▶│  WorkflowEngine    │
│ (static rules)  │     │ (dynamic weights)│     │  recordTransition()│
└─────────────────┘     └──────────────────┘     │  predictNext()     │
         │                        │              └────────────────────┘
         │                        │                        │
         ▼                        ▼                        ▼
┌──────────────────────────────────────────────────────────────────────┐
│                   @mikesaintsg/actionloop                            │
│  WorkflowBuilder │ WorkflowValidator │ WorkflowAnalyzer              │
└──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     @mikesaintsg Ecosystem                           │
│  @mikesaintsg/navigation │ @mikesaintsg/broadcast │ @mikesaintsg/form│
│  @mikesaintsg/indexeddb  │ @mikesaintsg/storage   │ @mikesaintsg/rater│
└──────────────────────────────────────────────────────────────────────┘
```

**Package Contents:**

| Export                    | Purpose                                             |
|---------------------------|-----------------------------------------------------|
| `createProceduralGraph`   | Factory for static procedural graphs                |
| `createPredictiveGraph`   | Factory for dynamic weight overlays                 |
| `createWorkflowEngine`    | Runtime orchestration engine                        |
| `createWorkflowBuilder`   | Programmatic graph construction                     |
| `createWorkflowValidator` | Static analysis and compliance checks               |
| `createWorkflowAnalyzer`  | Loop detection, bottleneck analysis, SCC algorithms |

---

## 4. Theoretical Foundations

Every workflow is modeled as **interconnected subgraphs** (procedures). Each subgraph contains: 

- **Nodes**: Discrete user actions or system events
- **Transitions**:  Directed links defining legal moves between nodes
- **Loops**: Shared nodes across subgraphs enabling continuous workflows

The ProceduralGraph captures all valid action sequences.  The PredictiveGraph brings it to life by ranking outgoing transitions based on frequency, recency, and actor context. 

### Comparison to Other Models

| Model                 | Similarity                                        | Difference                                              |
|-----------------------|---------------------------------------------------|---------------------------------------------------------|
| Finite-State Machines | Deterministic transitions enforce valid paths     | Layer per-user weights and modular subgraphs            |
| Markov Chains         | Historical counts assign transition probabilities | Preserve strict determinism; no memoryless assumption   |
| Process Mining        | Derive workflow graphs from action logs           | Focus on real-time guidance, not retrospective analysis |
| Petri Nets            | Formal graph constructs for loops and branching   | Simplify concurrency for UI-driven recommendations      |

---

## 5. ProceduralGraph

The ProceduralGraph is the single source of truth for valid workflow moves. 

### Type Definitions

```typescript
interface Node {
  readonly id: string
  readonly label?:  string
  readonly metadata?:  Readonly<{
    availablePaths?:  readonly string[]
    isStart?: boolean
    isEnd?: boolean
  }>
}

interface Transition {
  readonly from: string
  readonly to:  string
  readonly weight:  number
  readonly actor:  'user' | 'system' | 'automation'
  readonly metadata?: Readonly<{
    guard?: string
    version?: string
    relevantPaths?: readonly string[]
  }>
}

interface Procedure {
  readonly id: string
  readonly actions: readonly string[]
  readonly metadata?: Readonly<{
    primaryPaths?: readonly string[]
  }>
}
```

### API

```typescript
import { createProceduralGraph } from '@mikesaintsg/actionloop'

const graph = createProceduralGraph({
  procedures,
  transitions,
  validateOnCreate: true,
})

graph.validate() // Returns validation results
```

### Modeling Guidelines

1. **Nodes**:  Tag start/end nodes; include path metadata for context
2. **Transitions**: Annotate with base weight, actor type, and guard conditions
3. **Procedures**: Model as connected subgraphs; share nodes to form loops
4. **Versioning**: Export definitions to JSON/YAML with version metadata

---

## 6. PredictiveGraph

The PredictiveGraph adapts over time while respecting ProceduralGraph constraints.

### Characteristics

- **Transition Weights**: Track frequency and recency per transition
- **Decay Rules**: Stale patterns fade via configurable half-life or EWMA
- **Cold-Start Seeding**: Preload common paths to avoid empty results
- **Actor Separation**: Maintain distinct weight tracks for user, system, and automation

### API

```typescript
import { createPredictiveGraph } from '@mikesaintsg/actionloop'

const predictive = createPredictiveGraph(proceduralGraph, {
  decayAlgorithm: 'ewma',
  decayFactor: 0.9,
  preloadRecords: [
    { from: 'login', to: 'dashboard', actor: 'user', count: 100 }
  ]
})

predictive.updateWeight('login', 'dashboard', 'user')
const weights = predictive.getWeights('login', 'user')
```

### Constraints

- Only overlays transitions defined in ProceduralGraph
- Timestamps drive decay—older events count for less
- Metadata must remain PII-free

---

## 7. PPALS Runtime Cycle

The Predictive Procedural Action Loop System runs a continuous four-step cycle:

```text
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌───────────┐
│ OBSERVE │────▶│ UPDATE  │────▶│ PREDICT │────▶│ RECOMMEND │
│         │     │ WEIGHTS │     │         │     │           │
└─────────┘     └─────────┘     └─────────┘     └───────────┘
     ▲                                                 │
     └─────────────────────────────────────────────────┘
```

1. **Observe**: Capture transition event with actor, timestamp, session, and path
2. **Update**: Apply decay-aware weight updates to PredictiveGraph
3. **Predict**: Merge static ProceduralGraph priorities with dynamic weights
4. **Recommend**: Return top-k valid actions in <50ms

### Constraints

- Weight updates only apply to ProceduralGraph-defined transitions
- Actor contexts maintain separate weight tracks
- ProceduralGraph is time-agnostic; session data lives in PredictiveGraph
- Must support concurrent access without corrupting state

---

## 8. WorkflowEngine

The WorkflowEngine bridges static rules and dynamic learning.

### API

```typescript
import { createWorkflowEngine } from '@mikesaintsg/actionloop'

const engine = createWorkflowEngine(proceduralGraph, predictiveGraph, {
  trackSessions: true,
  validateTransitions: true,
})

// Record a transition
engine.recordTransition('login', 'dashboard', {
  actor: 'user',
  sessionId: 'session-123',
  path: '/app/dashboard'
})

// Predict next actions
const recommendations = engine.predictNext('dashboard', {
  actor: 'user',
  sessionId: 'session-123',
  path: '/app/dashboard',
  count: 5
})
```

### Session Management

```typescript
interface SessionInfo {
  readonly id: string
  readonly actor: Actor
  readonly startTime: number
  readonly lastActivity: number
}

// Start a session
const session = engine.startSession('user')

// Get session info
const info = engine.getSession(session.id)

// End a session
engine.endSession(session.id, 'completed')
```

### Event Sourcing

- **Immutable Events**: Each transition creates an immutable event
- **Cross-Session Continuity**: Chains persist across session boundaries
- **Temporal Ordering**: Strict chronological order across all sessions
- **Chain Truncation**: Configurable strategies for memory optimization

---

## 9. Dynamic Graph Management

ActionLoop supports runtime graph loading, unloading, and serialization.

### Weight Management

```typescript
interface WeightEvictionPolicy {
  readonly strategy: 'lru' | 'frequency' | 'recency' | 'relevance' | 'composite'
  readonly thresholds: Readonly<{
    memoryLimit: number
    accessThreshold: number
    ageThreshold: number
  }>
  readonly preserveRules: readonly string[]
}
```

### Export/Import

```typescript
// Export predictive weights for persistence
const exported = predictiveGraph.export()
await saveToIndexedDB(exported)

// Import on cold start
const stored = await loadFromIndexedDB()
if (stored) {
  predictiveGraph.import(stored)
}
```

### Capabilities

- **Modular Procedures**: Load/unload procedure subgraphs dynamically
- **Relevance-Based Loading**: Only load weights relevant to current context
- **Incremental Updates**: Apply changes without full reconstruction
- **Conflict Resolution**: Handle local/remote definition conflicts

---

## 10. Development Toolchain

### WorkflowBuilder

Programmatic graph construction API.

```typescript
import { createWorkflowBuilder } from '@mikesaintsg/actionloop'

const builder = createWorkflowBuilder()
builder.addNode({ id: 'login', label: 'Login' })
builder.addNode({ id: 'dashboard' })
builder.addTransition({ from: 'login', to: 'dashboard', weight: 1, actor: 'user' })

const graph = builder.build()
const yaml = builder.toYAML()
```

### WorkflowValidator

Static analysis for structural integrity.

```typescript
import { createWorkflowValidator } from '@mikesaintsg/actionloop'

const validator = createWorkflowValidator(proceduralGraph)
const results = validator.runStaticChecks()
const dangling = validator.findDanglingNodes()
const unreachable = validator.findUnreachableNodes()
```

Integrate into CI pipelines to block invalid deployments.

### WorkflowAnalyzer

Batch and streaming analysis using graph algorithms.

```typescript
import { createWorkflowAnalyzer } from '@mikesaintsg/actionloop'

const analyzer = createWorkflowAnalyzer(proceduralGraph, predictiveGraph)
const loops = analyzer.findHotLoops()
const bottlenecks = analyzer.findBottlenecks()
const automationOpportunities = analyzer.findAutomationOpportunities()

// Context-aware analysis
const contextualAnalysis = analyzer.analyzeByContext({
  groupBy: ['actor', 'path'],
  timeRange: { start: Date.now() - 86400000, end: Date.now() }
})
```

**Algorithms:**
- **SCC Detection**: Kosaraju's and Tarjan's algorithms for strongly connected components
- **Edge Classification**: DFS-based tree, back, cross, and forward edge detection
- **Loop Analysis**: Hot loops, infinite loops, unproductive loops, hierarchical loops

---

## 11. Ecosystem Integration

ActionLoop integrates seamlessly with other `@mikesaintsg` packages:

### With @mikesaintsg/navigation

```typescript
import { createNavigation } from '@mikesaintsg/navigation'
import { createWorkflowEngine } from '@mikesaintsg/actionloop'

const engine = createWorkflowEngine(procedural, predictive)
const navigation = createNavigation({
  page: 'landing',
  guards: [
    async (to, from) => {
      // Validate transitions against workflow
      return engine.isValidTransition(from.page, to.page)
    },
  ],
  hooks: [
    (to, from) => {
      // Record successful transitions
      engine.recordTransition(from.page, to.page, context)
    },
  ],
})
```

### With @mikesaintsg/indexeddb

```typescript
import { createDatabase } from '@mikesaintsg/indexeddb'
import { createPredictiveGraph } from '@mikesaintsg/actionloop'

// Persist predictive weights
const database = await createDatabase({ name: 'workflow', version: 1 })
const store = database.store('weights')

// Save on interval
setInterval(async () => {
  const exported = predictiveGraph.export()
  await store.set({ id: 'current', ...exported })
}, 60000)

// Load on startup
const stored = await store.get('current')
if (stored) {
  predictiveGraph.import(stored)
}
```

### With @mikesaintsg/broadcast

```typescript
import { createBroadcast } from '@mikesaintsg/broadcast'

// Sync workflow state across tabs
const broadcast = createBroadcast({
  channel: 'workflow-sync',
  state: { currentNode: 'landing' },
})

engine.onTransition((from, to, ctx) => {
  broadcast.setState({ currentNode: to })
})
```

---

## 12. TypeScript Implementation Example

```typescript
import {
  createProceduralGraph,
  createPredictiveGraph,
  createWorkflowEngine,
  type Actor,
  type Transition,
} from '@mikesaintsg/actionloop'

// Define transitions
const transitions: readonly Transition[] = [
  { from: 'login', to: 'dashboard', weight: 1, actor: 'user' },
  { from: 'dashboard', to: 'profile', weight: 1, actor: 'user' },
  { from: 'dashboard', to: 'settings', weight: 1, actor: 'user' },
  { from: 'profile', to: 'dashboard', weight: 1, actor: 'user' },
  { from: 'settings', to: 'dashboard', weight: 1, actor: 'user' },
  { from: 'dashboard', to: 'logout', weight: 1, actor: 'system' },
]

// Define procedures
const procedures = [
  { id: 'auth', actions: ['login', 'logout'] },
  { id: 'navigation', actions: ['dashboard', 'profile', 'settings'] },
]

// Build graphs
const procedural = createProceduralGraph({ procedures, transitions })
const predictive = createPredictiveGraph(procedural)
const engine = createWorkflowEngine(procedural, predictive)

// Start session
const session = engine.startSession('user')

// Record user behavior
engine.recordTransition('login', 'dashboard', {
  actor: 'user',
  sessionId: session.id,
  path: '/app/dashboard'
})

// Get recommendations
const nextActions = engine.predictNext('dashboard', {
  actor: 'user',
  sessionId: session.id,
  path: '/app/dashboard',
  count: 3
})

console.log('Recommended actions:', nextActions)
// ['profile', 'settings', 'logout']
```

---

## 13. Graph Visualization

```text
         [login]
            │
       user │ weight: 1
            ▼
      ┌──[dashboard]──┐
      │       │       │
 user │  user │  system│
      ▼       ▼       ▼
 [profile] [settings] [logout]
      │       │
 user │  user │
      └───────┴───────▶ [dashboard]
                          (loop)
```

- Solid lines: User-driven transitions
- Dashed lines: System-driven transitions
- Numbers: Base ProceduralGraph weights (PredictiveGraph adjusts dynamically)

---

## 14. Restrictions & Constraints

- **Zero External Dependencies**: Pure TypeScript ES modules
- **Cross-Platform**: Browser and Node.js without polyfills
- **PII-Free Metadata**: No personally identifiable information in graph data
- **Deterministic Predictions**: Never violate ProceduralGraph rules
- **Latency Requirements**: <50ms for interactive UI recommendations
- **Thread Safety**: Support concurrent access without state corruption

---

## 15. Development Guidelines

### TypeScript Standards

- Use `readonly` for parameters and return types
- Avoid `any` and non-null assertions
- Write user-defined type guards with `is` prefix
- Validate at edges (accept `unknown`, narrow, then use)
- Named exports only; no default exports

### Naming Conventions

| Category     | Prefixes                                     |
|--------------|----------------------------------------------|
| Accessors    | `get`, `peek`, `at`, `has`, `is`             |
| Mutators     | `set`, `update`, `append`, `remove`, `clear` |
| Transformers | `to`, `as`, `clone`                          |
| Constructors | `from`, `create`, `of`                       |
| Lifecycle    | `destroy`                                    |
| Events       | `on` (return cleanup function `() => void`)  |

### Quality Gates

```bash
npm run build      # Zero TypeScript errors
npm run test       # All tests pass
npm run format     # Code formatted
npm run check      # Strict type compliance
```

---

## 16. Roadmap

- **Multi-Tenant Graphs**: Isolated customer graphs with real-time replication
- **Automated Loop Resolution**: LLM and robotic agent integration for loop exits
- **Graph Compression**: Archive low-traffic paths dynamically
- **Guard Conditions**: Rich prerequisite validation with UI gating
- **Monitoring & Observability**: Standardized event schemas and dashboard templates
- **UI Components**: Framework-agnostic components for displaying recommendations

---

## 17. Glossary

| Term                | Definition                                                                                 |
|---------------------|--------------------------------------------------------------------------------------------|
| **PPALS**           | Predictive Procedural Action Loop System—continuous observe-update-predict-recommend cycle |
| **ProceduralGraph** | Static map of valid transitions (deterministic rules)                                      |
| **PredictiveGraph** | Dynamic overlay of per-transition weights (adaptive learning)                              |
| **WorkflowEngine**  | Runtime orchestrator bridging graphs and UI                                                |
| **Transition**      | Directed link from one node to another with weight and actor                               |
| **Actor**           | Entity performing action: `user`, `system`, or `automation`                                |
| **SCC**             | Strongly Connected Component—circuit in the graph                                          |
| **Guard**           | Precondition expression that must evaluate true for transition                             |

---

## 18. Conclusion

ActionLoop unites deterministic business rules with adaptive, data-driven guidance. By defining every valid transition in a ProceduralGraph and overlaying dynamic weights in a PredictiveGraph, teams deliver workflows that are both reliable and intuitive.

The package provides a complete toolkit—from graph construction and validation to runtime orchestration and pattern analysis—all within a single, zero-dependency TypeScript module that integrates seamlessly with the broader `@mikesaintsg` ecosystem.

**Getting Started:**
1. Install `@mikesaintsg/actionloop`
2. Define your ProceduralGraph with procedures and transitions
3. Create the PredictiveGraph overlay for adaptive learning
4. Initialize the WorkflowEngine and record first transitions
5. Display predictions in your UI
6. Use the WorkflowAnalyzer to discover optimization opportunities
