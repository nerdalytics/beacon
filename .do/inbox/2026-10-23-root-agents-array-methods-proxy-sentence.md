# Root AGENTS.md says every mutating array method runs through the Proxy

**Status:** needs-triage

**Source:** ticket 07 of change `wrap-array-methods-on-hookless-state`, review round 2, low standards finding, approved with the finding open.

The array-methods bullet in the root `AGENTS.md` (line 37 at commit 77fd93e) says "Each runs through the Proxy inside a batch, so it wakes each subscriber of the array at most once per call, is subject to the loop check inside an effect, and is seen by the read and write hooks". After ticket 07 (commit bb355d0) `push` and `pop` run the native method on the raw target and replay the get, set and delete trap bookkeeping by hand; the other five methods still run through the Proxy. The three observable claims after the comma stay true. The reviewer's suggested wording is "Each runs inside a batch (`push` and `pop` on the raw target with the trap bookkeeping replayed by hand, the other five through the Proxy), so it wakes ...". A one-line docs edit to `AGENTS.md`, no code change.
