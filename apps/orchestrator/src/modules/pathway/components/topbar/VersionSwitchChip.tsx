import { useNavigate } from '@tanstack/react-router'
import { Check, ChevronDown } from 'lucide-react'
import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import { usePathwayVersions } from '../../hooks'
import type { PathwayVersionDefinition, PathwayVersionSummary } from '../../types'

type Props = {
  pathwayId: string
  currentVersion: PathwayVersionDefinition
  onOpenHistory: () => void
}

function statusDotColor(status: 'concept' | 'published' | 'archived'): string {
  if (status === 'concept') return '#d97706'
  if (status === 'published') return '#16a34a'
  return '#3a7d8d'
}

export function VersionSwitchChip({
  pathwayId,
  currentVersion,
  onOpenHistory,
}: Props): ReactElement {
  const { t } = useTranslation('pathway')
  const navigate = useNavigate()
  const versions = usePathwayVersions(pathwayId)

  const rows = versions.data ?? []
  const concept = rows.find((v) => v.status === 'concept') ?? null
  const published = rows.filter((v) => v.status === 'published')
  const latestPublished = published[0] ?? null
  const bareTargetId = concept?.id ?? latestPublished?.id ?? null

  function navigateToVersion(target: PathwayVersionSummary) {
    if (target.id === bareTargetId) {
      void navigate({ to: '/pathways/$pathwayId', params: { pathwayId } })
      return
    }
    void navigate({
      to: '/pathways/$pathwayId/v/$versionId',
      params: { pathwayId, versionId: target.id },
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-medium"
          aria-label={t('version.switch.triggerLabel')}
          data-testid="version-switch-chip"
        >
          <span
            aria-hidden="true"
            className="inline-block size-2 rounded-full"
            style={{ background: statusDotColor(currentVersion.status) }}
          />
          {t('version.label', { n: currentVersion.version_no })}
          <ChevronDown className="size-3.5" strokeWidth={1.8} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[240px]">
        <DropdownMenuLabel>{t('version.switch.groupConcept')}</DropdownMenuLabel>
        {concept ? (
          <VersionRow
            row={concept}
            isCurrent={concept.id === currentVersion.id}
            onSelect={() => navigateToVersion(concept)}
          />
        ) : (
          <div className="px-2 py-1.5 text-[12px] text-muted-foreground">
            {t('version.switch.emptyConcept')}
          </div>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t('version.switch.groupPublished')}</DropdownMenuLabel>
        {published.length === 0 ? (
          <div className="px-2 py-1.5 text-[12px] text-muted-foreground">
            {t('version.switch.emptyPublished')}
          </div>
        ) : (
          published.map((row) => (
            <VersionRow
              key={row.id}
              row={row}
              isCurrent={row.id === currentVersion.id}
              onSelect={() => navigateToVersion(row)}
            />
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault()
            onOpenHistory()
          }}
        >
          {t('version.switch.footer')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function VersionRow({
  row,
  isCurrent,
  onSelect,
}: {
  row: PathwayVersionSummary
  isCurrent: boolean
  onSelect: () => void
}): ReactElement {
  const { t } = useTranslation('pathway')
  return (
    <DropdownMenuItem onSelect={onSelect} className="justify-between">
      <span className="inline-flex items-center gap-2">
        <span
          aria-hidden="true"
          className="inline-block size-2 rounded-full"
          style={{ background: statusDotColor(row.status) }}
        />
        <span>{t('version.label', { n: row.version_no })}</span>
        {row.label && <span className="text-muted-foreground">· {row.label}</span>}
      </span>
      {isCurrent && <Check className="size-3.5" strokeWidth={1.8} aria-hidden="true" />}
    </DropdownMenuItem>
  )
}
