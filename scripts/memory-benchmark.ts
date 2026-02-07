import { batch, derive, effect, lens, state } from '../src/index.ts'

declare const gc: (() => void) | undefined

interface MemoryMetrics {
	heapUsedBefore: number
	heapUsedAfter: number
	heapDelta: number
	externalBefore: number
	externalAfter: number
	arrayBuffersBefore: number
	arrayBuffersAfter: number
}

interface BenchmarkResult {
	name: string
	operationsPerRun: number
	metrics: MemoryMetrics
	bytesPerOperation: number
}

const forceGC = (): void => {
	if (typeof gc === 'function') {
		gc()
	} else {
		console.warn('GC not exposed. Run with --expose-gc for accurate memory measurements.')
	}
}

const getHeapSnapshot = (): NodeJS.MemoryUsage => {
	forceGC()
	return process.memoryUsage()
}

const measureMemory = (name: string, operationsPerRun: number, fn: () => void): BenchmarkResult => {
	forceGC()
	const before = getHeapSnapshot()

	fn()

	forceGC()
	const after = getHeapSnapshot()

	const metrics: MemoryMetrics = {
		arrayBuffersAfter: after.arrayBuffers,
		arrayBuffersBefore: before.arrayBuffers,
		externalAfter: after.external,
		externalBefore: before.external,
		heapDelta: after.heapUsed - before.heapUsed,
		heapUsedAfter: after.heapUsed,
		heapUsedBefore: before.heapUsed,
	}

	return {
		bytesPerOperation: metrics.heapDelta / operationsPerRun,
		metrics,
		name,
		operationsPerRun,
	}
}

