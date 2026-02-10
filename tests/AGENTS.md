# tests/ — Beacon Test Suite

Native Node.js test runner (`node --test`). No external test framework.

## File Organization

| Category | Naming | Examples |
|----------|--------|---------|
| Core | `{primitive}-core.test.ts` | `state-core`, `effect-core`, `derive-core`, `batch-core` |
| Hooks | `{primitive}-hooks.test.ts` | `state-hooks`, `effect-hooks`, `derive-hooks`, `batch-hooks` |
| Hooks Utility | `hooks-{utility}.test.ts` | `hooks-compose` |
| Integration | `{feature1}-{feature2}.test.ts` | `state-effect`, `state-derive`, `batch-integration` |
| Behavior | Descriptive name | `infinite-loop`, `cyclic-dependency`, `cleanup` |
| Property-Based | `property-{topic}.test.ts` | `property-array-mutations`, `property-same-value`, `property-proxy-identity` |

Template: `template.test.ts` — excluded via `--test-skip-pattern="COMPONENT NAME"`

## Test Structure

```typescript
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { state, effect, derive, batch } from '../src/index.ts'

describe('Feature Name', { concurrency: true, timeout: 1000 }, () => {
	it('does something specific', () => {
		// Arrange - Act - Assert
	})
})
```

All test suites use `{ concurrency: true, timeout: 1000 }`.

## Naming Conventions

- **State variables**: prefix with `$` — `$count`, `$user`, `$items`
- **Test descriptions**: present tense, active voice, start with verb — "tracks", "updates", "handles", "prevents"
- **Effect counters**: `let effectCount = 0` or `const results: T[] = []`

## Assertions

- `assert.strictEqual()` for primitives
- `assert.deepStrictEqual()` for objects/arrays
- `assert.throws()` for error cases
- No assertion messages unless test name is insufficient

## Code Style (Biome-enforced)

- Tabs for indentation
- Single quotes
- Semicolons: as needed (omit where possible)
- Trailing commas: es5
- Bracket spacing: on (e.g. `{ value: 0 }`)
- Import order: `node:assert/strict`, `node:test`, then `../src/index.ts`
- No `any` — use explicit types
- Sorted keys/properties in object literals

## Cleanup

Always dispose effects and derived values:

```typescript
const dispose = effect(() => { /* ... */ })
// ... test code ...
dispose()

const $computed = derive(() => /* ... */)
// ... test code ...
$computed.reactive = false
```

## Running Tests

| Command | Scope |
|---------|-------|
| `npm test` | All tests |
| `npm run test:core` | Core API tests (`*-core.test.ts`) |
| `npm run test:integration` | Integration tests (`state-*.test.ts`, `batch-integration`) |
| `npm run test:behavior` | Behavior tests (infinite-loop, cyclic-dependency, cleanup) |
| `npm run test:coverage` | All tests with coverage |

## Coverage Targets

Configured in `node.config.json`:
- Branches: 100%
- Functions: 100%
- Lines: 90%
- Includes: `src/**/*.ts`
- Excludes: `scripts/**/*.ts`

## Hooks Tests

Test hooks instrumentation for each primitive. Each file verifies backward compatibility (works without hooks), individual hook firing, and error isolation (hook errors never break core).

| File | Tests | Covers |
|------|-------|--------|
| `state-hooks.test.ts` | 12 | `onRead`, `onWrite`, `onDelete`, `onHas`, `onOwnKeys`, nested propagation, array methods, multiple hooks |
| `effect-hooks.test.ts` | 8 | `onRun`, `onDispose`, `onError`, `onDependencyAdd`, `onSchedule` |
| `derive-hooks.test.ts` | 7 | `onCompute`, `onCacheHit`, `onDispose`, `onError`, `onDependencyChange` |
| `batch-hooks.test.ts` | 6 | `onBatchStart`, `onBatchEnd`, `onBatchError`, nested depth |
| `hooks-compose.test.ts` | 7 | `composeHook` utility — undefined, single, array, forwarding, error isolation |

## Property-Based Tests

Randomized invariant testing for each primitive. Uses `fc` (fast-check) for property generation.

| File | Tests |
|------|-------|
| `property-array-mutations.test.ts` | Reactive array mutations preserve invariants |
| `property-same-value.test.ts` | Same-value optimization (Object.is) |
| `property-batch-dedup.test.ts` | Batch effect deduplication |
| `property-derive-consistency.test.ts` | Derive value consistency |
| `property-proxy-identity.test.ts` | Proxy identity invariants |
| `property-cleanup.test.ts` | Effect cleanup completeness |
| `property-infinite-loop.test.ts` | Infinite loop detection boundary |
| `property-deep-reactivity.test.ts` | Deep reactivity at arbitrary depths |
| `property-batch-error.test.ts` | Batch error recovery |
| `property-dynamic-deps.test.ts` | Dynamic dependency tracking |
| `property-frozen-sealed.test.ts` | Frozen/sealed object reactivity |

<!--— BEACON-START —>[Tests Index]
|root: ./tests
|IMPORTANT: Follow naming conventions and always dispose effects/derives in tests
|.:{state-core.test.ts,effect-core.test.ts,derive-core.test.ts,batch-core.test.ts,state-derive.test.ts,state-effect.test.ts,batch-integration.test.ts,cleanup.test.ts,cyclic-dependency.test.ts,infinite-loop.test.ts,state-hooks.test.ts,effect-hooks.test.ts,derive-hooks.test.ts,batch-hooks.test.ts,hooks-compose.test.ts,property-array-mutations.test.ts,property-same-value.test.ts,property-batch-dedup.test.ts,property-derive-consistency.test.ts,property-proxy-identity.test.ts,property-cleanup.test.ts,property-infinite-loop.test.ts,property-deep-reactivity.test.ts,property-batch-error.test.ts,property-dynamic-deps.test.ts,property-frozen-sealed.test.ts,README.md,STYLE_GUIDE.md,TEST_ORGANIZATION.md,PROPERTY_BASED_TESTING.md}
<!--— BEACON-END —>
