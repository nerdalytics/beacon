# Test Organization for Beacon

## Problem
Currently tests are organized by the "primary" function being tested, but most tests actually test interactions between multiple features. This creates confusion about where tests belong.

## Proposed Structure

### 1. Core API Tests (Pure, single-feature tests)
Each file tests ONLY the basic functionality of one API:

- `state-core.test.ts` - Pure state tests (creation, reading, writing)
- `effect-core.test.ts` - Pure effect tests (execution, cleanup, disposal)
- `derive-core.test.ts` - Pure derive tests (computation, caching, disposal)
- `batch-core.test.ts` - Pure batch tests (grouping, nesting)

### 2. Integration Tests (Feature interactions)
Named by the combination being tested:

- `state-effect.test.ts` - How state triggers effects
- `state-derive.test.ts` - How state changes update derives
- `effect-cleanup.test.ts` - Effect disposal and cleanup patterns
- `derive-batch.test.ts` - Batch optimization for derives
- `array-tracking.test.ts` - Array-specific reactivity
- `nested-reactivity.test.ts` - Deep object reactivity

### 3. Behavior Tests (Specific behaviors/edge cases)
Named by what they prevent or ensure:

- `infinite-loop-prevention.test.ts`
- `circular-dependency.test.ts`
- `memory-leaks.test.ts`
- `disposal-patterns.test.ts`

### 4. Performance Tests
- `benchmark.test.ts`
- `large-scale.test.ts`

## Example Migration

### Before (mixed concerns in effect.test.ts):
```typescript
describe('Effect', () => {
  it('should run immediately', () => {})  // Core effect
  it('should track dependencies', () => {}) // State + Effect
  it('should cleanup on disposal', () => {}) // Cleanup
  it('should handle dynamic deps', () => {}) // State + Effect
})
```

### After:

**effect-core.test.ts:**
```typescript
describe('Effect Core', () => {
  it('runs immediately on creation', () => {})
  it('returns disposal function', () => {})
  it('accepts optional name parameter', () => {})
})
```

**state-effect.test.ts:**
```typescript
describe('State-Effect Integration', () => {
  it('triggers effect when state changes', () => {})
  it('tracks multiple state dependencies', () => {})
  it('handles dynamic dependencies', () => {})
})
```

**effect-cleanup.test.ts:**
```typescript
describe('Effect Cleanup', () => {
  it('removes all dependencies on disposal', () => {})
  it('cleans up child effects', () => {})
  it('prevents disposed effects from running', () => {})
})
```

## Benefits

1. **Clear Location**: You know exactly where to put/find a test
2. **No Duplication**: Each behavior tested in one clear place
3. **Better Coverage**: Easy to see what combinations need testing
4. **Maintainable**: Changes to one feature don't require updating multiple test files
5. **Focused**: Each file has a single, clear purpose

## Test File Naming Convention

```
[feature1][-feature2].test.ts
```

Where:
- Single feature: `state-core.test.ts`
- Integration: `state-effect.test.ts`
- Specific behavior: `infinite-loop-prevention.test.ts`

## Migration Strategy

1. Create new test files with proper names
2. Move tests to appropriate files
3. Remove duplication
4. Delete old mixed test files
5. Update test runner if needed