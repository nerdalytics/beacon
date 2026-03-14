import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fc from 'fast-check'
import { effect, state } from '../src/index.ts'

/**
 * Property-based tests for infinite loop detection boundaries.
 *
 * Beacon detects infinite loops when an effect reads property `p` on a target
 * and then writes to the same property `p` on the same target. Reading `p`
 * and writing a different property `q` is always safe.
 *
 * These tests exercise arbitrary property key pairs to explore edge cases in
 * property key handling — numeric-like strings, single-char keys, keys that
 * could collide, etc.
 *
 * @see tests/PROPERTY_BASED_TESTING.md — Opportunity #7
 */

// --- Arbitraries ---

// Property keys with a variety of shapes: short strings, numeric-like strings,
// longer identifiers, single characters, etc.
const propKeyArb: fc.Arbitrary<string> = fc.oneof(
	fc.string({
		maxLength: 12,
		minLength: 1,
	}),
	fc.constantFrom('a', 'b', 'c', '0', '1', '2', '_', '$', 'ab', 'a0', '_$', '01'),
	fc
		.integer({
			max: 100,
			min: 0,
		})
		.map((n: number): string => String(n)),
	fc.constantFrom('value', 'count', 'name', 'data', 'x', 'y', 'length', 'toString', 'constructor')
)

const intArb: fc.Arbitrary<number> = fc.integer({
	max: 1000,
	min: -1000,
})

// --- Tests ---

describe('Property-Based: Infinite Loop Detection', {
	concurrency: true,
	timeout: 30000,
}, (): void => {
	it('reading and writing the same property always throws', (): void => {
		fc.assert(
			fc.property(propKeyArb, intArb, intArb, (prop: string, initial: number, updated: number): void => {
				fc.pre(!Object.is(initial, updated))

				const obj: Record<string, number> = {
					[prop]: initial,
				}
				const $s = state(obj)
				let errorThrown = false

				try {
					effect((): void => {
						const current = $s[prop]
						$s[prop] = (current as number) + 1
					})
				} catch (error: unknown) {
					errorThrown = true
					assert.ok(
						error instanceof Error && error.message.includes('Infinite loop detected'),
						`Expected infinite loop error for prop "${prop}"`
					)
				}

				assert.strictEqual(errorThrown, true, `Should throw for read+write of same prop "${prop}"`)
			}),
			{
				numRuns: 300,
			}
		)
	})

	it('reading one property and writing a different property never throws', (): void => {
		fc.assert(
			fc.property(
				propKeyArb,
				propKeyArb,
				intArb,
				intArb,
				(readProp: string, writeProp: string, readVal: number, writeVal: number): void => {
					fc.pre(readProp !== writeProp)

					const obj: Record<string, number> = {
						[readProp]: readVal,
						[writeProp]: 0,
					}
					const $s = state(obj)
					let effectRan = false

					const dispose = effect((): void => {
						effectRan = true
						void $s[readProp]
						$s[writeProp] = writeVal
					})

					assert.strictEqual(effectRan, true, `Effect should run for read="${readProp}" write="${writeProp}"`)

					dispose()
				}
			),
			{
				numRuns: 300,
			}
		)
	})

	it('reading property p and writing p on a different state never throws', (): void => {
		fc.assert(
			fc.property(propKeyArb, intArb, intArb, (prop: string, val1: number, val2: number): void => {
				const $source = state({
					[prop]: val1,
				} as Record<string, number>)
				const $target = state({
					[prop]: 0,
				} as Record<string, number>)
				let effectRan = false

				const dispose = effect((): void => {
					effectRan = true
					const v = $source[prop]
					$target[prop] = v as number
				})

				assert.strictEqual(effectRan, true)

				// Updating source triggers effect which writes to target — safe
				assert.doesNotThrow((): void => {
					$source[prop] = val2
				})

				assert.strictEqual($target[prop], val2)

				dispose()
			}),
			{
				numRuns: 300,
			}
		)
	})

	it('same-value write-back to a read property still throws', (): void => {
		fc.assert(
			fc.property(propKeyArb, intArb, (prop: string, value: number): void => {
				const $s = state({
					[prop]: value,
				} as Record<string, number>)
				let errorThrown = false

				// checkInfiniteLoop fires before the Object.is check in the set handler,
				// so writing the same value back still triggers detection
				try {
					effect((): void => {
						const current = $s[prop]
						$s[prop] = current as number
					})
				} catch (error: unknown) {
					errorThrown = true
					assert.ok(
						error instanceof Error && error.message.includes('Infinite loop detected'),
						`Expected infinite loop error for same-value write-back on prop "${prop}"`
					)
				}

				assert.strictEqual(errorThrown, true, `Should throw for same-value write-back on prop "${prop}"`)
			}),
			{
				numRuns: 300,
			}
		)
	})

	it('system recovers after catching infinite loop error', (): void => {
		fc.assert(
			fc.property(propKeyArb, intArb, intArb, (prop: string, initial: number, newValue: number): void => {
				fc.pre(!Object.is(initial, newValue))

				const $s = state({
					[prop]: initial,
				} as Record<string, number>)

				// Trigger infinite loop error
				try {
					effect((): void => {
						const current = $s[prop]
						$s[prop] = (current as number) + 1
					})
				} catch {
					// Expected
				}

				// System should still work: create a safe effect
				let safeRuns = 0
				const dispose = effect((): void => {
					safeRuns++
					void $s[prop]
				})

				safeRuns = 0
				$s[prop] = newValue

				assert.strictEqual(safeRuns, 1, `Safe effect should run after recovery for prop "${prop}"`)
				assert.strictEqual($s[prop], newValue)

				dispose()
			}),
			{
				numRuns: 300,
			}
		)
	})
})
