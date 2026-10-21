# `src/AGENTS.md` still says "coverage targets"

**Category:** enhancement
**Status:** needs-triage

The ticket 03 implementer of change `enforce-coverage-thresholds` reported on 2026-10-21 that `src/AGENTS.md` line 239 reads "coverage targets: 100% branches, 100% functions". `GLOSSARY.md` lists "coverage targets" under the terms to avoid for the entry **Coverage gate**. Ticket 03 named only the root agent docs and the tests agent docs, so the implementer left this line unchanged. One-word fix: replace "coverage targets" with "coverage gate" at that line, after checking the numbers against `node.config.json`.
