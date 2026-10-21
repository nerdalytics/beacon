# Spec Delta

## Purpose

Defines the handbook documentation obligations for beacon's epoch-3 API: which pages in the `latest` version tree must cover the new primitives and options, how the new page is placed in navigation, and how the machine-readable llms endpoints expose it — so the library epoch never ships undocumented.

## ADDED Requirements

### Requirement: derive page documents async compute semantics
The `latest/derive` page SHALL document promise-returning compute functions, stale-while-pending reads (`value` retains the last settled result while `pending` is true), `pending` as a trackable dependency, supersede-discard of stale settlements, and rejection routing to the derive error hook, each with at least one TypeScript example.

#### Scenario: built derive page contains the async section
- **WHEN** the handbook is built with `BASE_PATH=/beacon`
- **THEN** the built `latest/derive` HTML contains sections for `pending`, stale-while-pending, and superseded computations

#### Scenario: example guards on pending
- **WHEN** the derive page's async example is inspected
- **THEN** it shows an effect or read path checking `pending` before consuming `value`

### Requirement: effects page documents the schedule option
The `latest/effects` page SHALL document `schedule: 'sync' | 'microtask'`, same-turn write coalescing under `'microtask'`, batch-boundary precedence, and SHALL state that the default `'sync'` preserves v2000 execution timing.

#### Scenario: built effects page contains the scheduling section
- **WHEN** the handbook is built with `BASE_PATH=/beacon`
- **THEN** the built `latest/effects` HTML contains the `microtask` schedule option and the synchronous-default statement

### Requirement: settle page for until and onSettled
The `latest` version SHALL contain a `settle` page documenting `until(predicate, { timeout?, signal? })` (settled-truthy resolution, timeout and abort rejection, reactive-scope prohibition, self-disposal) and `onSettled(callback)` (quiescence notification, unsubscribe), with backend-flavored examples. The page SHALL appear in the `latest` navigation and SHALL NOT appear in navigation for versions lacking the primitives.

#### Scenario: latest navigation includes Settle
- **WHEN** the handbook is built and the `latest` landing or any latest page HTML is inspected
- **THEN** the navigation contains a Settle item linking to the settle page

#### Scenario: v2000 navigation excludes Settle
- **WHEN** any `v2000.0.0` page HTML is inspected
- **THEN** its navigation contains no Settle item

#### Scenario: settle page prerenders
- **WHEN** the handbook is built with `BASE_PATH=/beacon`
- **THEN** a built HTML file exists for the latest settle page and contains sections for `until` and `onSettled`

### Requirement: migration page documents v3000 consumer changes
The `latest/migration` page SHALL document the consumer-visible v2000 → v3000 changes: the new `pending` field on computed values, asynchronous first settle for async compute functions, and the new `schedule` effect option, and SHALL state that synchronous `derive` and default-schedule effects are unchanged.

#### Scenario: built migration page mentions v3000
- **WHEN** the handbook is built with `BASE_PATH=/beacon`
- **THEN** the built `latest/migration` HTML references 3000.0.0 and the `pending` field

### Requirement: llms endpoints expose the settle page
The generated `llms.txt` and `llms-full.txt` for `latest` SHALL include the settle page, because they are produced from the same nav-driven page list as the navigation.

#### Scenario: built llms.txt lists settle
- **WHEN** the handbook is built with `BASE_PATH=/beacon`
- **THEN** the built `latest/llms.txt` contains an entry whose path ends with `/settle`

### Requirement: latest aliases the current version
`latest` page routes SHALL redirect (308) to the corresponding page of the current version. The `latest` `llms.txt`, `llms-full.txt`, and `[page].md` endpoints SHALL serve the current version's content. The version selector SHALL list the current version entry carrying the `current` marker.

#### Scenario: latest page redirects
- **WHEN** `/latest/introduction` is requested from a prerendered build
- **THEN** the served stub redirects to `/v3000.0.0/introduction`

#### Scenario: latest llms proxies current content
- **WHEN** `/latest/llms.txt` is fetched from a prerendered build
- **THEN** the body is the v3000.0.0 llms index with base-rooted v3000.0.0 links

#### Scenario: selector lists the current version
- **WHEN** any version page HTML is inspected
- **THEN** the selector options include `v3000.0.0` and mark it current

#### Scenario: older version trees unchanged
- **WHEN** a `v2000.0.0` page HTML is inspected
- **THEN** its navigation contains no Settle item and no v3000 links
