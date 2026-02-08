import { performance } from 'node:perf_hooks'
import type { ReadOnlyState, Unsubscribe } from '../src/index.ts'
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
	const s = state(0)
	const start = performance.now()
	for (let i = 0; i < LOOP_LENGTH; i++) s.update((v: number): number => v + 1)
	return performance.now() - start
}

function statePlusDeriveNoEffects(): number {
	const s = state(0)
	const totals: ReadOnlyState<number> = derive((): number => s() * 2)
	const start = performance.now()
	for (let i = 0; i < LOOP_LENGTH; i++) s.update((v: number): number => v + 1)
	const end = performance.now()
	if (totals() !== s() * 2) throw new Error('mismatch')
	return end - start
}

function statePlusDerivePlusEffects(): number {
	const s = state(0)
	const d1: Unsubscribe = effect((): void => {
		s()
	})
	const d2: Unsubscribe = effect((): void => {
		s()
	})
	const totals: ReadOnlyState<number> = derive((): number => s() * 2)
	const start = performance.now()
	for (let i = 0; i < LOOP_LENGTH; i++) s.update((v: number): number => v + 1)
	const end = performance.now()
	if (totals() !== s() * 2) throw new Error('mismatch')
	d1()
	d2()
	return end - start
}

function batchPlusDeriveNoEffects(): number {
	const errors = state(0)
	const processed = state(0)
	const totals: ReadOnlyState<number> = derive((): number => errors() + processed())
	const start = performance.now()
	batch((): void => {
		for (let i = 0; i <= LOOP_LENGTH; i++) {
			if (i % ERROR_FREQUENCY === 0) {
				errors.update((v: number): number => v + 1)
			} else {
				processed.update((v: number): number => v + 1)
			}
		}
	})
	const end = performance.now()
	if (processed() + errors() !== totals()) throw new Error('mismatch')
	return end - start
}

function batchPlusDerivePlusEffects(): number {
	const errors = state(0)
	const processed = state(0)
	const d1: Unsubscribe = effect((): void => {
		errors()
	})
	const d2: Unsubscribe = effect((): void => {
		processed()
	})
	const totals: ReadOnlyState<number> = derive((): number => errors() + processed())
	const start = performance.now()
	batch((): void => {
		for (let i = 0; i <= LOOP_LENGTH; i++) {
			if (i % ERROR_FREQUENCY === 0) {
				errors.update((v: number): number => v + 1)
			} else {
				processed.update((v: number): number => v + 1)
			}
		}
	})
	const end = performance.now()
	if (processed() + errors() !== totals()) throw new Error('mismatch')
	d1()
	d2()
	return end - start
}

function stateCreation(): number {
	const start = performance.now()
	for (let i = 0; i < STATE_CREATION_COUNT; i++) {
		state(i)
	}
	return performance.now() - start
}

function stateReadNoEffect(): number {
	const s = state(42)
	const start = performance.now()
	for (let i = 0; i < STATE_READ_COUNT; i++) {
		s()
	}
	return performance.now() - start
}

function stateWrite1Sub(): number {
	const s = state(0)
	const cleanup: Unsubscribe = effect((): void => {
		s()
	})
	const start = performance.now()
	for (let i = 0; i < SINGLE_SUB_WRITES; i++) {
		s.set(i)
	}
	const end = performance.now()
	cleanup()
	return end - start
}

function stateWrite100Subs(): number {
	const s = state(0)
	const cleanups: Unsubscribe[] = []
	for (let j = 0; j < MANY_SUB_COUNT; j++) {
		cleanups.push(
			effect((): void => {
				s()
			})
		)
	}
	const start = performance.now()
	for (let i = 0; i < MANY_SUB_WRITES; i++) {
		s.set(i)
	}
	const end = performance.now()
	for (const c of cleanups) c()
	return end - start
}

function effectTriggers(): number {
	const s = state(0)
	const cleanup: Unsubscribe = effect((): void => {
		s()
	})
	const start = performance.now()
	for (let i = 0; i < EFFECT_TRIGGER_WRITES; i++) {
		s.set(i)
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
		(_: unknown, i: number) => state(i)
	)
	const sum: ReadOnlyState<number> = derive((): number => {
		let acc = 0
		for (const src of sources) acc += src()
		return acc
	})
	const cleanup: Unsubscribe = effect((): void => {
		sum()
	})
	const start = performance.now()
	for (let iter = 0; iter < MULTI_SOURCE_ITERATIONS; iter++) {
		batch((): void => {
			for (let i = 0; i < MULTI_SOURCE_COUNT; i++) {
				sources[i].set(i + iter)
			}
		})
	}
	const end = performance.now()
	cleanup()
	return end - start
}

function deriveChainDepth10(): number {
	const source = state(0)
	let current: ReadOnlyState<number> = derive((): number => source())
	for (let i = 1; i < DERIVE_CHAIN_DEPTH; i++) {
		const prev = current
		current = derive((): number => prev() + 1)
	}
	const cleanup: Unsubscribe = effect((): void => {
		current()
	})
	const start = performance.now()
	for (let i = 0; i < DERIVE_CHAIN_ITERATIONS; i++) {
		source.set(i)
	}
	const end = performance.now()
	cleanup()
	return end - start
}

function update100StatesIndividual(): number {
	const counters = Array.from(
		{
			length: MULTI_SOURCE_COUNT,
		},
		(_: unknown, i: number) => state(i)
	)
	const cleanup: Unsubscribe = effect((): void => {
		let _sum = 0
		for (const c of counters) _sum += c()
	})
	const start = performance.now()
	for (let iter = 0; iter < MULTI_SOURCE_ITERATIONS; iter++) {
		for (let i = 0; i < MULTI_SOURCE_COUNT; i++) {
			counters[i].set(i + iter)
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
		(_: unknown, i: number) => state(i)
	)
	const cleanup: Unsubscribe = effect((): void => {
		let _sum = 0
		for (const c of counters) _sum += c()
	})
	const start = performance.now()
	for (let iter = 0; iter < MULTI_SOURCE_ITERATIONS; iter++) {
		batch((): void => {
			for (let i = 0; i < MULTI_SOURCE_COUNT; i++) {
				counters[i].set(i + iter)
			}
		})
	}
	const end = performance.now()
	cleanup()
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

console.info(`=== Beacon v1000 Benchmark (${LOOP_LENGTH.toLocaleString()} iterations) ===`)
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
