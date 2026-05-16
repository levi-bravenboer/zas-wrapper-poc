import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import type { PathwayBlockType } from '../../types'

import { DockItem } from './DockItem'

type Props = {
  catalogue: PathwayBlockType[]
  onAddBlock: (blockType: PathwayBlockType) => void
}

export function BuilderDock({ catalogue, onAddBlock }: Props): ReactElement {
  const { t } = useTranslation('pathway')
  return (
    <div
      role="toolbar"
      aria-label={t('dock.toolbarLabel')}
      className="pointer-events-auto absolute bottom-5 left-1/2 z-10 inline-flex h-[60px] -translate-x-1/2 items-center gap-2 rounded-lg border bg-white/70 px-3.5 shadow-lg backdrop-blur-md"
      style={{ borderColor: 'var(--hairline)' }}
    >
      {catalogue.map((blockType) => (
        <DockItem key={blockType.type} blockType={blockType} onAdd={() => onAddBlock(blockType)} />
      ))}
    </div>
  )
}
