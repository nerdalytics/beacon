# tests/ — Beacon Test Suite

Native Node.js test runner (`node --test`). No external test framework.

## File Organization

| Category | Naming | Examples |
|----------|--------|---------|
| Core | `{primitive}-core.test.ts` | `state-core`, `effect-core`, `derive-core`, `batch-core` |
| Integration | `{feature1}-{feature2}.test.ts` | `state-effect`, `state-derive`, `batch-integration` |
| Behavior | Descriptive name | `infinite-loop`, `cyclic-dependency`, `cleanup` |

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

<!--— BEACON-START —>[Tests Index]
|root: ./tests
|IMPORTANT: Follow naming conventions and always dispose effects/derives in tests
|.:{state-core.test.ts,effect-core.test.ts,derive-core.test.ts,batch-core.test.ts,state-derive.test.ts,state-effect.test.ts,batch-integration.test.ts,cleanup.test.ts,cyclic-dependency.test.ts,infinite-loop.test.ts,STYLE_GUIDE.md,TEST_ORGANIZATION.md}
<!--— BEACON-END —>
