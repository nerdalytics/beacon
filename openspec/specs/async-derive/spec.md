# async-derive Specification

## Purpose

Defines how beacon's `derive` primitive supports asynchronous compute functions so backend consumers can derive state from promises (database or RPC results) while keeping stale-while-pending read semantics and latest-wins supersede behavior.

## Requirements

### Requirement: Async compute functions in derive
`derive` SHALL accept a compute function that returns a promise. Dependencies read before the first await SHALL be tracked exactly as in synchronous computations, and the derived value SHALL update when the returned promise settles.

#### Scenario: dependency change triggers async recompute
- **WHEN** a state property read by an async compute function changes
- **THEN** a new computation starts, and the derived value equals the new computation's resolved result after it settles

#### Scenario: synchronous derive behavior is unchanged
- **WHEN** `derive` is called with a synchronous compute function
- **THEN** the derived value is available immediately after the call, as in beacon v2000

### Requirement: Stale-while-pending values
While a computation is pending, the derived value SHALL keep the last settled value and its `pending` flag SHALL be `true`. Before the first settle, the value SHALL be `undefined` and `pending` SHALL be `true`. After a settle, `pending` SHALL be `false`.

#### Scenario: read during recompute returns previous value
- **WHEN** a dependency changes while a previous computation's promise is unsettled and the value is read after the new computation started
- **THEN** the read returns the last settled value and `pending` is `true`

#### Scenario: first read before settle
- **WHEN** the value is read before the first computation's promise settles
- **THEN** the value is `undefined` and `pending` is `true`

### Requirement: Trackable pending flag
Reading `pending` inside an effect or another computation SHALL register a dependency, so the reader re-runs when `pending` flips.

#### Scenario: effect reacts to pending flip
- **WHEN** an effect reads `pending` and a computation starts, then settles
- **THEN** the effect runs once per flip (true on start, false on settle)

### Requirement: Superseded computations are discarded
WHEN a new computation starts before an earlier one settles, the earlier computation is superseded: its settlement SHALL NOT write the value or clear `pending`; the latest computation wins.

#### Scenario: out-of-order settlement
- **WHEN** two computations start in order A then B, and A's promise settles after B's
- **THEN** the derived value equals B's result, and A's later settlement has no observable effect

### Requirement: Rejection routing
A rejected compute promise SHALL route the error to the derive error hook, SHALL NOT write a value, and SHALL set `pending` to `false` with the value unchanged.

#### Scenario: rejected recompute keeps last value
- **WHEN** a computation's promise rejects after a previous successful settle
- **THEN** the error hook receives the rejection, the value keeps the last settled result, and `pending` is `false`
