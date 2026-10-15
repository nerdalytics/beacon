# tests/ — Beacon Test Suite

Native Node.js test runner (`node --test`). No external test framework.

## File Organization

| Category | Naming | Examples |
|----------|--------|---------|
| Core | `{primitive}-core.test.ts` | `state-core`, `effect-core`, `derive-core`, `batch-core` |
| Hooks | `{primitive}-hooks.test.ts` | `state-hooks`, `effect-hooks`, `derive-hooks`, `batch-hooks` |
| Hooks Utility | `hooks-{utility}.test.ts` | `hooks-compose` |
| Integration | `{feature1}-{feature2}.test.ts` | `state-effect`, `state-derive`, `batch-integration` |
| Behavior | Descriptive name | `infinite-loop`, `cyclic-dependency`, `cleanup`, `effect-scheduling`, `derive-async`, `settle-observation` |
| Property-based | `property-{invariant}.test.ts` | `property-cleanup`, `property-proxy-identity` (fast-check; see `PROPERTY_BASED_TESTING.md`) |

`npm test` passes `--test-skip-pattern="COMPONENT NAME"`, which skips any test named `COMPONENT NAME` (a placeholder name; no template file is checked in).

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

Default suite options are `{ concurrency: true, timeout: 1000 }`. Exceptions: `cyclic-dependency` runs with `concurrency: false`; `derive-async`, `effect-scheduling` and `settle-observation` use `{ concurrency: false, timeout: 2000 }`; `property-*` suites raise `timeout` to 30000.

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
| `npm test` | All tests (`tests/**/*.ts`) |
| `npm run test:coverage` | All tests with coverage, lcov written to `lcov.info` |
| `node --test tests/<file>.test.ts` | One file (there are no per-category scripts) |

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
| `derive-hooks.test.ts` | 8 | `onCompute`, `onCacheHit`, `onDispose`, `onError`, `onDependencyChange` |
| `batch-hooks.test.ts` | 6 | `onBatchStart`, `onBatchEnd`, `onBatchError`, nested depth |
| `hooks-compose.test.ts` | 7 | `composeHook` utility — undefined, single, array, forwarding, error isolation |

<!-- BEACON-START -->[Tests Index]|root: ./tests|IMPORTANT: Follow naming conventions and always dispose effects/derives in tests|.:{*.test.ts,PROPERTY_BASED_TESTING.md,biome.json}<!-- BEACON-END -->
