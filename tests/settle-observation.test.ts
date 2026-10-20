import assert from 'node:assert/strict'
import { getEventListeners } from 'node:events'
import { describe, it, type TestContext } from 'node:test'
import { batch, derive, effect, onIdle, state, until } from '../src/index.ts'

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

	it('until stops evaluating on a write made before its resolution microtask', async (): Promise<void> => {
		const $s = state({
			n: 0,
		})
		let evaluations = 0
		const p = until((): number => {
			evaluations++
			return $s.n
		})
		$s.n = 1
		$s.n = 2
		assert.equal(await p, 1)
		assert.equal(evaluations, 2)
	})

	it('onIdle fires once per batched flush and stops after unsubscribe', async (): Promise<void> => {
		const s = state({
			a: 0,
			b: 0,
		})
		const stopReader = effect((): void => {
			void s.a
			void s.b
		})
		let calls = 0
		const stop = onIdle((): void => {
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

	it('onIdle fires while an async derived value is pending and again after it settles', async (): Promise<void> => {
		const $s = state({
			n: 0,
		})
		let current = deferred<number>()
		const derived = derive((): Promise<number> => {
			void $s.n
			return current.promise
		})
		current.resolve(0)
		await tick()
		let idle = 0
		const stop = onIdle((): void => {
			idle++
		})
		current = deferred<number>()
		batch((): void => {
			$s.n = 1
		})
		assert.equal(derived.pending, true)
		assert.equal(idle, 1)
		current.resolve(1)
		await tick()
		assert.equal(derived.pending, false)
		assert.equal(idle, 2)
		stop()
		derived.reactive = false
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

	it('until resolves when the signal aborts after the predicate turned truthy', async (): Promise<void> => {
		const controller = new AbortController()
		const $s = state({
			ready: false,
		})
		const p = until((): boolean => $s.ready, {
			signal: controller.signal,
		})
		$s.ready = true
		controller.abort(new Error('too late'))
		assert.equal(await p, true)
	})

	it('until rejects with the abort reason when the predicate aborts the signal on its first evaluation', async (): Promise<void> => {
		const controller = new AbortController()
		const $s = state({
			n: 0,
		})
		let evaluations = 0
		const p = until(
			(): boolean => {
				evaluations++
				controller.abort(new Error('gave up'))
				return $s.n > 0
			},
			{
				signal: controller.signal,
			}
		)
		await assert.rejects(p, /gave up/)
		$s.n = 1
		assert.equal(evaluations, 1)
	})

	it('until disposes its effect after the signal aborts', async (): Promise<void> => {
		const controller = new AbortController()
		const $s = state({
			n: 0,
		})
		const p = until((): boolean => $s.n > 0, {
			signal: controller.signal,
		})
		controller.abort(new Error('changed mind'))
		await assert.rejects(p, /changed mind/)
		let idle = 0
		const stopIdle = onIdle((): void => {
			idle++
		})
		$s.n = 1
		await tick()
		assert.equal(idle, 0)
		stopIdle()
	})

	it('until disposes its effect after it times out', async (): Promise<void> => {
		const $s = state({
			n: 0,
		})
		await assert.rejects(
			until((): boolean => $s.n > 0, {
				timeout: 20,
			}),
			/timed out/
		)
		let idle = 0
		const stopIdle = onIdle((): void => {
			idle++
		})
		$s.n = 1
		await tick()
		assert.equal(idle, 0)
		stopIdle()
	})

	it('until disposes its effect after it resolves', async (): Promise<void> => {
		const $s = state({
			n: 0,
		})
		const p = until((): boolean => $s.n > 0)
		$s.n = 1
		assert.equal(await p, true)
		let idle = 0
		const stopIdle = onIdle((): void => {
			idle++
		})
		$s.n = 2
		await tick()
		assert.equal(idle, 0)
		stopIdle()
	})

	it('onIdle keeps notifying other callbacks when one throws', async (): Promise<void> => {
		const s = state({
			n: 0,
		})
		const stopReader = effect((): void => {
			void s.n
		})
		let calls = 0
		const stopThrower = onIdle((): void => {
			throw new Error('cb boom')
		})
		const stop = onIdle((): void => {
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
		let idle = 0
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
		const stopIdle = onIdle((): void => {
			idle++
		})
		assert.throws((): void => {
			$s.n = 1
		}, /boom/)
		assert.equal(staleRuns, 1)
		idle = 0
		$s.k = 1
		assert.equal(idle, 1)
		$s.m = 1
		assert.equal(staleRuns, 1)
		assert.equal(idle, 2)
		stopFailing()
		stopStale()
		stopK()
		stopM1()
		stopM2()
		stopIdle()
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

	it('runs effects for a callback write and notifies again after them', (): void => {
		const $s = state({
			a: 0,
			b: 0,
		})
		const seen: string[] = []
		const stopReader = effect((): void => {
			seen.push(`${$s.a},${$s.b}`)
		})
		let idle = 0
		const stop = onIdle((): void => {
			idle++
			if ($s.a === 1 && $s.b === 0) $s.b = 99
		})
		$s.a = 1
		assert.deepEqual(seen, ['0,0', '1,0', '1,99'])
		assert.equal(idle, 2)
		stop()
		stopReader()
	})

	it('runs effects for a callback write after a batch', (): void => {
		const $s = state({
			a: 0,
			b: 0,
		})
		const seen: string[] = []
		const stopReader = effect((): void => {
			seen.push(`${$s.a},${$s.b}`)
		})
		let idle = 0
		const stop = onIdle((): void => {
			idle++
			if ($s.a === 1 && $s.b === 0) $s.b = 99
		})
		batch((): void => {
			$s.a = 1
		})
		assert.deepEqual(seen, ['0,0', '1,0', '1,99'])
		assert.equal(idle, 2)
		stop()
		stopReader()
	})

	it('runs effects for a callback write in a microtask flush', async (): Promise<void> => {
		const $trigger = state({
			go: 0,
		})
		const $s = state({
			a: 0,
			b: 0,
		})
		const stopWriter = effect(
			(): void => {
				$s.a = $trigger.go
			},
			undefined,
			undefined,
			{
				schedule: 'microtask',
			}
		)
		const seen: string[] = []
		const stopReader = effect((): void => {
			seen.push(`${$s.a},${$s.b}`)
		})
		let idle = 0
		const stop = onIdle((): void => {
			idle++
			if ($s.a === 1 && $s.b === 0) $s.b = 99
		})
		$trigger.go = 1
		await tick()
		assert.deepEqual(seen, ['0,0', '1,0', '1,99'])
		assert.equal(idle, 2)
		stop()
		stopReader()
		stopWriter()
	})

	it('runs effects for a callback write after the callbacks when an async settle has no readers', async (): Promise<void> => {
		const $s = state({
			b: 0,
		})
		const current = deferred<number>()
		const computed = derive((): Promise<number> => current.promise)
		const log: string[] = []
		const stopReader = effect((): void => {
			log.push(`effect b=${$s.b}`)
		})
		let idle = 0
		const stop = onIdle((): void => {
			const call = ++idle
			log.push(`enter ${call}`)
			if (call === 1) $s.b = 99
			log.push(`exit ${call}`)
		})
		current.resolve(5)
		await tick()
		assert.deepEqual(log, ['effect b=0', 'enter 1', 'exit 1', 'effect b=99', 'enter 2', 'exit 2'])
		stop()
		stopReader()
		computed.reactive = false
	})

	it('runs effects for a batch inside a callback once the callbacks return', (): void => {
		const $s = state({
			a: 0,
			b: 0,
		})
		const log: string[] = []
		const stopReader = effect((): void => {
			log.push(`effect ${$s.a},${$s.b}`)
		})
		let idle = 0
		const stop = onIdle((): void => {
			idle++
			if ($s.b !== 0) return
			batch((): void => {
				$s.b = 99
			})
			log.push('batch returned')
		})
		$s.a = 1
		assert.deepEqual(log, ['effect 0,0', 'effect 1,0', 'batch returned', 'effect 1,99'])
		assert.equal(idle, 2)
		stop()
		stopReader()
	})

	it('until resolves on a write made inside an onIdle callback', async (): Promise<void> => {
		const $s = state({
			a: 0,
			b: 0,
		})
		const stopReader = effect((): void => {
			void $s.a
		})
		const stop = onIdle((): void => {
			if ($s.a === 1) $s.b = 99
		})
		const p = until((): boolean => $s.b === 99, {
			timeout: 200,
		})
		$s.a = 1
		assert.equal(await p, true)
		stop()
		stopReader()
	})

	it('throws when onIdle callbacks keep scheduling effects', (): void => {
		const $s = state({
			a: 0,
			n: 0,
		})
		let runs = 0
		const stopReader = effect((): void => {
			void $s.a
			void $s.n
			runs++
		})
		let idle = 0
		const stop = onIdle((): void => {
			idle++
			$s.n++
		})
		assert.throws((): void => {
			$s.a = 1
		}, /Infinite loop detected: onIdle callbacks kept scheduling effects/)
		assert.equal(idle, 100)
		assert.equal(runs, 101)
		stop()
		$s.a = 2
		assert.equal(runs, 102)
		stopReader()
	})

	it('reports a runaway onIdle callback in a microtask flush', async (t: TestContext): Promise<void> => {
		const logged = t.mock.method(console, 'error', (): void => {})
		const $trigger = state({
			go: 0,
		})
		const $s = state({
			a: 0,
			n: 0,
		})
		const stopWriter = effect(
			(): void => {
				$s.a = $trigger.go
			},
			undefined,
			undefined,
			{
				schedule: 'microtask',
			}
		)
		const stopReader = effect((): void => {
			void $s.a
			void $s.n
		})
		let idle = 0
		const stop = onIdle((): void => {
			idle++
			$s.n++
		})
		$trigger.go = 1
		await tick()
		assert.equal(idle, 100)
		assert.equal(logged.mock.callCount(), 1)
		assert.match(String(logged.mock.calls[0]?.arguments[0]), /Infinite loop detected: onIdle/)
		stop()
		stopReader()
		stopWriter()
	})
})
