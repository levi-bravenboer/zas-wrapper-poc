import { useNavigate } from '@tanstack/react-router'
import { useState, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

import { usePathwayVersions } from '../../hooks'
import type { PathwayVersionSummary } from '../../types'
import { ConceptExistsDialog } from '../version/ConceptExistsDialog'
import { RestoreVersionDialog } from '../version/RestoreVersionDialog'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  pathwayId: string
}

function statusDot(status: 'concept' | 'published' | 'archived'): string {
  if (status === 'concept') return '#d97706'
  if (status === 'published') return '#16a34a'
  return '#3a7d8d'
}

export function GeschiedenisDrawer({ open, onOpenChange, pathwayId }: Props): ReactElement {
  const { t } = useTranslation('pathway')
  const navigate = useNavigate()
  const versions = usePathwayVersions(pathwayId)

  const [restoreTarget, setRestoreTarget] = useState<PathwayVersionSummary | null>(null)
  const [conceptExistsOpen, setConceptExistsOpen] = useState(false)

  const rows = versions.data ?? []
  const concept = rows.find((v) => v.status === 'concept') ?? null

  function handleView(row: PathwayVersionSummary) {
    onOpenChange(false)
    void navigate({
      to: '/pathways/$pathwayId/v/$versionId',
      params: { pathwayId, versionId: row.id },
    })
  }

  function handleRestore(row: PathwayVersionSummary) {
    if (concept) {
      setConceptExistsOpen(true)
      return
    }
    setRestoreTarget(row)
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-[420px] sm:max-w-[420px]">
          <SheetHeader>
            <SheetTitle>{t('history.drawer.title')}</SheetTitle>
            <SheetDescription className="sr-only">{t('history.drawer.title')}</SheetDescription>
          </SheetHeader>

          {versions.isError && (
            <p role="alert" className="px-4 py-2 text-sm text-destructive">
              {t('history.drawer.loadError')}
            </p>
          )}

          {!versions.isError && rows.length === 0 && (
            <p className="px-4 py-2 text-sm text-muted-foreground">{t('history.drawer.empty')}</p>
          )}

          <ul className="flex flex-col gap-0 overflow-y-auto px-2 py-2">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-surface-2"
              >
                <span
                  aria-hidden="true"
                  className="inline-block size-2 rounded-full"
                  style={{ background: statusDot(row.status) }}
                />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-medium">
                    {t('version.label', { n: row.version_no })}
                    {row.label && <span className="ml-1 text-muted-foreground">· {row.label}</span>}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {row.published_at ?? row.created_at}
                  </span>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => handleView(row)}>
                  {t('history.drawer.rowView')}
                </Button>
                {row.status !== 'concept' && (
                  <Button type="button" size="sm" onClick={() => handleRestore(row)}>
                    {t('history.drawer.rowRestore')}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </SheetContent>
      </Sheet>
      {restoreTarget && (
        <RestoreVersionDialog
          open={!!restoreTarget}
          onOpenChange={(next) => {
            if (!next) setRestoreTarget(null)
          }}
          pathwayId={pathwayId}
          versionId={restoreTarget.id}
          versionNo={restoreTarget.version_no}
          onAfterRestore={() => {
            onOpenChange(false)
            setRestoreTarget(null)
            void navigate({ to: '/pathways/$pathwayId', params: { pathwayId } })
          }}
        />
      )}
      <ConceptExistsDialog
        open={conceptExistsOpen}
        onOpenChange={setConceptExistsOpen}
        pathwayId={pathwayId}
        conceptVersionNo={concept?.version_no ?? null}
      />
    </>
  )
}
