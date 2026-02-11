# Beacon my story from Angular Signals to npm publish

You don't have to use a framework to be inspired by one.

---

## Why is everyone talking about signals

It starts the way most side projects start: someone else's problem catches your attention.

I orchestrate Angular developers. In late 2023, Angular shipped signals as a stable feature in version 17, a reactive primitive that tracks values and notifies consumers when they change. I watched colleagues adopt them. I watched the API surface shrink. Components that previously required elaborate lifecycle management became a handful of declarations: here's a value, here's what happens when it changes.

I'm not an Angular developer. I don't build SPAs. I build servers, CLI tools, and data pipelines in Node.js. But the concept lodged in my head anyway.

What is a signal, really?

Strip away the framework bindings, the template integration, the change detection optimization. A signal is a value that tells you when it changes. That's it. A container with a notification mechanism.

The more I thought about it, the less it seemed tied to any framework. It was a way to manage mutable state that had nothing to do with browsers or component rendering. Something that should work anywhere state changes and code needs to respond.

The question formed slowly over weeks: what would signals look like if they weren't built for a framework?

## Also TC39 has a signals proposal

The question led me to the TC39 Signals proposal.

TC39 is the committee that standardizes JavaScript. When they propose something, it means the idea has graduated from "framework feature" to "language-level concern." The Signals proposal was exactly that: an attempt to bring reactive primitives into the JavaScript specification itself.

The proposal sharpened my thinking. The TC39 authors had arrived at the same decomposition I was circling: a small set of primitives that compose into complex reactive behavior. State holds values. Computed values derive from state. Effects run when their dependencies change. That's the entire model.

But the proposal's gravity was unmistakably UI. The contributors were predominantly framework authors (Angular, Vue, Solid, Preact, Svelte) and the motivating examples reflected that world. The design was deliberately runtime-agnostic, but the conversations, the trade-offs, the implicit assumptions all orbited the browser. Every design decision carried the weight of needing to work inside React, Vue, Solid, and Angular simultaneously.

That wasn't my world.

I needed something for Node.js. For backend services that manage configuration, coordinate workers, stream data through pipelines, and persist state to databases. For processes that run for hours or days, not milliseconds between frames.

The TC39 proposal confirmed the primitives. But the context was wrong for my use case. I didn't need to support every framework's rendering model. I didn't need the effect API left deliberately unspecified so each framework could wire in its own scheduling.

I needed state, effect, derived, and batch. Four primitives. Nothing else.

## I cannot get lazy evaluation to work

Knowing what you want to build and knowing how to build it are different problems separated by weeks of bad code.

It was messy. I wrote reactive containers that leaked memory. I wrote dependency tracking that missed updates. I wrote batch implementations that deadlocked. Each prototype taught me something, mostly about what not to do.

I tried a purely pull-based system first, where computed values lazily recalculated on read. The TC39 proposal described this approach: derived values don't recompute eagerly, they wait until someone reads them. Elegant in theory. In practice, I couldn't make it work.

The problem was derived values inside effects. A derived value that lazily recomputes on read has no mechanism to tell an effect "your dependency changed, re-run." The effect sits idle, waiting for a notification that never comes, because the derived value only knows it's stale when someone pulls from it. Nothing triggers that pull. I'd see effects running with stale derived values, or sitting idle when they should have fired. The dependency graph was incomplete: state notified its direct subscribers, but the change signal died at the derived boundary instead of propagating upward to the effects that consumed it.

I needed a way to propagate change notifications through derived values to their dependent effects, but I didn't see it yet. A purely pull-based derived value is invisible to its consumers. The TC39 proposal solves this with a push-pull hybrid: derived values stay lazy but propagate dirty flags upward so effects know to re-execute, and only then does the derived value recompute.

Solid takes a different path: its `createMemo` is eager by default, pushing recomputation immediately when dependencies change, with an option to pull a fresh value early if read before the scheduler reaches it. Different architectures, same insight: purely lazy and purely eager are both incomplete.

I didn't know enough to build the pull-based hybrid. Ryan Carniato's GitHub discussions on Solid's eager evaluation gave me the direction. Push-based was within reach due to experience with event-driven patterns, enough research, and good ideas and code snippets from Claude Sonnet and Opus.

What eventually worked was a push-based system with property-level tracking. Each state property maintains its own set of subscribers. When a property changes, only effects that read that property are notified. No wasted notifications. No global broadcast. The dependency graph is explicit, built automatically as effects run and read state.

