## Comprehensive Hooks Interface Plan for Beacon

### Architecture Overview

The hooks system will transform Beacon from using `__DEV__` checks to a sophisticated, zero-cost abstraction that enables extensibility without performance overhead.

### 1. Core Hook Interfaces

**StateHook<T>** - Intercept all proxy operations:
- `onRead?: undefined | (prop: PropertyKey, value: unknown, target: T) => void` - Property access tracking
- `onWrite?: undefined | (prop: PropertyKey, oldValue: unknown, newValue: unknown, target: T) => void` - Mutation monitoring
- `onDelete?: undefined | (prop: PropertyKey, hadProperty: boolean, target: T) => void` - Deletion tracking
- `onHas?: undefined | (prop: PropertyKey, exists: boolean, target: T) => void` - 'in' operator monitoring
- `onOwnKeys?: undefined | (keys: PropertyKey[], target: T) => void` - Key enumeration tracking

***Example State Hook***: Self-Tracking State Monitor
```typescript
function monitorState<T>(): StateHook<T> {
  const accessPatterns = new Map<object, {
    reads: Map<PropertyKey, number>;
    writes: Map<PropertyKey, { count: number; values: unknown[] }>;
    deletes: Set<PropertyKey>;
    hasChecks: Map<PropertyKey, number>;
    keyEnumerations: number;
  }>();

  const getOrCreateMetrics = (target: T) => {
    if (!accessPatterns.has(target as object)) {
      accessPatterns.set(target as object, {
        reads: new Map(),
        writes: new Map(),
        deletes: new Set(),
        hasChecks: new Map(),
        keyEnumerations: 0
      });
    }
    return accessPatterns.get(target as object)!;
  };

  return {
    onRead(prop, value, target) {
      const metrics = getOrCreateMetrics(target);
      metrics.reads.set(prop, (metrics.reads.get(prop) || 0) + 1);

      // Track hot properties
      const readCount = metrics.reads.get(prop)!;
      if (readCount === 100) {
        console.warn(`Hot property detected: ${String(prop)} read ${readCount} times`);
      }
    },

    onWrite(prop, oldValue, newValue, target) {
      const metrics = getOrCreateMetrics(target);
      let writeData = metrics.writes.get(prop);
      if (!writeData) {
        writeData = { count: 0, values: [] };
        metrics.writes.set(prop, writeData);
      }

      writeData.count++;
      // Keep last 10 values for history
      writeData.values.push(newValue);
      if (writeData.values.length > 10) {
        writeData.values.shift();
      }

      // Detect rapid mutations
      if (writeData.count > 50) {
        console.warn(`Rapid mutations on ${String(prop)}: ${writeData.count} writes`);
      }
    },

    onDelete(prop, hadProperty, target) {
      if (hadProperty) {
        const metrics = getOrCreateMetrics(target);
        metrics.deletes.add(prop);
      }
    },

    onHas(prop, exists, target) {
      const metrics = getOrCreateMetrics(target);
      metrics.hasChecks.set(prop, (metrics.hasChecks.get(prop) || 0) + 1);
    },

    onOwnKeys(keys, target) {
      const metrics = getOrCreateMetrics(target);
      metrics.keyEnumerations++;

      // Warn about expensive operations
      if (keys.length > 100) {
        console.warn(`Large object enumeration: ${keys.length} keys`);
      }
    },

    // Expose metrics for analysis
    getMetrics: () => accessPatterns,

    printReport: () => {
      console.log('\n=== State Access Report ===');
      for (const [target, metrics] of accessPatterns) {
        console.log(`\nObject: ${target.constructor.name}`);
        console.log(`  Reads: ${metrics.reads.size} properties`);
        console.log(`  Writes: ${metrics.writes.size} properties`);
        console.log(`  Deletes: ${metrics.deletes.size} properties`);
        console.log(`  Key enumerations: ${metrics.keyEnumerations}`);
      }
    }
  };
}
```

***Example State Hook***: Log State
```typescript
function logState<T>(): StateHook<T> {
  return {
    onRead: (prop, value) => console.log(`[READ] ${String(prop)} = ${value}`),
    onWrite: (prop, old, val) => console.log(`[WRITE] ${String(prop)}: ${old} → ${val}`),
    onDelete: (prop, had) => had && console.log(`[DELETE] ${String(prop)}`),
  };
}
```

***Example State Hook***: Persist State
```typescript
function persist<T>(key: string, storage = localStorage): StateHook<T> {
  let isHydrating = false;

  return {
    onWrite(prop, oldValue, newValue, target) {
      // Skip during hydration to avoid loops
      if (isHydrating) return;

      try {
        // Save entire state object on any change
        storage.setItem(key, JSON.stringify(target));
      } catch (err) {
        console.error('Failed to persist state:', err);
      }
    },

    onDelete(prop, hadProperty, target) {
      if (hadProperty && !isHydrating) {
        try {
          storage.setItem(key, JSON.stringify(target));
        } catch (err) {
          console.error('Failed to persist state:', err);
        }
      }
    },

    // Hydration helper (not a hook, but useful)
    hydrate: (target: T) => {
      try {
        const saved = storage.getItem(key);
        if (saved) {
          isHydrating = true;
          Object.assign(target, JSON.parse(saved));
          isHydrating = false;
        }
      } catch (err) {
        console.error('Failed to hydrate state:', err);
      }
    }
  };
}
```

