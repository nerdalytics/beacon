# src/hooks/ — Beacon Hooks Module

Public API for zero-cost instrumentation. Re-exports types from `../types.ts` and the composition utility.

## Files

| File | Purpose |
|------|---------|
| `index.ts` | Public entry point — re-exports types and `composeHook` |
| `compose.ts` | `composeHook()` utility for composing hook arrays into single functions |

## Exports

**Types:** `BatchHooks`, `DeriveHooks`, `EffectHooks`, `StateHooks`, `HookFunction`, `SingleOrArray`
**Functions:** `composeHook`

## Hook Interfaces

All hooks are optional. Each accepts `SingleOrArray<HookFunction<Args>>` — a single function or array of functions.

| Interface | Hooks | Fired during |
|-----------|-------|-------------|
| `StateHooks<T>` | `onDelete`, `onHas`, `onOwnKeys`, `onRead`, `onWrite` | Proxy trap execution |
| `EffectHooks` | `onDependencyAdd`, `onDispose`, `onError`, `onRun`, `onSchedule` | Effect lifecycle |
| `DeriveHooks<T>` | `onCacheHit`, `onCompute`, `onDependencyChange`, `onDispose`, `onError` | Derived value computation |
| `BatchHooks` | `onBatchEnd`, `onBatchError`, `onBatchStart` | Batch boundary lifecycle |

## `composeHook<Args>(hook)`

Normalizes `SingleOrArray<HookFunction<Args>> | undefined` into a single function or `undefined`:

- `undefined`/`null` → `undefined`
- Single function → returned as-is
- Empty array → `undefined`
- Single-element array → that element
- Multiple functions → composed function that calls all in order

**Error isolation**: Each hook in a composed array runs inside try-catch. One failing hook does not prevent others from executing. Errors are silently swallowed — hook failures must never break core functionality.

## Integration with Core

Hooks are injected via optional last parameter on each API function:

- `state(initial, hooks?: StateHooks<T>)`
- `effect(fn, name?, hooks?: EffectHooks)`
- `derive(computeFn, hooks?: DeriveHooks<T>)`
- `batch(fn, hooks?: BatchHooks)`

The core `index.ts` imports `composeHook` from this module.

## Design Constraints

- All hook invocations wrapped in try-catch — never propagate to core
- State hooks propagate to nested objects via `HOOKS` symbol
- Frozen/sealed objects store hooks in `frozenHooksCache` WeakMap
- All hooks fire synchronously during their respective operations
- Types defined in `../types.ts`, not in this module

<!--— BEACON-START —>[Hooks Module Index]
|root: ./src/hooks
|IMPORTANT: Hook types live in ../types.ts. This module only re-exports and composes.
|.:{index.ts,compose.ts}
<!--— BEACON-END —>
