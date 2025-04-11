import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { state, derive, batch, type State, type ReadOnlyState } from '../src/index.ts'

/**
 * Integration tests for deep dependency chains.
 */
describe('Deep Dependency Chains', { concurrency: true, timeout: 1000 }, (): void => {
	type StateOrReadOnly<T> = State<T> | ReadOnlyState<T>

	it('should handle a small dependency chain', (): void => {
		// Create a small chain for basic testing
		const source = state(0)
		const a = derive((): number => source() + 1)
		const b = derive((): number => a() + 1)
		const c = derive((): number => b() + 1)

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

	it('should handle medium-depth dependency chains (depth=10)', (): void => {
		// Create a medium depth chain
		const source = state(0)
		const depth = 10

		// Create the chain and store nodes
		// Define a type for our callable state/derive values

		const chain: StateOrReadOnly<number>[] = [source]
		for (let i = 0; i < depth; i++) {
			chain.push(derive((): number => (chain[i] as StateOrReadOnly<number>)() + 1))
		}

		const leaf = chain[depth] as StateOrReadOnly<number>

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
			assert.strictEqual(
				(chain[i] as StateOrReadOnly<number>)(),
				expected,
				`Node at depth ${i} should have value ${expected}`
			)
		}
	})

	it('should handle deep dependency chains with batch (depth=20)', (): void => {
		// Create a deep chain
		const source = state(0)
		const depth = 20

		// Create the chain and store nodes
		const chain: StateOrReadOnly<number>[] = [source]
		for (let i = 0; i < depth; i++) {
			chain.push(derive((): number => (chain[i] as StateOrReadOnly<number>)() + 1))
		}

		const leaf = chain[depth] as StateOrReadOnly<number>

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
		assert.strictEqual((chain[1] as StateOrReadOnly<number>)(), 11)
		assert.strictEqual((chain[5] as StateOrReadOnly<number>)(), 15)
		assert.strictEqual((chain[10] as StateOrReadOnly<number>)(), 20)
		assert.strictEqual((chain[15] as StateOrReadOnly<number>)(), 25)
	})

	it('should not cause stack overflow with very deep chains (depth=30)', (): void => {
		const source = state(0)
		const depth = 30

		// Create a chain of 30 derived states
		const chain: StateOrReadOnly<number>[] = [source]
		for (let i = 0; i < depth; i++) {
			chain.push(derive((): number => (chain[i] as StateOrReadOnly<number>)() + 1))
		}

		const leaf = chain[depth] as StateOrReadOnly<number>

		// Verify initial values
		assert.strictEqual(source(), 0)
		assert.strictEqual(leaf(), depth)

		// Update source using batch
		batch((): void => {
			source.set(10)
		})

		// Verify all nodes update correctly
		assert.strictEqual(source(), 10)
		assert.strictEqual(leaf(), 10 + depth)
	})

	it('should handle extremely deep dependency chains (depth=100)', (): void => {
		const source = state(0)
		const depth = 100

		// Create a chain of 100 derived states
		const chain: StateOrReadOnly<number>[] = [source]
		for (let i = 0; i < depth; i++) {
			chain.push(derive((): number => (chain[i] as StateOrReadOnly<number>)() + 1))
		}

		const leaf = chain[depth] as StateOrReadOnly<number>

		// Verify initial values
		assert.strictEqual(source(), 0)
		assert.strictEqual(leaf(), depth)

		// Update source
		source.set(10)

		// Verify correct propagation to leaf node
		assert.strictEqual(source(), 10)
		assert.strictEqual(leaf(), 10 + depth)

		// Verify nodes at different depths
		assert.strictEqual((chain[1] as StateOrReadOnly<number>)(), 11)
		assert.strictEqual((chain[25] as StateOrReadOnly<number>)(), 35)
		assert.strictEqual((chain[50] as StateOrReadOnly<number>)(), 60)
		assert.strictEqual((chain[75] as StateOrReadOnly<number>)(), 85)
	})

	it('should handle multiple rapid updates to deep chains', (): void => {
		const source = state(0)
		const depth = 30

		// Create the chain
		const chain: StateOrReadOnly<number>[] = [source]
		for (let i = 0; i < depth; i++) {
			chain.push(derive((): number => (chain[i] as StateOrReadOnly<number>)() + 1))
		}

		const leaf = chain[depth] as StateOrReadOnly<number>

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
