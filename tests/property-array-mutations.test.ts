import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fc from 'fast-check'
import { batch, effect, state } from '../src/index.ts'

/**
 * Property-based tests for reactive array mutations.
 *
 * Uses model-based testing where a plain JavaScript Array serves as the
 * oracle. Every operation is applied to both a reactive state array and
 * a plain array, then their contents are compared.
 *
 * @see tests/PROPERTY_BASED_TESTING.md — Opportunity #1
 */

// --- Operation types (keys sorted per Biome useSortedKeys) ---

interface CopyWithinOp {
	end: number | undefined
	op: 'copyWithin'
	start: number
	target: number
}

interface FillOp {
	end: number | undefined
	op: 'fill'
	start: number | undefined
	value: number
}

interface PopOp {
	op: 'pop'
}

interface PushOp {
	args: number[]
	op: 'push'
}

interface ReverseOp {
	op: 'reverse'
}

interface ShiftOp {
	op: 'shift'
}

interface SortOp {
	op: 'sort'
}

interface SpliceOp {
	deleteCount: number
	items: number[]
	op: 'splice'
	start: number
}

interface UnshiftOp {
	args: number[]
	op: 'unshift'
}

type ArrayOp = CopyWithinOp | FillOp | PopOp | PushOp | ReverseOp | ShiftOp | SortOp | SpliceOp | UnshiftOp

// --- Operations that return a meaningful value (not the array itself) ---

type ValueReturningOp = PopOp | PushOp | ShiftOp | SpliceOp | UnshiftOp

// --- Operations that return the receiver ---

type ReceiverReturningOp = CopyWithinOp | FillOp | ReverseOp | SortOp

// --- Arbitraries ---

const pushArb: fc.Arbitrary<PushOp> = fc.record({
	args: fc.array(
		fc.integer({
			max: 1000,
			min: -1000,
		}),
		{
			maxLength: 5,
		}
	),
	op: fc.constant('push' as const),
})

const popArb: fc.Arbitrary<PopOp> = fc.record({
	op: fc.constant('pop' as const),
})

const shiftArb: fc.Arbitrary<ShiftOp> = fc.record({
	op: fc.constant('shift' as const),
})

const unshiftArb: fc.Arbitrary<UnshiftOp> = fc.record({
	args: fc.array(
		fc.integer({
			max: 1000,
			min: -1000,
		}),
		{
			maxLength: 5,
		}
	),
	op: fc.constant('unshift' as const),
})

const spliceArb: fc.Arbitrary<SpliceOp> = fc.record({
	deleteCount: fc.nat({
		max: 10,
	}),
	items: fc.array(
		fc.integer({
			max: 1000,
			min: -1000,
		}),
		{
			maxLength: 5,
		}
	),
	op: fc.constant('splice' as const),
	start: fc.integer({
		max: 20,
		min: -10,
	}),
})

const sortArb: fc.Arbitrary<SortOp> = fc.record({
	op: fc.constant('sort' as const),
})

const reverseArb: fc.Arbitrary<ReverseOp> = fc.record({
	op: fc.constant('reverse' as const),
})

// Bounds reach past both ends of arrays of up to 20 elements, so negative and out-of-range cases occur
const boundArb: fc.Arbitrary<number> = fc.integer({
	max: 30,
	min: -30,
})

const fillArb: fc.Arbitrary<FillOp> = fc.record({
	end: fc.option(boundArb, { nil: undefined }),
	op: fc.constant('fill' as const),
	start: fc.option(boundArb, { nil: undefined }),
	value: fc.integer({
		max: 1000,
		min: -1000,
	}),
})

const copyWithinArb: fc.Arbitrary<CopyWithinOp> = fc.record({
	end: fc.option(boundArb, { nil: undefined }),
	op: fc.constant('copyWithin' as const),
	start: boundArb,
	target: boundArb,
})

const arrayOpArb: fc.Arbitrary<ArrayOp> = fc.oneof(
	pushArb,
	popArb,
	shiftArb,
	unshiftArb,
	spliceArb,
	sortArb,
	reverseArb,
	fillArb,
	copyWithinArb
)

const receiverReturningOpArb: fc.Arbitrary<ReceiverReturningOp> = fc.oneof(sortArb, reverseArb, fillArb, copyWithinArb)

const valueReturningOpArb: fc.Arbitrary<ValueReturningOp> = fc.oneof(pushArb, popArb, shiftArb, unshiftArb, spliceArb)

