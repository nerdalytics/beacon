# Tasks

## 1. Types and API surface

- [x] 1.1 Extend `src/types.ts`: add readonly `pending: boolean` to `ComputedValue<T>`, a `schedule?: 'sync' | 'microtask'` effect option, `until`/`onSettled` signatures, and `derive` overloads (sync fn → `ComputedValue<T>`, async fn → `ComputedValue<Awaited<T>>`). Verify: `npx tsc --noEmit -p tsconfig.json` exits 0 with the new declarations and existing call sites unchanged.

## 2. Async derive

- [x] 2.1 Add thenable detection and a per-derive generation counter in `derive` (src/index.ts ~1330-1423); settled writes go through the existing `batch()`. Verify: new `tests/derive-async.test.ts` — a derive whose compute returns a controlled promise updates `value` to the resolved result after the promise settles and the flush completes.
- [x] 2.2 Implement stale-while-pending: `pending` true from compute start until settle, value retains last settled result (undefined before first settle); `pending` lives in the derive internal state so it is trackable. Verify: test asserts value retention mid-flight and that an effect reading `pending` runs once per flip (true on start, false on settle).
- [x] 2.3 Implement supersede-discard (stale generation settlements write nothing) and route rejections to `DeriveHooks.onError` with `pending` false and value unchanged. Verify: out-of-order test (settle A after B, value equals B) and rejection test with a process-level `unhandledRejection` listener asserting silence.

## 3. Settle observation

- [x] 3.1 Implement `until(predicate, { timeout?, signal? })` on a private self-disposing effect: reactive-scope call throws; truthy settled read resolves; timeout and abort reject; every settle path clears timer and subscription. Verify: `tests/until.test.ts` covering resolve-after-write, timeout rejection, pre-aborted rejection, in-effect throw, and no predicate evaluation after settle (write again, counter unchanged).
- [x] 3.2 Implement `onSettled(callback)` with an unsubscribe: invoked once per flush cycle that processed work and left queues empty (including microtask drains). Verify: batched writes produce exactly one callback after the boundary; after unsubscribe, further writes produce none.

## 4. Effect scheduling

- [x] 4.1 Store `schedule` on effect records and partition the pending set at the flush gate (src/index.ts ~230): microtask-scheduled effects drain via one `queueMicrotask` per turn through the existing `flushEffects` loop. Verify: sync-default test (effect ran before the write call returns) and microtask test (not run synchronously; ran after `await new Promise(queueMicrotask)`), both deterministic with no timers or retries.
- [x] 4.2 Verify coalescing, batch precedence, and guard scope per the effect-scheduling spec. Verify: two same-turn writes yield one run observing final values; a microtask effect notified inside `batch` runs after the boundary turn; sync write-during-read still throws the infinite-loop error; a microtask effect writing its own dependency re-runs exactly once on the next turn (bounded flip counter).

## 5. Release and docs

- [x] 5.1 Bump version to `3000.0.0` in `package.json` and `jsr.json`. Verify: `.github/scripts/check-version-sync.sh` exits 0.
- [x] 5.2 Document the epoch-3 surface in README: async `derive` with `pending`, `until`, `onSettled`, `schedule` option, and a migration note that sync timing and sync `derive` are unchanged. Verify: README contains the four API sections and `npm run check` (biome) exits 0.

## 6. Full gates

- [x] 6.1 Run the complete test suite with coverage. Verify: `npm run test:coverage` exits 0 meeting `node.config.json` thresholds (100% branches, 100% functions, 90% lines).
  - Resolution (Denny, 2026-10-14): accepted against the executable gate only — `npm run test:coverage` exits 0 and the suite is 218/218 — with the 100%-branch threshold recorded as unmet and pre-existing: trunk baseline measures 91.89% branches (scratch worktree at `origin/trunk`), this branch 92.64%, and the uncovered-line sets map one-to-one under a line offset, so epoch 3 added no uncovered branch. The threshold is enforced nowhere (no coverage step in `build-test-publish.yml`; Node 24 `test:coverage` exits 0 regardless). Closing the ~36 pre-existing uncovered branches is a separate follow-up change, not part of this one.
- [x] 6.2 Run the LTS build. Verify: `npm run build` exits 0 (tsc LTS config plus esbuild bundle).
