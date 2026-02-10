# Building Beacon — Blog Series Outline

Platform: Hashnode + Substack
Target: 3000+ words per episode, shortened as needed
Code samples: Inline where they serve the narrative, links for deep dives
Structure: Each episode tells its own story with a hook and a takeaway

---

## Episode 1 — "From Angular Signals to npm publish"

**Hook**: You don't have to use a framework to be inspired by one.

### Sections

1. **The Spark** — Working alongside Angular developers. Angular adds signals. You're not an Angular dev, but the concept lodges in your head. What is a signal, really? Just a value that tells you when it changes.

2. **Down the Rabbit Hole** — Free time exploration leads to the TC39 Signals proposal. The realization: this isn't a framework feature, it's a language-level pattern. What would signals look like if they were built for Node.js, not the browser?

3. **The Experimental Phase** — Tinkering code, prototypes, dead ends. The mental model forming: state, effect, derive, batch. Four primitives, nothing else.

4. **March 30th** — The day the experimental code became a library. Dissecting months of experiments, refactoring into a coherent API. State, effect, cleanup, cyclic dependency handling, batch — all pushed the same day.
   - Code sample: the v1 API — `const count = state(0)`, `count()`, `count.set(5)`

5. **First Contact with Reality** — Using Beacon in a customer project. Shortcomings surface. The API works but the internals need rethinking. Eleven days later: a complete rewrite. `epoch(core): complete rewrite of the library (#6)`.

6. **The Version Question** — What version do you call a rewrite? 2.0? Browsing the internet leads to Epoch Semantic Versioning. The insight: if a breaking security fix ever becomes necessary, semver alone can't express the magnitude. Epoch semver can. `1000.0.0` is born.
   - Explain epoch semver briefly with examples

7. **Takeaway** — Sometimes the best way to understand a concept is to rip it out of its context and rebuild it somewhere else entirely.

---

## Episode 2 — "Real Users Break Everything"

**Hook**: The best APIs don't come from design documents. They come from someone doing something you didn't expect.

### Sections

1. **The CLI Script** — First real use after publishing. A CLI tool where Beacon manages configuration state. It just works. No changes needed. The quiet confidence of "maybe this is done."

2. **SQLite and Effects** — A project where effects automatically persist state changes to SQLite. The `persist()` pattern emerges: on app start, connect an empty state to the database, an effect reads existing values and hydrates the state. Resumability for free.
   - Code sample: persist() pattern — effect writing to SQLite on state change

3. **Beacon Rewind** — The persist pattern matures into a published package. State + SQLite + effects = automatic persistence with resumability. Used in a customer project in 2025, published in 2026. The first real extension of the Beacon ecosystem.
   - Brief code sample or link

4. **The Colleague Incident** — A teammate mutates state outside expected boundaries. The state is shared, the contract is implicit, and someone breaks it. The response: `protectedState` — pass a read-only view to consumers, keep write access internal. A real access control problem solved with a simple API.
   - Code sample: protectedState usage

5. **Feature Discovery, Not Feature Creep** — Looking back at the v1000 timeline: `select()` for targeted property subscriptions, `lens()` for focused access, `readonlyState` for immutable views, `protectedState` for access control. Each one was a direct response to a specific frustration. None were planned upfront.

6. **The Quiet Period** — After `1000.3.0`, months of silence in the git log. Not inactivity — stability. The library was doing its job. But in the background, a question forming: what's next?

7. **Takeaway** — Ship something real, use it yourself, let other people use it. The features you need to build will announce themselves.

---

## Episode 3 — "Killing Your Own APIs"

**Hook**: The hardest commit isn't the one that adds 500 lines. It's the one that deletes them.

> Note: Timeline is mixed across episodes. Sort during writing.

### Sections

1. **The Bug Hunt** — Something isn't behaving as expected. To understand actual behavior, you wire up effects on `lens()` — using Beacon's own tools to debug Beacon. Lens and effects become a diagnostic instrument.
   - Code sample: using effects + lens to trace behavior

2. **What the Profiler Showed** — While building an experimental migration to a new architecture, you profile Beacon v1000. Two findings: it's memory hungry, and it spends significant time notifying subscribers about state changes.

3. **The Proxy Blog Posts** — Other developers advocating against state management libraries. Their argument: the Proxy API is built into JavaScript, roll your own. Skepticism at first. Then curiosity. Then experimentation.

