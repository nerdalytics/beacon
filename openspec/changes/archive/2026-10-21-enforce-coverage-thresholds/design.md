# Design

## Context

See proposal.md, Why. Observed on 2026-10-20 at commit 655dea8:

- Node reads `node.config.json` only with `--experimental-default-config-file` (or `--experimental-config-file <path>`). With it, the test runner prints one `Error: <pct>% <kind> coverage does not meet threshold of <n>%` line per failing kind and exits 1. Without it, the same run exits 0. Both verified locally on Node 24.21.0 and 26.12.0.
- The lcov report for `src/index.ts` lists 23 unhit branches on 22 lines and 1 unhit function. The function is the no-op placeholder initially assigned to the `stop` unsubscribe in the helper that `until()` delegates to; a comment there says the real effect is assigned before any first-run throw can call it, so the placeholder never runs by design.
- The unhit branches fall into two groups when read in context:
  1. Reachable from the public API and simply untested: reading an unknown property on a derived value (returns `undefined`); assigning a property other than `reactive` on a derived value (the set trap returns `false`); the infinite-loop error for a named effect (the message with the effect name and property); scheduling an effect that is already queued, reached through prop-less scheduling such as array mutating methods (the early return in the scheduler); a `batch()` called with hooks whose body dirtied targets at depth 1 (the dirty-target flush in the hooks path of `batch`).
  2. Defensive guards whose reachability is not established by reading: missing dependency or read maps on an effect at tracking time; a `reads` map missing when checking whether an effect depends on a property; identity short-circuits in the dependency-set comparison helpers; the stable-dependency restore path after a re-run; the missing-maps return in subscription update; the internal-symbol read and wrapped-array-method return in one of the two get handlers; storing hooks for a frozen target when hooks are given; the derive pending setter without a reactive internal; the derive effect body's reactive-or-computing early return; the double-fail and post-done guards in the `until` helper.

## Goals / Non-Goals

**Goals:**
- A coverage run that fails locally and in CI when any configured minimum is missed.
- 100% branch and function coverage of `src/index.ts` as reported by the lcov output, achieved by tests or by removing dead code.

**Non-Goals:**
- Lowering a threshold, excluding `src/index.ts` or any line of it from measurement, or using `node:coverage ignore` comments.
- Changing library behavior or the public API.
- Type-checking the tests in CI.

## Decisions

- **Load the config via the default config-file flag, not an explicit path.** `--experimental-default-config-file` picks up `node.config.json` by its conventional name, which is why the file is named that way. Alternative: `--experimental-config-file node.config.json` names the path explicitly; same effect, one more token, no benefit while the file keeps its default name.
- **Keep thresholds in `node.config.json`, not as CLI flags.** The file already exists and `tests/AGENTS.md` documents it. Alternative: pass `--test-coverage-branches=100` etc. in the script, which would duplicate the config and leave the file dead.
- **Run coverage in CI as its own step after `npm test`, on every matrix version.** The coverage run is roughly the test run plus instrumentation (3.2s locally versus the plain run), so cost is small. Alternative: one version only, which would miss a threshold regression that only shows on another runtime. The `latest` entry carries the risk that the experimental flag is renamed; that is accepted and will show as a CI failure with a clear message.
- **Group 1 branches get tests; group 2 branches are decided per branch by the implementer: a test if a public-API path reaches it, deletion of the guard if the implementer can show the condition is impossible.** Deleting an impossible guard is the lazy and honest way to reach 100%: it removes code rather than hiding it. The `stop` placeholder is in this group; a replacement shape that avoids an uncovered call site is the implementer's choice. Alternative: `/* node:coverage ignore next */` annotations, rejected by the maintainer in triage ("cover", not exclude).
- **Tests for group 1 go in the existing behavior test files whose subject they match** (`derive-core`, `infinite-loop`, `batch-core`, `batch-hooks`), per the file organization in `tests/AGENTS.md`. Alternative: one new `coverage-gaps.test.ts`, rejected because the file would be named after a tooling goal rather than a behavior.

## Risks / Trade-offs

- [The experimental flag or the config schema changes in a future Node] → CI fails loudly on the `latest` matrix entry; the fix is a flag rename in one script.
- [A guard deleted as "unreachable" was reachable] → the implementer must state the argument for each deletion in the ticket's report, and the review checks it; `npm test` must stay green.
- [100% branch coverage becomes a tax on future changes] → accepted by the maintainer in triage; the thresholds were already the documented policy.
- [The ExperimentalWarning adds noise to every coverage run] → accepted; `--no-warnings` would also hide warnings that matter.

## Migration Plan

Order: cover the gaps first, then switch the gate on, so no commit on the branch has a red coverage script. Rollback: remove the flag from the script and the CI step; `node.config.json` is inert again.
