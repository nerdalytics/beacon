# Spec Delta

## MODIFIED Requirements

### Requirement: infinite-loop guard scope
The synchronous write-during-read guard SHALL apply unchanged to `'sync'` effects. Writes performed by `'microtask'` effects SHALL NOT be treated as writes during a read of the same flush, since they execute outside any read window. Cycles across microtask turns SHALL be bounded instead: after 100 consecutive microtask flushes, each armed from inside the previous one, the pending `'microtask'` effects SHALL be dropped and an `Infinite loop detected` error SHALL be reported through `console.error`. Dropped effects SHALL stay subscribed, and the next write from outside a microtask flush SHALL start a new count.

#### Scenario: sync guard unchanged
- **WHEN** a `'sync'` effect writes a property it read during its run
- **THEN** the infinite-loop error is thrown, as in beacon v2000

#### Scenario: microtask effect writing its own dependency
- **WHEN** a `'microtask'` effect writes a property it read
- **THEN** no infinite-loop error is thrown at write time; the effect re-runs on the following microtask turn

#### Scenario: microtask chain limit
- **WHEN** a `'microtask'` effect, a cycle of `'microtask'` effects, or an `onIdle` callback waking a `'microtask'` effect keeps arming the next microtask flush from inside the current one
- **THEN** after the 100th chained flush the pending `'microtask'` effects are dropped, `console.error` receives an `Infinite loop detected` error, and a later write from outside a microtask flush runs the effects again