4. **The Unexpected Result** — Early profiling of a Proxy-based prototype shows something surprising: it's faster with many subscribers. Not clear why, but the numbers don't lie.
   - Code sample: the API shift — `count()` / `count.set(5)` to `signal.count` / `signal.count = 5`

5. **What Dies** — `select()` and `lens()` become unnecessary. Proxy-based state gives you direct property access — `signal.count` is already what `select('count')` was doing. `readonlyState` and `protectedState` are still on the todo list, but every DX experiment so far has been terrible. Maybe they never land. And that's okay.

6. **Committing to Epoch 2** — The decision to call this v2000.0.0. Not a minor version bump. Not even a major. A new epoch. The function-based era is over. 525 lines added, 570 deleted. The diff is almost symmetric — a true replacement, not an addition.

7. **The Performance Crisis** — The first working Proxy-based version isn't just slower. It's significantly more memory hungry than v1000. The benchmarks are bad enough to prevent releasing. You've committed to an architecture that doesn't yet perform well enough to ship.
   - Cliffhanger: leads into Episode 4

8. **Takeaway** — Measurement reveals what intuition hides. Sometimes the path forward requires destroying what works to build what's right.

---

## Episode 4 — "AI Helped Build This (And Then I Had to Take the Wheel)"

**Hook**: AI is a powerful collaborator. It's also confidently wrong in ways that are hard to catch.

### Sections

1. **Sonnet for Ideation** — A new AI model releases. You discover it's good enough for ideation. You feed it Beacon's codebase and ask: what could be improved? Sonnet proposes hooks — zero-cost instrumentation for all four primitives. The idea is good. You keep it. But nothing Sonnet proposes fits cleanly into the function-based architecture. The ideas need a different foundation.

2. **Opus for Code Review** — A more capable model releases. You ask it to review the codebase. It spots DX flaws in code examples you'd been blind to. The review leads directly to the `select()` API, then `lens()`. AI as a fresh pair of eyes — genuinely useful.

3. **Opus for v1000 Performance** — Facing the performance gap between v1000 and the Proxy prototype, you feed Opus profiling data. It finds real optimizations. v1000 gets faster, uses less memory. You ship `1000.3.0`. The benchmark suite finishes in about 20 seconds. Opus proves its value as an optimization partner.

4. **Opus for Epoch-2 Performance** — Naturally, you try the same approach for the Proxy-based version. Epoch-2 is finishing the benchmark suite in 37 seconds. There's work to do.

5. **The Confidence Problem** — Opus is very confident that every change improves performance. It applies changes cumulatively — multiple optimizations stacked without isolating their individual impact. Neither you nor Opus can tell which changes actually helped. When benchmark differences are small, Opus declares them "noise." Then you notice something worse: Opus altered the benchmark script during a session.

6. **The Reckoning** — You review the changes. Run the benchmarks yourself. The numbers don't match what Opus claimed. The lesson isn't that AI is useless — it's that AI has no mechanism for intellectual honesty. It doesn't know it's wrong. It doesn't hedge when it should. It presents speculation as fact.

7. **The New Workflow** — You don't fire Opus. You restructure the collaboration. For performance work, you take the lead. You form the hypothesis. Opus implements one change at a time. You run the benchmark. You confirm or reject. No more cumulative changes. No more "noise" excuses. No more mid-session benchmark alterations.
   - Could include a before/after workflow diagram

8. **The Results** — Under disciplined optimization: Epoch-2 goes from 37 seconds to 13 seconds. Faster than v1000's 20 seconds. Creating states is still expensive. Reading values without effects is still expensive. But nobody creates signals without using them. The realistic workloads are fast.

9. **Takeaway** — Trust but verify. AI is still a partner — for ideation, for code review, for implementation. But for anything with measurable outcomes, you hold the measuring tape. The numbers are yours to own.

---

## Episode 5 — "The Backend Signal"

**Hook**: Not every library needs to run everywhere. Sometimes the constraint is the feature.

### Sections

1. **The Frontend Assumption** — Every signals library targets the browser. React, Vue, Solid, Angular — signals are a UI primitive. Beacon was never built for that. It was built for Node.js. The question isn't "why not frontend?" — it's "what does a signal look like when it doesn't serve a render loop?"

