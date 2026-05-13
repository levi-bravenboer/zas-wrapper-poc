import { type ReactNode } from 'react'

import {
  FhirDepsContext,
  OrchestratorDepsContext,
  type FhirDeps,
  type OrchestratorDeps,
} from './depsContext'

export function OrchestratorDepsProvider({
  deps,
  children,
}: {
  deps: OrchestratorDeps
  children: ReactNode
}): ReactNode {
  return (
    <OrchestratorDepsContext.Provider value={deps}>{children}</OrchestratorDepsContext.Provider>
  )
}

export function FhirDepsProvider({
  deps,
  children,
}: {
  deps: FhirDeps
  children: ReactNode
}): ReactNode {
  return <FhirDepsContext.Provider value={deps}>{children}</FhirDepsContext.Provider>
}
