# Beacon Performance Benchmarks

This document contains performance benchmarks for the Beacon library. These benchmarks measure the speed of various operations in the library.

*Last updated: 2025-03-30 (commit: 4c74134)*

## Measurement Method

- **Test runs**: 5 iterations (with 1 warm-up runs)
- **Statistical method**: median value across all runs
- **Platform**: darwin / Node.js v23.10.0

## Key Metrics

| Operation | Speed | Change | Notes |
|-----------|-------|--------|-------|
| Signal Creation | ~3.0M ops/sec |  | Creating new state signals |
| Signal Reading | ~264.3M ops/sec |  | Reading signal values |
| Signal Writing | ~55.8M ops/sec |  | Setting signal values |
| Derived Signals | ~1.9M ops/sec |  | Updates with derived values |
| Effect Triggers | ~1.8M ops/sec |  | Effects running on state changes |
| Batch Updates | ~11.0M ops/sec |  | Updating multiple signals in batches |
| Many Dependencies | ~7.9K ops/sec |  | 100 dependencies, 100 iterations |

## Batched vs Unbatched Updates

When comparing batched and unbatched operations:

- **Speed improvement with batching vs. individual updates**: Batching is ~3.7x
- **Reduction in effect runs with batching**: Batching reduces effect runs by ~5.0x

## Analysis

The Beacon library shows excellent performance characteristics:

- **Reading is extremely fast**: At ~264.3M ops/sec, reading signals has minimal overhead
- **Writing is highly efficient**: At ~55.8M ops/sec, setting values is extremely fast
- **Batching is very effective**: Significantly reduces effect runs and improves performance by 3.7x

### Areas of Strength

- **Pure reads are near native speed**
- **Signal writes are optimized for high throughput**
- **Batching system provides significant optimization**
- **Core operations are all in the millions of ops/sec range**

### Potential Optimization Areas

- **Deep dependency chains**: Need careful handling to avoid stack overflow
- **Many dependencies**: Performance drops with large numbers of dependencies

## Conclusion

The Beacon library provides excellent performance for reactive state management in Node.js applications. Its performance characteristics make it suitable for most server-side use cases, especially when proper batching is utilized to optimize updates.

For most applications, the library will not be a performance bottleneck, with operations measured in millions per second. The batching system provides an effective way to optimize updates when multiple state changes occur together.
