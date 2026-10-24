# Effect `onError` hook runs with `currentEffect` still set, so state reads inside it re-subscribe the failed effect

**Category:** bug
**Status:** needs-triage

The ticket 02 round 1 implementer of change `enforce-coverage-thresholds` observed on 2026-10-21 that state reads inside an effect's `onError` hook re-subscribe the effect that just failed, and a later write to that property re-runs it and throws into the writer. In `src/index.ts` `runEffectSafely`, the catch block calls `cleanupEffectOnError(eff)` and then `callHookSafe(onError, ...)` (lines 1002 to 1004) before the `finally` block restores `currentEffect = prev` (line 1007), so every proxy get during the hook goes through `trackDependency` with `currentEffect` equal to the failed effect. The tests added by ticket 02 assert only hook-visible values and do not cover reads inside the hook. Fix is to restore `currentEffect` before calling the hook, or to run the hook after the `finally` restore.
