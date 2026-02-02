import { performance } from 'node:perf_hooks'
import { batch, type ComputedValue, derive, effect, state, type Unsubscribe } from '../src/index.ts'

const LOOP_LENGTH = 1000000
const ERROR_FREQUENCY = 1000

type BenchmarkResult = {
	duration: number
}
type BenchmarkFn = () => BenchmarkResult

const signalEffectLoopWithLogs: BenchmarkFn = (): BenchmarkResult => {
	const start: number = performance.now()

	const errors = state({
		count: 0,
	})

	const processed = state({
		count: 0,
	})

	const disposeErrors: Unsubscribe = effect((): void => {
		console.debug(errors.count)
	})

	const disposeProcessed: Unsubscribe = effect((): void => {
		console.debug(processed.count)
	})

	const totals: ComputedValue<number> = derive((): number => errors.count + processed.count)

	for (let i = 0; i <= LOOP_LENGTH; i++) {
		if (i % ERROR_FREQUENCY === 0) {
			errors.count++
		} else {
			processed.count++
		}
	}
	if (processed.count + errors.count !== totals.value) {
		throw new Error(`Error: 'totals.value' value differs from 'processed.count' + 'errors.count' count.`)
	}

	disposeErrors()
	disposeProcessed()
	const end = performance.now()

	return {
		duration: end - start,
	}
}

const signalEffectLoopWithoutLogs: BenchmarkFn = (): BenchmarkResult => {
	const start = performance.now()

	const errors = state({
		count: 0,
	})

	const processed = state({
		count: 0,
	})

	const totals: ComputedValue<number> = derive((): number => errors.count + processed.count)

	errors.count = 0
	processed.count = 0
	for (let i = 0; i <= LOOP_LENGTH; i++) {
		if (i % ERROR_FREQUENCY === 0) {
			errors.count++
		} else {
			processed.count++
		}
	}
	if (processed.count + errors.count !== totals.value) {
		throw new Error(`Error: 'totals.value' value differs from 'processed.count' + 'errors.count' count.`)
	}
	const end = performance.now()

	return {
		duration: end - start,
	}
}
const signalEffectWithoutLogs: BenchmarkFn = (): BenchmarkResult => {
	const start = performance.now()

	const errors = state({
		count: 0,
	})

	const processed = state({
		count: 0,
	})

	const totals: ComputedValue<number> = derive((): number => errors.count + processed.count)

	errors.count++
	processed.count++
	if (processed.count + errors.count !== totals.value) {
		throw new Error(`Error: 'totals.value' value differs from 'processed.count' + 'errors.count' count.`)
	}
	const end = performance.now()

	return {
		duration: end - start,
	}
}

const batchEffectLoopWithLogs: BenchmarkFn = (): BenchmarkResult => {
	const start = performance.now()

	const errors = state({
		count: 0,
	})
	const processed = state({
		count: 0,
	})

	const disposeErrors: Unsubscribe = effect((): void => {
		console.debug(errors.count)
	})

	const disposeProcessed: Unsubscribe = effect((): void => {
		console.debug(processed.count)
	})

	const totals: ComputedValue<number> = derive((): number => errors.count + processed.count)

	batch((): void => {
		for (let i = 0; i <= LOOP_LENGTH; i++) {
			if (i % ERROR_FREQUENCY === 0) {
				errors.count++
			} else {
				processed.count++
			}
		}
	})
	if (processed.count + errors.count !== totals.value) {
		throw new Error(`Error: 'totals.value' value differs from 'processed.count' + 'errors.count' count.`)
	}

	disposeErrors()
	disposeProcessed()

	const end = performance.now()
	return {
		duration: end - start,
	}
}

const batchEffectLoopWithoutLogs: BenchmarkFn = (): BenchmarkResult => {
	const start = performance.now()

	const errors = state({
		count: 0,
	})
	const processed = state({
		count: 0,
	})

	const totals: ComputedValue<number> = derive((): number => errors.count + processed.count)

	batch((): void => {
		for (let i = 0; i <= LOOP_LENGTH; i++) {
			if (i % ERROR_FREQUENCY === 0) {
				errors.count++
			} else {
				processed.count++
			}
		}
	})

	if (processed.count + errors.count !== totals.value) {
		throw new Error(`Error: 'totals.value' value differs from 'processed.count' + 'errors.count' count.`)
	}

	const end = performance.now()
	return {
		duration: end - start,
	}
}

const batchEffectWithoutLogs: BenchmarkFn = (): BenchmarkResult => {
	const start = performance.now()

	const errors = state({
		count: 0,
	})
	const processed = state({
		count: 0,
	})

	const totals: ComputedValue<number> = derive((): number => errors.count + processed.count)

	batch((): void => {
		errors.count++
		processed.count++
	})
	if (processed.count + errors.count !== totals.value) {
		throw new Error(`Error: 'totals.value' value differs from 'processed.count' + 'errors.count' count.`)
	}
	const end = performance.now()
	return {
		duration: end - start,
	}
}