The mental model solidified. **State** holds values and tracks who reads them. **Effect** declares "run this function, and re-run it whenever anything it reads changes." **Derive** is a computed value that stays in sync with its dependencies. **Batch** groups multiple writes so effects run once, not once per write.

Four primitives.

## I want feedback - someone should look at this code

I showed the code to colleagues at work. They're mostly React developers, and React is a religion. A reactive state library with no roots in their ecosystem didn't register. If I wanted feedback, I'd have to publish it.

March 30, 2025. A Sunday.

The experimental code had been accumulating for weeks across scattered files, abandoned branches, notes-to-self in comments. Months of experimenting, discarding, restarting. By that Sunday, the code existed. It worked. What it lacked was a narrative.

I arranged the code into commits, not in writing order but in the order I'd come to understand signals. Six commits hit the repository that day:

The first was the foundation. `epoch(core): initial project structure and state implementation.` The state primitive, the reactive container, the subscriber tracking, all extracted from the experiments and refactored into a coherent module.

The `epoch` prefix was deliberate. Before writing the first commit, I'd already adopted [Epoch Semantic Versioning](https://antfu.me/posts/epoch-semver). Standard semver has a blind spot: it can't distinguish a routine breaking change from a security-critical one that demands immediate migration. Every breaking change gets the same signal: bump the major version. A rename of a rarely-used option and a fix for a critical vulnerability that reshapes the public API look identical in the version number.

Epoch semver solves this with a simple encoding: `(EPOCH * 1000) + MAJOR.MINOR.PATCH`. Regular semver lives in epoch 0. Within any epoch, patch bumps fix bugs, minor bumps add features, and major bumps break the API. But when a change is so fundamental it represents a complete restart, you increment the epoch. The commit types follow the same logic. `epoch` when the library restarts. `breaking` when the API changes. `feat` and `fix` for the rest. At the time, `1.0.0` sat comfortably in epoch 0.

The second added effects. `feat(effect): add effect implementation.` The automatic dependency tracking, the re-execution on change, the subscription lifecycle.

The third tackled the hard problems. `feat(core): add cleanup and cyclic dependency handling.` Two distinct problems, actually.

The first was cleanup. When an effect re-runs, you must tear down its previous subscriptions. Otherwise ghost dependencies trigger phantom re-runs. If an effect conditionally reads property A or property B based on some flag, and the flag changes, the effect must stop listening to the branch it no longer takes. That means tracking dependencies per-execution, diffing against the previous set, and unsubscribing from stale ones.

The second was harder: what happens when an effect writes to state it also reads? Most signal implementations I studied solved this with a counter. Run the effect, track how many times it re-triggers itself, and if that count exceeds some threshold (100, 500, 1000) declare it an infinite loop and throw. The numbers were arbitrary. Magic constants with no theoretical basis. They might work in UI environments with frame budgets that can absorb a few hundred wasted cycles. For a backend library running inside a hot loop processing thousands of events per second, "wait for 500 re-triggers before noticing something is wrong" felt reckless.

I'm not writing a compiler. Statically analyzing the function body passed to `effect()` to determine whether it will converge is out of scope. So detection had to be dynamic and immediate.

The rule I landed on was simple: if an effect writes to a property it read during the current execution, that's an infinite loop. Always. No counter, no threshold, no grace period. One read-write cycle on the same property in the same effect is enough to know it will never converge. Throw immediately.

This left the other case: cyclic dependencies between *different* effects. Effect A writes to state that Effect B reads, and Effect B writes to state that Effect A reads. That's not necessarily infinite; it depends on whether the values converge. Queue-based processing solved it. Effects trigger other effects by enqueuing them rather than calling them recursively. No stack overflow. Convergence through value equality: if an effect re-runs but produces the same values, the chain stops.

The fourth commit rounded out the primitives. `feat(batch): implement batch operations and enhance documentation.` Batch was the final piece: group multiple state writes, defer all effect execution until the batch completes, then flush once.

Two more commits: contribution docs and a performance documentation script. Housekeeping. The kind of work you do when something feels done but you're not ready to stop touching it.

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

`state(0)` creates a reactive container. Call it to read. Call `.set()` to write. `derived()` computes values from state. `effect()` returns a cleanup function; call it and the subscriptions are gone. That's the entire contract. Functions, not classes or decorators.

The design was deliberate. Functions compose well in JavaScript. They close over scope, pass as arguments, return from other functions. A signal that *is* a function goes wherever functions go. Module boundaries, data structures, higher-order abstractions.

