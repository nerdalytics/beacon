# Unreachable assignment in the hooked-state infinite-loop test

**Category:** test
**Status:** needs-triage

`tests/infinite-loop.test.ts`, test `detects direct infinite loops on state created with hooks`, added by ticket 02 of change `wrap-array-methods-on-hookless-state`: inside `assert.throws` the line `$count.value = 10` after the `effect(...)` call never runs, because the effect's first run throws. The round 2 reviewer on 2026-10-22 rated it `low standards` and noted the sibling hookless test at line 46 has the same shape, so the pattern predates the ticket. Fix is to delete the line in both tests, or to leave both as they are for symmetry.