***Example State Hook***: Validation Hook
```typescript
interface ValidationRules<T> {
  [prop: PropertyKey]: (value: unknown, target: T) => boolean | string;
}

function validate<T>(rules: ValidationRules<T>): StateHook<T> {
  return {
    onWrite(prop, oldValue, newValue, target) {
      const rule = rules[prop];
      if (!rule) return;

      const result = rule(newValue, target);
      if (result === false || typeof result === 'string') {
        // Revert the change
        (target as Record<PropertyKey, unknown>)[prop] = oldValue;

        const message = typeof result === 'string'
          ? result
          : `Validation failed for ${String(prop)}`;

        throw new Error(message);
      }
    }
  };
}

// Usage
const $user = state({
  name: 'Alice',
  age: 25,
  email: 'alice@example.com'
}, {
  ...validate({
    age: (value) => {
      if (typeof value !== 'number') return 'Age must be a number';
      if (value < 0 || value > 150) return 'Age must be between 0 and 150';
      return true;
    },
    email: (value) => {
      if (typeof value !== 'string') return false;
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || 'Invalid email format';
    }
  })
});
```

**EffectHook** - Monitor reactive effects (each hook can be a single function or an array of functions):
- `onRun?: ((effectName?: string) => void) | Array<(effectName?: string) => void>` - Effect execution
- `onDispose?: ((effectName?: string) => void) | Array<(effectName?: string) => void>` - Cleanup tracking
- `onError?: ((error: Error, effectName?: string) => void) | Array<(error: Error, effectName?: string) => void>` - Error handling
- `onDependencyAdd?: ((target: object, prop: PropertyKey, effectName?: string) => void) | Array<(target: object, prop: PropertyKey, effectName?: string) => void>` - Dependency registration
- `onSchedule?: ((effectName?: string) => void) | Array<(effectName?: string) => void>` - Re-run scheduling