Two days later, on April 1st, I formatted the code with Biome, fixed lint warnings, updated dependencies, configured npm publishing, and tagged `1.0.0`.

Three days. From scattered experiments to a published npm package.

## Brave enough to use it at work

Using your own library in customer projects takes nerve. Colleagues would touch the code, and they'd tell me what worked and what didn't. I put Beacon into internal tooling, CLI scripts, and customer-facing services. The API worked. The mental model was sound. `state`, `effect`, `derived`, `batch` composed the way I'd hoped.

But the internals had problems.

The first sign was the selector primitive. Within a day of publishing, I needed a way to subscribe to a specific property of a state object without subscribing to every property. I wrote `select()`, a targeted subscription mechanism. It worked, but the implementation felt bolted on. A patch over a design that missed the need.

Over the next eleven days, patches accumulated. I added CI pipelines and restructured them immediately. I rewrote the README. Test files multiplied as edge cases surfaced. Each fix was reasonable on its own. Together, they told me the architecture couldn't take much more.

On April 10th, eleven days after `1.0.0`, I did what needed to be done.

`epoch(core): complete rewrite of the library (#6)`.

I rewrote the whole thing. Same four primitives, same mental model, but every line of implementation was new. I rebuilt dependency tracking, subscriber notification, batch processing. Everything from March 30th, replaced.

I merged the PR the same day. The old code couldn't support extension. The new code could.

## I planned for this since the first commit

The rewrite created a version problem.

Standard semver says `2.0.0`. Breaking changes increment the major version. A complete rewrite qualifies. But `2.0.0` implies linear progression: version 1 evolved into version 2. That's not what happened. I threw away version 1 and wrote version 2 from scratch. The relationship between them was conceptual, not genealogical.

This was exactly the scenario epoch versioning was designed for. A complete rewrite isn't a breaking change; it's starting over. The `epoch` commit type fit precisely.

`1000.0.0`. Epoch 1, major 0, minor 0, patch 0. The major version resets within the new epoch. Minor and patch versions track incremental changes from there.

The scheme communicates what standard semver can't: the *magnitude* of change. `2.0.0` says "breaking changes." `1000.0.0` says "this is a different library that happens to solve the same problem." The version number itself is a message to re-evaluate your assumptions.

And the security blind spot that motivated the choice in the first place? Within epoch 1, it works exactly as designed. If `1000.1.0` is out and a security vulnerability requires changing the public API, that's a breaking change, `1001.0.0`. The major version bumps within the epoch. Consumers see the major version jump and know: this isn't a minor update, read the changelog, the API changed. But the epoch stays the same, it's still the same library, the same architecture, the same mental model. An epoch bump to `2000.0.0` would mean something far more drastic: throw away your assumptions entirely, this is a different library now.

A colleague told me I was overthinking version numbers. For a library with a handful of users and a single maintainer, `2.0.0` would have been fine. But versioning is a communication tool, and I wanted precision. `1000.0.0` was the precise message: epoch 1 starts here.

## No issues for months

With `1000.0.0` tagged, the real work began.

Over the next four days, features landed. `1000.2.0` added custom equality functions: tell Beacon two values are equivalent using your own comparison, and effects skip re-runs when shape changes but meaning holds. `1000.2.1` improved minification and package configuration.

Then months of using it. Beacon managed state in CLI tools, a persistence layer, a customer project that processed Excel into Storybook stories via Salesforce. It worked.

Until I came back from vacation. A colleague had worked on the customer project while I was away. He didn't understand signals, so he removed them and wrote his own code. I tried to salvage his business logic while restoring the reactive layer.

My usual debugging approach was effect-based logging: add `effect()` calls to trace how state flows through the system. It had worked before. This time, data processed, API calls succeeded, but no stories appeared. I kept adding effects to narrow the problem down. The script went from one hour per run to sixteen and counting. Profiling pointed straight at Beacon: every added effect cost real memory and CPU. The library I'd built to manage state was now the bottleneck.

Around the same time, I read blog posts about using Proxies for state management. The API was clean. Natural. `state = 5` instead of `state.set(5)`. The idea lodged itself the same way Angular's signals had.

But that rewrite is another episode.

That's how Beacon started. A concept borrowed from a framework I don't use, rebuilt for a runtime where nobody expected it, published on a Sunday afternoon. Three days and one version number. Then eleven days, a complete rewrite, and a version number that jumps by a thousand.

Today's library is unrecognizable from March 30th. It started because Angular shipped signals, and the idea wouldn't leave me alone.

---

*Next: Beacon in production.*
