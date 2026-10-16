import assert from 'node:assert/strict'
import { describe, it, type TestContext } from 'node:test'
import { batch, effect, onSettled, state } from '../src/index.ts'

const microtick = (): Promise<void> => new Promise((resolve): void => queueMicrotask(resolve))

async function turn(): Promise<void> {
	await microtick()
	await microtick()
}

const macrotask = (): Promise<void> => new Promise((resolve): void => void setTimeout(resolve, 0))

// Bounds a runaway effect so a missing guard fails the test instead of hanging it
const RUN_CAP = 1000

describe('Effect Scheduling', {
	concurrency: false,
	timeout: 2000,
}, (): void => {
	it('sync schedule (default) runs before the write returns', (): void => {
		const s = state({
			n: 1,
		})
		let runs = 0
		const stop = effect((): void => {
			void s.n
			runs++
		})
		assert.equal(runs, 1)
		s.n = 2
		assert.equal(runs, 2)
		stop()
	})

	it('microtask schedule defers past the write', async (): Promise<void> => {
		const s = state({
			n: 1,
		})
		let runs = 0
		const stop = effect(
			(): void => {
				void s.n
				runs++
			},
			undefined,
			undefined,
			{
				schedule: 'microtask',
			}
		)
		assert.equal(runs, 1)
		s.n = 2
		assert.equal(runs, 1)
		await turn()
		assert.equal(runs, 2)
		stop()
	})

	it('coalesces same-turn writes into one run observing final values', async (): Promise<void> => {
		const s = state({
			a: 1,
			b: 1,
		})
		let runs = 0
		let seen = 0
		const stop = effect(
			(): void => {
				seen = s.a + s.b
				runs++
			},
			undefined,
			undefined,
			{
				schedule: 'microtask',
			}
		)
		assert.equal(runs, 1)
		s.a = 2
		s.b = 2
		await turn()
		assert.equal(runs, 2)
		assert.equal(seen, 4)
		stop()
	})

	it('batch boundary precedes the microtask run', async (): Promise<void> => {
		const s = state({
			n: 1,
		})
		let runs = 0
		const stop = effect(
			(): void => {
				void s.n
				runs++
			},
			undefined,
			undefined,
			{
				schedule: 'microtask',
			}
		)
		batch((): void => {
			s.n = 2
			s.n = 3
		})
		assert.equal(runs, 1)
		await microtick()
		assert.equal(runs, 2)
		await turn()
		stop()
	})

	it('sync infinite-loop guard unchanged', (): void => {
		const s = state({
			n: 1,
		})
		assert.throws((): void => {
			effect((): void => {
				s.n = s.n + 1
			})
		}, /Infinite loop/)
	})

	it('microtask effect writing its own dependency re-runs per turn without guard error', async (): Promise<void> => {
		const s = state({
			n: 1,
		})
		let runs = 0
		let first = true
		const stop = effect(
			(): void => {
				const n = s.n
				runs++
				if (!first && n < 3) s.n = n + 1
				first = false
			},
			undefined,
			undefined,
			{
				schedule: 'microtask',
			}
		)
		s.n = 2
		await turn()
		await turn()
		await turn()
		assert.equal(runs, 3)
		assert.equal(s.n, 3)
		stop()
	})

	it('drops a self-writing microtask effect after 100 chained flushes', async (t: TestContext): Promise<void> => {
		const logged = t.mock.method(console, 'error', (): void => {})
		const $s = state({
			n: 0,
		})
		let runs = 0
		const stop = effect(
			(): void => {
				runs++
				if (runs >= RUN_CAP) stop()
				else $s.n = $s.n + 1
			},
			'spin',
			undefined,
			{
				schedule: 'microtask',
			}
		)
		await macrotask()
		assert.equal(runs, 101)
		assert.equal(logged.mock.callCount(), 1)
		const [firstCall] = logged.mock.calls
		assert.ok(firstCall)
		assert.match((firstCall.arguments[0] as Error).message, /Infinite loop detected: microtask/)
		$s.n = 0
		await macrotask()
		assert.equal(runs, 201)
		assert.equal(logged.mock.callCount(), 2)
		stop()
	})

	it('drops a microtask cross-effect cycle after 100 chained flushes', async (t: TestContext): Promise<void> => {
		const logged = t.mock.method(console, 'error', (): void => {})
		const $s = state({
			x: 0,
			y: 0,
		})
		let runsA = 0
		let runsB = 0
		const stopA = effect(
			(): void => {
				runsA++
				if (runsA >= RUN_CAP) stopA()
				else $s.y = $s.x + 1
			},
			'A',
			undefined,
			{
				schedule: 'microtask',
			}
		)
		const stopB = effect(
			(): void => {
				runsB++
				if (runsB >= RUN_CAP) stopB()
				else $s.x = $s.y + 1
			},
			'B',
			undefined,
			{
				schedule: 'microtask',
			}
		)
		await macrotask()
		assert.equal(runsA, 51)
		assert.equal(runsB, 51)
		assert.equal(logged.mock.callCount(), 1)
		stopA()
		stopB()
	})

	it('drops a microtask effect woken by every onSettled write after 100 chained flushes', async (t: TestContext): Promise<void> => {
		const logged = t.mock.method(console, 'error', (): void => {})
		const $s = state({
			n: 0,
		})
		let runs = 0
		let settles = 0
		const stop = effect(
			(): void => {
				void $s.n
				runs++
				if (runs >= RUN_CAP) stop()
			},
			'reader',
			undefined,
			{
				schedule: 'microtask',
			}
		)
		const stopSettled = onSettled((): void => {
			settles++
			$s.n = $s.n + 1
		})
		$s.n = 1
		await macrotask()
		assert.equal(runs, 101)
		assert.equal(settles, 100)
		assert.equal(logged.mock.callCount(), 1)
		stopSettled()
		stop()
	})

	it('lets a converging microtask self-write settle without error', async (t: TestContext): Promise<void> => {
		const logged = t.mock.method(console, 'error', (): void => {})
		const $s = state({
			n: 500,
		})
		let runs = 0
		const stop = effect(
			(): void => {
				runs++
				if (runs >= RUN_CAP) stop()
				else if ($s.n > 100) $s.n = 100
			},
			'clamp',
			undefined,
			{
				schedule: 'microtask',
			}
		)
		await macrotask()
		assert.equal(runs, 2)
		$s.n = 700
		await macrotask()
		assert.equal(runs, 4)
		assert.equal($s.n, 100)
		assert.equal(logged.mock.callCount(), 0)
		stop()
	})

	it('onSchedule fires at notification time for microtask effects', async (): Promise<void> => {
		const s = state({
			n: 1,
		})
		let scheduled = 0
		let runs = 0
		const stop = effect(
			(): void => {
				void s.n
				runs++
			},
			'micro',
			{
				onSchedule: (): void => {
					scheduled++
				},
			},
			{
				schedule: 'microtask',
			}
		)
		s.n = 2
		assert.equal(scheduled, 1)
		assert.equal(runs, 1)
		stop()
		await turn()
	})

	it('routes a microtask effect error to onError and keeps flushing its siblings', async (): Promise<void> => {
		const $s = state({
			n: 0,
		})
		const errors: string[] = []
		const seen: number[] = []
		let settled = 0
		const stopSettled = onSettled((): void => {
			settled++
		})
		const stopFailing = effect(
			(): void => {
				if ($s.n > 0) throw new Error('boom')
			},
			'failing',
			{
				onError: (err: Error): void => {
					errors.push(err.message)
				},
			},
			{
				schedule: 'microtask',
			}
		)
		const stopSibling = effect(
			(): void => {
				seen.push($s.n)
			},
			'sibling',
			undefined,
			{
				schedule: 'microtask',
			}
		)
		$s.n = 1
		await turn()
		assert.deepEqual(errors, ['boom'])
		assert.deepEqual(seen, [0, 1])
		assert.equal(settled, 1)
		$s.n = 2
		await turn()
		assert.deepEqual(errors, ['boom'])
		assert.deepEqual(seen, [0, 1, 2])
		stopFailing()
		stopSibling()
		stopSettled()
	})

	it('reports a microtask effect error without onError to console.error', async (t: TestContext): Promise<void> => {
		const logged = t.mock.method(console, 'error', (): void => {})
		const $s = state({
			n: 0,
		})
		const stop = effect(
			(): void => {
				if ($s.n > 0) throw new Error('unhandled')
			},
			undefined,
			undefined,
			{
				schedule: 'microtask',
			}
		)
		$s.n = 1
		await turn()
		assert.equal(logged.mock.callCount(), 1)
		const [firstCall] = logged.mock.calls
		assert.ok(firstCall)
		assert.equal((firstCall.arguments[0] as Error).message, 'unhandled')
		stop()
	})
})
