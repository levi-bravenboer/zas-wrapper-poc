import { Link } from '@tanstack/react-router'
import { Redo2, Undo2, Workflow } from 'lucide-react'
import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { formatTime } from '@/lib/utils/datetime'

import type { PathwayBare, PathwayVersionDefinition } from '../../types'

import { CrumbVersionMarker } from './CrumbVersionMarker'
import { EditableTitle } from './EditableTitle'
import { PublishButton } from './PublishButton'
import { SaveStatusPill, type SaveState } from './SaveStatusPill'
import { VersionSwitchChip } from './VersionSwitchChip'

type Props = {
  pathway: PathwayBare
  version: PathwayVersionDefinition
  isReadOnly: boolean
  blockCount: number
  phaseCount: number
  saveState: SaveState
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onPublish: () => void
  onOpenHistory: () => void
  onRename: (name: string) => void
}

export function BuilderTopbar({
  pathway,
  version,
  isReadOnly,
  blockCount,
  phaseCount,
  saveState,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onPublish,
  onOpenHistory,
  onRename,
}: Props): ReactElement {
  const { t } = useTranslation('pathway')
  const time = formatTime(pathway.updated_at)
  const isHistorical = isReadOnly && version.status === 'published'

  return (
    <header
      data-slot="builder-topbar"
      className="relative flex h-16 items-center gap-3.5 border-b px-4 pl-3.5 backdrop-blur-md"
      style={{
        background:
          'linear-gradient(180deg, transparent 0%, rgba(207,237,232,0.18) 100%), rgba(255,255,255,0.55)',
        borderBottomColor: 'var(--hairline)',
      }}
    >
      <Link
        to="/pathways"
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border text-primary"
        style={{
          background:
            'linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 16%, white), color-mix(in srgb, var(--color-accent-mint) 22%, white))',
          borderColor: 'color-mix(in srgb, var(--color-primary) 22%, transparent)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)',
        }}
        aria-label={t('crumbRoot')}
      >
        <Workflow className="size-4" strokeWidth={1.8} />
      </Link>

      <div className="flex min-w-0 flex-col gap-[1px]">
        <div className="inline-flex items-center gap-2">
          <Link
            to="/pathways"
            className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground"
          >
            {t('crumbRoot')}
          </Link>
          <CrumbVersionMarker version={version} isHistorical={isHistorical} />
        </div>
        <div className="inline-flex items-center gap-2">
          <EditableTitle value={pathway.name} onCommit={onRename} />
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {blockCount} {t('blocks').toLowerCase()} · <span>{phaseCount} </span>
            {t('phases').toLowerCase()} · {t('editedAt', { time })}
          </span>
        </div>
      </div>

      <VersionSwitchChip
        pathwayId={pathway.id}
        currentVersion={version}
        onOpenHistory={onOpenHistory}
      />

      <SaveStatusPill state={saveState} />

      <div className="flex-1" />

      <div className="mx-1 h-[22px] w-px" style={{ background: 'var(--hairline)' }} />

      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={!canUndo}
        onClick={onUndo}
        aria-label={t('topbar.undo')}
      >
        <Undo2 className="size-4" strokeWidth={1.8} />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={!canRedo}
        onClick={onRedo}
        aria-label={t('topbar.redo')}
      >
        <Redo2 className="size-4" strokeWidth={1.8} />
      </Button>

      <PublishButton disabled={isReadOnly || saveState !== 'clean'} onClick={onPublish} />
    </header>
  )
}
