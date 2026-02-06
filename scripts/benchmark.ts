import { performance } from 'node:perf_hooks'
import type { ComputedValue, Unsubscribe } from '../src/index.ts'
import { batch, derive, effect, state } from '../src/index.ts'

const LOOP_LENGTH = 1_000_000
const ERROR_FREQUENCY = 1000
const WARMUP_RUNS = 3
const BENCH_RUNS = 7

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

console.info(`=== Beacon Benchmark (${LOOP_LENGTH.toLocaleString()} iterations) ===`)
console.info('')
runBench('classic loop              ', classicLoop)
runBench('state no subs             ', stateNoSubscribers)
runBench('state + derive            ', statePlusDeriveNoEffects)
runBench('state + derive + 2 effects', statePlusDerivePlusEffects)
runBench('batch + derive            ', batchPlusDeriveNoEffects)
runBench('batch + derive + 2 effects', batchPlusDerivePlusEffects)
