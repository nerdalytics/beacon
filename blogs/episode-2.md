# Episode 2 — "Real Users Break Everything"

The best APIs don't come from design documents. They come from someone doing something you didn't expect.

## The CLI Script

The first real test came quietly.

A few days after tagging `1.0.0`, I wired Beacon into an internal CLI tool. The tool managed configuration state — flags, connection strings, runtime options — and needed to propagate changes when a user edited a config file mid-session. The old approach was a tangle of callbacks and manual bookkeeping. The new approach was three lines:

```typescript
const config = state(loadConfig());

effect(() => {
  applyConfig(config());
});

// When the file changes:
config.set(loadConfig());
```

State holds the config. An effect applies it. When the file changes, set the new value. The effect re-runs. That's it.

I kept waiting for the edge case. The race condition. The subscription leak. It didn't come. The CLI tool ran for weeks without a single Beacon-related issue. Not because the code was perfect — the internals were the pre-rewrite v1 code, full of problems I'd discover later — but because the pattern was sound. A reactive container that notifies dependents when it changes is a correct abstraction for "something changed, now deal with it."

That quiet success was dangerous. It gave me the confidence that maybe this library was done.

## SQLite and Effects

The second project was more ambitious.

A backend service needed persistent state — the kind that survives process restarts. The state itself was straightforward: configuration, task queues, processing checkpoints. The persistence layer was SQLite. The question was how to connect them.

The obvious approach: manually save to the database whenever state changes. Call `db.save()` after every `.set()`. Sprinkle persistence logic throughout the business code. Hope you never forget a save call.

Effects offered something better. If an effect automatically runs when its dependencies change, then an effect that writes to SQLite is automatic persistence. You don't sprinkle save calls. You declare the relationship once:

```typescript
const appState = state({
  lastCheckpoint: 0,
  processedItems: 0,
  taskQueue: [],
});

// This effect persists every state change to SQLite
const unsubscribe = effect(() => {
  const current = appState();
  db.run(
    "INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)",
    ["state", JSON.stringify(current)]
  );
});
```

Every time `appState` changes — any property, any mutation — the effect fires and the database updates. No manual save calls. No forgotten writes. The reactive system handles the plumbing.

But persistence is only half the problem. The other half is resumability. When the process restarts, the state needs to come back.

```typescript
// On startup: hydrate from the database
const saved = db.get("SELECT value FROM app_state WHERE key = ?", ["state"]);
if (saved) {
  appState.set(JSON.parse(saved.value));
}
```

Hydrate once on startup. The effect picks up from there. Crash recovery, graceful restarts, long-running tasks that span multiple process lifetimes — all handled by the same two primitives: state holds the value, effects propagate it.

This pattern — reactive state backed by SQLite with automatic persistence and startup hydration — became the foundation for everything I built with Beacon over the next six months. It was simple enough to implement in an afternoon and robust enough to run in production without changes.

I started calling it the persist pattern.

## Beacon Rewind

The persist pattern kept showing up.

Every new project that needed durable state ended up with the same boilerplate: create state, wire an effect to SQLite, hydrate on startup. The code was nearly identical each time. The only things that changed were the table name and the shape of the state.

By late 2025, I'd extracted the pattern into its own package: Beacon Rewind. State plus SQLite plus effects, bundled into a single function call. Automatic persistence. Automatic hydration. Resumability as a feature, not a pattern you re-implement.

```typescript
import { rewind } from "@nerdalytics/beacon-rewind";

// One call: state + persistence + hydration
const appState = rewind("app-state", {
  lastCheckpoint: 0,
  processedItems: 0,
  taskQueue: [],
});

// Use it like regular state
appState.set({ ...appState(), processedItems: appState().processedItems + 1 });
// SQLite updates automatically
```

Beacon Rewind was used in a customer project throughout 2025 before being published as a standalone package in early 2026. It was the first real extension of the Beacon ecosystem — proof that the four primitives were composable enough to build higher-level abstractions on top of.

The important thing wasn't the package itself. It was what it validated: that `state` and `effect` compose into patterns that are genuinely useful beyond the obvious "update a value, run a callback" use case. Persistence, resumability, crash recovery — none of these were designed into Beacon. They fell out of the primitives naturally.

## The Colleague Incident

The CLI tool and the SQLite project were solo work. I was the only person writing Beacon code, the only person reading Beacon state, the only person who could break things.

That changed when a colleague started using a shared service I'd built with Beacon.

The service exposed state objects to other parts of the system. A configuration state. A status tracker. Shared, mutable, reactive. The implicit contract was simple: read the state however you want, but only update it through the designated API. Don't call `.set()` directly on the shared state. Use the service methods.

The contract lasted about a week.

The colleague — reasonably, from their perspective — saw a state object with a `.set()` method and called it. Why wouldn't they? The method was right there. The type system didn't prevent it. The API invited it.

The result wasn't a crash. It was worse: silent corruption. The service's internal invariants depended on updates going through specific validation logic. A direct `.set()` bypassed all of it. The state was technically valid — it held a value, effects ran, subscribers were notified — but semantically it was garbage. The validation layer never saw the write.

The fix was `protectedState`.

