import { createFileRoute } from '@tanstack/react-router'
import { type ReactElement } from 'react'

import { BuilderShellStateRenderer } from '@/modules/pathway/components/BuilderShellStateRenderer'
import {
  useEdgeOffsetDirections,
  useEdgeTimingKinds,
  usePathwayBlocks,
  usePathwayPhaseTemplates,
} from '@/modules/pathway/hooks'
import { useResolvedVersion } from '@/modules/pathway/hooks/useResolvedVersion'

export const Route = createFileRoute('/_auth/pathways/$pathwayId/')({
  component: PathwayBuilderPage,
  staticData: { breadcrumb: 'Builder' },
})

function PathwayBuilderPage(): ReactElement {
  const { pathwayId } = Route.useParams()
  const resolved = useResolvedVersion(pathwayId, undefined)
  const blocks = usePathwayBlocks()
  const templates = usePathwayPhaseTemplates()
  const timingKinds = useEdgeTimingKinds()
  const offsetDirections = useEdgeOffsetDirections()

  if (
    resolved.status === 'loading' ||
    blocks.isLoading ||
    templates.isLoading ||
    timingKinds.isLoading ||
    offsetDirections.isLoading
  ) {
    return <BuilderShellStateRenderer state="loading" />
  }

  if (resolved.status === 'not-found') {
    return <BuilderShellStateRenderer state="not-found" />
  }

  if (resolved.status === 'error') {
    return (
      <BuilderShellStateRenderer state="error" error={resolved.error} onRetry={resolved.refetch} />
    )
  }

  if (!blocks.data || !templates.data || !timingKinds.data || !offsetDirections.data) {
    return <BuilderShellStateRenderer state="loading" />
  }

  return (
    <BuilderShellStateRenderer
      state="ready"
      pathway={resolved.pathway}
      version={resolved.version}
      isReadOnly={resolved.isReadOnly}
      readOnlyVariant={resolved.readOnlyVariant}
      catalogue={blocks.data}
      phaseTemplates={templates.data}
      timingKinds={timingKinds.data}
      offsetDirections={offsetDirections.data}
    />
  )
}
