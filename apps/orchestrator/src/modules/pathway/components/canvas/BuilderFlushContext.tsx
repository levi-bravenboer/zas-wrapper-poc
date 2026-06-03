import type { ReactElement, ReactNode } from 'react'

import {
  BuilderFlushContext as Context,
  type BuilderFlushContextValue,
} from './builderFlushContextValue'

type ProviderProps = BuilderFlushContextValue & { children: ReactNode }

/**
 * Exposes the parent pathway's autosave handle to deep descendants in the
 * canvas tree (e.g. `NestedPathwayBlockNode`'s "Open child" CTA). The hook
 * (`useBuilderFlush`) and the bare context value live in sibling files so
 * this file only exports a component — keeps `react-refresh` HMR happy.
 */
export function BuilderFlushProvider({ flush, saveState, children }: ProviderProps): ReactElement {
  return <Context.Provider value={{ flush, saveState }}>{children}</Context.Provider>
}
