# Two `100` caps and one bypass contradict Beacon's loop-detection design

**Category:** bug
**Status:** needs-info

Beacon's loop-detection design, as the user stated it on 2026-10-21: an effect that reads and then writes the same property is an infinite loop and is reported at once; cycles between different effects are allowed to run until they converge, with no cap, because a backend has no frame budget to protect. `checkInfiniteLoop` in `src/index.ts` implements the first half. Two places do not follow the design. `MAX_MICROTASK_FLUSH_CHAIN = 100` stops microtask effects that keep rescheduling themselves after 100 flushes with a `console.error`, and `MAX_IDLE_CYCLES = 100` stops `onIdle` callbacks that keep scheduling effects after 100 notifications; both are counts, not detections. Separately, the wrapped array methods on hooked state (`wrapArrayMethod`) apply the method to the raw target and schedule every subscriber with no property, so `checkInfiniteLoop` never runs for them. Reproduced: an effect on hooked state that reads `length` and pushes while it is below 3 neither throws nor converges (`runs=2, length=1` after an external trigger), while the same effect on hookless state throws `Infinite loop detected` because `push` sets `length` through the set trap. The array bypass is in scope of the hookless array-wrap fix being triaged; the two caps are a separate question of whether microtask and idle self-feeding can be detected by property instead of counted.

## Triage notes

**What we've established so far:**

- The user decided on 2026-10-21 that both caps must go. A count answers how long a loop is tolerated, never whether it is one, so every report would move the number instead of fixing the detection.
- Both caps came in with PR 173 (`50c213a`, 2026-10-17), the async derive, `until` and `onSettled` work, which the user reviewed on a phone. `MAX_SETTLE_CYCLES` was renamed to `MAX_IDLE_CYCLES` in PR 183. Neither is tied to hooks.
- The root `AGENTS.md` line 34 documents the microtask cap, so the docs change with the code.

- On 2026-10-21 the user answered Q28 with "a": the two caps are removed in their own change, not folded into the hookless array wrap fix. That fix must not touch them.

**What we still need:**

- A detection for microtask effects that keep rescheduling themselves that works by property, the way `checkInfiniteLoop` does for synchronous effects, or a decision that microtask effects fall under the same read-then-write rule and lose their exemption.
- A detection for `onIdle` callbacks that keep scheduling effects, or a decision that an idle callback which schedules work is simply allowed and the graph goes idle again when that work ends.
- Whether the array-method bypass is fixed in the array-wrap change (Q29 there) or here.
