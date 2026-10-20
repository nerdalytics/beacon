# Spec Delta

## Purpose

Defines beacon's imperative settle points: awaiting reactive convergence from non-reactive code (`until`) and observing graph quiescence (`onSettled`), so backend request handlers can wait for state to reach a condition without polling or timers.

## ADDED Requirements

### Requirement: until resolves on a truthy settled predicate
`until(predicate, options?)` SHALL return a promise that resolves with the predicate's value once a settled evaluation of the predicate is truthy. Evaluations while async computations the predicate depends on are pending SHALL NOT resolve the promise.

#### Scenario: predicate flips after a state write
- **WHEN** imperative code awaits `until(() => state.ready)` and another task later sets `state.ready = true`
- **THEN** the promise resolves with `true` after the flush that applied the write completes

#### Scenario: predicate reading a pending async derive does not resolve early
- **WHEN** the predicate reads an async derived value whose recompute is in flight
- **THEN** the promise resolves only after the recompute settles and the predicate is truthy on the settled value

### Requirement: until rejects on timeout and abort
`until` SHALL reject with a timeout error when the `timeout` option elapses before a truthy settled evaluation, and SHALL reject with the signal's reason when the `signal` option aborts. An already-aborted signal SHALL reject immediately.

#### Scenario: timeout
- **WHEN** `until(predicate, { timeout: 50 })` is awaited and the predicate never becomes truthy
- **THEN** the promise rejects after approximately 50 ms with a timeout error

#### Scenario: pre-aborted signal
- **WHEN** `until(predicate, { signal })` is called with an already-aborted signal
- **THEN** the returned promise rejects with the signal's reason without subscribing

### Requirement: until is imperative-scope only
Calling `until` inside an effect or computation SHALL throw, mirroring the reactive-scope prohibition of imperative wait primitives.

#### Scenario: call inside an effect
- **WHEN** an effect callback calls `until(predicate)`
- **THEN** the call throws synchronously

### Requirement: until self-disposes
On resolve, timeout reject, or abort reject, `until` SHALL dispose its internal subscription so no listener outlives the promise (no leaked observers).

#### Scenario: no subscription after settle
- **WHEN** an `until` promise has settled and the state it watched changes again
- **THEN** no effect run or callback attributable to the settled `until` occurs

### Requirement: onSettled notifies graph quiescence
`onSettled(callback)` SHALL invoke the callback after each flush cycle that processed at least one effect or async settlement and left no further pending work. It SHALL return an unsubscribe function.

#### Scenario: callback after a batched flush
- **WHEN** several state writes occur inside one `batch` and the outermost boundary exits
- **THEN** the callback runs once after the resulting flush completes, not once per write

#### Scenario: unsubscribe stops notifications
- **WHEN** the unsubscribe function returned by `onSettled` is called and further writes occur
- **THEN** the callback is not invoked again