***Example Effect Hook***: Profile Effect
```typescript
function profileEffect(): EffectHook {
  const effectMetrics = new Map<string | undefined, {
    runCount: number;
    lastRunTime: number;
    totalRunTime: number;
    dependencies: Set<string>;
    scheduled: boolean;
  }>();

  const getOrCreateMetrics = (name?: string) => {
    if (!effectMetrics.has(name)) {
      effectMetrics.set(name, {
        runCount: 0,
        lastRunTime: 0,
        totalRunTime: 0,
        dependencies: new Set(),
        scheduled: false
      });
    }
    return effectMetrics.get(name)!;
  };

  return {
    onRun(effectName) {
      const metrics = getOrCreateMetrics(effectName);
      metrics.runCount++;
      metrics.scheduled = false;
      const startTime = performance.now();

      // Return a cleanup function to measure time
      queueMicrotask(() => {
        const duration = performance.now() - startTime;
        metrics.lastRunTime = duration;
        metrics.totalRunTime += duration;
        console.log(`[${effectName || 'unnamed'}] Run #${metrics.runCount} took ${duration.toFixed(2)}ms`);
      });
    },

    onDependencyAdd(target, prop, effectName) {
      const metrics = getOrCreateMetrics(effectName);
      const key = `${target.constructor.name}.${String(prop)}`;
      if (!metrics.dependencies.has(key)) {
        metrics.dependencies.add(key);
        console.log(`[${effectName || 'unnamed'}] Now depends on ${key}`);
      }
    },

    onSchedule(effectName) {
      const metrics = getOrCreateMetrics(effectName);
      if (!metrics.scheduled) {
        metrics.scheduled = true;
        console.log(`[${effectName || 'unnamed'}] Scheduled for re-run`);
      }
    },

    onDispose(effectName) {
      const metrics = effectMetrics.get(effectName);
      if (metrics) {
        console.log(`[${effectName || 'unnamed'}] Disposed after ${metrics.runCount} runs`);
        effectMetrics.delete(effectName);
      }
    },

    onError(error, effectName) {
      console.error(`[${effectName || 'unnamed'}] Error:`, error);
    }
  };
}
```

***Example Effect Hook***: Log Effect
```typescript
function logEffect(): EffectHook {
  return {
    onRun: (name) => console.log(`→ ${name || 'effect'}`),
    onDispose: (name) => console.log(`✗ ${name || 'effect'}`),
    onError: (err, name) => console.error(`! ${name || 'effect'}:`, err.message)
  };
}
```

***Example Effect Hook***: Dependency Grapth Builer
```typescript
function buildDependencyGraph(): EffectHook {
  const graph = new Map<string, Set<string>>();

  return {
    onDependencyAdd(target, prop, effectName) {
      const effectKey = effectName || 'anonymous';
      const depKey = `${target.constructor.name}.${String(prop)}`;

      if (!graph.has(effectKey)) {
        graph.set(effectKey, new Set());
      }
      graph.get(effectKey)!.add(depKey);
    },

    onDispose(effectName) {
      const effectKey = effectName || 'anonymous';
      graph.delete(effectKey);
    },

    // Expose graph for visualization
    getGraph: () => new Map(graph),

    // Helper to show graph
    visualize: () => {
      console.log('\n=== Dependency Graph ===');
      for (const [effect, deps] of graph) {
        console.log(`${effect}:`);
        for (const dep of deps) {
          console.log(`  ← ${dep}`);
        }
      }
      console.log('=======================\n');
    }
  };
}
```

**DeriveHook<T>** - Computed value lifecycle (each hook can be a single function or an array of functions):
- `onCompute?: ((previousValue: T | undefined) => void) | Array<(previousValue: T | undefined) => void>` - Recomputation tracking
- `onCacheHit?: ((value: T, cacheHit: boolean) => void) | Array<(value: T, cacheHit: boolean) => void>` - Cache hit monitoring
- `onDispose?: (() => void) | Array<() => void>` - Cleanup
- `onError?: ((error: Error) => void) | Array<(error: Error) => void>` - Error handling
- `onDependencyChange?: ((target: object, prop: PropertyKey) => void) | Array<(target: object, prop: PropertyKey) => void>` - Dependency updates

***Example Derive Hook***: Profile Derive
```typescript
function profileDerive<T>(): DeriveHook<T> {
  let computeCount = 0;
  let cacheHits = 0;
  let lastComputeTime = 0;

  return {
    onCompute(previousValue) {
      computeCount++;
      const startTime = performance.now();
      // Hook can track its own metrics
      return () => {
        lastComputeTime = performance.now() - startTime;
        console.log(`Compute #${computeCount} took ${lastComputeTime}ms`);
      };
    },

    onCacheHit(value, cacheHit) {
      if (cacheHit) {
        cacheHits++;
        console.log(`Cache hit #${cacheHits}`);
      }
    }
  };
}
```

***Example Derive Hook***: Log Derive
```typescript
function logDerive<T>(): DeriveHook<T> {
  return {
    onCompute: () => console.log('Computing...'),
    onCacheHit: (value, cacheHit) => {
      if (!cacheHit) console.log('Fresh computation');
    }
  };
}
```

***Example Derive***: Composed Tracking Hook
```typescript
function createMetricsHook<T>(): DeriveHook<T> {
  const metrics = {
    computeCount: 0,
    cacheHits: 0,
    totalAccesses: 0,
    errors: 0,
    dependencies: new Set<string>()
  };

  return {
    onCompute() {
      metrics.computeCount++;
    },

    onCacheHit(value, cacheHit) {
      metrics.totalAccesses++;
      if (cacheHit) metrics.cacheHits++;
    },

    onError() {
      metrics.errors++;
    },

    onDependencyChange(target, prop) {
      metrics.dependencies.add(`${target.constructor.name}.${String(prop)}`);
    },

    // Expose metrics for external access
    getMetrics: (): typeof metrics => ({ ...metrics })
  };
}
```

**BatchHook** - Batch operation monitoring:
- `onBatchStart(depth: number): void` - Batch initiation
- `onBatchEnd(depth: number): void` - Completion with metrics
- `onBatchError(depth: number, error: Error | Unknown): void` - Error tracking

***Example Batch Hook***: Profile Batch
```typescript
function profileBatch(): BatchHook {
  const stack: { depth: number; startTime: number; updates: number }[] = [];
  let trackingUpdates = false;

  return {
    onBatchStart(depth) {
      const startTime = performance.now();
      stack.push({ depth, startTime, updates: 0 });

      // Hook can set up its own tracking
      trackingUpdates = true;
      console.log(`${'  '.repeat(depth)}Batch started (depth: ${depth})`);
    },

    onBatchEnd(depth) {
      const batch = stack.pop();
      if (batch) {
        const duration = performance.now() - batch.startTime;
        console.log(`${'  '.repeat(depth)}Batch completed in ${duration}ms`);
      }
      trackingUpdates = false;
    },

    onBatchError(error, depth) {
      stack.pop(); // Clean up stack
      console.error(`Batch failed at depth ${depth}:`, error);
      trackingUpdates = false;
    }
  };
}
```

***Example Batch Hook***: Log Batch
```typescript
function logBatch(): BatchHook {
  return {
    onBatchStart: (depth) => console.log(`[BATCH START] depth: ${depth}`),
    onBatchEnd: (depth) => console.log(`[BATCH END] depth: ${depth}`),
    onBatchError: (error, depth) => console.error(`[BATCH ERROR] depth: ${depth}`, error)
  };
}
```

***Example Batch Hook***: Tracking Hook
```typescript
function trackBatchUpdates(): BatchHook {
  let batchStack: Map<number, Set<object>>[] = [];

  // This hook could collaborate with a StateHook to track updates
  return {
    onBatchStart(depth) {
      batchStack[depth] = new Map();
    },

    onBatchEnd(depth) {
      const updates = batchStack[depth];
      if (updates) {
        const updateCount = Array.from(updates.values())
          .reduce((sum, set) => sum + set.size, 0);
        console.log(`Batch at depth ${depth} had ${updateCount} updates`);
        delete batchStack[depth];
      }
    },

    onBatchError(error, depth) {
      delete batchStack[depth];
    }
  };
}
```

***Example Composed Batch Hook***: Coordinating Hooks
```typescript
// Shared tracking context
class BatchTracker {
  private batchUpdates = new Map<number, Set<string>>();

  recordUpdate(depth: number, target: object, prop: PropertyKey): void {
    if (!this.batchUpdates.has(depth)) {
      this.batchUpdates.set(depth, new Set());
    }
    this.batchUpdates.get(depth)!.add(`${target.constructor.name}.${String(prop)}`);
  }

  getUpdates(depth: number): Set<string> | undefined {
    return this.batchUpdates.get(depth);
  }

  clearUpdates(depth: number): void {
    this.batchUpdates.delete(depth);
  }
}

// Create coordinated hooks
function createBatchTracking() {
  const tracker = new BatchTracker();

  const stateHook: StateHook = {
    onWrite(prop, oldValue, newValue, target) {
      // Track writes if we're in a batch
      if (batchDepth > 0) {
        tracker.recordUpdate(batchDepth, target, prop);
      }
    }
  };

  const batchHook: BatchHook = {
    onBatchStart(depth) {
      console.log(`Batch ${depth} starting`);
    },

    onBatchEnd(depth) {
      const updates = tracker.getUpdates(depth);
      if (updates) {
        console.log(`Batch ${depth} completed with ${updates.size} unique updates:`, [...updates]);
        tracker.clearUpdates(depth);
      }
    },

    onBatchError(error, depth) {
      tracker.clearUpdates(depth);
      console.error(`Batch ${depth} failed:`, error);
    }
  };

  return { stateHook, batchHook };
}

