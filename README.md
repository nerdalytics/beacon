# Beacon <img align="right" src="https://raw.githubusercontent.com/nerdalytics/beacon/refs/heads/trunk/assets/beacon-logo-v2.svg" width="128px" alt="A stylized lighthouse beacon with golden light against a dark blue background, representing the reactive state library"/>

> Reactive dependency graph runtime for Node.js backends. Tracks dependencies between signals and propagates updates automatically.

[![license:mit](https://flat.badgen.net/static/license/MIT/blue)](https://github.com/nerdalytics/beacon/blob/trunk/LICENSE)
[![registry:npm:version](https://img.shields.io/npm/v/@nerdalytics/beacon.svg)](https://www.npmjs.com/package/@nerdalytics/beacon)
[![Socket Badge](https://badge.socket.dev/npm/package/@nerdalytics/beacon/1000.3.3)](https://socket.dev/npm/package/@nerdalytics/beacon/overview/1000.3.3)

[![tech:nodejs](https://img.shields.io/badge/Node%20js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![language:typescript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org/)
[![linter:biome](https://img.shields.io/badge/biome-60a5fa?style=for-the-badge&logo=biome&logoColor=white)](https://biomejs.dev/)

## Installation

```
npm install @nerdalytics/beacon --save-exact
```

## Quick Start

```typescript
import { state, derive, effect } from '@nerdalytics/beacon';

const count = state(0);
const doubled = derive(() => count() * 2);

effect(() => {
  console.log(`Count: ${count()}, Doubled: ${doubled()}`);
});

count.set(5);
// => "Count: 5, Doubled: 10"
```

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
