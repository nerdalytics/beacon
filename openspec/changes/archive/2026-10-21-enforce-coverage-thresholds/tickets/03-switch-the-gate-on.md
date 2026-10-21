# 03: Switch the gate on

**Area:** coverage-gate

**Blocked by:** 02

**What to build:** The coverage script makes Node load `node.config.json` through the default config-file flag, so a run below any configured minimum prints Node's threshold error and exits non-zero, and a run at or above them exits 0. The CI build, test and publish workflow runs the coverage script as a step of the test job on every Node version in its matrix, after the plain test step, so a pull request or trunk push that drops coverage fails. The coverage sentences in the root agent docs and the tests agent docs are checked against the final numbers and left as they are if still true; the tests docs heading uses the glossary term "coverage gate" rather than "coverage targets".

- [x] `npm run test:coverage` exits 0 at the committed `node.config.json` values and still writes `lcov.info`
- [x] With one test that covers a branch of the core module temporarily skipped in a scratch edit, `npm run test:coverage` prints a line matching `coverage does not meet threshold` and exits non-zero; the edit is reverted and `node.config.json` is not touched
- [x] The test job of the CI workflow has a coverage step that runs on each matrix version and fails the job when the script exits non-zero
- [x] The root agent docs and the tests agent docs describe the coverage gate accurately, and the tests docs use the term "coverage gate"
- [x] `npm test`, `npm run check` and `npm run build` pass
