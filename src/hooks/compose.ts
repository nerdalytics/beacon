import type { HookFunction, SingleOrArray } from '../types.ts'

/** Compose one or more hook functions into a single hook. Errors in individual hooks are silently caught. */
export function composeHook<Args extends unknown[]>(
	hook: SingleOrArray<HookFunction<Args>> | undefined
): HookFunction<Args> | undefined {
	if (hook == null) return undefined
	if (typeof hook === 'function') return hook
	if (hook.length === 0) return undefined
	if (hook.length === 1) return hook[0]
	const fns = hook
	return (...args: Args): void => invokeHookArray(fns, args)
}

function invokeHookArray<Args extends unknown[]>(fns: HookFunction<Args>[], args: Args): void {
	for (let i = 0; i < fns.length; i++) {
		try {
			fns[i]?.(...args)
		} catch {}
	}
}
