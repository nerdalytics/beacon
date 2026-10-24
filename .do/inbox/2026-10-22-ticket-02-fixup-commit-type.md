# Ticket 02 fix-up commit uses type `docs` for a test rename

**Category:** standards
**Status:** needs-triage

Commit `a2f76e0 docs(core): align the test count, test name and fast-path note` on the ticket 02 branch of change `wrap-array-methods-on-hookless-state` renames a test in `tests/infinite-loop.test.ts` alongside two agent-docs edits. The round 2 reviewer on 2026-10-22 rated it `low standards`: a code change under a `docs` type. The convention in `CONTRIBUTING.md` lines 81 to 92 has a `test` type for that. The commit landed as approved because the finding was low and the fix-up's review returned only low standards findings. If the change branch is squashed into trunk by pull request the type disappears; otherwise it is a history note.
