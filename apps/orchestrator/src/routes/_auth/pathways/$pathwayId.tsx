import { createFileRoute } from '@tanstack/react-router'
import { type ReactElement } from 'react'

import { BuilderShellStateRenderer } from '@/modules/pathway/components/BuilderShellStateRenderer'
import { usePathway, usePathwayBlocks, usePathwayPhaseTemplates } from '@/modules/pathway/hooks'

export const Route = createFileRoute('/_auth/pathways/$pathwayId')({
  component: PathwayBuilderPage,
  staticData: { breadcrumb: 'Builder' },
})

function PathwayBuilderPage(): ReactElement {
  const { pathwayId } = Route.useParams()
  const pathway = usePathway(pathwayId)
  const blocks = usePathwayBlocks()
  const templates = usePathwayPhaseTemplates()

  if (pathway.isLoading || blocks.isLoading || templates.isLoading) {
    return <BuilderShellStateRenderer state="loading" />
  }

  if (pathway.isError) {
    const status =
      pathway.error && typeof pathway.error === 'object' && 'status' in pathway.error
        ? (pathway.error as { status?: number }).status
        : undefined
    if (status === 404) return <BuilderShellStateRenderer state="not-found" />
    return (
      <BuilderShellStateRenderer
        state="error"
        error={pathway.error instanceof Error ? pathway.error : new Error('Unknown error')}
        onRetry={() => {
          void pathway.refetch()
        }}
      />
    )
  }

  if (!pathway.data || !blocks.data || !templates.data) {
    return <BuilderShellStateRenderer state="loading" />
  }

  return (
    <BuilderShellStateRenderer
      state="ready"
      pathway={pathway.data.pathway}
      version={pathway.data.version}
      catalogue={blocks.data}
      phaseTemplates={templates.data}
    />
  )
}
