/*
 * Integration tests for deep dependency chains.
 *
 * This file contains integration tests for dependency chains, testing:
 * - Small dependency chains
 * - Medium-depth dependency chains
 * - Deep dependency chains with batching
 * - Stack overflow prevention
 * - Extremely deep dependency chains
 * - Multiple rapid updates to deep chains
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { state, derived, batch } from '../src/index.ts'

describe('Deep Dependency Chains', { concurrency: true }, (): void => {
	it('should handle a small dependency chain', async (): Promise<void> => {
		// Create a small chain for basic testing
		const source = state(0)
		const a = derived(() => source() + 1)
		const b = derived(() => a() + 1)
		const c = derived(() => b() + 1)

		// Check initial values
		assert.strictEqual(source(), 0)
		assert.strictEqual(a(), 1)
		assert.strictEqual(b(), 2)
		assert.strictEqual(c(), 3)

		// Update source
		source.set(10)

		// Check updated values
		assert.strictEqual(source(), 10)
		assert.strictEqual(a(), 11)
		assert.strictEqual(b(), 12)
		assert.strictEqual(c(), 13)

		// Update with batch
		batch((): void => {
			source.set(20)
		})

		// Check values after batch
		assert.strictEqual(source(), 20)
		assert.strictEqual(a(), 21)
		assert.strictEqual(b(), 22)
		assert.strictEqual(c(), 23)
	})

	it('should handle medium-depth dependency chains (depth=10)', async (): Promise<void> => {
		// Create a medium depth chain
		const source = state(0)
		const depth = 10

		// Create the chain and store nodes
		const chain = [source]
		for (let i = 0; i < depth; i++) {
			chain.push(derived((): number => chain[i]() + 1))
		}

		const leaf = chain[depth]

		// Check initial values
		assert.strictEqual(source(), 0)
		assert.strictEqual(leaf(), depth)

		// Update source directly
		source.set(10)

		// Check updated values
		assert.strictEqual(source(), 10)
		assert.strictEqual(leaf(), 10 + depth)

		// Verify the entire chain
		for (let i = 0; i <= depth; i++) {
			const expected = i === 0 ? 10 : 10 + i
			assert.strictEqual(chain[i](), expected, `Node at depth ${i} should have value ${expected}`)
		}
	})

	it('should handle deep dependency chains with batch (depth=20)', async (): Promise<void> => {
		// Create a deep chain
		const source = state(0)
		const depth = 20

		// Create the chain and store nodes
		const chain = [source]
		for (let i = 0; i < depth; i++) {
			chain.push(derived((): number => chain[i]() + 1))
		}

		const leaf = chain[depth]

		// Check initial values
		assert.strictEqual(source(), 0)
		assert.strictEqual(leaf(), depth)

		// Update with batch to avoid stack overflow
		batch((): void => {
			source.set(10)
		})

		// Check updated values
		assert.strictEqual(source(), 10)
		assert.strictEqual(leaf(), 10 + depth)

		// Spot check a few nodes in the chain
		assert.strictEqual(chain[1](), 11)
		assert.strictEqual(chain[5](), 15)
		assert.strictEqual(chain[10](), 20)
		assert.strictEqual(chain[15](), 25)
	})

	/**
	 * This test demonstrates that without our fix, a deep chain
	 * would cause a stack overflow. With the fix, it works correctly.
	 */
	it('should not cause stack overflow with very deep chains (depth=30)', async (): Promise<void> => {
		// Create a very deep chain that would normally cause stack overflow
		const source = state(0)
		const depth = 30

		// Create the chain
		const chain = [source]
		for (let i = 0; i < depth; i++) {
			chain.push(derived((): number => chain[i]() + 1))
		}

		const leaf = chain[depth]

		// Check initial values
		assert.strictEqual(source(), 0)
		assert.strictEqual(leaf(), depth)

		// Update with batch
		batch((): void => {
			source.set(10)
		})

		// Check if leaf has updated
		assert.strictEqual(source(), 10)
		assert.strictEqual(leaf(), 10 + depth)
	})

	/**
	 * This test verifies that our asynchronous update mechanism can handle
	 * extremely deep dependency chains without stack overflow errors.
	 */
	it('should handle extremely deep dependency chains (depth=100)', async (): Promise<void> => {
		// Create an extremely deep chain
		const source = state(0)
		const depth = 100

		// Create the chain
		const chain = [source]
		for (let i = 0; i < depth; i++) {
			chain.push(derived((): number => chain[i]() + 1))
		}

		const leaf = chain[depth]

		// Check initial values
		assert.strictEqual(source(), 0)
		assert.strictEqual(leaf(), depth)

		// Update source
		source.set(10)

		// Check updated values
		assert.strictEqual(source(), 10)
		assert.strictEqual(leaf(), 10 + depth)

		// Spot check a few nodes across the chain
		assert.strictEqual(chain[1](), 11)
		assert.strictEqual(chain[25](), 35)
		assert.strictEqual(chain[50](), 60)
		assert.strictEqual(chain[75](), 85)
	})

	/**
	 * Test multiple updates in close succession to ensure they all propagate correctly
	 */
	it('should handle multiple rapid updates to deep chains', async (): Promise<void> => {
		const source = state(0)
		const depth = 30

		// Create the chain
		const chain = [source]
		for (let i = 0; i < depth; i++) {
			chain.push(derived((): number => chain[i]() + 1))
		}

		const leaf = chain[depth]

		// Initial check
		assert.strictEqual(leaf(), depth)

		// Make multiple updates in rapid succession
		source.set(10)
		source.set(20)
		source.set(30)

		// Should have the value from the last update
		assert.strictEqual(source(), 30)
		assert.strictEqual(leaf(), 30 + depth)

		// Test with batch
		batch((): void => {
			source.set(40)
			source.set(50)
			source.set(60)
		})

		// Should have the final value
		assert.strictEqual(source(), 60)
		assert.strictEqual(leaf(), 60 + depth)
	})
})