const formatBytes = (bytes: number): string => {
	if (Math.abs(bytes) < 1024) return `${bytes.toFixed(0)} B`
	if (Math.abs(bytes) < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
	return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

const runMemoryBenchmarks = (): BenchmarkResult[] => {
	const results: BenchmarkResult[] = []

	console.info('\n=== Memory Benchmark Suite ===\n')

	// 1. State creation memory overhead
	results.push(
		measureMemory('State Creation', 10_000, () => {
			const states: ReturnType<typeof state>[] = []
			for (let i = 0; i < 10_000; i++) {
				states.push(state(i))
			}
		})
	)

	// 2. Effect creation memory overhead
	results.push(
		measureMemory('Effect Creation', 1_000, () => {
			const cleanups: (() => void)[] = []
			const s = state(0)
			for (let i = 0; i < 1_000; i++) {
				cleanups.push(
					effect(() => {
						s()
					})
				)
			}
			// Clean up to measure retained vs temporary allocations
			for (const cleanup of cleanups) {
				cleanup()
			}
		})
	)

	// 3. Effect with active subscriptions (retained memory)
	results.push(
		measureMemory('Effect Retained Memory', 1_000, () => {
			const s = state(0)
			const cleanups: (() => void)[] = []
			for (let i = 0; i < 1_000; i++) {
				cleanups.push(
					effect(() => {
						s()
					})
				)
			}
			// Store cleanups to keep effects alive
			;(globalThis as Record<string, unknown>).__benchmarkCleanups = cleanups
		})
	)

	// 4. Derive creation memory overhead
	results.push(
		measureMemory('Derive Creation', 1_000, () => {
			const s = state(0)
			const derives: ReturnType<typeof derive>[] = []
			for (let i = 0; i < 1_000; i++) {
				derives.push(derive(() => s() * 2))
			}
		})
	)

	// 5. Memory after cleanup
	const cleanupBenchmark = (): BenchmarkResult => {
		forceGC()
		const beforeCreate = getHeapSnapshot()

		const s = state(0)
		const cleanups: (() => void)[] = []
		for (let i = 0; i < 1_000; i++) {
			cleanups.push(
				effect(() => {
					s()
				})
			)
		}

		forceGC()
		const afterCreate = getHeapSnapshot()

		// Clean up all effects
		for (const cleanup of cleanups) {
			cleanup()
		}

		forceGC()
		const afterCleanup = getHeapSnapshot()

		const retainedAfterCleanup = afterCleanup.heapUsed - beforeCreate.heapUsed
		const allocatedDuringRun = afterCreate.heapUsed - beforeCreate.heapUsed
		const freedByCleanup = afterCreate.heapUsed - afterCleanup.heapUsed

		console.info(`  Cleanup Analysis:`)
		console.info(`    Allocated during run: ${formatBytes(allocatedDuringRun)}`)
		console.info(`    Freed by cleanup: ${formatBytes(freedByCleanup)}`)
		console.info(`    Retained after cleanup: ${formatBytes(retainedAfterCleanup)}`)
		console.info(`    Cleanup efficiency: ${((freedByCleanup / allocatedDuringRun) * 100).toFixed(1)}%`)

		return {
			bytesPerOperation: retainedAfterCleanup / 1_000,
			metrics: {
				arrayBuffersAfter: afterCleanup.arrayBuffers,
				arrayBuffersBefore: beforeCreate.arrayBuffers,
				externalAfter: afterCleanup.external,
				externalBefore: beforeCreate.external,
				heapDelta: retainedAfterCleanup,
				heapUsedAfter: afterCleanup.heapUsed,
				heapUsedBefore: beforeCreate.heapUsed,
			},
			name: 'Memory After Cleanup',
			operationsPerRun: 1_000,
		}
	}
	results.push(cleanupBenchmark())

	// 6. Batch operation memory overhead
	results.push(
		measureMemory('Batch Operations', 100, () => {
			const states = Array.from(
				{
					length: 100,
				},
				(_, i) => state(i)
			)
			const cleanups: (() => void)[] = []

			// Create effects that depend on all states
			for (let i = 0; i < 10; i++) {
				cleanups.push(
					effect(() => {
						let sum = 0
						for (const s of states) {
							sum += s()
						}
						return sum
					})
				)
			}

			// Batch updates
			for (let iter = 0; iter < 100; iter++) {
				batch(() => {
					for (let i = 0; i < 100; i++) {
						states[i].set(i + iter)
					}
				})
			}

			for (const cleanup of cleanups) {
				cleanup()
			}
		})
	)

	// 7. WeakMap overhead measurement
	results.push(
		measureMemory('WeakMap Operations', 10_000, () => {
			const map = new WeakMap<object, number>()
			const objects: object[] = []

			for (let i = 0; i < 10_000; i++) {
				const obj = {}
				objects.push(obj)
				map.set(obj, i)
				map.get(obj)
			}
		})
	)

	// 8. Set operations overhead
	results.push(
		measureMemory('Set Operations', 10_000, () => {
			const sets: Set<number>[] = []
			for (let i = 0; i < 10_000; i++) {
				const set = new Set<number>()
				for (let j = 0; j < 10; j++) {
					set.add(j)
				}
				sets.push(set)
			}
		})
	)

	// ============================================
	// LENS MEMORY BENCHMARKS
	// ============================================

	// 9. Lens creation memory overhead
	results.push(
		measureMemory('Lens Creation', 1_000, () => {
			interface User {
				name: string
				age: number
			}
			const userState = state<User>({
				age: 30,
				name: 'John',
			})
			const lenses: ReturnType<typeof lens>[] = []

			for (let i = 0; i < 1_000; i++) {
				lenses.push(lens(userState, (u) => u.name))
			}
		})
	)

	// 10. Lens with retained effects (real-world usage pattern)
	results.push(
		measureMemory('Lens + Effect Retained', 500, () => {
			interface User {
				name: string
				age: number
				score: number
			}
			const userState = state<User>({
				age: 30,
				name: 'John',
				score: 100,
			})

			const lensesAndEffects: {
				cleanup: () => void
				lens: ReturnType<typeof lens>
			}[] = []

			for (let i = 0; i < 500; i++) {
				const nameLens = lens(userState, (u) => u.name)
				const cleanup = effect(() => {
					nameLens()
				})
				lensesAndEffects.push({
					cleanup,
					lens: nameLens,
				})
			}
			// Keep references alive
			;(globalThis as Record<string, unknown>).__lensEffects = lensesAndEffects
		})
	)

	// 11. Multiple lenses on same source
	results.push(
		measureMemory('Multiple Lenses per State', 100, () => {
			interface Config {
				a: number
				b: number
				c: number
				d: number
				e: number
				f: number
				g: number
				h: number
				i: number
				j: number
			}
			const configs: {
				lenses: ReturnType<typeof lens>[]
				state: ReturnType<typeof state<Config>>
			}[] = []

			for (let i = 0; i < 100; i++) {
				const configState = state<Config>({
					a: 0,
					b: 0,
					c: 0,
					d: 0,
					e: 0,
					f: 0,
					g: 0,
					h: 0,
					i: 0,
					j: 0,
				})
				const lenses = [
					lens(configState, (c) => c.a),
					lens(configState, (c) => c.b),
					lens(configState, (c) => c.c),
					lens(configState, (c) => c.d),
					lens(configState, (c) => c.e),
					lens(configState, (c) => c.f),
					lens(configState, (c) => c.g),
					lens(configState, (c) => c.h),
					lens(configState, (c) => c.i),
					lens(configState, (c) => c.j),
				]
				configs.push({
					lenses,
					state: configState,
				})
			}
		})
	)

	// 12. Deep nested lens memory
	results.push(
		measureMemory('Deep Nested Lens', 500, () => {
			interface DeepState {
				level1: {
					level2: {
						level3: {
							level4: {
								value: number
							}
						}
					}
				}
			}

			const deepLenses: ReturnType<typeof lens>[] = []

			for (let i = 0; i < 500; i++) {
				const deepState = state<DeepState>({
					level1: {
						level2: {
							level3: {
								level4: {
									value: i,
								},
							},
						},
					},
				})
				deepLenses.push(lens(deepState, (s) => s.level1.level2.level3.level4.value))
			}
		})
	)

	// 13. Lens vs State comparison (same functionality)
	const lensVsStateComparison = (): void => {
		console.info('\n  Lens vs State Memory Comparison:')

		// Measure state-only approach
		forceGC()
		const beforeState = getHeapSnapshot()

		interface User {
			name: string
			age: number
		}
		const stateOnlyUsers: ReturnType<typeof state<User>>[] = []
		for (let i = 0; i < 500; i++) {
			stateOnlyUsers.push(
				state<User>({
					age: i,
					name: `User${i}`,
				})
			)
		}

		forceGC()
		const afterState = getHeapSnapshot()
		const stateMemory = afterState.heapUsed - beforeState.heapUsed

		// Measure lens approach (single state + lenses)
		forceGC()
		const beforeLens = getHeapSnapshot()

		interface UsersContainer {
			users: User[]
		}
		const usersState = state<UsersContainer>({
			users: Array.from(
				{
					length: 500,
				},
				(_, i) => ({
					age: i,
					name: `User${i}`,
				})
			),
		})
		const _userLenses = Array.from(
			{
				length: 500,
			},
			(_, i) => lens(usersState, (s) => s.users[i])
		)

		forceGC()
		const afterLens = getHeapSnapshot()
		const lensMemory = afterLens.heapUsed - beforeLens.heapUsed

		console.info(`    500 separate states: ${formatBytes(stateMemory)} (${(stateMemory / 500).toFixed(2)} bytes/user)`)
		console.info(`    1 state + 500 lenses: ${formatBytes(lensMemory)} (${(lensMemory / 500).toFixed(2)} bytes/user)`)
		console.info(`    Lens overhead ratio: ${(lensMemory / stateMemory).toFixed(2)}x`)
	}
	lensVsStateComparison()

	// Print summary table
	console.info('\n=== Memory Benchmark Results ===\n')
	console.table(
		results.map((r) => ({
			'bytes/op': r.bytesPerOperation.toFixed(2),
			'heap delta': formatBytes(r.metrics.heapDelta),
			name: r.name,
			operations: r.operationsPerRun.toLocaleString(),
		}))
	)

	return results
}

// GC pressure test
const measureGCPressure = (): void => {
	console.info('\n=== GC Pressure Test ===\n')

	const NumIterations = 1000
	const NumStatesPerIteration = 100

	forceGC()
	const startHeap = process.memoryUsage().heapUsed

	let gcCount = 0
	let lastHeap = startHeap

	for (let iter = 0; iter < NumIterations; iter++) {
		// Create and destroy states rapidly
		const states = Array.from(
			{
				length: NumStatesPerIteration,
			},
			(_, i) => state(i)
		)
		const cleanups: (() => void)[] = []

		for (const s of states) {
			cleanups.push(
				effect(() => {
					s()
				})
			)
		}

		// Trigger updates
		for (const s of states) {
			s.set(Math.random())
		}

		// Cleanup
		for (const cleanup of cleanups) {
			cleanup()
		}

		// Check for GC events (heap drops significantly)
		const currentHeap = process.memoryUsage().heapUsed
		if (currentHeap < lastHeap * 0.8) {
			gcCount++
		}
		lastHeap = currentHeap

		if (iter % 100 === 0) {
			console.info(`  Iteration ${iter}: Heap = ${formatBytes(currentHeap)}`)
		}
	}

	forceGC()
	const endHeap = process.memoryUsage().heapUsed

	console.info(`\n  Total iterations: ${NumIterations}`)
	console.info(`  States created: ${(NumIterations * NumStatesPerIteration).toLocaleString()}`)
	console.info(`  Effects created: ${(NumIterations * NumStatesPerIteration).toLocaleString()}`)
	console.info(`  Detected GC events: ${gcCount}`)
	console.info(`  Final heap delta: ${formatBytes(endHeap - startHeap)}`)
}

// Main execution
if (typeof gc !== 'function') {
	console.info('Warning: Running without --expose-gc flag.')
	console.info('For accurate memory measurements, run with:')
	console.info('  node --expose-gc scripts/memory-benchmark.ts\n')
}

runMemoryBenchmarks()
measureGCPressure()