// Usage
const { stateHook, batchHook } = createBatchTracking();
const $state = state({ a: 1, b: 2 }, stateHook);

batch(() => {
  $state.a = 10;
  $state.b = 20;
}, batchHook);
// Logs: "Batch 1 completed with 2 unique updates: ['Object.a', 'Object.b']"
```

### 2. Performance Optimization Strategy

**Zero-Cost Pattern**:
```typescript
// Pre-check hooks once
const hasOnRead = hooks?.onRead != null;
const hasOnWrite = hooks?.onWrite != null;

// Use pre-checked booleans in hot paths
if (hasOnRead) { hooks.onRead!(prop, value, target) }
```

This eliminates:
- Repeated optional chaining
- Property access on undefined
- Function existence checks in hot paths

### 3. Integration Strategy

**Hook Storage**:
- Add `HOOKS` symbol for proxy-hook association
- WeakMap fallback for frozen objects
- Pass hooks through handler creation

**Error Isolation**:
- Wrap all hook calls in try-catch
- Log errors without breaking core functionality
- Silent failure in production

### 4. Implementation Phases

**Phase 1: Core Infrastructure**
- Create `src/types.ts` with all hook interfaces
- Update function signatures to accept optional hooks
- Add hook storage mechanisms

**Phase 2: State Hooks**
- Modify proxy handlers to invoke hooks
- Pre-check hook existence for performance
- Test with various state patterns

**Phase 3: Effect & Derive Hooks**
- Integrate with effect lifecycle
- Add compute counting for derive
- Track dependencies and scheduling

**Phase 4: Built-in Hooks**
```
src/hooks/
├── compose.ts      # Hook composition
├── debug/
│   ├── log.ts     # Logging hooks
│   └── trace.ts   # Stack traces
├── performance/
│   ├── profile.ts # Timing measurements
│   └── throttle.ts # Update limiting
└── persistence/
    └── persist.ts # localStorage sync
