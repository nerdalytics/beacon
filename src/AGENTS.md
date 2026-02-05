# src/ — Beacon Core

Single file: `index.ts`. The entire reactive system. Do not split into modules.

## Exports

`state`, `effect`, `batch`, `derive`, `Unsubscribe`, `EffectCallback`, `EffectName`, `ComputedValue`

## Internal State (Module-Level)

Global mutable state driving the reactive system:

| Variable | Type | Purpose |
|----------|------|---------|
| `currentEffect` | `EffectFunction \| null` | Currently executing effect (for dependency tracking) |
| `batchDepth` | `number` | Nesting depth counter for batch operations |
| `isNotifying` | `boolean` | Prevents re-entrant `flushEffects` calls |
| `pendingEffects` | `Set<EffectFunction>` | Effects queued for execution |
| `activeEffects` | `Set<EffectFunction>` | Prevents re-entrant effect execution |
| `deferredEffectCreations` | `EffectFunction[]` | Effects created inside batch (deferred until batch end) |

## Internal Data Structures (WeakMap-based)

| WeakMap | Type | Purpose |
|---------|------|---------|
| `parentEffect` | `EffectFunction → EffectFunction` | Effect hierarchy for nested cleanup |
| `childEffects` | `EffectFunction → Set<EffectFunction>` | Children of an effect |
| `effectStateReads` | `EffectFunction → WeakMap<object, Set<PropertyKey>>` | Three-level per-property read tracking |
| `effectDependencies` | `EffectFunction → Set<object>` | Which objects an effect depends on |
| `proxyCache` | `object → object` | Reuse same Proxy for same target |
| `subscriberCache` | `object → Set<EffectFunction>` | Fast subscriber lookup by target |
| `proxyCacheSubs` | `object → Set<EffectFunction>` | Fallback subscriber storage for frozen/sealed objects |
| `frozenMethodCache` | `object → Map<PropertyKey, CachedMethod>` | Cached wrapped array methods for frozen objects |

## Symbols

| Symbol | Purpose |
|--------|---------|
| `OWN_KEYS_SYMBOL` | Tracks key enumeration reads (ownKeys trap) |
| `SUBSCRIBERS` | Stores subscriber Set on target objects |
| `PROXY` | Stores Proxy reference on target objects |
| `CACHED_METHODS` | Stores cached array method wrappers |

## Proxy Handler Architecture

Five handler factories, each returns a ProxyHandler method:

| Handler | Traps | Key behavior |
|---------|-------|-------------|
| `createGetHandler()` | `get` | Tracks reads, wraps nested objects, intercepts array mutating methods |
| `createSetHandler()` | `set` | Infinite loop detection, `Object.is` comparison, array length tracking |
| `createDeleteHandler()` | `deleteProperty` | Deletion with subscriber notification |
| `createHasHandler()` | `has` | `in` operator tracking |
| `createOwnKeysHandler()` | `ownKeys` | Key enumeration tracking via `OWN_KEYS_SYMBOL` |

## Critical Invariants

1. **Proxy deduplication**: Never create two Proxies for the same target. Always check `proxyCache` and `[PROXY]` symbol first.
2. **Effect re-entrancy guard**: `activeEffects` Set prevents an effect from running while already running.
3. **Batch depth counting**: `batchDepth` must always return to 0. Incremented before `fn()`, decremented in all paths (success + error).
4. **Cleanup order**: `cleanupEffect` removes from subscribers. `cleanupEffectCompletely` also handles children iteratively (not recursively — avoids stack overflow).
5. **`flushEffects` non-recursion**: Uses a while loop draining `pendingEffects`. New effects triggered during flush are added to `pendingEffects` and processed in the same loop iteration.
6. **Infinite loop detection scope**: Only blocks direct self-mutation (effect reads prop X then writes prop X on same target). Indirect cycles through different effects are allowed. Nested child effects are exempt (they have a `parentEffect`).

## `derive()` Implementation

Creates an internal `state()` + `effect()` pair. Returns a Proxy over `internalState` with custom get/set traps. The `value` property reads through the reactive internal when inside an effect (for dependency propagation) or from `target.value` otherwise. The `reactive` property controls the effect lifecycle (false → dispose, true → recreate).

## Modification Guidelines

- Maintain single-file architecture
- All internal symbols: `unique symbol` typed
- Use WeakMap for any new object→data mappings (GC-safe)
- Follow Biome rules: tabs, sorted keys/properties, no `any`, explicit return types, shorthand array types
- Test every code path — coverage targets: 100% branches, 100% functions

<!--— BEACON-START —>[Source Index]
|root: ./src
|IMPORTANT: Maintain single-file architecture for core. Hooks are a separate module.
|.:{index.ts,types.ts}
|hooks/:{AGENTS.md,index.ts,compose.ts}
<!--— BEACON-END —>
