# Test Style Guide for Beacon

## Core Principles
- **Minimal**: No unnecessary comments or debug output
- **Consistent**: Same patterns across all tests
- **Clear**: Self-documenting test names and variable names
- **Focused**: Each test verifies one specific behavior

## Naming Conventions

### State Variables
- Use descriptive names that indicate the data type
- Prefix with dollar sign ($) to indicate reactive state
- Examples: `$count`, `$user`, `$items`, `$config`

### Regular Variables
- Use clear, descriptive names
- Examples: `effectCount`, `results`, `disposed`

### Test Descriptions
- Use present tense, active voice
- Start with verb: "tracks", "updates", "handles", "prevents"
- Be specific about what is being tested

## Code Style

### Imports
```typescript
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { state, effect, derive, batch } from '../src/index.ts'
```

### Test Structure
```typescript
describe('Feature Name', { concurrency: true, timeout: 1000 }, () => {
	it('does something specific', () => {
		// Arrange
		const $state = state({ value: 0 })
		let effectCount = 0
		
		// Act
		effect(() => {
			effectCount++
			$state.value // Read to establish dependency
		})
		
		// Assert
		assert.strictEqual(effectCount, 1)
	})
})
```

### Formatting Rules
- Use tabs for indentation
- No spaces inside object/array literals: `{value: 0}` not `{ value: 0 }`
- Single line for simple objects: `{x: 1, y: 2}`
- Multi-line for complex objects with consistent indentation
- No trailing commas in arrays or objects
- No unnecessary type annotations where TypeScript can infer

### Assertions
- Use `assert.strictEqual()` for primitives
- Use `assert.deepStrictEqual()` for objects/arrays
- No assertion messages unless the test name isn't sufficient
- Group related assertions together

### What NOT to Include
- Debug console.log statements
- Verbose comments explaining obvious code
- TODO comments
- Commented-out code
- Unnecessary type annotations
- Variable declarations far from usage

## Example Test

```typescript
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { state, effect } from '../src/index.ts'

describe('State', { concurrency: true, timeout: 1000 }, () => {
	it('tracks primitive values', () => {
		const $count = state({value: 0})
		
		assert.strictEqual($count.value, 0)
		
		$count.value = 5
		assert.strictEqual($count.value, 5)
	})
	
	it('triggers effects on change', () => {
		const $count = state({value: 0})
		let effectCount = 0
		
		effect(() => {
			effectCount++
			$count.value // Read to track
		})
		
		assert.strictEqual(effectCount, 1)
		
		$count.value = 10
		assert.strictEqual(effectCount, 2)
	})
})
```

## Cleanup Patterns

### For Effects
```typescript
const dispose = effect(() => { /* ... */ })
// Test code
dispose() // Always clean up
```

### For Derives
```typescript
const $computed = derive(() => /* ... */)
// Test code
$computed.dispose() // Always clean up
```

## Common Patterns

### Testing Effect Execution Count
```typescript
let effectCount = 0
effect(() => {
	effectCount++
	$state.value // Read dependency
})
```

### Collecting Effect Results
```typescript
const results: number[] = []
effect(() => {
	results.push($state.value)
})
```

### Testing Disposal
```typescript
const dispose = effect(() => { /* ... */ })
dispose()
$state.value = 10 // Should not trigger disposed effect
```