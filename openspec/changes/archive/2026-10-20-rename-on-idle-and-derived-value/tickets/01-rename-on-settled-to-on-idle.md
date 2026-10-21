# 01: Rename the graph notification to `onIdle`

**Area:** idle

**Blocked by:** None (can start immediately)

**What to build:** The graph-idle notification is exported as `onIdle` with the callback type `IdleCallback`, and the old names `onSettled` and `SettledCallback` no longer exist. Timing is unchanged: the callback fires after each flush or async settlement that left no effect queued and no microtask flush armed, including while an async computation is still pending. Graph-side internals (the callback set, the notify functions, the cycle cap) say idle; the flag that records an async settlement keeps its name because it describes a computation. The runaway-callback error reads `Infinite loop detected: onIdle callbacks kept scheduling effects for 100 notifications`. The three behavior test files that use the API are updated, and the agent docs and README describe the API with glossary vocabulary (idle, never quiet or quiescence).

- [x] `onIdle` and `IdleCallback` are exported from the package entry; importing `onSettled` or `SettledCallback` fails to type-check
- [x] A test shows the callback runs once after a batched flush while an async derived value's `pending` is still `true`, and again after that computation settles
- [x] Graph-side internal names and comments say idle; the only remaining internal "settle" names describe a computation's settlement
- [x] The runaway error text names `onIdle`, and both tests that assert that text (sync throw and microtask `console.error`) pass with the new wording
- [x] `npm test`, `npm run test:coverage` (thresholds hold) and `npm run check` pass
- [x] Root `AGENTS.md` and `src/AGENTS.md` list `onIdle` and `IdleCallback` and describe the internals with their new names
- [x] The README's `onSettled` section becomes an `onIdle` section using glossary wording