const initialArrayArb: fc.Arbitrary<number[]> = fc.array(
	fc.integer({
		max: 1000,
		min: -1000,
	}),
	{
		maxLength: 20,
		minLength: 0,
	}
)

const opsArb: fc.Arbitrary<ArrayOp[]> = fc.array(arrayOpArb, {
	maxLength: 15,
	minLength: 1,
})

// --- Helpers ---

function applyOp(arr: number[], op: ArrayOp): void {
	switch (op.op) {
		case 'copyWithin':
			arr.copyWithin(op.target, op.start, op.end)
			break
		case 'fill':
			arr.fill(op.value, op.start, op.end)
			break
		case 'pop':
			arr.pop()
			break
		case 'push':
			arr.push(...op.args)
			break
		case 'reverse':
			arr.reverse()
			break
		case 'shift':
			arr.shift()
			break
		case 'sort':
			arr.sort()
			break
		case 'splice':
			arr.splice(op.start, op.deleteCount, ...op.items)
			break
		case 'unshift':
			arr.unshift(...op.args)
			break
	}
}

function applyOpWithReturn(arr: number[], op: ValueReturningOp): number | number[] | undefined {
	switch (op.op) {
		case 'pop':
			return arr.pop()
		case 'push':
			return arr.push(...op.args)
		case 'shift':
			return arr.shift()
		case 'splice':
			return arr.splice(op.start, op.deleteCount, ...op.items)
		case 'unshift':
			return arr.unshift(...op.args)
	}
}

function applyOpWithReceiver(arr: number[], op: ReceiverReturningOp): number[] {
	switch (op.op) {
		case 'copyWithin':
			return arr.copyWithin(op.target, op.start, op.end)
		case 'fill':
			return arr.fill(op.value, op.start, op.end)
		case 'reverse':
			return arr.reverse()
		case 'sort':
			return arr.sort()
	}
}

// --- Tests ---

describe('Property-Based: Array Mutations', {
	concurrency: true,
	timeout: 30000,
}, (): void => {
	it('produces same contents as a plain array after arbitrary mutations', (): void => {
		fc.assert(
			fc.property(initialArrayArb, opsArb, (initial: number[], ops: ArrayOp[]): void => {
				const $reactive = state([...initial])
				const plain = [...initial]

				for (const op of ops) {
					applyOp($reactive, op)
					applyOp(plain, op)
				}

				assert.deepStrictEqual([...$reactive], plain)
				assert.strictEqual($reactive.length, plain.length)
			}),
			{
				numRuns: 300,
			}
		)
	})

	it('returns same values from mutating methods as a plain array', (): void => {
		fc.assert(
			fc.property(initialArrayArb, valueReturningOpArb, (initial: number[], op: ValueReturningOp): void => {
				const $reactive = state([...initial])
				const plain = [...initial]

				const reactiveResult = applyOpWithReturn($reactive, op)
				const plainResult = applyOpWithReturn(plain, op)

				assert.deepStrictEqual(reactiveResult, plainResult)
				assert.deepStrictEqual([...$reactive], plain)
			}),
			{
				numRuns: 300,
			}
		)
	})

	it('returns the receiver from fill, copyWithin, sort and reverse', (): void => {
		fc.assert(
			fc.property(initialArrayArb, receiverReturningOpArb, (initial: number[], op: ReceiverReturningOp): void => {
				const $reactive = state([...initial])
				const plain = [...initial]

				const reactiveResult = applyOpWithReceiver($reactive, op)
				applyOpWithReceiver(plain, op)

				assert.strictEqual(reactiveResult, $reactive)
				assert.deepStrictEqual([...$reactive], plain)
			}),
			{
				numRuns: 300,
			}
		)
	})

	it('fires effect at most once per batch of mutations', (): void => {
		fc.assert(
			fc.property(initialArrayArb, opsArb, (initial: number[], ops: ArrayOp[]): void => {
				const $arr = state([...initial])
				const plain = [...initial]
				let effectRuns = 0

				const dispose = effect((): void => {
					effectRuns++
					// Subscribe to length and all indices
					void $arr.length
				})

				effectRuns = 0

				batch((): void => {
					for (const op of ops) {
						applyOp($arr, op)
						applyOp(plain, op)
					}
				})

				assert.ok(effectRuns <= 1, `Effect ran ${effectRuns} times inside batch of ${ops.length} operations`)
				assert.deepStrictEqual([...$arr], plain)

				dispose()
			}),
			{
				numRuns: 300,
			}
		)
	})
})
