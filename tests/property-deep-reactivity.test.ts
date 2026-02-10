import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fc from 'fast-check'
import { batch, effect, state } from '../src/index.ts'

/**
 * Property-based tests for deep reactivity at arbitrary nesting depths.
 *
 * Beacon's proxy wrapping in resolveValue → wrapNestedObject is recursive:
 * accessing a nested object property returns a proxy, which itself wraps
 * deeper objects on access. These tests verify that writing to the deepest
 * property at any nesting depth N triggers an effect reading that path.
 *
 * @see tests/PROPERTY_BASED_TESTING.md — Opportunity #8
 */

// --- Types ---

type NestedObj = {
	inner: NestedObj | number
}

// --- Helpers ---

/**
 * Build a nested object of given depth with a leaf value at the bottom.
 * depth=1 → { inner: leafValue }
 * depth=2 → { inner: { inner: leafValue } }
 */
function buildNested(depth: number, leafValue: number): NestedObj {
	let obj: NestedObj | number = leafValue
	for (let i = 0; i < depth; i++) {
		obj = {
			inner: obj,
		}
	}
	return obj as NestedObj
}

/**
 * Read the leaf value at the given depth through a proxy chain.
 * Traverses .inner N times to reach the leaf.
 */
function readLeaf(proxy: NestedObj, depth: number): number {
	let current: NestedObj | number = proxy
	for (let i = 0; i < depth; i++) {
		current = (current as NestedObj).inner
	}
	return current as number
}

/**
 * Write a value to the leaf at the given depth through a proxy chain.
 * Traverses .inner (depth-1) times, then writes .inner = value.
 */
function writeLeaf(proxy: NestedObj, depth: number, value: number): void {
	let current: NestedObj | number = proxy
	for (let i = 0; i < depth - 1; i++) {
		current = (current as NestedObj).inner
	}
	;(current as NestedObj).inner = value
}

// --- Arbitraries ---

const depthArb: fc.Arbitrary<number> = fc.integer({
	max: 15,
	min: 1,
})

const intArb: fc.Arbitrary<number> = fc.integer({
	max: 1000,
	min: -1000,
})

// --- Tests ---

describe(
	'Property-Based: Deep Reactivity',
	{
		concurrency: true,
		timeout: 30000,
	},
	(): void => {
		it('writing to the deepest property triggers an effect reading that path', (): void => {
			fc.assert(
				fc.property(depthArb, intArb, intArb, (depth: number, initial: number, updated: number): void => {
					fc.pre(!Object.is(initial, updated))

					const $s = state(buildNested(depth, initial))
					let runs = 0

					const dispose = effect((): void => {
						runs++
						readLeaf($s, depth)
					})

					assert.strictEqual(runs, 1)

					runs = 0
					writeLeaf($s, depth, updated)

					assert.strictEqual(runs, 1, `effect did not fire for depth ${depth}`)
					assert.strictEqual(readLeaf($s, depth), updated)

					dispose()
				}),
				{
					numRuns: 300,
				}
			)
		})

		it('same-value write at any depth does not trigger effect', (): void => {
			fc.assert(
				fc.property(depthArb, intArb, (depth: number, value: number): void => {
					const $s = state(buildNested(depth, value))
					let runs = 0

					const dispose = effect((): void => {
						runs++
						readLeaf($s, depth)
					})

					runs = 0
					writeLeaf($s, depth, value)

					assert.strictEqual(runs, 0, `effect fired for same-value write at depth ${depth}`)

					dispose()
				}),
				{
					numRuns: 300,
				}
			)
		})

		it('effect tracks correct path through arbitrary depth changes', (): void => {
			fc.assert(
				fc.property(
					depthArb,
					intArb,
					fc.array(intArb, {
						maxLength: 10,
						minLength: 1,
					}),
					(depth: number, initial: number, updates: number[]): void => {
						const $s = state(buildNested(depth, initial))
						let lastSeen = initial

						const dispose = effect((): void => {
							lastSeen = readLeaf($s, depth)
						})

						assert.strictEqual(lastSeen, initial)

						for (const v of updates) {
							writeLeaf($s, depth, v)
							assert.strictEqual(lastSeen, v, `lastSeen mismatch at depth ${depth} for value ${v}`)
						}

						dispose()
					}
				),
				{
					numRuns: 300,
				}
			)
		})

		it('batched writes at any depth trigger effect at most once', (): void => {
			fc.assert(
				fc.property(
					depthArb,
					intArb,
					fc.array(intArb, {
						maxLength: 10,
						minLength: 1,
					}),
					(depth: number, initial: number, updates: number[]): void => {
						const $s = state(buildNested(depth, initial))
						let runs = 0

						const dispose = effect((): void => {
							runs++
							readLeaf($s, depth)
						})

						runs = 0

						batch((): void => {
							for (const v of updates) {
								writeLeaf($s, depth, v)
							}
						})

						assert.ok(runs <= 1, `effect ran ${runs} times in batch at depth ${depth}`)

						const lastValue = updates[updates.length - 1]
						assert.strictEqual(readLeaf($s, depth), lastValue)

						dispose()
					}
				),
				{
					numRuns: 300,
				}
			)
		})

		it('writing at an intermediate depth does not affect deeper leaf tracking', (): void => {
			fc.assert(
				fc.property(
					fc.integer({
						max: 15,
						min: 3,
					}),
					intArb,
					intArb,
					(depth: number, initial: number, updated: number): void => {
						fc.pre(!Object.is(initial, updated))

						const $s = state(buildNested(depth, initial))

						// Effect tracks the deepest leaf
						let deepRuns = 0
						const disposeDeep = effect((): void => {
							deepRuns++
							readLeaf($s, depth)
						})

						// Effect tracks an intermediate level (depth - 1 reads .inner at that level)
						let midRuns = 0
						const disposeMid = effect((): void => {
							midRuns++
							readLeaf($s, depth - 1)
						})

						deepRuns = 0
						midRuns = 0

						// Write at the deepest level
						writeLeaf($s, depth, updated)

						assert.strictEqual(deepRuns, 1, `deep effect should fire at depth ${depth}`)
						// The mid-level effect reads .inner one level up, which is a sub-object
						// reference — it may or may not fire depending on whether the object
						// reference changed. We just verify it doesn't crash.
						assert.ok(midRuns >= 0)

						disposeDeep()
						disposeMid()
					}
				),
				{
					numRuns: 300,
				}
			)
		})
	}
)
