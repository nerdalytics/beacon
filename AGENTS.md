# Beacon

@nerdalytics/beacon — lightweight reactive state management for Node.js backends.

## Quick Commands

| Command | Purpose |
|---------|---------|
| `npm test` | Run all tests (native Node.js test runner) |
| `npm run test:core` | Run core API tests only |
| `npm run test:integration` | Run integration tests |
| `npm run test:behavior` | Run behavior/edge-case tests |
| `npm run test:coverage` | Run tests with coverage reporting |
| `npm run build` | Build LTS dist (tsc + uglify) |
| `npm run format` | Format with Biome |
| `npm run lint` | Lint with Biome |
| `npm run check` | Run all Biome checks |
| `npm run benchmark` | Run performance benchmarks |

## Architecture

Single-file core: `src/index.ts` (900 lines). Zero external dependencies. Proxy-based reactive system.

**Exports:**
- `state<T extends object>(initial: T, hooks?: StateHooks<T>): T` — Proxy-wrapped reactive objects with per-property tracking
- `effect(fn: EffectCallback, name?: EffectName, hooks?: EffectHooks): Unsubscribe` — side effects with automatic dependency tracking
- `derive<T>(fn: () => T, hooks?: DeriveHooks<T>): ComputedValue<T>` — eagerly-computed values, returns `{ value, reactive }`, requires disposal
- `batch<T>(fn: () => T, hooks?: BatchHooks): T` — groups updates, flushes effects once at outermost batch boundary

**Key behaviors:**
- Dependency tracking via WeakMaps + Symbols at the property level
- Nested objects automatically wrapped in Proxies (deep reactivity)
- Infinite loop detection: throws if effect writes to a state property it reads from
- Cyclic dependencies between different effects: allowed via queue-based non-recursive `flushEffects`
- Array mutating methods intercepted: `push`, `pop`, `shift`, `unshift`, `splice`, `sort`, `reverse`
- Frozen/sealed objects: fallback to WeakMap storage
- `derive()` must be disposed to prevent memory leaks (creates internal state + effect pair)

## Versioning

Epoch Semantic Versioning: `{EPOCH * 1000 + MAJOR}.MINOR.PATCH`
- Current: v1000.2.3

Commit format: `<type>(<scope>): <summary>` — imperative, present tense, no period, under 72 chars.
Types: `epoch`, `breaking`, `feat`, `fix`, `perf`, `refactor`, `style`, `test`, `docs`, `chore`
Scopes: `state`, `derive`, `effect`, `batch`, `core`, `api`, `assets`

## Branching

- Main branch: `trunk` (NOT main/master)
- PRs target `trunk`

## Tooling

- **Runtime**: Node.js >= 20.0.0 (mise-managed)
- **TypeScript**: strict mode, ESNext target, NodeNext modules
- **Linter/Formatter**: Biome — tabs, 120 line width, LF, single quotes, semicolons asNeeded, trailing commas es5, bracket spacing on, arrow parens always
- **Key lint rules**: `noExplicitAny: error`, `useExplicitType: error`, `noConsole: error` (allow: error/warn/dir/info/debug/table/time/timeEnd/timeLog/trace), `noAccumulatingSpread: error`, `useSortedKeys: on`, `useSortedProperties: on`, `useConsistentArrayType: shorthand`
- **Tests**: Native Node.js test runner (`node --test`), no external framework
- **Coverage**: 100% branches, 100% functions, 90% lines (configured in `node.config.json`)
- **Build**: `tsc -p tsconfig.lts.json` → `uglify-js` → `dist/src/index.min.js`
- **CI**: GitHub Actions — build on Node 24, test LTS on Node 20 + 22, publish to npm on trunk push

## .gitignore

Whitelist approach: ignores everything by default (`*`), explicitly allows specific directories and files. Markdown files (`**/*.md`) are allowed anywhere.

## Hooks System

Zero-cost instrumentation. All four primitives accept an optional hooks parameter as their last argument. Types in `src/types.ts`, composition utility in `src/hooks/`. See `docs/README.hooks.md` for the full API reference.

## Key Root Files

| File | Purpose |
|------|---------|
| `TECHNICAL_DETAILS.md` | Internal implementation details, migration guide v1000→v2000 |
| `CONTRIBUTING.md` | Contribution guidelines, commit message format |
| `DEVELOPER_GUIDE.md` | Setup, architecture overview, release process |
| `HOOKS.md` | Hooks architecture overview |
| `HOOKS_API.md` | Hook interface definitions |
| `HOOKS_CATALOG.md` | Built-in hook catalog |
| `HOOKS_TODO.md` | Hooks implementation roadmap |

<!--— BEACON-START —>[Beacon Index]
|root: .
|IMPORTANT: Read docs/AGENTS.md before writing code that uses Beacon APIs. Read folder AGENTS.md before working in that domain.
|docs/:{AGENTS.md,README.md,README.state.md,README.effect.md,README.derive.md,README.batch.md,README.core.md,README.debugging.md,README.hooks.md}
|src/:{AGENTS.md,index.ts,types.ts}
|src/hooks/:{AGENTS.md,index.ts,compose.ts}
|tests/:{AGENTS.md}
|scripts/:{naiv-benchmark.ts,run-lts-tests.js}
|.github/workflows/:{build-test-publish.yml,update-dependencies-cache.yml}
|assets/:{beacon-logo-v2.svg,beacon-logo.svg}
<!--— BEACON-END —>
