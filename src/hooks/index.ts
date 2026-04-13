/**
 * Hook types and composition utility for Beacon's instrumentation system.
 *
 * @module
 */
export type {
	BatchHooks,
	DeriveHooks,
	EffectHooks,
	HookFunction,
	SingleOrArray,
	StateHooks,
} from '../types.ts'
export { composeHook } from './compose.ts'
