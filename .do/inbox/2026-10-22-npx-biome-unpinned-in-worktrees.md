# `npm run check` runs an unpinned Biome in a worktree without node_modules

**Category:** tooling
**Status:** needs-triage

The `check`, `check:fix`, `format` and `lint` scripts in `package.json` (lines 57 to 62) call `npx @biomejs/biome`, and the devDependency pins `@biomejs/biome` at `2.4.11` (line 5). In a fresh git worktree there is no `node_modules`, so `npx` resolves the latest published Biome instead of the pinned one. The ticket 02 reviewer of change `wrap-array-methods-on-hookless-state` saw this on 2026-10-22 in worktree `agent-aa924c77f2417c380`: `npm run check` printed `Found 2 infos.` from Biome 2.6.2 (schema mismatch and a `recommended` deprecation), while the pinned 2.4.11 against the same tree printed `Checked 62 files in 66ms. No fixes applied.` and the main checkout printed no infos. A newer Biome could also fail or pass a rule the pinned one does not, so a worktree check is not the same check as CI. Options: call the binary from `node_modules/.bin` or `npm exec --no` in the scripts, or have worktrees install dependencies before checks (a `WorktreeCreate` hook or `.worktreeinclude`).
