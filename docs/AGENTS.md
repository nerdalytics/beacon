# docs/ — Beacon Documentation

API documentation has moved to the handbook: https://nerdalytics.github.io/beacon/

The handbook source lives in `handbook/` and is built with SvelteKit.

## Critical Gotchas

1. **`state()` only accepts objects** — primitives are returned as-is. Wrap in object: `state({ value: 0 })`
2. **Async callbacks don't track dependencies** — `currentEffect` is null inside setTimeout, Promise.then, event handlers. Access state in the effect body, capture values before async boundaries.
3. **Always dispose `derive()` values** — they create internal effects. Undisposed derives leak memory.
4. **Always dispose `effect()` return values** — call the returned `Unsubscribe` function when the effect is no longer needed.
5. **Effects cannot write to state they read** — throws infinite loop error. Use separate state objects or `derive()` instead.
6. **`batch()` must be synchronous** — async operations inside batch break the batch context. Await first, then batch.
7. **Array mutating methods notify all subscribers** — `push`, `pop`, `splice` etc. trigger all effects on that array, not just index-specific ones.

<!--— BEACON-START —>[Docs Index]
|root: ./docs
|.:{AGENTS.md}
<!--— BEACON-END —>
