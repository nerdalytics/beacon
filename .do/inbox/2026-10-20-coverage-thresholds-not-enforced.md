# `npm run test:coverage` never applies the thresholds in `node.config.json`

**Category:** enhancement
**Status:** ready-for-agent
**Change:** enforce-coverage-thresholds

`node.config.json` sets `test-coverage-branches: 100`, `test-coverage-functions: 100` and `test-coverage-lines: 90` under `nodeOptions`, and the root `AGENTS.md` describes those as the project's coverage gate. The `test:coverage` script in `package.json` (line 65) runs `node --test --experimental-test-coverage --test-reporter=lcov --test-reporter-destination=lcov.info tests/**/*.test.ts` with no `--experimental-config-file` or `--experimental-default-config-file` flag, and nothing in `package.json`, `.github/workflows/*.yml`, `.github/scripts/*.sh` or `mise.toml` names `node.config.json` (grep on 2026-10-20). The ticket 01 implementer of change `rename-on-idle-and-derived-value` reported that the script exited 0 while `lcov.info` showed 515 of 538 branches and 108 of 109 functions covered for `src/index.ts`, both below the configured 100, with every uncovered line outside its diff. So the thresholds are documentation, not a gate. Options: pass `--experimental-default-config-file` in the script so Node reads `node.config.json`, or drop the thresholds and the `AGENTS.md` sentence. Either way, the current numbers would fail a 100% branch gate, so enforcing it also means covering or excluding the 23 uncovered branches first.

## Triage notes

Triaged on 2026-10-20. Confirmed: `npm run test:coverage` exits 0 at commit 655dea8 while the generated `lcov.info` reports 514 of 537 branches and 108 of 109 functions covered for `src/index.ts`, against configured minimums of 100 and 100. Nothing in `package.json`, the GitHub workflows, the workflow scripts or `mise.toml` passes a config-file flag, so Node never reads `node.config.json`. Node v24.21.0 accepts `--experimental-default-config-file` with an ExperimentalWarning. The one uncovered function is the no-op placeholder assigned to the `stop` unsubscribe variable in `runUntil()`, the helper `until()` delegates to, before the real effect is created. The maintainer chose to enforce the thresholds as configured and cover the gaps rather than exclude them or lower the numbers.

## Agent brief

**Summary:** Make the coverage thresholds in `node.config.json` a real gate, locally and in CI, with the source fully covered so the gate passes.

**Current behavior:**
The `test:coverage` npm script produces an lcov report but never reads `node.config.json`, so its branch, function and line minimums are never applied and the script exits 0 regardless of coverage. CI runs `npm run check`, `npm run build` and `npm test`, and never runs coverage. The root `AGENTS.md` and `tests/AGENTS.md` describe the minimums as the project's coverage gate. The current suite leaves 23 branches and 1 function in the core module uncovered; the function is the no-op placeholder assigned to the `stop` unsubscribe in `runUntil()`, the helper `until()` delegates to, before its effect is created.

**Desired behavior:**
Running `npm run test:coverage` applies the minimums from `node.config.json` and exits non-zero when any of them is not met. The CI test job runs the coverage script on at least one Node version so a drop below the minimums fails the build. The tests cover every branch and function in the core module reported by the lcov output, so the gate passes at the configured values of 100% branches, 100% functions and 90% lines. Where a branch is genuinely unreachable from the public API, the agent says so in the change and covers it by a targeted test rather than by lowering a threshold or excluding the file.

**Key interfaces:**
- The `test:coverage` script in `package.json`: must make Node load `node.config.json`, for example by passing `--experimental-default-config-file`
- `node.config.json` `nodeOptions`: thresholds, include and exclude lists stay as they are
- The GitHub Actions test job in the build, test and publish workflow: gains a coverage step
- The lcov output written to `lcov.info`: the source of truth for which branches and functions remain uncovered

**Acceptance criteria:**
- [ ] `npm run test:coverage` exits non-zero when a scratch edit skips a test so coverage drops below a threshold in `node.config.json`, and exits 0 with the committed values
- [ ] `lcov.info` for `src/index.ts` reports branches hit equal to branches found and functions hit equal to functions found
- [ ] The thresholds in `node.config.json` remain 100 branches, 100 functions and 90 lines
- [ ] A CI workflow step runs the coverage script and fails the job when the gate fails
- [ ] `npm test`, `npm run check` and `npm run build` still pass

**Out of scope:**
- Lowering any threshold or excluding `src/index.ts` from coverage
- Adding a `typecheck` script for the tests; that was noted in the tsc-errors issue and left for a separate decision
- Changing the lcov reporter or the report destination
- Coverage for the handbook or the benchmark script