const classicLoopWithLogs: BenchmarkFn = (): BenchmarkResult => {
	const start = performance.now()
	let errors = 0
	let processed = 0
	let totals = 0
	for (let i = 0; i <= LOOP_LENGTH; i++) {
		if (i % ERROR_FREQUENCY === 0) {
			errors++
			console.debug(errors)
		} else {
			processed++
			console.debug(processed)
		}
		totals++
	}
	if (processed + errors !== totals) {
		throw new Error(
			`Error: 'totals':${totals} value differs from 'processed':${processed} + 'errors':${errors} [${errors + processed}] count.`
		)
	}
	const end = performance.now()
	return {
		duration: end - start,
	}
}

const classicLoopWithoutLogs: BenchmarkFn = (): BenchmarkResult => {
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
	if (processed + errors !== totals) {
		throw new Error(
			`Error: 'totals':${totals} value differs from 'processed':${processed} + 'errors':${errors} [${errors + processed}] count.`
		)
	}
	const end = performance.now()
	return {
		duration: end - start,
	}
}
const classicWithoutLogs: BenchmarkFn = (): BenchmarkResult => {
	const start = performance.now()
	let errors = 0
	let processed = 0
	let totals = 0
	errors++
	processed++
	totals += 2
	if (processed + errors !== totals) {
		throw new Error(
			`Error: 'totals':${totals} value differs from 'processed':${processed} + 'errors':${errors} [${errors + processed}] count.`
		)
	}
	const end = performance.now()
	return {
		duration: end - start,
	}
}

const fairLoggingLoopBenchmark: () => void = (): void => {
	const batchLoopDuration: BenchmarkResult = batchEffectLoopWithLogs()
	console.info()
	const classicLoopDuration: BenchmarkResult = classicLoopWithLogs()
	console.info()
	const signalLoopDuration: BenchmarkResult = signalEffectLoopWithLogs()
	console.info()
	console.debug({
		loopWithFairLogging: {
			batchLoopDuration,
			classicLoopDuration,
			signalLoopDuration,
		},
	})
}

const fairLoggingBenchmark: () => void = (): void => {
	const batchDuration: BenchmarkResult = batchEffectWithoutLogs()
	console.info()
	const classicDuration: BenchmarkResult = classicWithoutLogs()
	console.info()
	const signalDuration: BenchmarkResult = signalEffectWithoutLogs()
	console.info()
	console.debug({
		singleWithFairLogging: {
			batchDuration,
			classicDuration,
			signalDuration,
		},
	})
}

const noLoggingLoopBenchmark: () => void = (): void => {
	const batchLoopDuration: BenchmarkResult = batchEffectLoopWithoutLogs()
	console.info()
	const classicLoopDuration: BenchmarkResult = classicLoopWithoutLogs()
	console.info()
	const signalLoopDuration: BenchmarkResult = signalEffectLoopWithoutLogs()
	console.info()
	console.debug({
		loopWithoutLogging: {
			batchLoopDuration,
			classicLoopDuration,
			signalLoopDuration,
		},
	})
}

const noLoggingBenchmark: () => void = (): void => {
	const batchDuration: BenchmarkResult = batchEffectWithoutLogs()
	console.info()
	const classicDuration: BenchmarkResult = classicWithoutLogs()
	console.info()
	const signalDuration: BenchmarkResult = signalEffectWithoutLogs()
	console.info()
	console.debug({
		singleWithoutLogging: {
			batchDuration,
			classicDuration,
			signalDuration,
		},
	})
}

fairLoggingLoopBenchmark()
fairLoggingBenchmark()
noLoggingLoopBenchmark()
noLoggingBenchmark()

// with fair logging
// v1000: {
// 	batchDuration: { duration: 8352.928566 },
// 	classicDuration: { duration: 7950.195513999999 },
// 	signalDuration: { duration: 9004.620522 }
// }
// v2000: {
//   batchDuration: { duration: 9036.54412 },
//   classicDuration: { duration: 7936.78097 },
//   signalDuration: { duration: 12124.495678 }
// }

// without any logging
// v1000: {
// 	batchDuration: { duration: 18.77363600000001 },
// 	classicDuration: { duration: 1.6882600000000139 },
// 	signalDuration: { duration: 362.539116 }
// }
// v2000: {
//   batchDuration: { duration: 73.65244600000005 },
//   classicDuration: { duration: 3.166104000000132 },
//   signalDuration: { duration: 1450.981608 }
// }