```

**Phase 5: Migration from __DEV__**
1. Keep __DEV__ temporarily (backward compatible)
2. Extract debug logic to hook modules
3. Remove __DEV__ entirely (major version)

### 5. Key Implementation Details

**Hook Invocation Points**:

*State (src/index.ts:366-485)*:
- Get handler: After dependency tracking
- Set handler: After value comparison
- Delete handler: After deletion
- Has handler: After property check
- OwnKeys handler: After key retrieval

*State Implementation Example*:
```typescript
export function state<T extends object>(initial: T, hooks?: StateHook<T>): T {
  if (initial === null || initial === undefined || typeof initial !== 'object') return initial;

  if (__DEV__) {
    devAssert(typeof initial === 'object', 'state() requires an object');
  }

  const initialWithProxy = initial as ProxyObject;
  const existingProxy = initialWithProxy?.[PROXY];
  if (existingProxy) return existingProxy as T;

  const target = initial as ProxyTarget;
  const cached = proxyCache.get(target);
  if (cached) return cached as T;

  // Pre-check hooks once
  const hasOnRead = hooks?.onRead != null;
  const hasOnWrite = hooks?.onWrite != null;
  const hasOnDelete = hooks?.onDelete != null;
  const hasOnHas = hooks?.onHas != null;
  const hasOnOwnKeys = hooks?.onOwnKeys != null;

  // Store hooks with the proxy for nested objects
  const HOOKS = Symbol('[[beacon_hooks]]');

  const proxy = new Proxy(target, {
    get: createGetHandler(hooks, hasOnRead, HOOKS),
    set: createSetHandler(hooks, hasOnWrite, HOOKS),
    deleteProperty: createDeleteHandler(hooks, hasOnDelete),
    has: createHasHandler(hooks, hasOnHas),
    ownKeys: createOwnKeysHandler(hooks, hasOnOwnKeys),
  }) as T;

  // Cache the proxy
  proxyCache.set(target, proxy);

  try {
    if (Object.isExtensible(target)) {
      Object.defineProperty(target, PROXY, {
        configurable: true,
        enumerable: false,
        value: proxy,
        writable: false,
      });

      // Store hooks with the proxy if provided
      if (hooks) {
        Object.defineProperty(target, HOOKS, {
          configurable: true,
          enumerable: false,
          value: hooks,
          writable: false,
        });
      }
    }
  } catch (error) {
    if (__DEV__) {
      console.debug?.('[beacon][warn] Failed to define PROXY property on target', error);
    }
  }

  return proxy;
}
```



*Effect (src/index.ts:529-582)*:
- Before effect execution (onRun)
- In cleanup functions (onDispose)
- In catch blocks (onError)
- In registerEffectRead (onDependencyTrack)
- In scheduleSubscribersForTarget (onSchedule)

*Effect Implementation Example*:
```typescript
export function effect(
  fn: EffectCallback,
  name?: EffectName,
  hooks?: EffectHook
): Unsubscribe {
  // Pre-check hooks once
  const hasOnRun = hooks?.onRun != null;
  const hasOnDispose = hooks?.onDispose != null;
  const hasOnError = hooks?.onError != null;
  const hasOnDependencyAdd = hooks?.onDependencyAdd != null;
  const hasOnSchedule = hooks?.onSchedule != null;

  const runEffect: EffectFunction = () => {
    if (__DEV__) {
      devAssert(!activeEffects.has(runEffect), 'Effect should not already be in activeEffects');
    }
    if (activeEffects.has(runEffect)) return;
    activeEffects.add(runEffect);
    const prev = currentEffect;

    try {
      cleanupEffect(runEffect);
      const existing = childEffects.get(runEffect);
      if (existing?.size && existing.size > 0) {
        for (const c of existing) {
          cleanupEffectCompletely(c);
          existing.delete(c);
        }
      }
      currentEffect = runEffect;
      effectStateReads.set(runEffect, new WeakMap());

      // Call onRun hook if provided
      if (hasOnRun) {
        try {
          hooks.onRun!(name);
        } catch (err) {
          // Error isolated by compose - hook error doesn't break core
        }
      }

      if (__DEV__ && runEffect.effectName) {
        console.debug(`[beacon][effect:${runEffect.effectName}] Running`);
      }

      fn();
    } catch (error) {
      // Call onError hook if provided
      if (hasOnError) {
        try {
          hooks.onError!(error as Error, name);
        } catch (err) {
          // Error isolated by compose - hook error doesn't break core
        }
      }
      throw error; // Re-throw original error
    } finally {
      currentEffect = prev;
      activeEffects.delete(runEffect);
    }
  };

  // Store hooks with the effect for use in other functions
  if (hooks) {
    (runEffect as any).__hooks = hooks;
  }

  if (currentEffect) {
    parentEffect.set(runEffect, currentEffect);
    let cs = childEffects.get(currentEffect);
    if (!cs) {
      cs = new Set<EffectFunction>();
      childEffects.set(currentEffect, cs);
    }
    cs.add(runEffect);
  }

  if (name) {
    runEffect.effectName = name;
  }

  if (batchDepth === 0) runEffect();
  else deferredEffectCreations.push(runEffect);

  return (): void => {
    // Call onDispose hook if provided
    if (hasOnDispose) {
      try {
        hooks.onDispose!(name);
      } catch (err) {
        // Error isolated by compose - hook error doesn't break core
      }
    }

    if (__DEV__ && runEffect.effectName) {
      console.debug(`[beacon][effect:${runEffect.effectName}] Disposing`);
    }
    cleanupEffectCompletely(runEffect);
  };
}
```

*Derive (src/index.ts:619-709)*:
- Track compute count internally
- Monitor cache hits
- Hook into effect system for dependencies

*Derive Implementation Example*:
```typescript
export function derive<T>(
  computeFn: () => T,
  hooks?: DeriveHook<T>
): ComputedValue<T> {
  const hasOnCompute = hooks?.onCompute != null;
  const hasOnAccess = hooks?.onAccess != null;
  const hasOnError = hooks?.onError != null;
  const hasOnDependencyChange = hooks?.onDependencyChange != null;

  const internalState = {
    lastValue: undefined as T | undefined,
    hasValue: false,
    reactive: true,
    value: undefined as T | undefined,
  };

  let dispose: Unsubscribe | null = null;
  let isComputing = false;
  let reactiveInternal: typeof internalState | null = null;

  const createEffect = (): void => {
    if (dispose) return;

    reactiveInternal = state(internalState);

    dispose = effect((): void => {
      if (!internalState.reactive) return;
      if (isComputing) return;

      isComputing = true;
      try {
        const previousValue = internalState.hasValue
          ? internalState.lastValue
          : undefined;

        // Only call hook if provided
        if (hasOnCompute) {
          hooks.onCompute!(previousValue);
        }

        const newValue = computeFn();

        if (!Object.is(newValue, internalState.lastValue)) {
          internalState.lastValue = newValue;
          internalState.hasValue = true;
          if (reactiveInternal) {
            reactiveInternal.value = newValue;
          }
        }
      } catch (error) {
        if (hasOnError) {
          hooks.onError!(error as Error);
        }
        throw error;
      } finally {
        isComputing = false;
      }
    });
  };

  // Return proxy with access tracking
  return new Proxy(internalState, {
    get(target: typeof internalState, prop: PropertyKey): unknown {
      if (prop === 'value') {
        const fromCache = target.hasValue && !isComputing;

        // Only call hook if provided
        if (hasOnAccess) {
          hooks.onAccess!(target.value as T, fromCache);
        }

        if (reactiveInternal && currentEffect) {
          return reactiveInternal.value;
        }
        return target.value;
      }
      if (prop === 'reactive') {
        return target.reactive;
      }
      return undefined;
    },
    // ... rest of proxy implementation
  }) as ComputedValue<T>;
}
```

*Batch (src/index.ts:584-617)*:
- At batch entry (onBatchStart)
- At successful completion (onBatchEnd)
- In error handlers (onBatchError)

*Batch Implementation Example*:
```typescript
export function batch<T>(fn: () => T, hooks?: BatchHook): T {
  // Pre-check hooks once
  const hasOnBatchStart = hooks?.onBatchStart != null;
  const hasOnBatchEnd = hooks?.onBatchEnd != null;
  const hasOnBatchError = hooks?.onBatchError != null;

  if (__DEV__) {
    devAssert(typeof fn === 'function', 'batch() requires a function');
    devAssert(batchDepth < CONFIG.MAX_BATCH_DEPTH, 'Excessive batch nesting detected - possible bug');
  }

  batchDepth++;

  // Call start hook if provided
  if (hasOnBatchStart) {
    try {
      hooks.onBatchStart!(batchDepth);
    } catch (err) {
      // Don't let hook errors break batching
      if (__DEV__) console.error('[beacon] BatchHook.onBatchStart error:', err);
    }
  }

  let result: T;
  try {
    result = fn();
  } catch (err) {
    batchDepth--;

    // Call error hook if provided
    if (hasOnBatchError) {
      try {
        hooks.onBatchError!(err as Error, batchDepth + 1);
      } catch (hookErr) {
        if (__DEV__) console.error('[beacon] BatchHook.onBatchError error:', hookErr);
      }
    }

    if (batchDepth === 0) {
      pendingEffects.clear();
      deferredEffectCreations.length = 0;
    }
    throw err;
  }

  batchDepth--;

  if (batchDepth === 0) {
    try {
      if (deferredEffectCreations.length > 0) {
        const effectsToRun = Array.from(deferredEffectCreations);
        deferredEffectCreations.length = 0;
        for (const e of effectsToRun) e();
      }
      if (pendingEffects.size > 0) flushEffects();
    } catch (err) {
      pendingEffects.clear();
      deferredEffectCreations.length = 0;
      throw err;
    }
  }

  // Call end hook if provided (and no error occurred)
  if (hasOnBatchEnd) {
    try {
      hooks.onBatchEnd!(batchDepth + 1);
    } catch (err) {
      if (__DEV__) console.error('[beacon] BatchHook.onBatchEnd error:', err);
    }
  }

  return result;
}
```

### 6. Success Metrics

- ✅ **Zero overhead**: Single falsy check when no hooks
- ✅ **Type safety**: Full TypeScript support with generics
- ✅ **Tree-shaking**: Unused hooks eliminated from bundle
- ✅ **Composability**: Multiple hooks combinable
- ✅ **Extensibility**: Easy custom hook creation
- ✅ **Migration path**: Smooth transition from __DEV__

### 7. Module Exports Strategy

```typescript
// Core library
export { state, effect, derive, batch } from './index';

