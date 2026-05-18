import { useNavigate } from '@tanstack/react-router'
import { Info } from 'lucide-react'
import { useState, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'

import { useForkPathwayFromPublish, usePathwayVersions } from '../../hooks'
import type { ReadOnlyVariant } from '../../hooks/useResolvedVersion'
import type { PathwayVersionDefinition } from '../../types'
import { ConceptExistsDialog } from '../version/ConceptExistsDialog'
import { RestoreVersionDialog } from '../version/RestoreVersionDialog'

type Props = {
  pathwayId: string
  version: PathwayVersionDefinition
  variant: ReadOnlyVariant
}

export function ReadOnlyBanner({ pathwayId, version, variant }: Props): ReactElement {
  const { t } = useTranslation('pathway')
  const navigate = useNavigate()
  const versions = usePathwayVersions(pathwayId)
  const fork = useForkPathwayFromPublish(pathwayId)
  const [restoreOpen, setRestoreOpen] = useState(false)
  const [conceptExistsOpen, setConceptExistsOpen] = useState(false)

  const conceptVersion = (versions.data ?? []).find((v) => v.status === 'concept') ?? null

  function onFork() {
    if (conceptVersion) {
      setConceptExistsOpen(true)
      return
    }
    fork.mutate(
      { versionId: version.id },
      {
        onSuccess: () => {
          void navigate({
            to: '/pathways/$pathwayId',
            params: { pathwayId },
          })
        },
        onError: () => toast.error(t('forkOnEdit.error')),
      },
    )
  }

  function onRestore() {
    if (conceptVersion) {
      setConceptExistsOpen(true)
      return
    }
    setRestoreOpen(true)
  }

  const isPublishedFallback = variant === 'published-fallback'
  const tint = isPublishedFallback
    ? { color: 'var(--color-success, #16a34a)', bg: 'rgba(22,163,74,0.08)' }
    : { color: 'var(--color-info, #3a7d8d)', bg: 'rgba(58,125,141,0.08)' }

  return (
    <>
      <div
        role="status"
        data-slot="readonly-banner"
        data-variant={variant}
        className="flex h-9 items-center gap-2 border-b px-4 text-[12.5px]"
        style={{
          background: tint.bg,
          borderBottomColor: 'var(--hairline)',
          color: tint.color,
        }}
      >
        <Info className="size-3.5 shrink-0" strokeWidth={1.8} />
        <span className="flex-1 truncate font-medium">
          {isPublishedFallback
            ? t('banner.publishedFallback.body')
            : t('banner.historical.body', { n: version.version_no })}
        </span>
        <div className="flex items-center gap-2">
          {!isPublishedFallback && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                void navigate({
                  to: '/pathways/$pathwayId',
                  params: { pathwayId },
                })
              }}
            >
              {t('banner.historical.backToCurrent')}
            </Button>
          )}
          <Button type="button" size="sm" onClick={isPublishedFallback ? onFork : onRestore}>
            {isPublishedFallback ? t('banner.publishedFallback.cta') : t('banner.historical.cta')}
          </Button>
        </div>
      </div>
      <RestoreVersionDialog
        open={restoreOpen}
        onOpenChange={setRestoreOpen}
        pathwayId={pathwayId}
        versionId={version.id}
        versionNo={version.version_no}
      />
      <ConceptExistsDialog
        open={conceptExistsOpen}
        onOpenChange={setConceptExistsOpen}
        pathwayId={pathwayId}
        conceptVersionNo={conceptVersion?.version_no ?? null}
      />
    </>
  )
}
