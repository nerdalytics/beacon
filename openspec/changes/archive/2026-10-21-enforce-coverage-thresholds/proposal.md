# Proposal

## Why

`node.config.json` declares coverage minimums of 100% branches, 100% functions and 90% lines, and the root `AGENTS.md` and `tests/AGENTS.md` present them as the project's gate. Nothing loads that file: the `test:coverage` script passes no config-file flag and CI never runs coverage, so the script exits 0 at 95.7% branch and 99.1% function coverage of `src/index.ts` (lcov.info at commit 655dea8). The gap surfaced when a ticket of `rename-on-idle-and-derived-value` claimed "thresholds hold" as an acceptance criterion and the implementer found the thresholds were never applied. Inbox issue `.do/inbox/2026-10-20-coverage-thresholds-not-enforced.md`; the maintainer chose to enforce the configured numbers and cover the gaps rather than lower or exclude.

## What Changes

- The `test:coverage` script loads `node.config.json`, so a run below any configured minimum exits non-zero. Verified mechanism: `node --experimental-default-config-file --test --experimental-test-coverage tests/**/*.test.ts` prints `Error: 95.84% branch coverage does not meet threshold of 100%` and exits 1 on both Node 24.21.0 and 26.12.0 (local runs on 2026-10-20).
- The CI test job runs the coverage script, so the gate applies on pull requests and trunk pushes.
- The test suite covers the 23 branches and 1 function in `src/index.ts` that the lcov report lists as unhit, so the gate passes at the configured values. A branch that is shown to be unreachable from the public API is removed as dead code rather than excluded from measurement (assumption, pending the ticket review; see design.md).
- The thresholds, the include list and the exclude list in `node.config.json` stay as they are.

Out of scope: a `typecheck` script for the tests (noted in the tsc-errors inbox issue, left for a separate decision); changing the lcov reporter or its destination; coverage for `handbook/` or `scripts/`.

## Capabilities

### New Capabilities

None. This change alters developer tooling and tests, not library behavior, so `.openspec.yaml` sets `skip_specs: true`.

### Modified Capabilities

None.

## Impact

- `package.json`: the `test:coverage` script gains the config-file flag.
- `.github/workflows/build-test-publish.yml`: the test job gains a coverage step. The flag is experimental and prints an ExperimentalWarning; it works on the two installed majors the CI matrix covers (24, 26). The `latest` matrix entry is unverified until CI runs.
- `tests/`: new test cases for uncovered branches, following the file naming in `tests/AGENTS.md`.
- `src/index.ts`: only if a guard is removed as unreachable; no public API or behavior change.
- `tests/AGENTS.md` and root `AGENTS.md`: the coverage sentences become true and need no wording change unless a number changes.
