import { Fragment, useMemo, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import type { PathwayBlockType } from '../../types'

import { DockItem } from './DockItem'
import { groupCatalogueBySource } from './groupCatalogue'

type Props = {
  catalogue: PathwayBlockType[]
  onAddBlock: (blockType: PathwayBlockType) => void
  onDragStartType?: (blockType: PathwayBlockType) => void
  onDragEndType?: () => void
}

export function BuilderDock({
  catalogue,
  onAddBlock,
  onDragStartType,
  onDragEndType,
}: Props): ReactElement {
  const { t } = useTranslation('pathway')
  const groups = useMemo(() => groupCatalogueBySource(catalogue), [catalogue])
  return (
    <div
      role="toolbar"
      aria-label={t('dock.toolbarLabel')}
      className="pointer-events-auto absolute bottom-5 left-1/2 z-10 inline-flex h-[60px] -translate-x-1/2 items-center gap-2 rounded-lg border bg-white/70 px-3.5 shadow-lg backdrop-blur-md"
      style={{ borderColor: 'var(--hairline)' }}
    >
      {groups.map((group, index) => {
        const groupKey = group.source === 'native' ? 'native' : `external-${group.provider}`
        const groupLabel =
          group.source === 'native'
            ? t('dock.groupNative')
            : t(`dock.groupProvider.${group.provider}`, { defaultValue: group.provider })
        return (
          <Fragment key={groupKey}>
            {index > 0 && (
              <span
                aria-hidden="true"
                className="mx-1 inline-block h-6 w-px"
                style={{ background: 'var(--hairline)' }}
              />
            )}
            <div
              role="group"
              aria-label={groupLabel}
              className="inline-flex items-center gap-2"
            >
              {group.items.map((blockType) => (
                <DockItem
                  key={blockType.type}
                  blockType={blockType}
                  onAdd={() => onAddBlock(blockType)}
                  onDragStartType={onDragStartType}
                  onDragEndType={onDragEndType}
                />
              ))}
            </div>
          </Fragment>
        )
      })}
    </div>
  )
}