2. **No Magic Numbers** — Most signal libraries detect infinite loops by counting: if the cycle counter hits some arbitrary threshold, throw. Beacon doesn't. It checks causation: does this effect write to the same state it reads from? If yes, throw. If the cycle is across different effects, it's allowed — and resolved through value equality convergence.
   - Code sample: direct loop (blocked) vs. indirect cycle (allowed)

3. **The 16ms Question** — Beacon is fast. It can run in a browser. But signals used for UI updates need to complete within ~16ms for 60fps rendering. Beacon cannot and will not guarantee to always finish in time. No magic cycle limit means effect chains run to completion or convergence — correct behavior for backends, but a gap for frame-sensitive UIs. That gap is intentional.

4. **Real-Time Config** — Watching a config file for changes. Setting state. Effects propagate the new config through the system. Enable or disable debug logging without restarting the process.
   - Code sample: config watcher to state to effects

5. **SQLite Persistence and Resumability** — The persist pattern and Beacon Rewind in action (introduced in Episode 2). How it works under the hood in a backend context: crash recovery, long-running tasks, state hydration on restart.
   - Reference back to Episode 2, link for deeper dive

6. **Hooks as Observability** — v1000 used effects and derives for instrumentation. That worked, but v1000 gets slow under effect-heavy workloads. Epoch-2 is faster and has hooks. Want to know when a specific property becomes undefined? `onWrite` hook. Want a change log? `onWrite` hook. Zero-cost when not used — a single falsy check that JIT optimizes away.
   - Code sample: hooks for change detection / logging

7. **The Ecosystem** — Beacon core. Beacon Rewind. Hooks. What a backend-first signals library makes possible when it doesn't carry the weight of UI rendering assumptions.

8. **Takeaway** — The modern instinct is to build for everything. But a library that knows what it's not is more useful than one that tries to be universal.

---

## Episode 6 — "Performance Deep-Dive"

**Hook**: Optimization without measurement is fiction.

### Sections

1. **The Benchmark Suite** — What's measured: state creation, property reads/writes, effect scheduling, batch operations, derive recomputation, memory allocation. Multi-cycle with GC and heap reporting.
   - Link to benchmark script

2. **Phase 1 Optimizations** — Stable dependency skip: if an effect's deps haven't changed, don't rebuild subscriber sets. Tracking reallocation elimination. Array reuse instead of allocation. Spread replacement with direct assignment. Dead code removal.
   - Before/after numbers for each

3. **Phase 2-3 Optimizations** — Symbol caching for hot property access. Reference-equality fast paths in dependency comparison. Cleanup loop optimization (loops replace spreads). WeakMap replacement with direct property access where possible.
   - Before/after numbers

4. **The Singleton Handler** — Hookless states share a single Proxy handler object. One allocation instead of one-per-state. Small change, measurable impact at scale.

5. **The Batch Fast Path** — During batch, the set handler skips subscriber scheduling entirely. Only dirty target-property pairs are tracked. Processing happens once at batch end.
   - Code sample: the fast path logic

6. **What Didn't Work** — The reverted optimizations. The changes that looked good in theory but showed no improvement (or regression) under measurement. Being honest about what was tried and discarded.

7. **Property-Based Testing** — After all the performance work: hardening correctness. PBT for every primitive — array mutations, same-value optimization, proxy identity, derive consistency, batch deduplication, infinite loop detection boundaries, cleanup completeness, frozen/sealed object reactivity.

8. **The Final Numbers** — v1000: ~20s. Epoch-2 initial: ~37s. Epoch-2 optimized: ~13s. State creation still expensive. Effectless reads still expensive. Realistic workloads: faster than the function-based version it replaced.

9. **Takeaway** — Measure one thing at a time. Reject "noise" as an explanation. Own your benchmark suite. The numbers don't lie, but the person interpreting them might.

---

## Series Meta

### Cross-linking

- Episode 2 introduces persist() and Beacon Rewind
- Episode 3's performance cliffhanger feeds into Episode 4
- Episode 5 references Episode 2's persist pattern for backend context
- Episode 4's methodology pays off in Episode 6

### Consistent Elements

- Each opens with a hook (one provocative sentence)
- Each closes with a takeaway (one thesis statement)
- Code samples inline where they serve the narrative, links for deep dives

### Publishing Cadence

One episode per week — gives readers time to absorb, gives the author time to write each one at the depth it deserves.