// Hook types
export type { StateHook, EffectHook, DeriveHook, BatchHook } from './types';

// Built-in hooks (separate entry point)
// Note: compose is for internal use only - users should use arrays instead
export { logRead, logWrite, persist } from './hooks';
```

### Array-Based Hook API

Instead of requiring a `compose` utility, hooks can be provided as either a single function or an array of functions. This provides a more natural and consistent API:

**Single Hook:**
```typescript
const $state = state({ count: 0 }, {
  onWrite: logWrite()  // Single hook function
});

batch(() => {
  // operations
}, {
  onBatchError: notifyError()  // Single hook function
});
```

**Multiple Hooks (Array):**
```typescript
const $state = state({ count: 0 }, {
  onWrite: [
    logWrite(),          // Runs first
    validateWrite(),     // Runs second
    persistWrite()       // Runs third
  ]
});

batch(() => {
  // operations  
}, {
  onBatchStart: trackStart(),
  onBatchEnd: trackEnd(),
  onBatchError: [
    logBatchError(),          // Runs first
    notifyErrorMonitoring(),  // Runs second
    rollbackOnError()         // Runs third
  ]
});
```

**Mixed Single and Array:**
```typescript
effect(() => {
  // effect body
}, 'myEffect', {
  onRun: profileEffect(),        // Single hook
  onError: [                     // Multiple hooks
    logError(),
    reportToSentry(),
    fallbackHandler()
  ]
});
```

This approach eliminates the need for users to import and use `compose`, making the API more intuitive and consistent. The core library handles arrays internally by iterating through them in order.

This architecture will position Beacon as a truly extensible reactive system while maintaining its core principle of simplicity and performance.

### Andendum
Handler factory function:
```typescript
function createGetHandler<T>(
  hooks: StateHook<T> | undefined,
  hasOnRead: boolean,
  HOOKS: symbol
): ProxyHandler<ProxyTarget>['get'] {
  return (rawTarget: ProxyTarget, prop: PropertyKey): unknown => {
    if (prop === SUBSCRIBERS || prop === PROXY || prop === HOOKS) return rawTarget[prop];

    // Track dependencies for effects
    if (currentEffect) {
      const subs = getSubscribers(rawTarget);
      subs.add(currentEffect);
      registerEffectRead(currentEffect, rawTarget, prop);
    } else {
      if (__DEV__) devLogRead(rawTarget, prop);
    }

    const value = rawTarget[prop];

    // Call onRead hook if provided
    if (hasOnRead) {
      try {
        hooks!.onRead!(prop, value, rawTarget as T);
      } catch (err) {
        // Error isolated by compose - hook error doesn't break core
      }
    }

    // Handle array mutating methods
    if (Array.isArray(rawTarget) && typeof prop === 'string' && MUTATING_ARRAY_METHODS.has(prop)) {
      if (typeof value === 'function') {
        // Return wrapped method that triggers updates
        return getCachedMethod(rawTarget, prop, value as Function);
      }
    }

    // Wrap nested objects with same hooks
    if (value !== null && typeof value === 'object') {
      const cached = proxyCache.get(value as object);
      if (cached) return cached;

      // Pass hooks to nested objects
      const parentHooks = rawTarget[HOOKS] as StateHook<T> | undefined;
      return state(value as object, parentHooks);
    }

    return value;
  };
}

