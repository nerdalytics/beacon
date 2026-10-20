# Beacon <img align="right" src="https://raw.githubusercontent.com/nerdalytics/beacon/refs/heads/trunk/assets/beacon-logo-v2.svg" width="128px" alt="A stylized lighthouse beacon with golden light against a dark blue background, representing the reactive state library"/>

> Reactive dependency graph runtime for Node.js backends. Tracks dependencies between state properties and propagates updates automatically.

[![pm:yarn](https://img.shields.io/badge/yarn-2C8EBB?style=flat-square&logo=yarn&logoColor=white)](https://yarnpkg.com/)
[![pm:pnpm](https://img.shields.io/badge/pnpm-F69220?style=flat-square&logo=pnpm&logoColor=white)](https://pnpm.io/)
[![pm:jsr](https://img.shields.io/badge/jsr-F7DF1E?style=flat-square&logo=jsr&logoColor=black)](https://jsr.io/@nerdalytics/beacon)
[![pm:vlt](https://img.shields.io/badge/vlt-1A1A2E?style=flat-square&logoColor=white)](https://vlt.sh/)
[![registry:npm:version](https://img.shields.io/npm/v/@nerdalytics/beacon.svg)](https://www.npmjs.com/package/@nerdalytics/beacon)
[![Socket Badge](https://badge.socket.dev/npm/package/@nerdalytics/beacon/2002.0.0)](https://socket.dev/npm/package/@nerdalytics/beacon/overview/2002.0.0)

[![tech:nodejs](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![language:typescript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org/)
[![linter:biome](https://img.shields.io/badge/Biome-60a5fa?style=for-the-badge&logo=biome&logoColor=white)](https://biomejs.dev/)
[![license:mit](https://img.shields.io/badge/MIT-blue?style=for-the-badge)](https://github.com/nerdalytics/beacon/blob/trunk/LICENSE)

Tracks which properties each effect reads and re-runs only when those properties change. Zero dependencies, TypeScript-first.

## Installation

```bash
npm install @nerdalytics/beacon --save-exact
# or
yarn add @nerdalytics/beacon
# or
pnpm add @nerdalytics/beacon
# or
bun add @nerdalytics/beacon
# or
deno install npm:@nerdalytics/beacon
# or
npx jsr add @nerdalytics/beacon
# or
vlt install @nerdalytics/beacon
```

## Quick Start

```typescript
import { state, derive, effect } from '@nerdalytics/beacon';

const counter = state({ count: 0 });
const doubled = derive(() => counter.count * 2);

const dispose = effect(() => {
  console.log(`Count: ${counter.count}, Doubled: ${doubled.value}`);
});
// => "Count: 0, Doubled: 0"

counter.count = 5;
// => "Count: 5, Doubled: 10"

dispose();
doubled.reactive = false;
```

## Async API (v2001)

### Async derive and `pending`

`derive` accepts async compute functions. While a computation is pending the value keeps its last settled result and `pending` is `true`; `pending` is itself a trackable dependency. Superseded computations are discarded, and rejections route to the `onError` hook.

```typescript
const user = derive(async () => (await db.users.find(route.id)) ?? null);
effect(() => {
  if (user.pending) return;
  console.log(user.value);
});
```

### `until`

`until(predicate, { timeout?, signal? })` resolves with the predicate's value once a settled evaluation is truthy — safe to await inside request handlers. It throws when called inside a reactive scope and disposes itself on settle, timeout, or abort.

```typescript
await until(() => cache.warm, { timeout: 5000 });
```

### `onIdle`

`onIdle(callback)` invokes the callback each time the graph goes idle after processing work (a flush or an async settlement): no effect is queued and no microtask flush is armed. A pending async computation does not keep the graph busy, so the callback fires after the flush that started the computation and again once it settles. Returns an unsubscribe function.

### Effect `schedule` option

`effect(fn, name, hooks, { schedule: 'microtask' })` defers re-runs to a microtask, coalescing writes across await boundaries into one run. The default `'sync'` preserves v2000 timing exactly.

**Migration note:** synchronous `derive` and default-schedule effects behave exactly as in v2000; the only consumer-visible changes are the new `pending` field on derived values and async compute support.

## Documentation

Full documentation, API reference, and examples available at:
**[nerdalytics.github.io/beacon](https://nerdalytics.github.io/beacon/)**

### LLM-friendly docs

The handbook has plain-text endpoints for LLMs:

- [`llms.txt`](https://nerdalytics.github.io/beacon/llms.txt) lists available versions
- [`<version>/llms.txt`](https://nerdalytics.github.io/beacon/latest/llms.txt) lists pages for a version
- [`<version>/llms-full.txt`](https://nerdalytics.github.io/beacon/latest/llms-full.txt) concatenates every page into one file

You can also append `.md` to any handbook page URL for its Markdown source (e.g. [`<version>/introduction.md`](https://nerdalytics.github.io/beacon/latest/introduction.md)).

## License

MIT - See [LICENSE](./LICENSE) for details.
