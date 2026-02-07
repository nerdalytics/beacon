import { performance } from 'node:perf_hooks'
import type { ComputedValue, Unsubscribe } from '../src/index.ts'
import { batch, derive, effect, state } from '../src/index.ts'

const LOOP_LENGTH = 1_000_000
const ERROR_FREQUENCY = 1000
const WARMUP_RUNS = 3
const BENCH_RUNS = 7

const EFFECT_TRIGGER_WRITES = 50_000
const MULTI_SOURCE_COUNT = 100
const MULTI_SOURCE_ITERATIONS = 100
const DERIVE_CHAIN_DEPTH = 10
const DERIVE_CHAIN_ITERATIONS = 1_000
const STATE_CREATION_COUNT = 100_000
const STATE_READ_COUNT = 1_000_000
const SINGLE_SUB_WRITES = 100_000
const MANY_SUB_COUNT = 100
const MANY_SUB_WRITES = 10_000

type BenchmarkFn = () => number

function classicLoop(): number {
	const start = performance.now()
	let errors = 0
	let processed = 0
	let totals = 0
	for (let i = 0; i <= LOOP_LENGTH; i++) {
		if (i % ERROR_FREQUENCY === 0) {
			errors++
		} else {
			processed++
		}
		totals++
	}
	if (processed + errors !== totals) throw new Error('mismatch')
	return performance.now() - start
}

function stateNoSubscribers(): number {
	const s = state({
		count: 0,
	})
	const start = performance.now()
	for (let i = 0; i < LOOP_LENGTH; i++) s.count++
	return performance.now() - start
}

function statePlusDeriveNoEffects(): number {
	const s = state({
		count: 0,
	})
	const totals: ComputedValue<number> = derive((): number => s.count * 2)
	const start = performance.now()
	for (let i = 0; i < LOOP_LENGTH; i++) s.count++
	const end = performance.now()
	if (totals.value !== s.count * 2) throw new Error('mismatch')
	return end - start
}

function statePlusDerivePlusEffects(): number {
	const s = state({
		count: 0,
	})
	const d1: Unsubscribe = effect((): void => {
		void s.count
	})
	const d2: Unsubscribe = effect((): void => {
		void s.count
	})
	const totals: ComputedValue<number> = derive((): number => s.count * 2)
	const start = performance.now()
	for (let i = 0; i < LOOP_LENGTH; i++) s.count++
	const end = performance.now()
	if (totals.value !== s.count * 2) throw new Error('mismatch')
	d1()
	d2()
	return end - start
}

function batchPlusDeriveNoEffects(): number {
	const errors = state({
		count: 0,
	})
	const processed = state({
		count: 0,
	})
	const totals: ComputedValue<number> = derive((): number => errors.count + processed.count)
	const start = performance.now()
	batch((): void => {
		for (let i = 0; i <= LOOP_LENGTH; i++) {
			if (i % ERROR_FREQUENCY === 0) {
				errors.count++
			} else {
				processed.count++
			}
		}
	})
	const end = performance.now()
	if (processed.count + errors.count !== totals.value) throw new Error('mismatch')
	return end - start
}

function batchPlusDerivePlusEffects(): number {
	const errors = state({
		count: 0,
	})
	const processed = state({
		count: 0,
	})
	const d1: Unsubscribe = effect((): void => {
		void errors.count
	})
	const d2: Unsubscribe = effect((): void => {
		void processed.count
	})
	const totals: ComputedValue<number> = derive((): number => errors.count + processed.count)
	const start = performance.now()
	batch((): void => {
		for (let i = 0; i <= LOOP_LENGTH; i++) {
			if (i % ERROR_FREQUENCY === 0) {
				errors.count++
			} else {
				processed.count++
			}
		}
	})
	const end = performance.now()
	if (processed.count + errors.count !== totals.value) throw new Error('mismatch')
	d1()
	d2()
	return end - start
}

function runBench(name: string, fn: BenchmarkFn): void {
	for (let i = 0; i < WARMUP_RUNS; i++) fn()
	const results: number[] = []
	for (let i = 0; i < BENCH_RUNS; i++) results.push(fn())
	results.sort((a: number, b: number): number => a - b)
	const median = results[Math.floor(results.length / 2)]
	const min = results[0]
	const max = results[results.length - 1]
	const mean = results.reduce((a: number, b: number): number => a + b, 0) / results.length
	const sd = Math.sqrt(results.reduce((sum: number, v: number): number => sum + (v - mean) ** 2, 0) / results.length)
	console.info(
		`${name}:  med=${median.toFixed(2)}ms  min=${min.toFixed(2)}ms  max=${max.toFixed(2)}ms  sd=${sd.toFixed(2)}ms`
	)
}

function stateCreation(): number {
	const start = performance.now()
	for (let i = 0; i < STATE_CREATION_COUNT; i++) {
		state({
			v: i,
		})
	}
	return performance.now() - start
}

function stateReadNoEffect(): number {
	const s = state({
		v: 42,
	})
	const start = performance.now()
	for (let i = 0; i < STATE_READ_COUNT; i++) {
		void s.v
	}
	return performance.now() - start
}