```typescript
import { protectedState, effect } from "@nerdalytics/beacon";

// Returns a tuple: [reader, writer]
const [status, setStatus] = protectedState({ healthy: true, lastCheck: 0 });

// Expose only the reader to consumers
export { status };

// Keep the writer internal
export function updateStatus(healthy: boolean): void {
  // Validation happens here
  if (healthy === status().healthy) return;
  setStatus.set({ healthy, lastCheck: Date.now() });
}
```

`protectedState` returns a tuple. The first element is a read-only view — a function you can call to read the value, pass to effects, use in derived computations. It has no `.set()` method. No `.update()` method. No way to mutate. The second element is the writer — `.set()` and `.update()`, kept internal to the module that owns the state.

Pass the reader to consumers. Keep the writer behind your API boundary. The type system enforces what the implicit contract couldn't.

The colleague's code broke at compile time instead of silently corrupting at runtime. That's the difference between an implicit contract and a type-level guarantee.

## Feature Discovery, Not Feature Creep

Looking back at the v1000 timeline, a pattern emerges.

`select()` landed the same day as the rewrite. The problem: subscribing to `state({ name: "Alice", age: 30 })` meant every property change triggered every effect, even if an effect only cared about `name`. The selector primitive created targeted subscriptions:

```typescript
const user = state({ name: "Alice", age: 30, email: "alice@example.com" });
const name = select(user, (u) => u.name);

effect(() => {
  console.log(`Name: ${name()}`);
});
// => "Name: Alice"

user.update((u) => ({ ...u, age: 31 }));
// (nothing — effect doesn't care about age)

user.update((u) => ({ ...u, name: "Bob" }));
// => "Name: Bob"
```

`lens()` followed for deep access. Where `select()` gave you a read-only view of a derived value, `lens()` gave you read-write access to a nested property:

```typescript
const settings = state({
  display: { theme: "dark", fontSize: 14 },
  network: { timeout: 5000 },
});

const theme = lens(settings, (s) => s.display.theme);

theme(); // "dark"
theme.set("light"); // updates settings.display.theme without touching network
```

`readonlyState()` wrapped any state in a read-only view — same as the reader half of `protectedState`, but for states that already existed:

```typescript
const internal = state(0);
const exposed = readonlyState(internal);

exposed(); // 0
// exposed.set(1) — doesn't exist, type error
```

Custom equality functions in `1000.2.0`. The ability to tell Beacon "these two values are the same even though `===` says they're different." Useful when state holds objects that get recreated but haven't meaningfully changed:

```typescript
const position = state(
  { x: 0, y: 0 },
  (a, b) => a.x === b.x && a.y === b.y
);

position.set({ x: 0, y: 0 }); // No effect triggers — same value by custom equality
```

Every one of these features was reactive. Not planned upfront. Not extracted from a design document. Each was a direct response to a specific frustration encountered while using Beacon in real code. `select()` because effects were running too often. `lens()` because updating nested state was verbose. `readonlyState()` because sharing mutable state was dangerous. `protectedState()` because a colleague called `.set()` when they shouldn't have. Custom equality because effects fired on meaningless changes.

None were in the original design. All were necessary.

## The Quiet Period

After `1000.2.1` shipped on April 14, 2025, the git log went silent.

Six months. No commits. No PRs. No issues. From the outside, the project looked dead.

From the inside, it looked like this: Beacon was running in three production systems. The CLI tool was managing configuration state. The SQLite-backed service was persisting and resuming task queues. A third project was using effects to coordinate worker processes. All three ran daily. None required changes.

There's a version of open-source culture that treats inactivity as failure. A library without weekly commits is "unmaintained." A repository without recent activity is "abandoned." The green squares on the contribution graph are a proxy for health.

That framing misses something. A library that doesn't need changes is a library that works. The four primitives — `state`, `effect`, `derived`, `batch` — plus the extensions that real usage demanded — `select`, `lens`, `readonlyState`, `protectedState` — were covering every case I threw at them. The API surface was complete for the problems I had.

Six months of silence wasn't stagnation. It was the library earning its stability through daily production use.

The silence broke on October 23, 2025. A brief maintenance burst: a performance refactor to reduce closure variable capture, a typo fix in a CI action, a fix to re-include `index.ts` in the published npm package. Housekeeping. The kind of work that accumulates when you're using a library but not actively developing it.

Then more silence. Two months this time, until January 2026.

When the commits returned, they weren't bug fixes or new features. They were performance optimizations and architectural changes — `1000.2.4` optimized notification and batch processing, `1000.3.0` decomposed the state implementation for tree-shaking. The library was being prepared for something, even if I didn't fully know what yet.

In the background, a question had been forming. Not about what Beacon could do — it could do everything I needed. About how it felt to use. The function-based API was powerful. It was also ceremonious. `count()` to read. `count.set(5)` to write. `select(user, u => u.name)` to access a property. Every interaction mediated by function calls.

What if state was just an object? What if reading was just property access? What if writing was just assignment?

But that's a story for Episode 3.

## Takeaway

Ship something real, use it yourself, let other people use it. The features you need to build will announce themselves.

Every useful feature in Beacon v1000 — selectors, lenses, protected state, custom equality — was born from a specific moment of friction. Not from a roadmap. Not from a brainstorming session. From someone trying to do something the library didn't yet support, and the library stretching to meet them.

The best signal that your API needs a new feature isn't a GitHub issue. It's the moment you write a workaround and think: this should be easier.
