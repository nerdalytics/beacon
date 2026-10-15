import assert from 'node:assert/strict'
import { getEventListeners } from 'node:events'
import { describe, it, type TestContext } from 'node:test'
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
	return {
		promise,
		resolve,
	}
}

async function tick(): Promise<void> {
	await Promise.resolve()
	await Promise.resolve()
	await Promise.resolve()
}

function activeTimers(): number {
	return process.getActiveResourcesInfo().filter((resource: string): boolean => resource === 'Timeout').length
}

describe('Settle Observation', {
	concurrency: false,
	timeout: 2000,
}, (): void => {
	it('until resolves after the watched state flips', async (): Promise<void> => {
		const s = state({
			ready: false,
		})
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
		const s = state({
			n: 5,
		})
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
		const s = state({
			ready: false,
		})
		await assert.rejects(
			until((): boolean => s.ready, {
				timeout: 20,
			}),
			/timed out/
		)
	})

	it('until rejects immediately for a pre-aborted signal', async (): Promise<void> => {
		const controller = new AbortController()
		controller.abort(new Error('stopped'))
		const s = state({
			ready: true,
		})
		await assert.rejects(
			until((): boolean => s.ready, {
				signal: controller.signal,
			}),
			/stopped/
		)
	})

	it('until throws when called inside an effect', (): void => {
		const s = state({
			n: 1,
		})
		assert.throws((): void => {
			effect((): void => {
				void s.n
				until((): boolean => s.n > 0)
			})
		}, /reactive scope/)
	})

	it('until stops evaluating after it settles', async (): Promise<void> => {
		const s = state({
			n: 0,
		})
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
		const s = state({
			a: 0,
			b: 0,
		})
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

	it('until rejects when the signal aborts mid-wait', async (): Promise<void> => {
		const controller = new AbortController()
		const s = state({
			ready: false,
		})
		const p = until((): boolean => s.ready, {
			signal: controller.signal,
		})
		controller.abort(new Error('changed mind'))
		await assert.rejects(p, /changed mind/)
	})

	it('onSettled keeps notifying other callbacks when one throws', async (): Promise<void> => {
		const s = state({
			n: 0,
		})
		const stopReader = effect((): void => {
			void s.n
		})
		let calls = 0
		const stopThrower = onSettled((): void => {
			throw new Error('cb boom')
		})
		const stop = onSettled((): void => {
			calls++
		})
		s.n = 1
		await tick()
		assert.equal(calls, 1)
		stopThrower()
		stop()
		stopReader()
	})

	it('until gates on pending derives read after settled ones', async (): Promise<void> => {
		const s = state({
			n: 1,
		})
		const settledCurrent = deferred<number>()
		let pendingCurrent = deferred<number>()
		const settledDerived = derive((): Promise<number> => {
			void s.n
			return settledCurrent.promise
		})
		const pendingDerived = derive((): Promise<number> => {
			void s.n
			return pendingCurrent.promise
		})
		settledCurrent.resolve(5)
		pendingCurrent.resolve(7)
		await tick()
		pendingCurrent = deferred<number>()
		s.n = 2
		let resolved = false
		const p = until((): boolean => (settledDerived.value ?? 0) > 0 && (pendingDerived.value ?? 0) > 0)
		void p.then((): void => {
			resolved = true
		})
		await tick()
		assert.equal(resolved, false)
		pendingCurrent.resolve(7)
		const value = await p
		assert.equal(value, true)
		settledDerived.reactive = false
		pendingDerived.reactive = false
	})

	it('drains the flush queue after a throwing multi-effect flush', (): void => {
		const $s = state({
			k: 0,
			m: 0,
			n: 0,
		})
		let staleRuns = 0
		let settled = 0
		const stopFailing = effect((): void => {
			if ($s.n > 0) throw new Error('boom')
		})
		const stopStale = effect((): void => {
			void $s.n
			staleRuns++
		})
		const stopK = effect((): void => {
			void $s.k
		})
		const stopM1 = effect((): void => {
			void $s.m
		})
		const stopM2 = effect((): void => {
			void $s.m
		})
		const stopSettled = onSettled((): void => {
			settled++
		})
		assert.throws((): void => {
			$s.n = 1
		}, /boom/)
		assert.equal(staleRuns, 1)
		settled = 0
		$s.k = 1
		assert.equal(settled, 1)
		$s.m = 1
		assert.equal(staleRuns, 1)
		assert.equal(settled, 2)
		stopFailing()
		stopStale()
		stopK()
		stopM1()
		stopM2()
		stopSettled()
	})
	it('until rejects with the error a re-run predicate throws and clears its timer', async (): Promise<void> => {
		const $s = state({
			n: 0,
		})
		const timersBefore = activeTimers()
		let evaluations = 0
		let outcome = 'pending'
		void until(
			(): boolean => {
				evaluations++
				if ($s.n === 1) throw new Error('boom')
				return $s.n === 2
			},
			{
				timeout: 1500,
			}
		).then(
			(): void => {
				outcome = 'resolved'
			},
			(err: Error): void => {
				outcome = err.message
			}
		)
		assert.equal(activeTimers(), timersBefore + 1)
		assert.doesNotThrow((): void => {
			$s.n = 1
		})
		await tick()
		assert.equal(outcome, 'boom')
		assert.equal(activeTimers(), timersBefore)
		$s.n = 2
		assert.equal(evaluations, 2)
	})

	it('until rejects with the error a first-run predicate throws and releases its listener and timer', async (): Promise<void> => {
		const $s = state({
			n: 0,
		})
		const controller = new AbortController()
		const timersBefore = activeTimers()
		let evaluations = 0
		const p = until(
			(): boolean => {
				evaluations++
				if ($s.n === 0) throw new Error('boom')
				return true
			},
			{
				signal: controller.signal,
				timeout: 1500,
			}
		)
		await assert.rejects(p, /boom/)
		assert.equal(getEventListeners(controller.signal, 'abort').length, 0)
		assert.equal(activeTimers(), timersBefore)
		$s.n = 1
		assert.equal(evaluations, 1)
	})

	it('until rejects with the error a predicate throws in a microtask flush', async (t: TestContext): Promise<void> => {
		const logged = t.mock.method(console, 'error', (): void => {})
		const $s = state({
			n: 0,
		})
		const $trigger = state({
			go: 0,
		})
		const stopWriter = effect(
			(): void => {
				$s.n = $trigger.go
			},
			undefined,
			undefined,
			{
				schedule: 'microtask',
			}
		)
		let outcome = 'pending'
		void until((): boolean => {
			if ($s.n === 1) throw new Error('boom')
			return $s.n === 2
		}).then(
			(): void => {
				outcome = 'resolved'
			},
			(err: Error): void => {
				outcome = err.message
			}
		)
		$trigger.go = 1
		await tick()
		await tick()
		assert.equal(outcome, 'boom')
		assert.equal(logged.mock.callCount(), 0)
		stopWriter()
	})
})
