# Beacon Tests

A comprehensive test suite for the Beacon reactive state library.

## Test Categories

### Core API Tests

#### [`state.test.ts`][1]
Tests for the core state primitive.
- Value creation and initialization
- State updates via set/update methods
- Reference equality preservation
- Handling different data types

#### [`derive.test.ts`][2]
Tests for computed derived values.
- Dependency tracking
- Automatic recalculation
- Memoization and performance
- Dynamic dependency paths

#### [`effect.test.ts`][3]
Tests for reactive effects.
- Immediate execution behavior
- Dependency tracking
- Cleanup/disposal
- Dynamic dependency changes

#### [`batch.test.ts`][4]
Tests for batched state updates.
- Effect batching
- Nested batches
- Error handling
- Return values

#### [`select.test.ts`][5]
Tests for selective state subscriptions.
- Subset selection
- Custom equality functions
- Performance with large objects
- Nested selections

#### [`readonly-state.test.ts`][6]
Tests for read-only state views.
- Read-only access limitations
- Dependency tracking
- Updates from original state

#### [`protected-state.test.ts`][7]
Tests for protected state pattern.
- Read/write capability separation
- Effect dependency tracking
- Update mechanics

### Advanced Behavior Tests

#### [`cleanup.test.ts`][8]
Tests for subscription cleanup behavior.
- Effect disposal
- Memory leak prevention
- Dependency cleanup
- Nested effect cleanup

#### [`cyclic-dependency.test.ts`][9]
Tests for cyclic dependency handling.
- Direct cycles between states
- Derived value cycles
- Convergent and divergent cycles
- Cycle breaking mechanisms

#### [`deep-chain.test.ts`][10]
Tests for deep dependency chains.
- Performance with long dependency chains
- Stack overflow prevention
- Batch operations on chains
- Rapid updates through chains

#### [`infinite-loop.test.ts`][11]
Tests for infinite loop detection.
- Direct state mutation protection
- Safe update patterns
- Conditional update cycles
- Oscillating update patterns

### Templates

#### [`template.test.ts`][12]
Template for creating new test files.
- Standardized structure
- Test organization guidelines

## Running Tests

```bash
# Run all tests
npm test

# Run tests for specific components
npm run test:unit:state
npm run test:unit:effect
npm run test:unit:derive
npm run test:unit:batch
npm run test:unit:select

# Run tests for advanced behaviors
npm run test:unit:cleanup
npm run test:unit:cyclic-dependency
npm run test:unit:deep-chain
npm run test:unit:infinite-loop
```

---

## License

This project is licensed under the MIT License. See the [LICENSE][13] file for details.

<div align="center">
  <img src="https://raw.githubusercontent.com/nerdalytics/nerdalytics/refs/heads/main/nerdalytics-logo-gray-transparent.svg" width="128px">
</div>

<!-- Links collection -->

[1]: ./state.test.ts
[2]: ./derive.test.ts
[3]: ./effect.test.ts
[4]: ./batch.test.ts
[5]: ./select.test.ts
[6]: ./readonly-state.test.ts
[7]: ./protected-state.test.ts
[8]: ./cleanup.test.ts
[9]: ./cyclic-dependency.test.ts
[10]: ./deep-chain.test.ts
[11]: ./infinite-loop.test.ts
[12]: ./template.test.ts
[13]: ./LICENSE
