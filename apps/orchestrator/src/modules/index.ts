// Module barrel: each feature module's `index.ts` is re-exported here so that
// `import '@/modules'` from `main.tsx` runs every `defineFeature(...)` call at
// boot, populating the platform feature registry before the router is built.
//
// Reason: this is the one sanctioned barrel in the app — the registry depends
// on import side-effects and has no other discovery mechanism. See
// `openspec/specs/feature-registry/spec.md`.
export { tasksFeature } from './tasks'
