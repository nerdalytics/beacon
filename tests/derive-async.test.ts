import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { derive, effect, onIdle, state, until } from '../src/index.ts'

interface Deferred<T> {
	promise: Promise<T>
	reject: (reason?: unknown) => void
	resolve: (value: T) => void
}

function deferred<T>(): Deferred<T> {
	let reject: (reason?: unknown) => void = (): void => {}
	let resolve: (value: T) => void = (): void => {}
	const promise = new Promise<T>((res, rej): void => {
		resolve = res
		reject = rej
	})
	return {
		promise,
		reject,
		resolve,
	}
}

async function tick(): Promise<void> {
	await Promise.resolve()
	await Promise.resolve()
	await Promise.resolve()
}

describe('Derive Async', {
	concurrency: false,
	timeout: 2000,
}, (): void => {
	it('settles value after the compute promise resolves', async (): Promise<void> => {
		const s = state({
			n: 1,
		})
		const d = deferred<number>()
		const computed = derive((): Promise<number> => {
			const n = s.n
			return d.promise.then((x): number => x + n)
		})
		assert.equal(computed.pending, true)
		assert.equal(computed.value, undefined)
		d.resolve(1)
		await tick()
		assert.equal(computed.value, 2)
		assert.equal(computed.pending, false)
		computed.reactive = false
	})

	it('recomputes on dependency change and keeps the last value while pending', async (): Promise<void> => {
		const s = state({
			n: 1,
		})
		let current = deferred<number>()
		const computed = derive((): Promise<number> => {
			const n = s.n
			return current.promise.then((x): number => x + n)
		})
		current.resolve(1)
		await tick()
		assert.equal(computed.value, 2)
		assert.equal(computed.pending, false)
		current = deferred<number>()
		s.n = 5
		assert.equal(computed.pending, true)
		assert.equal(computed.value, 2)
		current.resolve(1)
		await tick()
		assert.equal(computed.value, 6)
		assert.equal(computed.pending, false)
		computed.reactive = false
	})

	it('exposes pending as a trackable dependency', async (): Promise<void> => {
		const s = state({
			n: 1,
		})
		let current = deferred<number>()
		const computed = derive((): Promise<number> => {
			void s.n
			return current.promise
		})
		const seen: boolean[] = []
		const stop = effect((): void => {
			seen.push(computed.pending)
		})
		current.resolve(7)
		await tick()
		current = deferred<number>()
		s.n = 2
		current.resolve(8)
		await tick()
		assert.deepEqual(seen, [true, false, true, false])
		stop()
		computed.reactive = false
	})

	it('discards superseded settlements (latest wins)', async (): Promise<void> => {
		const s = state({
			n: 1,
		})
		let current = deferred<string>()
		const computed = derive((): Promise<string> => {
			void s.n
			return current.promise
		})
		const stale = current
		current = deferred<string>()
		s.n = 2
		const superseded = current
		current = deferred<string>()
		s.n = 3
		assert.equal(computed.pending, true)
		assert.equal(computed.value, undefined)
		current.resolve('B')
		await tick()
		assert.equal(computed.value, 'B')
		assert.equal(computed.pending, false)
		stale.resolve('A')
		superseded.resolve('A2')
		await tick()
		assert.equal(computed.value, 'B')
		computed.reactive = false
	})

	it('routes rejections to onError and keeps the last value', async (): Promise<void> => {
		const errors: Error[] = []
		const s = state({
			n: 1,
		})
		let current = deferred<string>()
		let unhandled = false
		const onUnhandled = (): void => {
			unhandled = true
		}
		process.on('unhandledRejection', onUnhandled)
		const computed = derive(
			(): Promise<string> => {
				void s.n
				return current.promise
			},
			{
				onError: (e: Error): void => {
					errors.push(e)
				},
			}
		)
		current.resolve('ok')
		await tick()
		current = deferred<string>()
		s.n = 2
		current.reject(new Error('boom'))
		await tick()
		await tick()
		assert.equal(errors.length, 1)
		assert.equal(errors[0]?.message, 'boom')
		assert.equal(computed.value, 'ok')
		assert.equal(computed.pending, false)
		assert.equal(unhandled, false)
		process.off('unhandledRejection', onUnhandled)
		computed.reactive = false
	})

	it('discards settlements that arrive after dispose', async (): Promise<void> => {
		const s = state({
			n: 1,
		})
		let current = deferred<number>()
		const computed = derive((): Promise<number> => {
			void s.n
			return current.promise
		})
		current = deferred<number>()
		s.n = 2
		computed.reactive = false
		assert.equal(computed.pending, false)
		current.resolve(9)
		await tick()
		assert.equal(computed.pending, false)
		assert.equal(computed.value, undefined)
	})

	it('keeps synchronous derive eager and not pending', (): void => {
		const s = state({
			n: 2,
		})
		const computed = derive((): number => s.n * 2)
		assert.equal(computed.value, 4)
		assert.equal(computed.pending, false)
		computed.reactive = false
	})

	it('discards rejections from superseded computations', async (): Promise<void> => {
		const errors: Error[] = []
		const s = state({
			n: 1,
		})
		let current = deferred<number>()
		const computed = derive(
			(): Promise<number> => {
				void s.n
				return current.promise
			},
			{
				onError: (e: Error): void => {
					errors.push(e)
				},
			}
		)
		const stale = current
		current = deferred<number>()
		s.n = 2
		stale.reject(new Error('stale boom'))
		await tick()
		await tick()
		assert.equal(errors.length, 0)
		current.resolve(3)
		await tick()
		assert.equal(computed.value, 3)
		computed.reactive = false
	})

	it('lets a synchronous recompute supersede an in-flight computation', async (): Promise<void> => {
		const s = state({
			mode: 'slow',
		})
		const slow = deferred<string>()
		const computed = derive((): string | Promise<string> => (s.mode === 'slow' ? slow.promise : 'fast-sync'))
		const pendingSeen: boolean[] = []
		const valueSeen: unknown[] = []
		const stopPending = effect((): void => {
			pendingSeen.push(computed.pending)
		})
		const stopValue = effect((): void => {
			valueSeen.push(computed.value)
		})
		s.mode = 'fast'
		assert.equal(computed.pending, false)
		assert.equal(computed.value, 'fast-sync')
		assert.deepEqual(pendingSeen, [true, false])
		slow.resolve('stale-async')
		await tick()
		assert.equal(computed.pending, false)
		assert.equal(computed.value, 'fast-sync')
		assert.deepEqual(pendingSeen, [true, false])
		assert.deepEqual(valueSeen, [undefined, 'fast-sync'])
		stopPending()
		stopValue()
		computed.reactive = false
	})

	it('discards a rejection superseded by a synchronous recompute', async (): Promise<void> => {
		const errors: Error[] = []
		const s = state({
			mode: 'slow',
		})
		const slow = deferred<string>()
		const computed = derive((): string | Promise<string> => (s.mode === 'slow' ? slow.promise : 'fast-sync'), {
			onError: (e: Error): void => {
				errors.push(e)
			},
		})
		s.mode = 'fast'
		slow.reject(new Error('stale boom'))
		await tick()
		await tick()
		assert.equal(errors.length, 0)
		assert.equal(computed.value, 'fast-sync')
		assert.equal(computed.pending, false)
		computed.reactive = false
	})

	it('resolves until() on a synchronous result that supersedes an in-flight computation', async (): Promise<void> => {
		const s = state({
			mode: 'slow',
		})
		const slow = deferred<string>()
		const computed = derive((): string | Promise<string> => (s.mode === 'slow' ? slow.promise : 'fast-sync'))
		const waiting = until((): boolean => computed.value === 'fast-sync', {
			timeout: 200,
		})
		s.mode = 'fast'
		assert.equal(await waiting, true)
		slow.resolve('stale-async')
		await tick()
		assert.equal(computed.value, 'fast-sync')
		computed.reactive = false
	})

	it('shows a re-enabled result equal to a settlement discarded after dispose', async (): Promise<void> => {
		const s = state({
			mode: 'slow',
		})
		const slow = deferred<string>()
		const computed = derive((): string | Promise<string> => (s.mode === 'slow' ? slow.promise : 'late'))
		computed.reactive = false
		s.mode = 'fast'
		slow.resolve('late')
		await tick()
		assert.equal(computed.value, undefined)
		computed.reactive = true
		assert.equal(computed.value, 'late')
		assert.equal(computed.pending, false)
		computed.reactive = false
	})

	it('does not notify onIdle for a settlement that arrives after dispose', async (): Promise<void> => {
		const slow = deferred<number>()
		const computed = derive((): Promise<number> => slow.promise)
		computed.reactive = false
		await tick()
		let idle = 0
		const off = onIdle((): void => {
			idle++
		})
		slow.resolve(1)
		await tick()
		off()
		assert.equal(idle, 0)
	})
})
