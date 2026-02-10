# From Angular Signals to npm publish

You don't have to use a framework to be inspired by one.

---

## The Spark

It starts the way most side projects start: someone else's problem catches your attention.

I work alongside Angular developers. In 2023, Angular introduced signals — a reactive primitive that tracks values and automatically notifies consumers when those values change. I watched colleagues adopt them. I watched the API surface shrink. Components that previously required elaborate lifecycle management became a handful of declarations: here's a value, here's what happens when it changes.

I'm not an Angular developer. I don't build SPAs. My work is backend Node.js — servers, CLI tools, data pipelines. But the concept lodged in my head anyway.

What is a signal, really?

Strip away the framework bindings, the template integration, the change detection optimization. At its core, a signal is a value that tells you when it changes. That's it. A container with a notification mechanism. The simplest useful abstraction over mutable state.

The more I thought about it, the less it felt like a framework feature. It felt like a pattern. A pattern that had nothing inherently to do with browsers, DOM updates, or component rendering. A pattern that should work anywhere you have state that changes and code that needs to respond.

The question formed slowly over weeks: what would signals look like if they weren't built for a framework?

## Down the Rabbit Hole

The question led me to the TC39 Signals proposal.

TC39 is the committee that standardizes JavaScript. When they propose something, it means the idea has graduated from "framework feature" to "language-level concern." The Signals proposal was exactly that — an attempt to bring reactive primitives into the JavaScript specification itself.

Reading the proposal was clarifying. The TC39 authors had arrived at the same decomposition I was circling: a small set of primitives that compose into complex reactive behavior. State holds values. Computed values derive from state. Effects run when their dependencies change. That's the entire model.

But the proposal's gravity was unmistakably UI. The contributors were predominantly framework authors — Angular, Vue, Solid, Preact, Svelte — and the motivating examples reflected that world. The design was deliberately runtime-agnostic, but the conversations, the trade-offs, the implicit assumptions all orbited the browser. Every design decision carried the weight of needing to work inside React, Vue, Solid, and Angular simultaneously.

That wasn't my world.

I needed something for Node.js. For backend services that manage configuration, coordinate workers, stream data through pipelines, and persist state to databases. For processes that run for hours or days, not milliseconds between frames.

The TC39 proposal told me the primitives were right. It also told me the context was wrong — wrong for my use case, at least. I didn't need to support every framework's rendering model. I didn't need the effect API left deliberately unspecified so each framework could wire in its own scheduling.

I needed four things: state, effect, derived, batch. Four primitives. Nothing else.

## The Experimental Phase

Knowing what you want to build and knowing how to build it are different problems separated by weeks of bad code.

The experimental phase was messy. I wrote reactive containers that leaked memory. I wrote dependency tracking that missed updates. I wrote batch implementations that deadlocked. Each prototype taught me something, mostly about what not to do.

The first attempt was too clever. I tried to build a pull-based system where computed values lazily recalculated on read. It was elegant in theory and a nightmare to debug. Stale values appeared in effects because the evaluation order was unpredictable. A pull-based system works when you control the read timing — in a render loop, for instance. It falls apart when effects can fire at any moment in response to arbitrary writes.

The second attempt was too simple. A global event emitter that broadcast every change to every listener. It worked but scaled terribly. Ten state variables with ten effects meant a hundred notifications per change, most of them irrelevant.

The third attempt found the shape. Property-level tracking. Each state property maintains its own set of subscribers. When a property changes, only the effects that actually read that property are notified. No wasted notifications. No global broadcast. The dependency graph is implicit — built automatically as effects run and read state.

The mental model solidified: **state** holds values and tracks who reads them. **Effect** declares "run this function, and re-run it whenever anything it reads changes." **Derive** is a computed value that stays in sync with its dependencies. **Batch** groups multiple writes so effects run once, not once per write.

Four primitives. Each one simple enough to explain in a sentence. Powerful enough in combination to model any reactive system I could think of.

## March 30th

March 30, 2025. A Sunday.

The experimental code had been accumulating for weeks — scattered files, abandoned branches, notes-to-self in comments. Months of experimenting, discarding, restarting. By that Sunday, the code existed. It worked. What it lacked was a narrative.

I took the logical groups of code and arranged them into commits — not in the order I'd written them, but in the order that told the story of how I'd come to understand signals. Six commits hit the repository that day:

The first was the foundation. `epoch(core): initial project structure and state implementation.` The state primitive, the reactive container, the subscriber tracking — all extracted from the experiments and refactored into a coherent module.

