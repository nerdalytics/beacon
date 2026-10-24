**Status:** needs-triage

Ticket 07 (commit 3a8e13a on `worktree-agent-acacc5eb0393bade9`) stores a `DirectArrayContext` in the `[HOOKS]` slot of every reactive array target, and the `push`/`pop` wrappers read it through `this[HOOKS]`. `HOOKS_TODO.md` item C1 says the `HOOKS` slot is never read; that is no longer true for arrays once ticket 07 lands. The implementer left the root file alone because it is outside the ticket's Area. One-line doc fix at landing or in the archive step.
