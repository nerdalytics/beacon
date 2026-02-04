# docs/ — Beacon API Reference

IMPORTANT: Read the relevant doc file before writing any code that uses Beacon APIs. These docs were created specifically because AI agents were applying the APIs incorrectly.

## When to Read What

| File | Read when... |
|------|-------------|
| `README.md` | You need a quick overview or getting-started example |
| `README.state.md` | Creating reactive state, nested objects, arrays, frozen objects, or understanding Proxy behavior |
| `README.effect.md` | Writing side effects, understanding dependency tracking, nested effects, infinite loop prevention, or async pitfalls |
| `README.derive.md` | Computing derived values, chaining derivations, understanding disposal requirements, or batch optimization |
| `README.batch.md` | Grouping multiple state updates, understanding nested batches, or optimizing performance |
| `README.core.md` | Understanding the reactive system architecture, dependency tracking internals, or performance trade-offs |
| `README.debugging.md` | Debugging reactive state, using named effects, enabling debug logging, or troubleshooting |

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
|IMPORTANT: Read the relevant doc file before writing code that uses Beacon APIs
|.:{README.md,README.state.md,README.effect.md,README.derive.md,README.batch.md,README.core.md,README.debugging.md}
<!--— BEACON-END —>
