// Reason: spec mandates `platform/smart/` as the public surface for reading
// launch context. The implementation lives in `modules/smart-launch/`; this
// file is the platform-facing re-export consumers should import from.
export { useLaunchContext } from '@/modules/smart-launch/hooks'
export type { LaunchContext, SmartCtx } from '@/modules/smart-launch/store'