function createSetHandler<T>(
  hooks: StateHook<T> | undefined,
  hasOnWrite: boolean,
  HOOKS: symbol
): ProxyHandler<ProxyTarget>['set'] {
  return (rawTarget: ProxyTarget, prop: PropertyKey, value: unknown): boolean => {
    // Check for infinite loops
    if (currentEffect && didEffectReadProp(currentEffect, rawTarget, prop)) {
      const parent = parentEffect.get(currentEffect);
      if (!parent) {
        const effectName = currentEffect.effectName;
        const errorMsg = effectName
          ? `Infinite loop detected: effect "${effectName}" cannot update property "${String(prop)}" it depends on`
          : 'Infinite loop detected: effect cannot update a state it depends on';
        throw new Error(errorMsg);
      }
    }

    const oldValue = rawTarget[prop];
    if (Object.is(oldValue, value)) return true;

    if (__DEV__) devLogWrite(rawTarget, prop, value);

    // Unwrap proxies if needed
    const rawValue = value !== null && typeof value === 'object' ? tryUnwrap(value) : value;

    // Track array length changes
    let oldLength: number | undefined;
    if (Array.isArray(rawTarget) && typeof prop === 'string') {
      const index = Number(prop);
      if (!Number.isNaN(index) && index >= 0 && 'length' in rawTarget) {
        oldLength = rawTarget.length;
      }
    }

    // Actually set the value
    rawTarget[prop] = rawValue;

    // Call onWrite hook if provided
    if (hasOnWrite) {
      try {
        hooks!.onWrite!(prop, oldValue, value, rawTarget as T);
      } catch (err) {
        // Error isolated by compose - hook error doesn't break core
        // Note: If hook throws, the change has already been applied
      }
    }

    // Schedule updates
    scheduleSubscribersForTarget(rawTarget, prop);

    // If array length changed, notify length subscribers
    if (oldLength !== undefined && 'length' in rawTarget && (rawTarget as unknown[]).length !== oldLength) {
      scheduleSubscribersForTarget(rawTarget, 'length');
    }

    return true;
  };
}

function createDeleteHandler<T>(
  hooks: StateHook<T> | undefined,
  hasOnDelete: boolean
): ProxyHandler<ProxyTarget>['deleteProperty'] {
  return (rawTarget: ProxyTarget, prop: PropertyKey): boolean => {
    const hadProperty = Object.hasOwn(rawTarget, prop);
    const result = delete rawTarget[prop];

    if (__DEV__) {
      devAssert(!Object.isFrozen(rawTarget), 'Cannot delete property from frozen object');
    }

    // Call onDelete hook if provided
    if (hasOnDelete) {
      try {
        hooks!.onDelete!(prop, hadProperty, rawTarget as T);
      } catch (err) {
        // Error isolated by compose - hook error doesn't break core
      }
    }

    if (hadProperty && result) {
      scheduleSubscribersForTarget(rawTarget, prop);
    }

    return result;
  };
}

function createHasHandler<T>(
  hooks: StateHook<T> | undefined,
  hasOnHas: boolean
): ProxyHandler<ProxyTarget>['has'] {
  return (rawTarget: ProxyTarget, prop: PropertyKey): boolean => {
    if (currentEffect) {
      const subs = getSubscribers(rawTarget);
      subs.add(currentEffect);
      registerEffectRead(currentEffect, rawTarget, prop);
    }

    const exists = prop in rawTarget;

    // Call onHas hook if provided
    if (hasOnHas) {
      try {
        hooks!.onHas!(prop, exists, rawTarget as T);
      } catch (err) {
        // Error isolated by compose - hook error doesn't break core
      }
    }

    return exists;
  };
}

