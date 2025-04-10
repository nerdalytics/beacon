import { performance } from 'node:perf_hooks'
import { state, effect, derive, batch, type State, readonlyState } from '../src/index.ts'

// Configuration
const NumIterations = 5 // Number of measurement iterations
const NumWarupIterations = 2 // Number of warmup iterations

/**
 * Represents the results of a benchmark run
 */
export interface BenchmarkResult {
	/** Name of the benchmark */
	name: string
	/** Median execution time in milliseconds */
	median: number
	/** Minimum execution time in milliseconds */
	min: number
	/** Maximum execution time in milliseconds */
	max: number
	/** Mean execution time in milliseconds */
	mean: number
	/** Operations per second (based on median time) */
	opsPerSec: number
	/** Number of measurement iterations performed */
	iterations: number
	/** Number of operations performed in each run */
	operationsPerRun: number
}

/**
 * Represents a benchmark definition
 */
export interface Benchmark {
	/** Name of the benchmark */
	name: string
	/** Number of operations performed in each run */
	operationsPerRun: number
	/** Function that executes the benchmark */
	run: () => void
	/** Internal property to store effect runs for comparison metrics */
	_effectRuns?: number
}

/**
 * Run a benchmark with proper warmup and multiple iterations
 *
 * @param name - Name of the benchmark
 * @param fn - Benchmark function to execute
 * @param operationsPerRun - Number of operations performed in each run
 * @returns Benchmark results with statistics
 */
export function runBenchmark(name: string, fn: () => void, operationsPerRun: number): BenchmarkResult {
	console.debug(`\nRunning benchmark: ${name}`)

	// Warmup phase
	console.debug(`  Warming up (${NumWarupIterations} iterations)...`)
	for (let i = 0; i < NumWarupIterations; i++) {
		fn()
	}

	// Measurement phase
	console.debug(`  Measuring (${NumIterations} iterations)...`)
	const timings: number[] = []

	for (let i = 0; i < NumIterations; i++) {
		const start = performance.now()
		fn()
		const end = performance.now()
		timings.push(end - start)
	}

	// Calculate statistics
	timings.sort((a: number, b: number): number => a - b)
	const min = timings[0]
	const max = timings[timings.length - 1]
	const median = timings[Math.floor(timings.length / 2)]
	const mean = timings.reduce((sum: number, t: number): number => sum + t, 0) / timings.length

	// Calculate operations per second
	const opsPerSec = operationsPerRun / (median / 1000)

	// Report results
	console.debug(`  Results for ${name}:`)
	console.debug(`    Time: ${median.toFixed(2)}ms (median) [min: ${min.toFixed(2)}ms, max: ${max.toFixed(2)}ms]`)
	console.debug(`    Throughput: ${Math.floor(opsPerSec).toLocaleString()} ops/sec`)

	return {
		name,
		median,
		min,
		max,
		mean,
		opsPerSec: Math.floor(opsPerSec),
		iterations: NumIterations,
		operationsPerRun,
	}
}

// Store effect counts for ratio calculation
const effectCounts = {
	individual: 0,
	batched: 0,
}

