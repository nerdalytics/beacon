import { performance } from 'node:perf_hooks'
import { state, effect, derive, batch } from '../src/index.ts'

const errors = state(0)
const processed = state(0)

const disposeErrors = effect((): void => {
	console.debug({ errors: errors() })
})

const disposeProcessed = effect((): void => {
	console.debug({ processed: processed() })
})

const incrementErrors = (): void => {
	errors.set(errors() + 1)
}

const incrementProcessed = (): void => {
	processed.set(processed() + 1)
}

const totals = derive((): number => errors() + processed())

const LOOP_LENGTH = 1000000
const ERROR_FREQUENCY = 1000

const signalEffectLoop = ({
	incrementErrors,
	incrementProcessed,
}: {
	incrementErrors: () => void
	incrementProcessed: () => void
}): { duration: number } => {
	const start = performance.now()
	errors.set(0)
	processed.set(0)
	for (let i = 0; i <= LOOP_LENGTH; i++) {
		if (i % ERROR_FREQUENCY === 0) {
			incrementErrors()
		} else {
			incrementProcessed()
		}
	}
	if (processed() + errors() !== totals()) {
		throw new Error(`Error: 'totals()' value differs from 'processed()' + 'errors()' count.`)
	}
	const end = performance.now()
	return { duration: end - start }
}

const batchEffectLoop = ({
	incrementErrors,
	incrementProcessed,
}: {
	incrementErrors: () => void
	incrementProcessed: () => void
}): { duration: number } => {
	const start = performance.now()
	errors.set(0)
	processed.set(0)
	batch((): void => {
		for (let i = 0; i <= LOOP_LENGTH; i++) {
			if (i % ERROR_FREQUENCY === 0) {
				incrementErrors()
				console.debug({ errors: errors() })
			} else {
				incrementProcessed()
				console.debug({ processed: processed() })
			}
		}
	})
	if (processed() + errors() !== totals()) {
		throw new Error(`Error: 'totals()' value differs from 'processed()' + 'errors()' count.`)
	}
	const end = performance.now()
	return { duration: end - start }
}

const classicLoop = (): { duration: number } => {
	const start = performance.now()
	let errors = 0
	let processed = 0
	let totals = 0
	for (let i = 0; i <= LOOP_LENGTH; i++) {
		if (i % ERROR_FREQUENCY === 0) {
			console.debug({ errors: errors++ })
		} else {
			console.debug({ processed: processed++ })
		}
		totals++
	}
	if (processed + errors !== totals) {
		throw new Error(`Error: 'totals()' value differs from 'processed()' + 'errors()' count.`)
	}
	const end = performance.now()
	return { duration: end - start }
}

const main = (): void => {
	const signalDuration = signalEffectLoop({
		incrementErrors,
		incrementProcessed,
	})
	const batchDuration = batchEffectLoop({
		incrementErrors,
		incrementProcessed,
	})

	const classicDuration = classicLoop()

	console.debug({
		signalDuration,
		batchDuration,
		classicDuration,
	})

	disposeErrors()
	disposeProcessed()
}

main()

// with fair logging
// {
//   signalDuration: { duration: 9004.620522 },
//   batchDuration: { duration: 8352.928566 },
//   classicDuration: { duration: 7950.195513999999 }
// }

// without any logging
// {
//   signalDuration: { duration: 362.539116 },
//   batchDuration: { duration: 18.77363600000001 },
//   classicDuration: { duration: 1.6882600000000139 }
// }
