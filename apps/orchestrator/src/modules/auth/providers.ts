import { type ComponentType } from 'react'

import { PasswordStrategy } from './components/PasswordStrategy'
import type { ProviderDescriptor, ProviderKind } from './schemas'

export interface ProviderStrategyProps {
  provider: ProviderDescriptor
}

export type ProviderStrategy = ComponentType<ProviderStrategyProps>

export const strategies: Partial<Record<ProviderKind, ProviderStrategy>> = {
  password: PasswordStrategy,
}
