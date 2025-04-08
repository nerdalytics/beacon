# Beacon Performance Benchmarks

This document contains performance benchmarks for the Beacon library. These benchmarks measure the speed of various operations in the library.

*Last updated: 2025-04-08 (commit: f212ed9)*

## Measurement Method

- **Test runs**: 5 iterations with 2 warm-up runs
- **Statistical method**: Median value across all runs
- **Platform**: darwin / Node.js v23.11.0

## Core Operations

These metrics measure the performance of fundamental operations in isolation:

| Operation | Speed | Change | Notes |
|-----------|-------|--------|-------|
| Signal Creation | ~13.8M ops/sec |  | Creating new state signals |
| Signal Reading | ~272.3M ops/sec |  | Reading signal values |
| Signal Writing | ~138.6M ops/sec |  | Setting signal values |
| Derived Signals | ~1.7M ops/sec |  | Updates with derived values |
| Effect Triggers | ~1.8M ops/sec |  | Effects running on state changes |

## Batching Performance

These metrics compare performance with and without batching for the same operations:

| Operation | Speed | Change | Notes |
|-----------|-------|--------|-------|
| Update 100 States Individually | ~66.9K ops/sec |  | Updating multiple signals without batching |
| Update 100 States with Batching | ~4.7M ops/sec |  | Updating multiple signals in batches |

## Advanced Scenarios

These metrics measure performance in more complex scenarios:

| Operation | Speed | Change | Notes |
|-----------|-------|--------|-------|
| Deep Dependency Chain | ~1.6M ops/sec |  | Chain of 10 derived signals |
| Many Dependencies | ~4.6M ops/sec |  | 100 dependencies, 100 iterations |

## Batching Benefits

When comparing batched and unbatched operations for the same workload (100 states updated 100 times):

- **Speed improvement**: Batching is ~70.1x faster in operations per second
- **Effect efficiency**: Batching triggers only 1.0% of the effect runs (99.1x reduction)

These complementary metrics measure different aspects of the same optimization:

1. **Performance Ratio (70.1x)**:
   - Measures raw throughput in operations per second
   - Shows how many more operations you can perform in the same time period
   - Higher is better (more operations per second)

2. **Effect Reduction (99.1x)**:
   - Measures efficiency in triggering effects
   - Shows how many fewer side effects run with batching
   - Higher is better (fewer unnecessary effect executions)

The effect reduction is calculated from the measured effect runs:
- Without batching: ~9810 effect runs (one per state update)
- With batching: ~99 effect runs (one per batch of 100 state updates)
- Result: 99.1× fewer effect runs with batching (1.0% of original)

## Analysis

The Beacon library shows excellent performance characteristics:

- **Reading is extremely fast**: At ~272.3M ops/sec, reading signals has minimal overhead
- **Writing is highly efficient**: At ~138.6M ops/sec, setting values is extremely fast
- **Batching provides dual benefits**:
  1. ~70.1x faster throughput (operations per second)
  2. ~99.1x reduction in effect executions (1.0% of original)

### Areas of Strength

- **Pure reads are near native speed**: Reading states without effects approaches native JavaScript speed
- **Signal writes are optimized**: Direct state updates are very efficient
- **Batching is highly effective**: For real-world scenarios with multiple related states, batching provides significant benefits
- **Derived signals have low overhead**: Computing values from state is efficient

### When to Use Batching

Batching is particularly important when:
- Updating multiple states that share effects or derived dependencies
- Performing sequences of updates that should be treated as a single transaction
- Working with complex data structures broken into multiple state containers
- Updating state in response to external events (API calls, user input, etc.)

### Potential Optimization Areas

- **Deep dependency chains**: Long chains of derived signals should be managed carefully
- **Many dependencies**: Performance can drop with large numbers of dependencies in a single derived signal

## Conclusion

The Beacon library provides excellent performance for reactive state management in Node.js applications, with:

- Core operations in the tens of millions per second range
- State reading at ~272.3M operations/second
- State writing at ~138.6M operations/second

For real-world usage scenarios, these benchmarks demonstrate clear performance guidelines:

1. **Always use batching for multiple updates**:
   - 70.1x faster operation throughput
   - 99.1x reduction in effect triggers
   - Most important for components with shared dependencies

2. **Optimize dependency tracking**:
   - Minimize deep dependency chains when possible
   - Be mindful of effects with many dependencies
   - Performance can drop with overly complex dependency networks

For most applications, Beacon will not be a performance bottleneck and provides an excellent balance of developer experience and runtime efficiency.
