import { performance } from 'node:perf_hooks'
import { parseArgs } from 'node:util'
import type { ReadOnlyState, Unsubscribe } from '../src/index.ts'
import { batch, derive, effect, state } from '../src/index.ts'

const DEFAULT_RUN_COUNT = 10
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

const {
	values,
}: {
	values: {
		'run-count'?: string
	}
} = parseArgs({
	options: {
		'run-count': {
			short: 'R',
			type: 'string',
		},
	},
	strict: false,
})
const RUN_COUNT: number = values['run-count'] ? Number(values['run-count']) : DEFAULT_RUN_COUNT

const forceGC = (): void => {
	if (global.gc) {
		global.gc()
	}
}

type BenchmarkFn = () => number
type BenchResult = {
	heapDeltas: number[]
	times: number[]
}

function collectBench(fn: BenchmarkFn): BenchResult {
	for (let i = 0; i < WARMUP_RUNS; i++) fn()
	const times: number[] = []
	const heapDeltas: number[] = []
	for (let i = 0; i < BENCH_RUNS; i++) {
		forceGC()
		const heapBefore = process.memoryUsage().heapUsed
		times.push(fn())
		const heapAfter = process.memoryUsage().heapUsed
		heapDeltas.push(heapAfter - heapBefore)
	}
	return {
		heapDeltas,
		times,
	}
}

function printResult(name: string, result: BenchResult): void {
	const times = result.times.slice().sort((a: number, b: number): number => a - b)
	const heaps = result.heapDeltas.slice().sort((a: number, b: number): number => a - b)
	const median = times[Math.floor(times.length / 2)]
	const min = times[0]
	const max = times[times.length - 1]
	const mean = times.reduce((a: number, b: number): number => a + b, 0) / times.length
	const sd = Math.sqrt(times.reduce((sum: number, v: number): number => sum + (v - mean) ** 2, 0) / times.length)
	const heapMedian = Math.round(heaps[Math.floor(heaps.length / 2)] / 1024)

	let totalT = 0
	for (const t of result.times) totalT += t
	const avgT = totalT / RUN_COUNT

	let totalM = 0
	for (const h of result.heapDeltas) totalM += h
	totalM = Math.round(totalM / 1024)
	const avgM = Math.round(totalM / RUN_COUNT)

	console.info(
		`${name}:  med=${median.toFixed(2)}ms  min=${min.toFixed(2)}ms  max=${max.toFixed(2)}ms  sd=${sd.toFixed(2)}ms  heap=${heapMedian}kb  total_t=${totalT.toFixed(2)}ms  avg_t=${avgT.toFixed(2)}ms  total_m=${totalM}kb  avg_m=${avgM}kb`
	)
}

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

type SuiteEntry =
	| {
			fn: BenchmarkFn
			name: string
	  }
	| {
			header: string
	  }

const suite: SuiteEntry[] = [
	{
		fn: classicLoop,
		name: 'classic loop              ',
	},
	{
		fn: stateNoSubscribers,
		name: 'state no subs             ',
	},
	{
		fn: statePlusDeriveNoEffects,
		name: 'state + derive            ',
	},
	{
		fn: statePlusDerivePlusEffects,
		name: 'state + derive + 2 effects',
	},
	{
		fn: batchPlusDeriveNoEffects,
		name: 'batch + derive            ',
	},
	{
		fn: batchPlusDerivePlusEffects,
		name: 'batch + derive + 2 effects',
	},
	{
		header: '--- Targeted benchmarks ---',
	},
	{
		fn: stateCreation,
		name: 'state creation            ',
	},
	{
		fn: stateReadNoEffect,
		name: 'state read (no effect)    ',
	},
	{
		fn: stateWrite1Sub,
		name: 'state write 1 sub         ',
	},
	{
		fn: stateWrite100Subs,
		name: 'state write 100 subs      ',
	},
	{
		fn: effectTriggers,
		name: 'effect triggers           ',
	},
	{
		fn: manyDependencies,
		name: 'many dependencies         ',
	},
	{
		fn: deriveChainDepth10,
		name: 'derive chain depth 10     ',
	},
	{
		fn: update100StatesIndividual,
		name: '100 states individual     ',
	},
	{
		fn: update100StatesBatched,
		name: '100 states batched        ',
	},
]

const totalSamples: number = RUN_COUNT * BENCH_RUNS
console.info(
	`=== Beacon v1000 Benchmark (${LOOP_LENGTH.toLocaleString()} iterations, ${RUN_COUNT} cycles × ${BENCH_RUNS} samples = ${totalSamples} total) ===`
)
console.info('')

const accumulated: Map<string, BenchResult> = new Map<string, BenchResult>()

for (let cycle = 0; cycle < RUN_COUNT; cycle++) {
	process.stderr.write(`Cycle ${cycle + 1}/${RUN_COUNT}...\n`)
	for (const entry of suite) {
		if ('header' in entry) continue
		const { fn, name } = entry
		const result = collectBench(fn)
		const existing = accumulated.get(name)
		if (existing) {
			for (const t of result.times) existing.times.push(t)
			for (const h of result.heapDeltas) existing.heapDeltas.push(h)
		} else {
			accumulated.set(name, {
				heapDeltas: [
					...result.heapDeltas,
				],
				times: [
					...result.times,
				],
			})
		}
	}
}

let grandTotalTime = 0
let grandTotalMem = 0

for (const entry of suite) {
	if ('header' in entry) {
		console.info('')
		console.info(entry.header)
		console.info('')
		continue
	}
	const result = accumulated.get(entry.name)
	if (result) {
		printResult(entry.name, result)
		for (const t of result.times) grandTotalTime += t
		for (const h of result.heapDeltas) grandTotalMem += h
	}
}

const grandTotalMemKb: number = Math.round(grandTotalMem / 1024)
const avgTimePerCycle: number = grandTotalTime / RUN_COUNT
const avgMemPerCycle: number = Math.round(grandTotalMemKb / RUN_COUNT)

console.info('')
console.info(
	`Total: ${(grandTotalTime / 1000).toFixed(1)}s  Avg/cycle: ${(avgTimePerCycle / 1000).toFixed(1)}s  Total mem: ${grandTotalMemKb}kb  Avg mem/cycle: ${avgMemPerCycle}kb`
)
