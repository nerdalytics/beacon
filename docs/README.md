# Beacon Documentation

Comprehensive documentation for Beacon — a Proxy-based reactive state management library.

## Core API

- [**State**](./README.state.md) - Creating and managing reactive state objects
- [**Effect**](./README.effect.md) - Running side effects that respond to state changes
- [**Derive**](./README.derive.md) - Computing derived values that update automatically
- [**Batch**](./README.batch.md) - Optimizing performance by grouping state updates

## Advanced Topics

- [**Core Concepts**](./README.core.md) - Understanding the reactive system architecture
- [**Debugging**](./README.debugging.md) - Tools and techniques for debugging reactive state
- [**Hooks**](./README.hooks.md) - Zero-cost instrumentation for all four primitives

## Quick Start

```typescript
import { state, effect, derive, batch } from '@nerdalytics/beacon';

// Create reactive state
const counter = state({ value: 0 });

// React to changes
effect(() => {
  console.log(`Count: ${counter.value}`);
});

// Compute derived values
const doubled = derive(() => counter.value * 2);

// Update state
counter.value++; // Logs: "Count: 1"
```

For detailed information on each topic, follow the links above.