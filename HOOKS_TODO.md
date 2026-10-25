# Hooks Roadmap

Status-tracked plan and catalog for Beacon's hooks system. Every "shipped" row and every contract fact below was verified against `src/` at commit `c7ce796`. The former `HOOKS_CATALOG.md` is folded into the Catalog section.

**Status legend**

| Status | Meaning |
|--------|---------|
| `shipped` | In `src/` with tests |
| `open` | Not started; nothing in core blocks it |
| `blocked` | Needs a change to the hook contract first (see below) |
| `decide` | Needs a product decision before any work starts |

## Shipped

| Item | Where |
|------|-------|
| Hook interfaces: `StateHooks` (5 slots), `EffectHooks` (6), `DeriveHooks` (5), `BatchHooks` (3) | `src/types.ts` |
| Single-or-array hook values; `composeHook` normalizer with per-hook error isolation | `src/hooks/compose.ts` |
| Public entry `@nerdalytics/beacon/hooks` exporting the types and `composeHook` | `package.json` exports, `jsr.json` exports |
| All 19 slots wired in core through `callHookSafe` | `src/index.ts` |
| 41 tests across state, effect, derive, batch, and compose | `tests/*-hooks.test.ts`, `tests/hooks-compose.test.ts` |
| Handbook pages: hooks-overview, hooks-api, hooks-catalog (including the custom-hook guide) | `handbook/src/routes/v2002.0.0/` |

## Hook contract

Facts from `src/index.ts` that decide whether a catalog entry can be built as a plain hook:

1. Hooks return `void`. Nothing a hook returns reaches core.
2. Hook errors are swallowed by `callHookSafe`. A hook cannot throw to the caller.
3. `onWrite` fires after `rawTarget[prop] = value`. A hook cannot veto, alter, or delay a write.
4. Same-value writes return before `onWrite` (`Object.is` check). A hook never sees an unchanged write.
5. `onRun` fires before the effect body. There is no post-run slot, so a hook cannot time an effect.
6. `onCompute` fires before `computeFn` with the previous value. The new value is only visible through `onCacheHit`.
7. Hooks bind by closure at `state()` / `effect()` / `derive()` / `batch()` call time. Nested objects wrapped later inherit the parent's hooks through that closure, not through any per-target storage.
8. The presence of a hook never changes which subscribers wake or when. Hooked and hookless state share one set trap, so a write notifies the same subscribers at the same moment on every path: outside a batch, inside a batch from outside any effect, and inside an effect.

Anything that needs veto, throw-through, delay, or post-run timing is `blocked` until a new slot or a return-value contract exists.

## Open core items

| # | Item | Status | Evidence |
|---|------|--------|----------|
| C1 | The `HOOKS` symbol is defined only on extensible array targets, holding the `DirectArrayContext` their direct `push`/`pop` read; a non-array target gets no slot and no cache entry, since hooks fire through the handler closure on every target. | `shipped` | `tests/state-hooks.test.ts`, "defines the hooks symbol on an array target only" |
| C2 | `state(obj, hooksB)` on an already-proxied `obj` returns the cached proxy and drops `hooksB` silently. A nested object proxied before its parent keeps its own (possibly empty) hooks. | `decide` | probe: parent `onRead` sees `["inner"]` only; a second `state()` call fires hooksA, never hooksB |
| C3 | Reading a nested object through a frozen proxy throws a Proxy invariant `TypeError`, with or without hooks. | `open` | probe: `Object.freeze(state({nested:{b:2}}))` then `.nested.b` |
| C4 | File layout for built-in hooks: one file per hook under `src/hooks/` (original Phase 4 plan) or a single `src/hooks/builtins.ts`. | `decide` | none yet |

## Catalog

Import path for anything built here is `@nerdalytics/beacon/hooks`. Per-hook subpaths such as `@nerdalytics/beacon/hooks/logRead` are not in the exports map and are not planned.

### Debugging

#### `logRead` — `open`

Slot: `StateHooks.onRead`.

```ts
function logRead<T>(options?: {
	prefix?: string // default '[READ]'
	logger?: (...args: unknown[]) => void // default console.log
	includeStack?: boolean // default false
}): StateHooks<T>['onRead']
```

#### `logWrite` — `open`, one option `blocked`

Slot: `StateHooks.onWrite`.

```ts
function logWrite<T>(options?: {
	prefix?: string // default '[WRITE]'
	logger?: (...args: unknown[]) => void
	includeStack?: boolean // default false
	logUnchanged?: boolean // blocked: contract fact 4, onWrite never fires for unchanged writes
}): StateHooks<T>['onWrite']
```

#### `logEffect` — `open`, `logTiming` `blocked`

