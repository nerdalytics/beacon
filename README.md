# Beacon <img align="right" src="https://raw.githubusercontent.com/nerdalytics/beacon/refs/heads/trunk/assets/beacon-logo-v2.svg" width="128px" alt="A stylized lighthouse beacon with golden light against a dark blue background, representing the reactive state library"/>

> Lightweight reactive state management for Node.js backends

[![license:mit](https://flat.badgen.net/static/license/MIT/blue)](https://github.com/nerdalytics/beacon/blob/trunk/LICENSE)
[![registry:npm:version](https://img.shields.io/npm/v/@nerdalytics/beacon.svg)](https://www.npmjs.com/package/@nerdalytics/beacon)
[![Socket Badge](https://badge.socket.dev/npm/package/@nerdalytics/beacon/2000.0.0)](https://socket.dev/npm/package/@nerdalytics/beacon/overview/2000.0.0)

[![tech:nodejs](https://img.shields.io/badge/Node%20js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![language:typescript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org/)
[![linter:biome](https://img.shields.io/badge/biome-60a5fa?style=for-the-badge&logo=biome&logoColor=white)](https://biomejs.dev/)

Tracks which properties each effect reads and re-runs only when those properties change. Zero dependencies, TypeScript-first.

## Installation

```
npm install @nerdalytics/beacon@2000.0.0 --save-exact
```

## Quick Start

```typescript
import { state, derive, effect } from '@nerdalytics/beacon';

const signal = state({ count: 0 });
const doubled = derive(() => signal.count * 2);

const dispose = effect(() => {
  console.log(`Count: ${signal.count}, Doubled: ${doubled.value}`);
});
// => "Count: 0, Doubled: 0"

signal.count = 5;
// => "Count: 5, Doubled: 10"

dispose();
doubled.reactive = false;
```

## Documentation

Full documentation:
**[nerdalytics.github.io/beacon](https://nerdalytics.github.io/beacon/)**

## License

MIT - See [LICENSE](./LICENSE) for details.
