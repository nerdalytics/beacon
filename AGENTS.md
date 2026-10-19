# Beacon

@nerdalytics/beacon — lightweight reactive state management for Node.js backends.

## Quick Commands

| Command | Purpose |
|---------|---------|
| `npm test` | Run all tests (native Node.js test runner) |
| `npm run test:coverage` | Run tests with coverage, writes `lcov.info` |
| `npm run build` | Build dist (tsc + esbuild) |
| `npm run format` | Format with Biome |
| `npm run lint` | Lint with Biome |
| `npm run check` | Run all Biome checks (`check:fix` to apply) |
| `npm run benchmark` | Run performance benchmarks |

## Architecture

Single-file core: `src/index.ts` (~1400 lines). Zero external dependencies. Proxy-based reactive system.

**Exports:**
- `state<T extends object>(initial: T, hooks?: StateHooks<T>): T` — Proxy-wrapped reactive objects with per-property tracking
- `effect(fn: EffectCallback, name?: EffectName, hooks?: EffectHooks, options?: EffectOptions): Unsubscribe` — side effects with automatic dependency tracking; `options.schedule` is `'sync'` (default) or `'microtask'`
- `derive<T>(fn: () => T | Promise<T>, hooks?: DeriveHooks<T>): ComputedValue<T>` — eagerly-computed values, returns `{ value, pending, reactive }`, requires disposal; async results set `pending` until they settle, stale promises are dropped
- `batch<T>(fn: () => T, hooks?: BatchHooks): T` — groups updates, flushes effects once at outermost batch boundary
- `onSettled(callback: SettledCallback): Unsubscribe` — runs the callback each time the graph goes quiet after doing work
- `until<T>(predicate: () => T, options?: UntilOptions): Promise<T>` — resolves once the predicate is truthy with no derive pending; `timeout` and `signal` reject; throws inside a reactive scope
- Types: `Unsubscribe`, `EffectCallback`, `EffectName`, `ComputedValue`, `EffectSchedule`, `EffectOptions`, `UntilOptions`, `SettledCallback`
- Subpath `@nerdalytics/beacon/hooks`: hook types and `composeHook`

**Key behaviors:**
- Dependency tracking via WeakMaps + Symbols at the property level
- Nested objects automatically wrapped in Proxies (deep reactivity)
- Infinite loop detection: throws if effect writes to a state property it reads from (child effects and microtask effects are exempt; microtask re-runs stop after 100 chained microtask flushes with a `console.error`)
- Cyclic dependencies between different effects: allowed via queue-based non-recursive `flushEffects`
- Array mutating methods intercepted: `push`, `pop`, `shift`, `unshift`, `splice`, `sort`, `reverse`
- Frozen/sealed objects: fallback to WeakMap storage
- `derive()` must be disposed to prevent memory leaks (creates internal state + effect pair)

## Versioning

Epoch Semantic Versioning: `{EPOCH * 1000 + MAJOR}.MINOR.PATCH`
- Current: v2001.0.1 (`package.json` and `jsr.json` must match)

Commit format: `<type>(<scope>): <summary>` — imperative, present tense, no period, under 72 chars.
Types: `epoch`, `breaking`, `feat`, `fix`, `perf`, `refactor`, `style`, `test`, `docs`, `chore`
Scopes: `state`, `derive`, `effect`, `batch`, `core`, `api`, `assets`

## Branching

- Main branch: `trunk` (NOT main/master)
- PRs target `trunk`

## Tooling

- **Runtime**: Node.js >= 24.0.0 (mise-managed); CI tests 24.x, 26.x and latest
- **TypeScript**: strict mode, ESNext target, NodeNext modules
- **Linter/Formatter**: Biome — tabs, 120 line width, LF, single quotes, semicolons asNeeded, trailing commas es5, bracket spacing on, arrow parens always
- **Key lint rules**: `noExplicitAny: error`, `useExplicitType: error`, `noConsole: error` (allow: error/warn/dir/info/debug/table/time/timeEnd/timeLog/trace), `noAccumulatingSpread: error`, `useSortedKeys: on`, `useSortedProperties: on`, `useConsistentArrayType: shorthand`
- **Tests**: Native Node.js test runner (`node --test`), no external framework; `fast-check` for the `property-*` tests
- **Coverage**: 100% branches, 100% functions, 90% lines (configured in `node.config.json`)
- **Build**: `tsc -p tsconfig.build.json` → `esbuild` → `dist/src/index.min.js`
- **CI**: GitHub Actions — build on Node 24, test on Node 24/26/latest, publish to npm + JSR on trunk push (gated by version change)

## .gitignore

Whitelist approach: ignores everything by default (`*`), explicitly allows specific directories and files. Markdown files (`**/*.md`) are allowed anywhere.

## Hooks System

Zero-cost instrumentation. `state`, `derive` and `batch` take hooks as their last argument; `effect` takes them third, before `options`. Types in `src/types.ts`, composition utility in `src/hooks/`. See the [handbook](https://nerdalytics.github.io/beacon/) for the full API reference.

## Key Root Files

| File | Purpose |
|------|---------|
| `CONTRIBUTING.md` | Contribution guidelines, development setup, release process |
| `HOOKS_TODO.md` | Status-tracked hooks roadmap and catalog |

<!-- BEACON-START -->[Beacon Index]|root: .|IMPORTANT: Read folder AGENTS.md before working in that domain|src:{AGENTS.md}|src/hooks:{AGENTS.md}|tests:{AGENTS.md}|handbook:{AGENTS.md}|scripts:{benchmark.ts,README.md,biome.json}|.github:{dependabot.yml,ISSUE_TEMPLATE/,PULL_REQUEST_TEMPLATE/}|.github/workflows:{*.yml}|.github/scripts:{*.sh}|assets:{*.svg}|.:{package.json,jsr.json,biome.json,node.config.json,tsconfig.json,tsconfig.build.json,mise.toml,README.md,CONTRIBUTING.md,HOOKS_TODO.md}<!-- BEACON-END -->
