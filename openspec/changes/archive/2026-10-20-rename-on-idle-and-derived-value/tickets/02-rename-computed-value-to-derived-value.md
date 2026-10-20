# 02: Rename `ComputedValue` to `DerivedValue`

**Area:** derived-value

**Blocked by:** 01

**What to build:** The type that `derive` returns is exported as `DerivedValue<T>` and `ComputedValue` no longer exists. The shape (`value`, `pending`, `reactive`) and both `derive` overloads are unchanged. Everything that names the type follows: the core's doc comments, the benchmark script, the agent docs, the README and the hooks roadmap. Prose in those files uses glossary vocabulary: "derived value" instead of "computed value", "pending" instead of "in flight", "computation" instead of "recompute" as a noun.

- [x] `DerivedValue` is exported from the package entry and is the return type of both `derive` overloads; importing `ComputedValue` fails to type-check
- [x] The benchmark script compiles and runs against the renamed type
- [x] `npm test`, `npm run test:coverage` and `npm run check` pass; `npm run build` succeeds
- [x] Root `AGENTS.md` and `src/AGENTS.md` name `DerivedValue` and use "derived value" and "pending" in prose
- [x] The README and `HOOKS_TODO.md` no longer say "computed value" or "in flight"
