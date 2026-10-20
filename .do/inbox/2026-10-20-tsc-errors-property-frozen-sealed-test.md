# `tests/property-frozen-sealed.test.ts` fails `tsc --noEmit` on trunk

**Category:** bug
**Status:** needs-triage

Running the repo's type-checker over `tsconfig.json`, which includes the tests, reports `tests/property-frozen-sealed.test.ts(377,12): error TS2339: Property 'a' does not exist on type 'object'.` and the same error at lines 381 and 383. The ticket 01 implementer of change `rename-on-idle-and-derived-value` saw it on 2026-10-20 at commit d8d2dda via `npm run build -- --noEmit -p tsconfig.json`, in a file its diff did not touch, so the errors pre-date that change. `npm test` does not catch it because tests run under Node's type stripping, and `npm run build` compiles only `src/` through `tsconfig.build.json`. No npm script type-checks the tests, which is why nothing in CI fails. Fix is a type narrowing or assertion at the three sites, and optionally a `typecheck` script so the tests are checked in CI.
