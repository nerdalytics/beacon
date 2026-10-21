# 05: Release surface and version 2002.0.0

**Area:** handbook

**Blocked by:** 04

**What to build:** The repository presents one vocabulary and one version. The README tagline and the package description describe tracking dependencies between state properties rather than between signals, the quick-start example names its state object something other than `signal`, and the Socket badge points at the new version. The version is 2002.0.0 in both manifests, and the root agent docs state it as current. A search over the repository finds the old names `onSettled`, `SettledCallback` and `ComputedValue` only in frozen handbook trees older than v2002.0.0 and in the OpenSpec archive. The `signals` npm keyword stays.

- [x] `package.json` and `jsr.json` both say `2002.0.0`, and the version sync script passes
- [x] The README tagline and the `package.json` description no longer say "signals"; the `signals` keyword remains
- [x] The README quick-start and async examples use a state variable name other than `signal`
- [x] The README Socket badge names 2002.0.0
- [x] Root `AGENTS.md` names v2002.0.0 as the current version
- [x] A `git grep` over tracked files for `onSettled`, `SettledCallback` and `ComputedValue` matches only handbook trees older than v2002.0.0, the v2002.0.0 migration page, `GLOSSARY.md`, `docs/adr/` and `openspec/`
- [x] `npm test`, `npm run check` and `npm run build` pass at the root
