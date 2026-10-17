import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fc from 'fast-check'
import { batch, effect, state, type Unsubscribe } from '../src/index.ts'

/**
 * Property-based tests for per-property notification within one state object.
 *
 * A write schedules only the effects whose last run read the written property or
 * enumerated the object's keys. The effects here change which properties of the same
 * object they read from run to run, so their subscriptions must follow the read set,
 * not just the object.
 */

// --- Types ---

const KEYS = 'keys'
type Prop = 'a' | 'b' | 'c' | 'd' | 'e'
type Read = Exclude<Prop, 'e'> | typeof KEYS

type Op =
	| { kind: 'batch'; props: Prop[] }
	| { kind: 'delete'; prop: Prop }
	| { index: number; kind: 'dispose' }
	| { kind: 'write'; prop: Prop }

// --- Arbitraries ---

const readArb: fc.Arbitrary<Read> = fc.constantFrom<Read>('a', 'b', 'c', 'd', KEYS)
// Each effect cycles through these read sets, one per run
const planArb: fc.Arbitrary<Read[][]> = fc.array(
	fc.uniqueArray(readArb, {
		maxLength: 3,
	}),
	{
		maxLength: 4,
		minLength: 1,
	}
)
// 'e' starts absent, so writing it adds a key
const propArb: fc.Arbitrary<Prop> = fc.constantFrom<Prop>('a', 'b', 'c', 'd', 'e')
const opArb: fc.Arbitrary<Op> = fc.oneof(
	fc.record({
		kind: fc.constant('write' as const),
		prop: propArb,
	}),
	fc.record({
		kind: fc.constant('delete' as const),
		prop: propArb,
	}),
	fc.record({
		kind: fc.constant('batch' as const),
		props: fc.uniqueArray(propArb, {
			maxLength: 3,
			minLength: 1,
		}),
	}),
	fc.record({
		index: fc.nat({
			max: 7,
		}),
		kind: fc.constant('dispose' as const),
	})
)

describe('Property-Based: Per-Property Notification', {
	concurrency: true,
	timeout: 30000,
}, (): void => {
	it('reruns exactly the effects whose last run read a written key or enumerated the keys', (): void => {
		fc.assert(
			fc.property(
				// Up to 8 effects, so targets cross INDEXED_SCHEDULE_MIN_SUBSCRIBERS in both directions
				fc.array(planArb, {
					maxLength: 8,
					minLength: 1,
				}),
				fc.array(opArb, {
					maxLength: 25,
				}),
				(plans: Read[][][], ops: Op[]): void => {
					const $s: Record<string, number> = state<Record<string, number>>({
						a: 0,
						b: 0,
						c: 0,
						d: 0,
					})
					const present = new Set<string>(['a', 'b', 'c', 'd'])
					let next = 0
					const runs: number[] = plans.map((): number => 0)
					const alive: boolean[] = plans.map((): boolean => true)
					const disposers: Unsubscribe[] = plans.map(
						(plan: Read[][], i: number): Unsubscribe =>
							effect((): void => {
								const reads = plan[(runs[i] as number) % plan.length] as Read[]
								runs[i] = (runs[i] as number) + 1
								for (const read of reads) {
									if (read === KEYS) void Object.keys($s)
									else void $s[read]
								}
							})
					)
					const expected: number[] = plans.map((): number => 1)
					assert.deepStrictEqual(runs, expected)

					const lastReads = (i: number): Read[] => {
						const plan = plans[i] as Read[][]
						return plan[((expected[i] as number) - 1) % plan.length] as Read[]
					}

					for (const op of ops) {
						let written: Prop[] = []
						if (op.kind === 'write') {
							$s[op.prop] = ++next
							present.add(op.prop)
							written = [op.prop]
						} else if (op.kind === 'delete') {
							if (present.has(op.prop)) written = [op.prop]
							delete $s[op.prop]
							present.delete(op.prop)
						} else if (op.kind === 'batch') {
							batch((): void => {
								for (const prop of op.props) {
									$s[prop] = ++next
									present.add(prop)
								}
							})
							written = op.props
						} else if (op.index < plans.length && alive[op.index]) {
							;(disposers[op.index] as Unsubscribe)()
							alive[op.index] = false
						}

						for (let i = 0; i < plans.length; i++) {
							if (!alive[i] || written.length === 0) continue
							const reads = lastReads(i)
							if (reads.includes(KEYS) || written.some((prop: Prop): boolean => reads.includes(prop as Read))) {
								expected[i] = (expected[i] as number) + 1
							}
						}
						assert.deepStrictEqual(runs, expected)
					}

					for (let i = 0; i < plans.length; i++) {
						if (alive[i]) (disposers[i] as Unsubscribe)()
					}
				}
			),
			{
				numRuns: 500,
			}
		)
	})
})
