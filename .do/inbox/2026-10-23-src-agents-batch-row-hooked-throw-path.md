# src/AGENTS.md batch() row misnames the hooked throw path

**Status:** needs-triage

**Source:** ticket 06 of change `wrap-array-methods-on-hookless-state`, review round 2, low standards finding, approved with the finding open.

The `batch()` row in `src/AGENTS.md` (line 173 at commit 9efd3ae) says "or `abortBatch` on a throw", but only the hookless `batch(fn)` path calls `abortBatch` on a throw; the hooked `batch(fn, hooks)` path calls `handleBatchError`. The reviewer's suggested wording is "then `endBatch` (on a throw: `abortBatch` without hooks, `handleBatchError` with hooks)". A one-line docs edit to `src/AGENTS.md`, no code change.
