# Spec Delta

## MODIFIED Requirements

### Requirement: until resolves on a truthy settled predicate
`until(predicate, options?)` SHALL return a promise that resolves with the predicate's value once a settled evaluation of the predicate is truthy. Evaluations while async computations the predicate depends on are pending SHALL NOT resolve the promise.

#### Scenario: predicate flips after a state write
- **WHEN** imperative code awaits `until(() => state.ready)` and another task later sets `state.ready = true`
- **THEN** the promise resolves with `true` after the flush that applied the write completes

#### Scenario: predicate reading a pending async derive does not resolve early
- **WHEN** the predicate reads an async derived value whose latest computation is pending
- **THEN** the promise resolves only after that computation settles and the predicate is truthy on the settled value

## REMOVED Requirements

### Requirement: onSettled notifies graph quiescence
**Reason**: "Settled" is reserved for computations (ADR 0001). The graph notification fires while an async computation is still pending, so calling it "settled" hid that difference.
**Migration**: Replace `onSettled` with `onIdle` and `SettledCallback` with `IdleCallback`. Timing and the unsubscribe contract are unchanged.

## ADDED Requirements

### Requirement: onIdle notifies graph idleness
`onIdle(callback)` SHALL invoke the callback after each flush cycle or async settlement that processed at least one effect or settlement and left the graph idle: no effect queued and no microtask flush armed. A pending async computation SHALL NOT keep the graph from being idle. It SHALL return an unsubscribe function.

#### Scenario: callback after a batched flush
- **WHEN** several state writes occur inside one `batch` and the outermost boundary exits
- **THEN** the callback runs once after the resulting flush completes, not once per write

#### Scenario: idle while a computation is pending
- **WHEN** a state write starts an async computation and the flush that applied the write completes
- **THEN** the callback runs once while the derived value's `pending` is still `true`, and runs again after the computation settles

#### Scenario: unsubscribe stops notifications
- **WHEN** the unsubscribe function returned by `onIdle` is called and further writes occur
- **THEN** the callback is not invoked again

#### Scenario: runaway callbacks name onIdle
- **WHEN** callbacks keep scheduling synchronous effects for 100 notifications within one flush
- **THEN** the remaining effects are dropped and the thrown `Infinite loop detected` error names `onIdle`