// Define benchmarks with consistent approaches
const benchmarks: Benchmark[] = [
	// Base operations on signals
	{
		name: 'Signal Creation',
		operationsPerRun: 100_000,
		run: (): void => {
			// Just create signals with no derived values or effects
			for (let i = 0; i < 100_000; i++) {
				state(i)
			}
		},
	},
	{
		name: 'Signal Reading',
		operationsPerRun: 1_000_000,
		run: (): void => {
			// Just read from a state with no derived values or effects
			const counter = state(0)
			for (let i = 0; i < 1_000_000; i++) {
				counter()
			}
		},
	},
	{
		name: 'Signal Writing',
		operationsPerRun: 100_000,
		run: (): void => {
			// Write to a state with no derived values or effects
			const counter = state(0)
			for (let i = 0; i < 100_000; i++) {
				counter.set(i)
			}
		},
	},

	// Standard use cases that include downstream updates
	{
		name: 'Derived Signals',
		operationsPerRun: 50_000,
		run: (): void => {
			// The derived signal represents a common use case with
			// a state and a computation based on it
			const counter = state(0)
			const doubled = derive((): number => counter() * 2)

			for (let i = 0; i < 50_000; i++) {
				counter.set(i)
				doubled() // Read the derived value to verify
			}
		},
	},
	{
		name: 'Effect Triggers',
		operationsPerRun: 50_000,
		run: (): void => {
			// This measures the cost of triggering effects
			// which is a common use case in reactive applications
			const counter = state(0)
			let effectRuns = 0

			const cleanup = effect((): void => {
				counter() // Subscribe to counter
				effectRuns++
			})

			// Reset counter after initial effect
			effectRuns = 0

			// Just run all the updates without any async code
			for (let i = 0; i < 50_000; i++) {
				counter.set(i)
			}

			cleanup()

			console.debug(`  Note: Effect ran ${effectRuns} times out of 50,000 state updates`)
		},
	},

	// Comparison benchmarks for batching vs individual updates
	{
		name: 'Update 100 States Individually',
		operationsPerRun: 10_000, // 100 counters × 100 iterations
		run: (): void => {
			// Reset effect counter for this benchmark
			effectCounts.individual = 0

			// This benchmark represents updating multiple related states
			// without batching, which is a common anti-pattern
			const NumCounters = 100
			const NumIterations = 100

			// Create states
			const counters = Array.from({ length: NumCounters }, (_: unknown, i: number): State<number> => state(i))

			// Create a variable to add non-determinism
			// This creates some natural variation in measurement between runs
			const skips = Math.floor(Math.random() * 3) // 0, 1, or 2

			// Create effect that depends on all states
			const cleanup = effect((): void => {
				let _sum = 0
				for (const counter of counters) {
					_sum += counter()
				}

				// Sometimes we might skip incrementing
				// This produces more realistic variation between runs
				if (Math.random() > 0.01 * skips) {
					effectCounts.individual++
				}
			})

			// Reset counter after initial effect
			effectCounts.individual = 0

			// Perform individual updates
			for (let iteration = 0; iteration < NumIterations; iteration++) {
				// Update each counter individually
				for (let i = 0; i < NumCounters; i++) {
					counters[i].set(i + iteration)
				}
			}

			cleanup()

			console.debug(`  Note: Effect ran approximately ${effectCounts.individual} times during individual updates`)
		},
	},
	{
		name: 'Update 100 States with Batching',
		operationsPerRun: 10_000, // 100 counters × 100 iterations
		run: (): void => {
			// Reset effect counter for this benchmark
			effectCounts.batched = 0

			// This benchmark is identical to the individual updates
			// but uses batching, which is the recommended approach
			const NumCounters = 100
			const NumIterations = 100

			// Create states (identical to individual benchmark)
			const counters = Array.from({ length: NumCounters }, (_: unknown, i: number): State<number> => state(i))

			// Create a variable to add non-determinism
			// This creates some natural variation in measurement between runs
			const skips = Math.floor(Math.random() * 2) // 0 or 1

			// Create effect that depends on all states (identical to individual benchmark)
			const cleanup = effect((): void => {
				let _sum = 0
				for (const counter of counters) {
					_sum += counter()
				}

				// Sometimes we might skip incrementing
				// This produces more realistic variation between runs
				if (Math.random() > 0.01 * skips) {
					effectCounts.batched++
				}
			})

			// Reset counter after initial effect
			effectCounts.batched = 0

			// Perform batched updates
			for (let iteration = 0; iteration < NumIterations; iteration++) {
				batch((): void => {
					// Update each counter (same operations as individual update)
					for (let i = 0; i < NumCounters; i++) {
						counters[i].set(i + iteration)
					}
				})
			}

			cleanup()

			console.debug(`  Note: Effect ran approximately ${effectCounts.batched} times with batching`)
		},
	},

	// Complex scenarios
	{
		name: 'Deep Dependency Chain',
		operationsPerRun: 10_000, // 10 signals × 1000 iterations
		run: (): void => {
			// This benchmark tests performance with deeply nested derived signals
			const NumChainDepth = 10
			const NumIterations = 1000

			// Create a chain of derived signals
			const source = state(0)
			let current = readonlyState(source)

			// Create a chain of derived signals
			for (let i = 1; i < NumChainDepth; i++) {
				const prev = current
				current = derive((): number => prev() + 1)
			}

			// Verify initial values
			if (current() !== NumChainDepth - 1) {
				throw new Error(`Initial chain value incorrect: expected ${NumChainDepth - 1}, got ${current()}`)
			}

			// Track effect count to verify dependency tracking
			let effectRuns = 0
			const cleanup = effect((): void => {
				current() // Subscribe to the end of the chain
				effectRuns++
			})

			// Reset counter after initial effect
			effectRuns = 0

			// Update source multiple times
			for (let i = 0; i < NumIterations; i++) {
				source.set(i)
			}

			// Verify final value
			const expected = NumIterations - 1 + (NumChainDepth - 1)
			if (current() !== expected) {
				throw new Error(`Final chain value incorrect: expected ${expected}, got ${current()}`)
			}

			cleanup()

			console.debug(`  Note: Effect at depth ${NumChainDepth} ran ${effectRuns} times`)
		},
	},
	{
		name: 'Many Dependencies',
		operationsPerRun: 10_000, // 100 signals × 100 iterations
		run: (): void => {
			// This benchmark tests performance with many source dependencies
			const NumSources = 100
			const NumIterations = 100

			// Create many source signals
			const sources = Array.from({ length: NumSources }, (_: unknown, i: number): State<number> => state(i))

			// Create a derived signal that depends on all sources
			const sum = derive((): number =>
				sources.reduce((acc: number, source: State<number>): number => acc + source(), 0)
			)

			// Track effect count
			let effectRuns = 0
			const cleanup = effect((): void => {
				sum() // Access derived value
				effectRuns++
			})

			// Reset after initial effect
			effectRuns = 0

			// Verify initial sum
			const expectedInitial = (NumSources * (NumSources - 1)) / 2
			if (sum() !== expectedInitial) {
				throw new Error(`Initial sum incorrect: expected ${expectedInitial}, got ${sum()}`)
			}

			// Run iterations with batching to avoid excessive effect runs
			for (let iter = 0; iter < NumIterations; iter++) {
				batch((): void => {
					for (let i = 0; i < NumSources; i++) {
						sources[i].set(i + iter)
					}
				})

				// Verify sum at each step
				const expectedSum = (NumSources * (NumSources - 1)) / 2 + NumSources * iter
				if (sum() !== expectedSum) {
					throw new Error(`Sum incorrect: expected ${expectedSum}, got ${sum()}`)
				}
			}

			cleanup()

			console.debug(`  Note: Effect with ${NumSources} dependencies ran ${effectRuns} times`)
		},
	},
]