function createOwnKeysHandler<T>(
  hooks: StateHook<T> | undefined,
  hasOnOwnKeys: boolean
): ProxyHandler<ProxyTarget>['ownKeys'] {
  return (rawTarget: ProxyTarget): (string | symbol)[] => {
    if (currentEffect) {
      const subs = getSubscribers(rawTarget);
      subs.add(currentEffect);
      registerEffectRead(currentEffect, rawTarget, OWN_KEYS_SYMBOL);
    }

    const keys = Reflect.ownKeys(rawTarget) as (string | symbol)[];

    // Call onOwnKeys hook if provided
    if (hasOnOwnKeys) {
      try {
        hooks!.onOwnKeys!(keys, rawTarget as T);
      } catch (err) {
        // Error isolated by compose - hook error doesn't break core
      }
    }

    return keys;
  };
}
```

Change Tracker:
```typescript
function createChangeTracker<T>() {
  const changes: Array<{
    timestamp: number;
    target: object;
    prop: PropertyKey;
    type: 'write' | 'delete';
    oldValue?: unknown;
    newValue?: unknown;
  }> = [];

  const hook: StateHook<T> = {
    onWrite(prop, oldValue, newValue, target) {
      changes.push({
        timestamp: Date.now(),
        target: target as object,
        prop,
        type: 'write',
        oldValue,
        newValue
      });

      // Keep only last 100 changes
      if (changes.length > 100) {
        changes.shift();
      }
    },

    onDelete(prop, hadProperty, target) {
      if (hadProperty) {
        changes.push({
          timestamp: Date.now(),
          target: target as object,
          prop,
          type: 'delete'
        });
      }
    }
  };

  return {
    hook,

    getChanges: () => [...changes],

    undo: () => {
      const change = changes.pop();
      if (!change) return false;

      if (change.type === 'write') {
        (change.target as any)[change.prop] = change.oldValue;
      } else if (change.type === 'delete') {
        delete (change.target as any)[change.prop];
      }
      return true;
    },

    printHistory: () => {
      console.log('\n=== Change History ===');
      for (const change of changes.slice(-10)) {
        const time = new Date(change.timestamp).toLocaleTimeString();
        if (change.type === 'write') {
          console.log(`[${time}] ${String(change.prop)}: ${change.oldValue} → ${change.newValue}`);
        } else {
          console.log(`[${time}] DELETE ${String(change.prop)}`);
        }
      }
    }
  };
}
```

In `registerEffectRead` function:
```typescript
function registerEffectRead(effect: EffectFunction, target: object, prop: PropertyKey): void {
  // Register dependency
  let deps = effectDependencies.get(effect);
  const isNewDep = !deps?.has(target);

  if (!deps) {
    deps = new Set<object>();
    effectDependencies.set(effect, deps);
  }
  deps.add(target);

  // Register property read
  let map = effectStateReads.get(effect);
  if (!map) {
    map = new WeakMap<object, Set<PropertyKey>>();
    effectStateReads.set(effect, map);
  }
  let set = map.get(target);
  const isNewProp = !set?.has(prop);

  if (!set) {
    set = new Set<PropertyKey>();
    map.set(target, set);
  }
  set.add(prop);

  // Call onDependencyAdd hook if this is a new dependency
  if (isNewDep || isNewProp) {
    const hooks = (effect as any).__hooks as EffectHook | undefined;
    if (hooks?.onDependencyAdd) {
      try {
        hooks.onDependencyAdd(target, prop, effect.effectName);
      } catch (err) {
        // Error isolated by compose - hook error doesn't break core
      }
    }
  }
}
```

In `scheduleSubscribersForTarget` function:
```typescript
function scheduleSubscribersForTarget(target: object, prop?: PropertyKey): void {
  const subs = getSubscribers(target);
  if (subs?.size === 0 || !subs) return;

  for (const s of subs) {
    if (prop === undefined) {
      if (!pendingEffects.has(s)) {
        pendingEffects.add(s);

        // Call onSchedule hook
        const hooks = (s as any).__hooks as EffectHook | undefined;
        if (hooks?.onSchedule) {
          try {
            hooks.onSchedule(s.effectName);
          } catch (err) {
            // Error isolated by compose - hook error doesn't break core
          }
        }
      }
    } else {
      const map = effectStateReads.get(s);
      if (map) {
        const set = map.get(target);
        if (set?.has(prop) || set?.has(OWN_KEYS_SYMBOL)) {
          if (!pendingEffects.has(s)) {
            pendingEffects.add(s);

            // Call onSchedule hook
            const hooks = (s as any).__hooks as EffectHook | undefined;
            if (hooks?.onSchedule) {
              try {
                hooks.onSchedule(s.effectName);
              } catch (err) {
                // Error isolated by compose - hook error doesn't break core
              }
            }
          }
        }
      }
    }
  }

  if (batchDepth === 0 && !isNotifying) flushEffects();
}
```

```typescript
function createEffectDebugger() {
  const effectStates = new Map<string, {
    status: 'idle' | 'running' | 'scheduled' | 'disposed';
    dependencies: Map<string, Set<PropertyKey>>;
    lastError?: Error;
    runHistory: { timestamp: number; duration?: number }[];
  }>();

  return {
    hook: {
      onRun(effectName) {
        const name = effectName || 'anonymous';
        const state = effectStates.get(name) || {
          status: 'idle',
          dependencies: new Map(),
          runHistory: []
        };

        state.status = 'running';
        const run = { timestamp: Date.now() };
        state.runHistory.push(run);
        effectStates.set(name, state);

        // Measure duration
        const startTime = performance.now();
        queueMicrotask(() => {
          run.duration = performance.now() - startTime;
          state.status = 'idle';
        });
      },

      onSchedule(effectName) {
        const name = effectName || 'anonymous';
        const state = effectStates.get(name);
        if (state) {
          state.status = 'scheduled';
        }
      },

      onDependencyAdd(target, prop, effectName) {
        const name = effectName || 'anonymous';
        const state = effectStates.get(name) || {
          status: 'idle',
          dependencies: new Map(),
          runHistory: []
        };

        const targetKey = target.constructor.name;
        if (!state.dependencies.has(targetKey)) {
          state.dependencies.set(targetKey, new Set());
        }
        state.dependencies.get(targetKey)!.add(prop);
        effectStates.set(name, state);
      },

      onError(error, effectName) {
        const name = effectName || 'anonymous';
        const state = effectStates.get(name);
        if (state) {
          state.lastError = error;
          state.status = 'idle';
        }
      },

      onDispose(effectName) {
        const name = effectName || 'anonymous';
        const state = effectStates.get(name);
        if (state) {
          state.status = 'disposed';
        }
      }
    } as EffectHook,

    // Debug utilities
    getState: () => effectStates,

    printStatus: () => {
      console.log('\n=== Effect Status ===');
      for (const [name, state] of effectStates) {
        console.log(`\n${name}:`);
        console.log(`  Status: ${state.status}`);
        console.log(`  Runs: ${state.runHistory.length}`);
        if (state.runHistory.length > 0) {
          const lastRun = state.runHistory[state.runHistory.length - 1];
          console.log(`  Last run: ${new Date(lastRun.timestamp).toISOString()}`);
          if (lastRun.duration) {
            console.log(`  Duration: ${lastRun.duration.toFixed(2)}ms`);
          }
        }
        if (state.dependencies.size > 0) {
          console.log('  Dependencies:');
          for (const [target, props] of state.dependencies) {
            console.log(`    ${target}: ${[...props].join(', ')}`);
          }
        }
        if (state.lastError) {
          console.log(`  Last error: ${state.lastError.message}`);
        }
      }
      console.log('=====================\n');
    }
  };
}

// Usage
const debugger = createEffectDebugger();

const $state = state({ count: 0, name: 'test' });

effect(() => {
  console.log($state.count, $state.name);
}, 'logger', debugger.hook);

$state.count++; // Triggers schedule and run
debugger.printStatus(); // Shows detailed effect state
```
