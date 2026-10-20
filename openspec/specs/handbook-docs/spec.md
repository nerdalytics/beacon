# handbook-docs Specification

## Purpose

Defines the handbook documentation obligations for beacon's async derive, effect scheduling and settle primitives (introduced in v2001) and the v2002 renames: which pages in the current version tree must cover them, how the settle page is placed in navigation, how `latest` aliases the current version, and how the machine-readable llms endpoints expose it — so a library version never ships undocumented.

## Requirements

### Requirement: derive page documents async compute semantics
The `latest/derive` page SHALL document promise-returning compute functions, stale-while-pending reads (`value` retains the last settled result while `pending` is true), `pending` as a trackable dependency, discarding of superseded computations, and rejection routing to the derive error hook, each with at least one TypeScript example.

#### Scenario: built derive page contains the async section
- **WHEN** the handbook is built with `BASE_PATH=/beacon`
- **THEN** the built `latest/derive` HTML contains sections for `pending`, stale-while-pending, and superseded computations

#### Scenario: example guards on pending
- **WHEN** the derive page's async example is inspected
- **THEN** it shows an effect or read path checking `pending` before consuming `value`

### Requirement: effects page documents the schedule option
The `latest/effects` page SHALL document `schedule: 'sync' | 'microtask'`, same-turn write coalescing under `'microtask'`, batch-boundary precedence, the 100-flush microtask chain limit, and SHALL state that the default `'sync'` preserves v2000 execution timing.

#### Scenario: built effects page contains the scheduling section
- **WHEN** the handbook is built with `BASE_PATH=/beacon`
- **THEN** the built `latest/effects` HTML contains the `microtask` schedule option and the synchronous-default statement

### Requirement: settle page for until and onIdle
The `latest` version SHALL contain a `settle` page documenting `until(predicate, { timeout?, signal? })` (settled-truthy resolution, timeout and abort rejection, reactive-scope prohibition, self-disposal) and `onIdle(callback)` (idle notification, unsubscribe), with backend-flavored examples. The page SHALL appear in the `latest` navigation and SHALL NOT appear in navigation for versions lacking the primitives.

#### Scenario: latest navigation includes Settle
- **WHEN** the handbook is built and the `latest` landing or any latest page HTML is inspected
- **THEN** the navigation contains a Settle item linking to the settle page

#### Scenario: v2000 navigation excludes Settle
- **WHEN** any `v2000.0.0` page HTML is inspected
- **THEN** its navigation contains no Settle item

#### Scenario: settle page prerenders
- **WHEN** the handbook is built with `BASE_PATH=/beacon`
- **THEN** a built HTML file exists for the latest settle page and contains sections for `until` and `onIdle`

### Requirement: migration pages document consumer-visible changes per version
Each version tree's `migration` page SHALL document the consumer-visible changes from the previous version. The `v2001.0.1/migration` page SHALL cover the v2000 → v2001 changes: the new `pending` field on derived values, asynchronous first settle for async compute functions, the new `schedule` effect option, and SHALL state that synchronous `derive` and default-schedule effects are unchanged. The `latest/migration` page SHALL cover the v2001 → v2002 renames (`onSettled` → `onIdle`, `SettledCallback` → `IdleCallback`, `ComputedValue` → `DerivedValue`) and SHALL state that there is no runtime change.

#### Scenario: built v2001 migration page covers the async additions
- **WHEN** the handbook is built with `BASE_PATH=/beacon`
- **THEN** the built `v2001.0.1/migration` HTML references the `pending` field and the `schedule` option

#### Scenario: built latest migration page covers the renames
- **WHEN** the handbook is built with `BASE_PATH=/beacon`
- **THEN** the built `latest/migration` HTML references 2002.0.0 and maps `onSettled` to `onIdle`

### Requirement: llms endpoints expose the settle page
The generated `llms.txt` and `llms-full.txt` for `latest` SHALL include the settle page, because they are produced from the same nav-driven page list as the navigation.

#### Scenario: built llms.txt lists settle
- **WHEN** the handbook is built with `BASE_PATH=/beacon`
- **THEN** the built `latest/llms.txt` contains an entry whose path ends with `/settle`

### Requirement: latest aliases the current version
`latest` SHALL serve the current version's pages under its own URL, without copying the page sources and without redirecting. The `latest` `llms.txt`, `llms-full.txt`, and `[page].md` endpoints SHALL serve the current version's content. The version selector SHALL list `latest` carrying the `current` marker and SHALL list the current version number as a separate entry.

#### Scenario: latest page serves current content
- **WHEN** `/latest/introduction` is requested from a prerendered build
- **THEN** a built HTML file exists at that path and its content matches the current version's introduction page

#### Scenario: latest llms serves current content
- **WHEN** `/latest/llms.txt` is fetched from a prerendered build
- **THEN** the body lists the current version's pages with base-rooted `latest` links

#### Scenario: selector marks latest as current
- **WHEN** any version page HTML is inspected
- **THEN** the selector options include `latest` marked current and `v2002.0.0` as a separate entry

#### Scenario: older version trees unchanged
- **WHEN** a `v2000.0.0` page HTML is inspected
- **THEN** its navigation contains no Settle item and no `latest` or v2002 links