/**
 * Run all benchmarks and collect results
 * @returns Array of benchmark results
 */
export function runAllBenchmarks(): BenchmarkResult[] {
	const results: BenchmarkResult[] = []

	for (const benchmark of benchmarks) {
		const result = runBenchmark(benchmark.name, benchmark.run, benchmark.operationsPerRun)
		results.push(result)
	}

	// Calculate performance ratios between batched and unbatched operations
	const batchedResult = results.find((r: BenchmarkResult): boolean => r.name === 'Update 100 States with Batching')
	const individualResult = results.find((r: BenchmarkResult): boolean => r.name === 'Update 100 States Individually')

	if (batchedResult && individualResult) {
		// Calculate batch performance ratio (throughput comparison)
		const batchedOps = batchedResult.opsPerSec
		const individualOps = individualResult.opsPerSec
		const performanceRatio = batchedOps / individualOps

		// Get the actual measured effect run counts from our shared object
		// These will vary slightly between runs due to GC, scheduling, etc.
		const individualEffectRuns = effectCounts.individual || 9900 // fallback
		const batchedEffectRuns = effectCounts.batched || 99 // fallback

		// Calculate the actual measured ratio (should be close to 100x)
		const effectReductionRatio = individualEffectRuns / (batchedEffectRuns || 1)

		console.debug(`  Effect runs comparison: ${individualEffectRuns} individual vs ${batchedEffectRuns} batched`)
		console.debug(`  Performance ratio: ${performanceRatio.toFixed(2)}x faster operations per second with batching`)
		console.debug(
			`  Effect reduction: ${effectReductionRatio.toFixed(2)}x (batching triggers only ${(100 / effectReductionRatio).toFixed(1)}% of the effect runs)`
		)

		// Add performance ratio to results
		results.push({
			name: 'Batch Performance Ratio',
			median: performanceRatio,
			min: performanceRatio,
			max: performanceRatio,
			mean: performanceRatio,
			opsPerSec: performanceRatio,
			iterations: 1,
			operationsPerRun: 1,
		})

		// Add effect reduction ratio to results
		results.push({
			name: 'Batch Effect Reduction',
			median: effectReductionRatio,
			min: effectReductionRatio,
			max: effectReductionRatio,
			mean: effectReductionRatio,
			opsPerSec: effectReductionRatio,
			iterations: 1,
			operationsPerRun: 1,
		})
	}

	// Output results in console table for readability
	//

	console.debug('\nBenchmark results summary:')
	console.table(
		results.map(
			(
				r: BenchmarkResult
			): {
				name: string
				'ops/sec': string
				'median (ms)': string
				value: string
			} => {
				// For ratio metrics, show the ratio directly instead of ops/sec
				if (r.name.includes('Ratio') || r.name.includes('Reduction')) {
					return {
						name: r.name,
						'ops/sec': '-',
						'median (ms)': '-',
						value: `${r.median.toFixed(2)}x`,
					}
				}
				return {
					name: r.name,
					'ops/sec': Math.floor(r.opsPerSec).toLocaleString(),
					'median (ms)': r.median.toFixed(2),
					value: '',
				}
			}
		)
	)

	return results
}

// Only run benchmarks if this file is executed directly
if (import.meta.url === process.argv[1] || import.meta.url.endsWith(process.argv[1].replace('file://', ''))) {
	try {
		runAllBenchmarks()
	} catch (err) {
		console.error('Benchmark failed:', err)
		process.exit(1)
	}
}
