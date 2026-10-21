# `tests/property-frozen-sealed.test.ts` fails `tsc --noEmit` on trunk

**Category:** bug
**Status:** wontfix

Running the repo's type-checker over `tsconfig.json`, which includes the tests, reports `tests/property-frozen-sealed.test.ts(377,12): error TS2339: Property 'a' does not exist on type 'object'.` and the same error at lines 381 and 383. The ticket 01 implementer of change `rename-on-idle-and-derived-value` saw it on 2026-10-20 at commit d8d2dda via `npm run build -- --noEmit -p tsconfig.json`, in a file its diff did not touch, so the errors pre-date that change. `npm test` does not catch it because tests run under Node's type stripping, and `npm run build` compiles only `src/` through `tsconfig.build.json`. No npm script type-checks the tests, which is why nothing in CI fails. Fix is a type narrowing or assertion at the three sites, and optionally a `typecheck` script so the tests are checked in CI.

## Triage notes

Triaged on 2026-10-20. Reproduced with `npm run build -- --noEmit -p tsconfig.json`, which reported the three TS2339 errors at lines 377, 381 and 383. Root cause was one annotation, not three sites: the `defineProperty` trap in the test "extensible targets that reject symbol properties notify via proxyCacheSubs" typed its target parameter as `object`, so TypeScript inferred `ProxyHandler<object>` for the whole handler and the `new Proxy(...)` result, and `state()` returned `object`. Fixed on branch `breaking/rename-on-idle-and-derived-value` in commit 08e8052 by typing the trap target as `{ a: number }`. After the fix the same command reports no TypeScript errors, the file's 21 tests pass under `node --test`, and `npm run check` reports no Biome issues. The optional `typecheck` script and CI step were not added; the coverage-thresholds issue in this inbox carries the CI gating work.
