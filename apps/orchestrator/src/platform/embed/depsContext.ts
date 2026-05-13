import type Client from 'fhirclient/lib/Client'
import { createContext } from 'react'

import type { SmartCtx } from '@/modules/smart-launch/store'

export type OrchestratorDeps = { readonly api: unknown }
export type FhirDeps = { readonly client: Client; readonly ctx: SmartCtx }

export const OrchestratorDepsContext = createContext<OrchestratorDeps | null>(null)
export const FhirDepsContext = createContext<FhirDeps | null>(null)
