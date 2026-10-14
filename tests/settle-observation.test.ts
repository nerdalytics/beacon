import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { batch, derive, effect, onSettled, state, until } from '../src/index.ts'

interface Deferred<T> {
	promise: Promise<T>
	resolve: (value: T) => void
}

function deferred<T>(): Deferred<T> {
	let resolve: (value: T) => void = (): void => {}
	const promise = new Promise<T>((res): void => {
		resolve = res
	})
	return { promise, resolve }
}

async function tick(): Promise<void> {
	await Promise.resolve()
	await Promise.resolve()
	await Promise.resolve()
}

describe('Settle Observation', { concurrency: false, timeout: 2000 }, (): void => {
	it('until resolves after the watched state flips', async (): Promise<void> => {
		const s = state({ ready: false })
		const p = until((): boolean => s.ready)
		let resolved = false
		void p.then((): void => {
			resolved = true
		})
		await tick()
		assert.equal(resolved, false)
		s.ready = true
		const value = await p
		assert.equal(value, true)
	})

	it('until waits for a pending async derive to settle', async (): Promise<void> => {
		const s = state({ n: 5 })
		let current = deferred<number>()
		const computed = derive((): Promise<number> => {
			void s.n
			return current.promise
		})
		current.resolve(5)
		await tick()
		assert.equal(computed.value, 5)
		current = deferred<number>()
		s.n = 6
		let resolved = false
		const p = until((): boolean => (computed.value ?? 0) > 0)
		void p.then((): void => {
			resolved = true
		})
		await tick()
		assert.equal(resolved, false)
		current.resolve(5)
		const value = await p
		assert.equal(value, true)
		computed.reactive = false
	})

	it('until rejects on timeout', async (): Promise<void> => {
		const s = state({ ready: false })
		await assert.rejects(until((): boolean => s.ready, { timeout: 20 }), /timed out/)
	})

	it('until rejects immediately for a pre-aborted signal', async (): Promise<void> => {
		const controller = new AbortController()
		controller.abort(new Error('stopped'))
		const s = state({ ready: true })
		await assert.rejects(until((): boolean => s.ready, { signal: controller.signal }), /stopped/)
	})

	it('until throws when called inside an effect', (): void => {
		const s = state({ n: 1 })
		assert.throws(
			(): void => {
				effect((): void => {
					void s.n
					until((): boolean => s.n > 0)
				})
			},
			/reactive scope/
		)
	})

	it('until stops evaluating after it settles', async (): Promise<void> => {
		const s = state({ n: 0 })
		let evaluations = 0
		const p = until((): boolean => {
			evaluations++
			return s.n > 0
		})
		s.n = 1
		await p
		await tick()
		const after = evaluations
		s.n = 2
		await tick()
		await tick()
		assert.equal(evaluations, after)
	})

	it('onSettled fires once per batched flush and stops after unsubscribe', async (): Promise<void> => {
		const s = state({ a: 0, b: 0 })
		const stopReader = effect((): void => {
			void s.a
			void s.b
		})
		let calls = 0
		const stop = onSettled((): void => {
			calls++
		})
		batch((): void => {
			s.a = 1
			s.b = 1
		})
		await tick()
		assert.equal(calls, 1)
		stop()
		s.a = 2
		await tick()
		assert.equal(calls, 1)
		stopReader()
	})
})