function stateWrite1Sub(): number {
	const s = state({
		v: 0,
	})
	const cleanup: Unsubscribe = effect((): void => {
		void s.v
	})
	const start = performance.now()
	for (let i = 0; i < SINGLE_SUB_WRITES; i++) {
		s.v = i
	}
	const end = performance.now()
	cleanup()
	return end - start
}

function stateWrite100Subs(): number {
	const s = state({
		v: 0,
	})
	const cleanups: Unsubscribe[] = []
	for (let j = 0; j < MANY_SUB_COUNT; j++) {
		cleanups.push(
			effect((): void => {
				void s.v
			})
		)
	}
	const start = performance.now()
	for (let i = 0; i < MANY_SUB_WRITES; i++) {
		s.v = i
	}
	const end = performance.now()
	for (const c of cleanups) c()
	return end - start
}

function effectTriggers(): number {
	const s = state({
		v: 0,
	})
	const cleanup: Unsubscribe = effect((): void => {
		void s.v
	})
	const start = performance.now()
	for (let i = 0; i < EFFECT_TRIGGER_WRITES; i++) {
		s.v = i
	}
	const end = performance.now()
	cleanup()
	return end - start
}

function manyDependencies(): number {
	const sources = Array.from(
		{
			length: MULTI_SOURCE_COUNT,
		},
		(
			_: unknown,
			i: number
		): {
			v: number
		} =>
			state({
				v: i,
			})
	)
	const sum: ComputedValue<number> = derive((): number => {
		let acc = 0
		for (const src of sources) acc += src.v as number
		return acc
	})
	const cleanup: Unsubscribe = effect((): void => {
		void sum.value
	})
	const start = performance.now()
	for (let iter = 0; iter < MULTI_SOURCE_ITERATIONS; iter++) {
		batch((): void => {
			for (let i = 0; i < MULTI_SOURCE_COUNT; i++) {
				sources[i].v = i + iter
			}
		})
	}
	const end = performance.now()
	cleanup()
	sum.reactive = false
	return end - start
}

function deriveChainDepth10(): number {
	const source = state({
		v: 0,
	})
	const chain: ComputedValue<number>[] = []
	let current: ComputedValue<number> = derive((): number => source.v as number)
	chain.push(current)
	for (let i = 1; i < DERIVE_CHAIN_DEPTH; i++) {
		const prev = current
		current = derive((): number => (prev.value as number) + 1)
		chain.push(current)
	}
	const cleanup: Unsubscribe = effect((): void => {
		void current.value
	})
	const start = performance.now()
	for (let i = 0; i < DERIVE_CHAIN_ITERATIONS; i++) {
		source.v = i
	}
	const end = performance.now()
	cleanup()
	for (const d of chain) d.reactive = false
	return end - start
}

function update100StatesIndividual(): number {
	const counters = Array.from(
		{
			length: MULTI_SOURCE_COUNT,
		},
		(
			_: unknown,
			i: number
		): {
			v: number
		} =>
			state({
				v: i,
			})
	)
	const cleanup: Unsubscribe = effect((): void => {
		let _sum = 0
		for (const c of counters) _sum += c.v as number
	})
	const start = performance.now()
	for (let iter = 0; iter < MULTI_SOURCE_ITERATIONS; iter++) {
		for (let i = 0; i < MULTI_SOURCE_COUNT; i++) {
			counters[i].v = i + iter
		}
	}
	const end = performance.now()
	cleanup()
	return end - start
}

function update100StatesBatched(): number {
	const counters = Array.from(
		{
			length: MULTI_SOURCE_COUNT,
		},
		(
			_: unknown,
			i: number
		): {
			v: number
		} =>
			state({
				v: i,
			})
	)
	const cleanup: Unsubscribe = effect((): void => {
		let _sum = 0
		for (const c of counters) _sum += c.v as number
	})
	const start = performance.now()
	for (let iter = 0; iter < MULTI_SOURCE_ITERATIONS; iter++) {
		batch((): void => {
			for (let i = 0; i < MULTI_SOURCE_COUNT; i++) {
				counters[i].v = i + iter
			}
		})
	}
	const end = performance.now()
	cleanup()
	return end - start
}

console.info(`=== Beacon Benchmark (${LOOP_LENGTH.toLocaleString()} iterations) ===`)
console.info('')
runBench('classic loop              ', classicLoop)
runBench('state no subs             ', stateNoSubscribers)
runBench('state + derive            ', statePlusDeriveNoEffects)
runBench('state + derive + 2 effects', statePlusDerivePlusEffects)
runBench('batch + derive            ', batchPlusDeriveNoEffects)
runBench('batch + derive + 2 effects', batchPlusDerivePlusEffects)

console.info('')
console.info('--- Targeted benchmarks ---')
console.info('')
runBench('state creation            ', stateCreation)
runBench('state read (no effect)    ', stateReadNoEffect)
runBench('state write 1 sub         ', stateWrite1Sub)
runBench('state write 100 subs      ', stateWrite100Subs)
runBench('effect triggers           ', effectTriggers)
runBench('many dependencies         ', manyDependencies)
runBench('derive chain depth 10     ', deriveChainDepth10)
runBench('100 states individual     ', update100StatesIndividual)
runBench('100 states batched        ', update100StatesBatched)