Returns an `EffectHooks` object. The original intersection-of-functions return type cannot be implemented.

```ts
function logEffect(options?: {
	logRun?: boolean // default true, via onRun
	logDispose?: boolean // default true, via onDispose
	logDependencies?: boolean // default false, via onDependencyAdd
	logTiming?: boolean // blocked: contract fact 5, no post-run slot
}): EffectHooks
```

#### `logDerive` — `open`

Returns a `DeriveHooks` object. The derived value is only available in `onCacheHit` (contract fact 6).

```ts
function logDerive<T>(options?: {
	logCompute?: boolean // default true, via onCompute
	logCache?: boolean // default true, via onCacheHit
	logValue?: boolean // default false, via onCacheHit only
	maxValueLength?: number // default 100
}): DeriveHooks<T>
```

#### `trace` — `open`

Slot: `StateHooks.onRead` or `StateHooks.onWrite`.

```ts
function trace<T>(options?: {
	maxDepth?: number // default 10
	filter?: (line: string) => boolean // default: drop node_modules frames
	onTrace?: (stack: string) => void // default console.trace
}): StateHooks<T>['onRead'] | StateHooks<T>['onWrite']
```

### Performance

#### `profile` — `blocked`

No slot brackets an operation: `onWrite` fires after the write, `onRun` before the body, and there is no post-run or post-write slot (contract facts 3 and 5). Needs an `onAfterRun` style slot or a timing pair before this can exist.

#### `throttle` — `blocked` as specified

A hook cannot delay the write itself (contract fact 3). The original spec ("after 500ms: executes with 'abc'") describes write batching, not a hook. Re-specify as a wrapper that throttles the hook's own side effect, then it becomes `open` under Utilities.

#### `debounce` — `blocked` as specified

Same reason as `throttle`.

### Persistence

#### `persist` — `decide`

Feasible as a write-through side effect on `onWrite` that serializes `target`. The planned default backend `localStorage` does not exist in Node, which is Beacon's target runtime. Decide the default backend (file, custom `Storage`-like interface) before starting.

```ts
function persist<T>(key: string, options?: {
	storage?: Storage // default: to decide
	serialize?: (value: T) => string // default JSON.stringify
	debounce?: number // default 0
}): StateHooks<T>['onWrite']
```

#### `hydrate` — `decide`

Not a hook. It is a plain `(initial: T) => T` loader run before `state()`. Decide whether it belongs in the hooks module at all.

### Validation

#### `validate` — `blocked` as specified

`preventDefault` is impossible: the write is applied before `onWrite` fires and hook errors are swallowed (contract facts 2 and 3). An observe-and-report variant (`onError` callback only) is `open`.

```ts
function validate<T>(
	rules:
		| { [K in keyof T]?: (value: T[K]) => boolean | string }
		| ((prop: PropertyKey, value: unknown) => boolean | string),
	options?: { onError?: (error: ValidationError) => void }
): StateHooks<T>['onWrite']
```

#### `freeze` — `blocked` as specified

Cannot block the write and cannot throw to the caller (contract facts 2 and 3). `onAttempt` reporting alone is `open`, but native `Object.freeze` plus contract fact 7 already covers the common case.

### Analytics

#### `trackMutation` — `open`

Slot: `StateHooks.onWrite`.

```ts
function trackMutation<T>(options?: {
	eventName?: string // default 'state_mutation'
	tracker?: (event: MutationEvent) => void
	includeValue?: boolean // default true
	includePrevious?: boolean // default false
}): StateHooks<T>['onWrite']
```

#### `trackAccess` — `open`

Slot: `StateHooks.onRead`.

```ts
function trackAccess<T>(options?: {
	eventName?: string // default 'state_access'
	tracker?: (event: AccessEvent) => void
	sampleRate?: number // 0..1, default 1
}): StateHooks<T>['onRead']
```

### DevTools

#### `devtools` — `decide`

The original spec targets a browser DevTools panel with performance metrics. Beacon targets Node backends, and performance metrics are `blocked` for the same reason as `profile`. Decide whether a Node-side inspector (for example, an event stream over the existing slots) replaces this entry.

### Utilities

#### Array-based composition — `shipped`

Every slot accepts a function or an array of functions, executed in order. `composeHook` is exported for library authors who need to normalize a slot value themselves.

#### `once` — `open`

Pure wrapper, independent of core.

```ts
function once<T extends (...args: never[]) => void>(hook: T): T
```

#### `filter` — `open`

Pure wrapper, independent of core.

```ts
function filter<T extends (...args: never[]) => void>(predicate: (...args: Parameters<T>) => boolean, hook: T): T
```

### Writing custom hooks

Covered by the handbook hooks-catalog page. Not duplicated here.
