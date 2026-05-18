import { ChevronDown, ChevronRight, GripVertical, MoreHorizontal } from 'lucide-react'
import { forwardRef, type CSSProperties, type HTMLAttributes, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/style/cn'

import type { OrganisationRead } from '../schemas'

export const TREE_INDENT_PX = 16

export interface TreeRowProps extends Omit<HTMLAttributes<HTMLLIElement>, 'onToggle'> {
  org: OrganisationRead
  depth: number
  hasChildren: boolean
  expanded: boolean
  onToggleExpand?: ((id: string) => void) | undefined
  onOpenDetail?: ((org: OrganisationRead) => void) | undefined
  onEdit?: ((org: OrganisationRead) => void) | undefined
  onCreateChild?: ((parent: OrganisationRead) => void) | undefined
  onArchive?: ((org: OrganisationRead) => void) | undefined
  dragHandle?: ReactElement | undefined
  isDragging?: boolean | undefined
  isDropTarget?: boolean | undefined
  actionsDisabled?: boolean | undefined
}

export const TreeRow = forwardRef<HTMLLIElement, TreeRowProps>(function TreeRow(
  {
    org,
    depth,
    hasChildren,
    expanded,
    onToggleExpand,
    onOpenDetail,
    onEdit,
    onCreateChild,
    onArchive,
    dragHandle,
    isDragging,
    isDropTarget,
    actionsDisabled,
    className,
    style,
    ...rest
  },
  ref,
) {
  const { t } = useTranslation('organisations-admin-ui')
  const ariaLevel = depth + 1
  const mergedStyle: CSSProperties = {
    paddingLeft: `${depth * TREE_INDENT_PX + 8}px`,
    ...style,
  }

  return (
    <li
      ref={ref}
      role="treeitem"
      aria-level={ariaLevel}
      aria-expanded={hasChildren ? expanded : undefined}
      className={cn(isDragging && 'opacity-50', className)}
      {...rest}
    >
      <div
        className={cn(
          'flex items-center gap-2 rounded-md border bg-card px-2 py-1.5 transition-shadow',
          isDropTarget && 'ring-2 ring-primary ring-offset-1',
        )}
        style={mergedStyle}
      >
        {dragHandle ?? null}
        {hasChildren ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={expanded ? t('tree.collapse') : t('tree.expand')}
            onClick={() => onToggleExpand?.(org.id)}
          >
            {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </Button>
        ) : (
          <span className="size-9" aria-hidden="true" />
        )}
        <button
          type="button"
          className="flex flex-1 items-center gap-2 text-left"
          onClick={() => onOpenDetail?.(org)}
          disabled={!onOpenDetail}
        >
          <span className="font-medium">{org.name}</span>
          <Badge variant="outline">{org.type_display ?? org.type_code}</Badge>
        </button>
        {actionsDisabled || (!onEdit && !onCreateChild && !onArchive) ? null : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon" aria-label={t('tree.actions')}>
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onEdit && (
                <DropdownMenuItem onSelect={() => onEdit(org)}>
                  {t('node.action.edit')}
                </DropdownMenuItem>
              )}
              {onCreateChild && (
                <DropdownMenuItem onSelect={() => onCreateChild(org)}>
                  {t('node.action.create_child')}
                </DropdownMenuItem>
              )}
              {onArchive && (
                <DropdownMenuItem className="text-destructive" onSelect={() => onArchive(org)}>
                  {t('node.action.archive')}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </li>
  )
})

export interface DragHandleProps extends HTMLAttributes<HTMLButtonElement> {
  label: string
}

export function DragHandle({ label, className, ...rest }: DragHandleProps): ReactElement {
  return (
    <button
      type="button"
      className={cn(
        'flex h-7 w-5 cursor-grab items-center justify-center rounded text-muted-foreground hover:bg-muted',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
      aria-label={label}
      {...rest}
    >
      <GripVertical className="size-4" aria-hidden="true" />
    </button>
  )
}
