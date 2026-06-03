import { useContext } from 'react'

import { BuilderFlushContext, type BuilderFlushContextValue } from './builderFlushContextValue'

export function useBuilderFlush(): BuilderFlushContextValue {
  return useContext(BuilderFlushContext)
}
