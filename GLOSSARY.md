# Beacon

Reactive dependency graph runtime for Node.js backends. One context: the core in `src/index.ts`, its hooks, and the handbook that documents them.

## Language

### State

**State**:
A plain object that `state()` wraps in a reactive Proxy. Its properties are the unit of dependency tracking: an effect re-runs only for the properties it read.
_Avoid_: signal, store, observable, model

**Signal**:
The TC39 signals proposal's cell of data with `get()` and `set()`, the shape Beacon had through v1000. Beacon's counterpart is a property of a state object. Use the word only when relating Beacon to the proposal or to its own past, never for a Beacon object.
_Avoid_: using it for a state object or a derived value

**Hookless state**:
A state object created without hooks. Hooks only observe; the reactive behavior is the same with or without them.
_Avoid_: fast-path state, plain state, unhooked state

### Derived values

**Derived value**:
The object `derive` returns: `value`, `pending` and the `reactive` switch over an internal state and effect pair. The `DerivedValue` type names it.
_Avoid_: computed value, computed, derive (as a noun), `ComputedValue`

**Computation**:
One run of a derive's compute function. A synchronous computation returns its value; an asynchronous computation returns a promise.
_Avoid_: recompute (as a noun), calculation, evaluation (reserved for `until` predicates)

**Settled**:
The state of a computation whose promise has resolved or rejected, or of a synchronous computation once it has returned. The word applies to computations only, never to the graph.
_Avoid_: completed, finished, done, landed

**Pending**:
The state of a computed value whose latest computation is not yet settled. Readable and trackable as the `pending` field.
_Avoid_: in flight, loading, unsettled

**Superseded**:
A computation that a newer computation replaced before it settled. Its outcome is discarded when it arrives; the latest computation wins.
_Avoid_: stale, cancelled, dropped

**Settled evaluation**:
A run of an `until` predicate during which every computed value it read was settled. `until` resolves on the first settled evaluation that is truthy.
_Avoid_: clean evaluation, stable read

### Graph

**Idle**:
The state of the reactive graph when no effect is queued and no microtask flush is armed. `onIdle` notifies each time the graph becomes idle after doing work. A pending computation does not keep the graph from being idle; `until` is the primitive that waits on pending values.
_Avoid_: settled (reserved for computations), quiet, quiescent, quiescence, converged

### Documentation

**Handbook**:
The versioned documentation site under `handbook/`, one frozen route tree per release. The newest tree is the current documentation; older trees are history.
_Avoid_: docs site, wiki, API reference (for the site as a whole)

### Tooling

**Coverage gate**:
The minimums in `node.config.json` that `npm run test:coverage` must meet: 100% branches, 100% functions and 90% lines of `src/`. A run below any of them exits non-zero.
_Avoid_: coverage targets, thresholds (as a bare noun)
