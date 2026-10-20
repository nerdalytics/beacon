# Spec Delta

## Purpose

Defines per-effect scheduling in beacon: effects may run synchronously (current behavior, the default) or be deferred to a microtask so writes separated by await boundaries coalesce into a single run, without changing synchronous semantics for existing consumers.

## ADDED Requirements

### Requirement: schedule option with synchronous default
`effect` SHALL accept a `schedule` option with values `'sync'` and `'microtask'`. The default SHALL be `'sync'`, preserving beacon v2000 execution timing exactly for effects that do not opt in.

#### Scenario: default timing unchanged
- **WHEN** a state property changes and an effect without a `schedule` option observes it
- **THEN** the effect runs before the write call returns, as in beacon v2000

#### Scenario: microtask-scheduled effect defers
- **WHEN** a state property changes and an effect with `schedule: 'microtask'` observes it
- **THEN** the effect has not run when the write call returns, and runs after the current microtask turn

### Requirement: microtask coalescing
Multiple writes to dependencies of a microtask-scheduled effect within the same microtask turn SHALL produce exactly one effect run, observing the final values.

#### Scenario: two writes, one run
- **WHEN** two separate writes to properties read by a microtask-scheduled effect occur in the same turn
- **THEN** the effect runs once, after the turn, seeing both writes

### Requirement: batch boundary precedence
A microtask-scheduled effect notified inside `batch` SHALL NOT run before the outermost batch boundary exits; after the boundary it SHALL follow its microtask schedule.

#### Scenario: batch defers past the boundary
- **WHEN** writes occur inside `batch` and the boundary exits within a microtask turn
- **THEN** the microtask-scheduled effect runs in a later microtask turn than the boundary exit, exactly once

### Requirement: infinite-loop guard scope
The synchronous write-during-read guard SHALL apply unchanged to `'sync'` effects. Writes performed by `'microtask'` effects SHALL NOT be treated as writes during a read of the same flush, since they execute outside any read window; cycles across microtask turns remain bounded by the per-flush drain loop and are documented as user error.

#### Scenario: sync guard unchanged
- **WHEN** a `'sync'` effect writes a property it read during its run
- **THEN** the infinite-loop error is thrown, as in beacon v2000

#### Scenario: microtask effect writing its own dependency
- **WHEN** a `'microtask'` effect writes a property it read
- **THEN** no infinite-loop error is thrown at write time; the effect re-runs on the following microtask turn

### Requirement: scheduling observability
The existing effect schedule hook SHALL fire for both schedules, carrying enough information to distinguish a synchronous flush from a microtask-deferred one in tests.

#### Scenario: hook observes deferral
- **WHEN** a microtask-scheduled effect is notified
- **THEN** the schedule hook fires at notification time, before the deferred run
