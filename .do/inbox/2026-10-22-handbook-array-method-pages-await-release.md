# Handbook pages for array mutating methods wait for the next release tree

**Category:** docs
**Status:** needs-triage

Change `wrap-array-methods-on-hookless-state` makes the seven array mutating methods run through the Proxy inside a batch on both kinds of state, with one wake per call, loop detection inside an effect and hook visibility, and unifies the set trap so hook presence never changes notification. By ruling Q35 c on 2026-10-22 the change ships no version bump, because further inbox items are expected to make the next release a breaking one. The handbook keeps one frozen route tree per release (`GLOSSARY.md`, Handbook entry), so the pages that describe array interception, `architecture/+page.md` and `effects/+page.md` under `handbook/src/routes/v2002.0.0/`, plus the raw-target write sentences on the state page of that tree, stay as they are until the release that carries the behavior creates its tree. That release change must rewrite those sentences in the new tree to match the `array-mutation` spec of the archived change.
