import { useContext } from 'react'

import {
  FhirDepsContext,
  OrchestratorDepsContext,
  type FhirDeps,
  type OrchestratorDeps,
} from './depsContext'

export function useOrchestratorDeps(): OrchestratorDeps {
  const value = useContext(OrchestratorDepsContext)
  if (value === null) {
    throw new Error('orchestrator deps missing — wrap in AppShell')
  }
  return value
}

export function useFhirDeps(): FhirDeps {
  const value = useContext(FhirDepsContext)
  if (value === null) {
    throw new Error('fhir deps missing — wrap in SmartShell or EmbedShell')
  }
  return value
}
