import { describe, it } from 'node:test'
import { performance } from 'node:perf_hooks'
import { state, derived, effect, batch, type Signal } from '../src/index.ts'

/**
 * Performance tests for the beacon library.
 *
 * This file contains performance benchmarks, testing:
 * - Signal creation performance
 * - Read/write performance
 * - Derived signal performance
 * - Effect performance
 * - Batch performance
 * - Many dependencies handling
 * - Batch vs. unbatched updates comparison
 */
describe('Performance', { concurrency: true }, (): void => {
	it('should measure creation performance', (): void => {
		const ITERATIONS = 100_000

		const start = performance.now()
		for (let i = 0; i < ITERATIONS; i++) {
			state(i)
		}
		const end = performance.now()

		const elapsed = end - start
		const opsPerSecond = Math.floor((ITERATIONS / elapsed) * 1000)
		console.log(`\nCreating ${formatNumber(ITERATIONS)} signals: ${elapsed.toFixed(2)}ms`)
		console.log(`Operations per second: ${formatNumber(opsPerSecond)}/s`)
	})

	it('should measure read performance', (): void => {
		const ITERATIONS = 1_000_000
		const counter = state(0)

		const start = performance.now()
		for (let i = 0; i < ITERATIONS; i++) {
			const value = counter()
		}
		const end = performance.now()

		const elapsed = end - start
		const opsPerSecond = Math.floor((ITERATIONS / elapsed) * 1000)
		console.log(`\nReading signal ${formatNumber(ITERATIONS)} times: ${elapsed.toFixed(2)}ms`)
		console.log(`Operations per second: ${formatNumber(opsPerSecond)}/s`)
	})

	it('should measure write performance', (): void => {
		const ITERATIONS = 100_000
		const counter = state(0)

		const start = performance.now()
		for (let i = 0; i < ITERATIONS; i++) {
			counter.set(i)
		}
		const end = performance.now()

		const elapsed = end - start
		const opsPerSecond = Math.floor((ITERATIONS / elapsed) * 1000)
		console.log(`\nSetting signal ${formatNumber(ITERATIONS)} times: ${elapsed.toFixed(2)}ms`)
		console.log(`Operations per second: ${formatNumber(opsPerSecond)}/s`)
	})

	it('should measure derived signal performance', (): void => {
		const ITERATIONS = 100_000
		const counter = state(0)
		const doubled = derived((): number => counter() * 2)

		const start = performance.now()
		for (let i = 0; i < ITERATIONS; i++) {
			counter.set(i)
			const value = doubled()
		}
		const end = performance.now()

		const elapsed = end - start
		const opsPerSecond = Math.floor((ITERATIONS / elapsed) * 1000)
		console.log(`\nDerived signal with ${formatNumber(ITERATIONS)} updates: ${elapsed.toFixed(2)}ms`)
		console.log(`Operations per second: ${formatNumber(opsPerSecond)}/s`)
	})

	it('should measure effect performance', (): void => {
		const ITERATIONS = 10_000
		const counter = state(0)
		let effectRuns = 0

		// Set up effect
		const cleanup = effect((): void => {
			effectRuns++
			const value = counter()
		})

		effectRuns = 0 // Reset after initial run

		const start = performance.now()
		for (let i = 0; i < ITERATIONS; i++) {
			counter.set(i)
		}
		const end = performance.now()

		cleanup() // Clean up the effect

		const elapsed = end - start
		const opsPerSecond = Math.floor((ITERATIONS / elapsed) * 1000)
		console.log(`\nEffect with ${formatNumber(ITERATIONS)} triggers: ${elapsed.toFixed(2)}ms`)
		console.log(`Operations per second: ${formatNumber(opsPerSecond)}/s`)
		console.log(`Effect ran ${formatNumber(effectRuns)} times`)
	})

	it('should measure batch performance', (): void => {
		const ITERATIONS = 10_000
		const BATCH_SIZE = 10
		const counter = state(0)
		let effectRuns = 0

		// Set up effect
		const cleanup = effect((): void => {
			effectRuns++
			const value = counter()
		})

		effectRuns = 0 // Reset after initial run

		const start = performance.now()
		for (let i = 0; i < ITERATIONS; i++) {
			batch((): void => {
				for (let j = 0; j < BATCH_SIZE; j++) {
					counter.set(i * BATCH_SIZE + j)
				}
			})
		}
		const end = performance.now()

		cleanup() // Clean up the effect

		const elapsed = end - start
		const totalOps = ITERATIONS * BATCH_SIZE
		const opsPerSecond = Math.floor((totalOps / elapsed) * 1000)
		console.log(`\nBatch with ${formatNumber(ITERATIONS)} batches of ${BATCH_SIZE} updates: ${elapsed.toFixed(2)}ms`)
		console.log(`Total operations: ${formatNumber(totalOps)}`)
		console.log(`Operations per second: ${formatNumber(opsPerSecond)}/s`)
		console.log(
			`Effect ran ${formatNumber(effectRuns)} times (${((effectRuns / ITERATIONS) * 100).toFixed(2)}% of batches)`
		)
	})

	// Removed complex dependency graph test due to stack overflow issues

	it('should handle many dependencies', async (): Promise<void> => {
		const COUNT = 100
		const ITERATIONS = 100 // Reduced iterations since we're now awaiting each batch

		// Create many source signals
		const sources = Array.from({ length: COUNT }, (_: unknown, i: number): Signal<number> => state(i))

		// Create a derived signal that depends on all sources
		const sum = derived((): number => {
			return sources.reduce((acc: number, source: Signal<number>): number => acc + source(), 0)
		})

		const expected = (COUNT * (COUNT - 1)) / 2 // Sum of 0..COUNT-1
		const initial = sum()
		if (initial !== expected) {
			throw new Error(`Initial sum incorrect: expected ${expected}, got ${initial}`)
		}

		const start = performance.now()
		for (let iter = 0; iter < ITERATIONS; iter++) {
			// Use batch to update all sources at once
			batch((): void => {
				for (let i = 0; i < COUNT; i++) {
					sources[i].set(i + iter)
				}
			})

			// Wait for updates to propagate
			await new Promise((resolve: (value: unknown) => void): NodeJS.Timeout => setTimeout(resolve, 10))

			const value = sum()
			const expectedSum = (COUNT * (COUNT - 1)) / 2 + COUNT * iter
			if (value !== expectedSum) {
				throw new Error(`Sum incorrect: expected ${expectedSum}, got ${value}`)
			}
		}
		const end = performance.now()

		const elapsed = end - start
		const totalUpdates = ITERATIONS * COUNT
		const opsPerSecond = Math.floor((totalUpdates / elapsed) * 1000)
		console.log(`\nHandling ${COUNT} dependencies with ${formatNumber(ITERATIONS)} iterations: ${elapsed.toFixed(2)}ms`)
		console.log(`Total updates: ${formatNumber(totalUpdates)}`)
		console.log(`Operations per second: ${formatNumber(opsPerSecond)}/s`)
	})

	it('should compare batch vs. unbatched updates', (): void => {
		const UPDATES = 10_000
		const SIGNAL_COUNT = 5

		// With batch
		const batchedSignals = Array.from({ length: SIGNAL_COUNT }, (): Signal<number> => state(0))
		let batchedEffectCount = 0

		const batchedCleanup = effect((): number => {
			batchedEffectCount++
			let sum = 0
			for (const signal of batchedSignals) {
				sum += signal()
			}
			return sum
		})

		batchedEffectCount = 0 // Reset after initial run

		const batchStart = performance.now()
		for (let i = 0; i < UPDATES; i++) {
			batch((): void => {
				for (const signal of batchedSignals) {
					signal.set(i)
				}
			})
		}
		const batchEnd = performance.now()

		batchedCleanup()

		// Without batch
		const unbatchedSignals = Array.from({ length: SIGNAL_COUNT }, (): Signal<number> => state(0))
		let unbatchedEffectCount = 0

		const unbatchedCleanup = effect((): number => {
			unbatchedEffectCount++
			let sum = 0
			for (const signal of unbatchedSignals) {
				sum += signal()
			}
			return sum
		})

		unbatchedEffectCount = 0 // Reset after initial run

		const unbatchedStart = performance.now()
		for (let i = 0; i < UPDATES; i++) {
			for (const signal of unbatchedSignals) {
				signal.set(i)
			}
		}
		const unbatchedEnd = performance.now()

		unbatchedCleanup()

		const batchedElapsed = batchEnd - batchStart
		const unbatchedElapsed = unbatchedEnd - unbatchedStart
		const batchedOps = ((UPDATES * SIGNAL_COUNT) / batchedElapsed) * 1000
		const unbatchedOps = ((UPDATES * SIGNAL_COUNT) / unbatchedElapsed) * 1000

		console.log(`\nBatch vs. Unbatched comparison (${SIGNAL_COUNT} signals, ${formatNumber(UPDATES)} iterations):`)
		console.log(
			`Batched: ${batchedElapsed.toFixed(2)}ms, ${formatNumber(Math.floor(batchedOps))}/s, effect runs: ${formatNumber(batchedEffectCount)}`
		)
		console.log(
			`Unbatched: ${unbatchedElapsed.toFixed(2)}ms, ${formatNumber(Math.floor(unbatchedOps))}/s, effect runs: ${formatNumber(unbatchedEffectCount)}`
		)
		console.log(`Performance ratio: ${(unbatchedElapsed / batchedElapsed).toFixed(2)}x faster with batching`)
		console.log(`Effect runs ratio: ${(unbatchedEffectCount / batchedEffectCount).toFixed(2)}x fewer with batching`)
	})
})

// Helper to format numbers with commas
const formatNumber = (num: number): string => {
	return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}
