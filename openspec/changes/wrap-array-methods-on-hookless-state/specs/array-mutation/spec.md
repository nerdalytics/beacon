# Spec Delta

## Purpose

Defines how a mutating array method (`push`, `pop`, `shift`, `unshift`, `splice`, `sort`, `reverse`) called on reactive state notifies subscribers, composes with batches, is checked for self-feeding loops, and is observed by state hooks, identically for state created with and without hooks; and that the presence of a hook never changes which subscribers a write wakes or when.

## ADDED Requirements

### Requirement: Mutating methods behave the same with and without hooks
Reactive state SHALL expose the same behavior for the seven mutating array methods whether the state was created with hooks or without. Hooks SHALL only observe; they SHALL NOT change which subscribers wake, how often, or whether a loop error is raised.

#### Scenario: Same wake count on both kinds of state
- **WHEN** an effect reads index 0 and `length` of an empty reactive array, and `push(1)` is called from outside any effect, on state created without hooks and on state created with hooks
- **THEN** the effect re-runs exactly once on each

#### Scenario: Same loop outcome on both kinds of state
- **WHEN** a synchronous top-level effect calls a mutating method on a reactive array, on state created without hooks and on state created with hooks
- **THEN** both raise the same infinite-loop error

### Requirement: Hook presence does not change notification
Reactive state SHALL notify the same subscribers at the same moment whether the state was created with hooks or without, for every write path: outside a batch, inside a batch from outside any effect, and inside an effect. The `onWrite` hook SHALL be called after the raw write on every path on which a write changes a value, including a write inside a batch. A write of an equal value SHALL stay silent on every path and SHALL NOT call `onWrite`.

#### Scenario: Batched write wakes the same subscribers on every kind of state
- **WHEN** an effect reads only index 1 of a reactive array `[0, 1, 2]` and a batch assigns index 3 from outside any effect, on state created without hooks, with `onRead` only, with `onWrite` only, and with both
- **THEN** the effect re-runs exactly once on each

#### Scenario: onWrite sees a batched write
- **WHEN** state with an `onWrite` hook holds `{ a: 1 }` and a batch assigns `a = 2` from outside any effect
- **THEN** the hook is called once with property `a`, old value `1`, new value `2` and the raw target, and a batched assignment of `a = 2` again calls it no further time

### Requirement: One wake per method call
A mutating array method called from outside any batch SHALL wake each subscriber of that array at most once per call, after the method has returned, regardless of which properties the subscriber read and how many properties the method changed. A call that changes no element and leaves `length` unchanged SHALL wake no subscriber.

#### Scenario: Subscriber of an unchanged index wakes once
- **WHEN** an effect reads only index 1 of a reactive array `[0, 1, 2]` and `push(3)` is called from outside any effect
- **THEN** the effect re-runs exactly once

#### Scenario: Subscriber of a changed index and length wakes once
- **WHEN** an effect reads index 0 and `length` of an empty reactive array and `push(1)` is called from outside any effect
- **THEN** the effect re-runs exactly once, and sees the element and the new length

#### Scenario: Method that changes nothing wakes nobody
- **WHEN** an effect reads every index of a sorted reactive array and `sort()` is called from outside any effect
- **THEN** the effect does not re-run

### Requirement: Mutating methods compose with batches
A mutating array method called inside a batch SHALL defer its wakes to the outermost batch boundary, where each subscriber of the array wakes at most once for the whole batch.

#### Scenario: Two methods in one batch wake once
- **WHEN** an effect reads `length` of a reactive array and a batch calls `push(1)` then `pop()` on it
- **THEN** the effect does not re-run before the batch ends and re-runs at most once after it

### Requirement: Mutating methods are subject to loop detection
A mutating array method reads the properties it writes. When a synchronous top-level effect calls one on a reactive array, the system SHALL raise the same infinite-loop error it raises for an effect that writes a property it read. Child effects and microtask effects SHALL keep the exemption they have for property writes; the system SHALL NOT add a new exemption or a new counter for array methods.

#### Scenario: Each method throws in a synchronous top-level effect
- **WHEN** a synchronous top-level effect calls `push`, `pop`, `shift`, `unshift`, `splice`, `sort` or `reverse` on a reactive array it did not otherwise read
- **THEN** the effect's first run raises the infinite-loop error, and the error names the effect when it has a name

#### Scenario: Child effect does not throw
- **WHEN** a child effect calls `push` on a reactive array
- **THEN** no infinite-loop error is raised

#### Scenario: Microtask effect converges
- **WHEN** a microtask effect pushes onto a reactive array while its `length` is below 3
- **THEN** no error is raised and the array ends with length 3

### Requirement: State hooks observe mutating methods
On state created with hooks, the `onRead` hook SHALL see the method name read and every property the method reads, and the `onWrite` hook SHALL see every property the method writes, with the same arguments a direct property access produces.

#### Scenario: onWrite sees a push
- **WHEN** state with an `onWrite` hook holds an empty array and `push(1)` is called
- **THEN** the hook is called for index `0` with old value `undefined` and new value `1`, and for `length` only if the write changes it

#### Scenario: onRead sees the method and its reads
- **WHEN** state with an `onRead` hook holds an array and `push(1)` is called
- **THEN** the hook is called with `push` and with `length`

### Requirement: Results equal the native method
The return value of a wrapped method and the contents of the array afterwards SHALL equal those of the same native method on a plain array with the same contents and arguments, for every argument shape the native method accepts. On a non-extensible array the native method's error SHALL propagate unchanged.

#### Scenario: Splice with removals
- **WHEN** `splice(1, 2, 9)` is called on a reactive array `[0, 1, 2, 3]`
- **THEN** it returns `[1, 2]` and the array reads `[0, 9, 3]`

#### Scenario: Sort with a comparator
- **WHEN** `sort((a, b) => b - a)` is called on a reactive array `[1, 3, 2]`
- **THEN** it returns the same array and the array reads `[3, 2, 1]`

#### Scenario: Push on a sealed array
- **WHEN** `push(1)` is called on reactive state over a sealed array
- **THEN** a `TypeError` is raised, as the native method raises, and the system stays usable