That `epoch` prefix wasn't accidental. Before writing the first commit, I'd already adopted [Epoch Semantic Versioning](https://antfu.me/posts/epoch-semver). Standard semver has a blind spot: it can't distinguish a routine breaking change from a security-critical one that demands immediate migration. Every breaking change gets the same signal — bump the major version. A rename of a rarely-used option and a fix for a critical vulnerability that reshapes the public API look identical in the version number.

Epoch semver solves this with a simple encoding: `(EPOCH * 1000) + MAJOR.MINOR.PATCH`. Regular semver lives in epoch 0. Within any epoch, versioning works exactly as you'd expect — patch for fixes, minor for features, major for breaking changes. But when a change is so fundamental it represents a new era — a complete rewrite, a paradigm shift — you increment the epoch. The commit types reflected this: `epoch` for paradigm shifts, `breaking` for API changes, `feat` for features, `fix` for patches. At the time, `1.0.0` sat comfortably in epoch 0.

The second added effects. `feat(effect): add effect implementation.` The automatic dependency tracking, the re-execution on change, the subscription lifecycle.

The third tackled the hard problems. `feat(core): add cleanup and cyclic dependency handling.` Two distinct problems, actually.

The first was cleanup. When an effect re-runs, its previous subscriptions need to be torn down — otherwise you get ghost dependencies that trigger phantom re-runs. If an effect conditionally reads property A or property B based on some flag, and the flag changes, the effect must stop listening to the branch it no longer takes. That means tracking dependencies per-execution, diffing against the previous set, and unsubscribing from stale ones.

The second was harder: what happens when an effect writes to state it also reads? Most signal implementations I studied solved this with a counter. Run the effect, track how many times it re-triggers itself, and if that count exceeds some threshold — 100, 500, 1000 — declare it an infinite loop and throw. The numbers were arbitrary. Magic constants with no theoretical basis. Maybe they make sense in UI environments where you have frame budgets and can afford a few hundred wasted cycles before bailing out. For a backend library that might run inside a hot loop processing thousands of events per second, "wait for 500 re-triggers before noticing something is wrong" felt reckless.

I'm not writing a compiler. Statically analyzing the function body passed to `effect()` to determine whether it will converge is out of scope. So the detection had to be dynamic, and it had to be immediate.

The rule I landed on was simple: if an effect writes to a property it read during the current execution, that's an infinite loop. Always. No counter, no threshold, no grace period. One read-write cycle on the same property in the same effect is enough to know it will never converge. Throw immediately.

This left the other case: cyclic dependencies between *different* effects. Effect A writes to state that Effect B reads, and Effect B writes to state that Effect A reads. That's not necessarily infinite — it depends on whether the values converge. The answer was queue-based processing. Effects trigger other effects by enqueuing them rather than calling them recursively. No stack overflow. Convergence through value equality — if an effect re-runs but produces the same values, the chain stops.

The fourth commit rounded out the primitives. `feat(batch): implement batch operations and enhance documentation.` Batch was the final piece: group multiple state writes, defer all effect execution until the batch completes, then flush once.

Two more commits followed — contribution docs and a performance documentation script. Housekeeping. The kind of work you do when you've just built something and you're staring at it, wondering if it's real.

The API that emerged was function-based:

```typescript
import { state, derived, effect, batch } from "@nerdalytics/beacon";

// Create reactive state
const count = state(0);
const doubled = derived(() => count() * 2);

// Read values
console.log(count()); // => 0
console.log(doubled()); // => 0

// Setup an effect that automatically runs when dependencies change
// effect() returns a cleanup function that removes all subscriptions when called
const unsubscribe = effect(() => {
  console.log(`Count is ${count()}, doubled is ${doubled()}`);
});
// => "Count is 0, doubled is 0" (effect runs immediately when created)

// Update values - effect automatically runs after each change
count.set(5);
// => "Count is 5, doubled is 10"

// Update with a function
count.update((n) => n + 1);
// => "Count is 6, doubled is 12"

// Batch updates (only triggers effects once at the end)
batch(() => {
  count.set(10);
  count.set(20);
});
// => "Count is 20, doubled is 40" (only once)

// Unsubscribe the effect to stop it from running on future updates
// and clean up all its internal subscriptions
unsubscribe();
```

`state(0)` creates a reactive container. Call it to read. Call `.set()` to write. `derived()` computes values from state. `effect()` returns a cleanup function — call it and the subscriptions are gone. That's the entire contract. No classes, no decorators, no configuration objects. Just functions.

The design was deliberate. Functions are the most composable unit in JavaScript. They close over scope. They pass as arguments. They return from other functions. A signal that *is* a function can go anywhere a function can go — into arrays, into maps, into higher-order functions, across module boundaries. No wrapping, no unwrapping, no ceremony.

Two days later, on April 1st, I formatted the code with Biome, fixed lint warnings, updated dependencies, configured npm publishing, and tagged `1.0.0`.

Three days. From scattered experiments to a published npm package.

## First Contact with Reality

Publishing a library is a statement. It says: this is ready. It says: someone else could use this.

Both of those statements were premature.

I started using Beacon immediately — in internal tooling, in CLI scripts, in small backend services. The API worked. The mental model was sound. `state`, `effect`, `derived`, `batch` composed the way I'd hoped.

But the internals had problems.

The first sign was the selector primitive. Within a day of publishing, I needed a way to subscribe to a specific property of a state object without subscribing to every property. The `select()` function was born — a targeted subscription mechanism. It worked, but the implementation felt bolted on. It was a patch over a design that hadn't anticipated the need.

Over the next eleven days, the patches accumulated. CI pipelines were added and immediately restructured. The README was rewritten. Test files multiplied as edge cases surfaced. Each fix was reasonable on its own. Together, they painted a picture: the architecture was straining under the weight of real-world requirements.

On April 10th, eleven days after `1.0.0`, I did what needed to be done.

`epoch(core): complete rewrite of the library (#6)`.

Not a refactor. Not a major version bump. A complete rewrite. The same four primitives, the same mental model, but entirely new internals. The dependency tracking was rebuilt. The subscriber notification was rebuilt. The batch processing was rebuilt. Everything that existed on March 30th was replaced.

The PR was merged the same day it was opened. There was no deliberation. The old code wasn't salvageable in the way that mattered — structurally sound enough to extend. The new code was.

## The Version Question

The rewrite created a version problem — but not the one you might expect.

Standard semver says `2.0.0`. Breaking changes increment the major version. A complete rewrite certainly qualifies. But `2.0.0` implies a linear progression — version 1 evolved into version 2. That's not what happened. Version 1 was thrown away. Version 2 was written from scratch. The relationship between them was conceptual, not genealogical.

This was exactly the scenario epoch versioning was designed for. A complete rewrite isn't a breaking change — it's a new era. The `epoch` commit type I'd been using since the first commit was the precise tool for this moment.

`1000.0.0`. Epoch 1, major 0, minor 0, patch 0. The major version resets within the new epoch. Minor and patch versions track incremental changes from there.

The scheme communicates something that standard semver can't: the *magnitude* of the change. `2.0.0` says "breaking changes." `1000.0.0` says "this is a different library that happens to solve the same problem." The version number itself tells you to re-evaluate your assumptions.

And the security blind spot that motivated the choice in the first place? Within epoch 1, it works exactly as designed. If `1000.1.0` is out and a security vulnerability requires changing the public API, that's a breaking change — `1001.0.0`. The major version bumps within the epoch. Consumers see the major version jump and know: this isn't a minor update, read the changelog, the API changed. But the epoch stays the same — it's still the same library, the same architecture, the same mental model. An epoch bump to `2000.0.0` would mean something far more drastic: throw away your assumptions entirely, this is a different library now.

Some people find epoch versioning excessive. For a library with a handful of users and a single maintainer, `2.0.0` would have been fine. But versioning is a communication tool, and I wanted precision. `1000.0.0` was the precise message: epoch 1 starts here.

## What Came Next

With `1000.0.0` tagged, the real work began.

Over the next four days, the library matured rapidly. Custom equality functions landed in `1000.2.0` — the ability to tell Beacon "these two values are the same" using your own comparison logic, preventing unnecessary effect re-runs when values change shape but not meaning. Minification and package configuration improvements followed in `1000.2.1`.

Then silence.

From April 14 to October 23, 2025 — six months — the git log shows nothing. No commits. No PRs. No issues.

This wasn't abandonment. It was the opposite. Beacon was in production. It was managing state in CLI tools. It was coordinating effects in a SQLite persistence layer. It was doing exactly what it was built to do, quietly, without requiring changes.

Six months of silence in a git log can mean two things: the project is dead, or the project is done. Beacon was neither — it was stable. Stable enough that the next change wouldn't come from a bug report or a missing feature. It would come from a question: what if the entire API paradigm was wrong?

But that's a story for another episode.

## Takeaway

Sometimes the best way to understand a concept is to rip it out of its context and rebuild it somewhere else entirely.

Angular's signals were designed for component rendering. The TC39 proposal was designed for cross-framework compatibility. Beacon was designed for none of those things. It was designed for backend Node.js — for servers, scripts, and long-running processes that have no DOM, no render loop, no frame budget.

The concept transferred because the concept was sound. Reactive state management isn't a UI pattern. It's a state management pattern. The framework context was incidental, not essential.

You don't need permission to be inspired by something outside your domain. You don't need the original authors' use case to match yours. You don't even need the concept to survive the transfer intact — Beacon's API looks nothing like Angular's signals, and the TC39 proposal would barely recognize it.

What you need is the willingness to pull an idea apart, examine the pieces, and reassemble them for your own problem. The result might be unrecognizable. It might be better. It might be worse. But it will be *yours*, shaped by constraints that no one else has, solving problems that no one else faces.

That's how Beacon started. A concept borrowed from a framework I don't use, rebuilt for a runtime where nobody expected it, published on a Sunday afternoon after three days of focused work. Three days and one version number. Then eleven days, a complete rewrite, and a version number that jumps by a thousand.

The library that exists today — two epochs, dozens of optimizations, a hooks system, property-based tests, and a Proxy-based architecture later — is unrecognizable from what shipped on March 30th. But March 30th is where it started. And it started because someone else's framework did something interesting, and I couldn't stop thinking about it.

---

*Next episode: "Real Users Break Everything" — what happens when Beacon meets production, and how every feature in the v1000 era was a direct response to something that went wrong.*
