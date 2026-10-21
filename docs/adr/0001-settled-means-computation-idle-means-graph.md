# "Settled" names a computation outcome; the graph goes "idle"

Beacon v2001 used "settled" for three things: a promise-backed computation resolving or rejecting, the graph draining its effect queues (`onSettled`, `SettledCallback`), and an `until` evaluation that read no pending value. We decided to reserve "settled" for computations, matching JavaScript's promise vocabulary, and to rename the graph notification to `onIdle` with `IdleCallback`, accepting a breaking change to get one meaning per word. An `until` "settled evaluation" then needs no new term: it is an evaluation in which every computed value read was settled.

## Considered options

- Keep `onSettled` and rename the computation sense. Rejected: promises settle in the language itself, so Beacon cannot take the word away from them.
- Keep "settled" for all three senses and document the family. Rejected: `onSettled` fires while an async derive is still pending, so the graph sense and the computation sense can be true at different moments for the same write, and one word hid that.
- `onQuiet`, matching the internal `notifySettledIfQuiet` and the handbook's "goes quiet". Rejected in favor of `onIdle`, which is the familiar word for "nothing queued" from `requestIdleCallback`.

## Consequences

- Idle does not mean every computation has finished. `onIdle` fires after the flush that started an async computation and again when that computation settles.
- Renaming `onSettled` to `onIdle` is a breaking change and needs an epoch or major bump under the project's versioning scheme.
