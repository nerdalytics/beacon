# Beacon Test Suite

This directory contains tests for the Beacon reactive signal library. Tests are organized by type:

## Test Types

- **Unit Tests**: Test individual components in isolation
  - `state.test.ts` - Tests for state functionality
  - `derived.test.ts` - Tests for derived functionality
  - `effect.test.ts` - Tests for effect functionality
  - `batch.test.ts` - Tests for batch functionality

- **Integration Tests**: Test how components work together
  - `deep-chain.test.ts` - Tests for deep dependency chains

- **Performance Tests**: Test performance characteristics
  - `performance.test.ts` - Performance benchmarks

## Adding New Tests

When adding new tests:

1. Identify the test type (unit, integration, performance)
2. Either add to an existing file if testing the same component, or create a new file following the naming convention
3. Update package.json scripts if needed

## Running Tests

- Run all tests: `npm test`
- Run unit tests: `npm run test:unit`
- Run specific unit tests: `npm run test:unit:state`
- Run integration tests: `npm run test:integration`
- Run performance tests: `npm run test:perf`

<!-- Links collection -->
