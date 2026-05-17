import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useMemo, useState, type CSSProperties, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import type { OrganisationRead, OrganisationTreeMove } from '../schemas'
import { applyMovesOverlay } from '../tree/applyMovesOverlay'
import { flattenTree } from '../tree/flattenTree'
import { projectDepth, type Projection } from '../tree/projectDepth'
import type { FlatItem, PendingMoves } from '../tree/types'

import { DragHandle, TREE_INDENT_PX, TreeRow } from './TreeRow'

export interface OrganisationTreeEditorProps {
  organisations: readonly OrganisationRead[]
  pendingMoves: PendingMoves
  expanded: ReadonlySet<string>
  onToggleExpand: (id: string) => void
  onMove: (move: OrganisationTreeMove) => void
}

export function OrganisationTreeEditor({
  organisations,
  pendingMoves,
  expanded,
  onToggleExpand,
  onMove,
}: OrganisationTreeEditorProps): ReactElement {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const collapsed = useMemo<Set<string>>(() => {
    const out = new Set<string>()
    for (const org of organisations) if (!expanded.has(org.id)) out.add(org.id)
    return out
  }, [organisations, expanded])

  const items: FlatItem[] = useMemo(() => {
    const overlayed = applyMovesOverlay(organisations, pendingMoves)
    return flattenTree(overlayed, collapsed)
  }, [organisations, pendingMoves, collapsed])

  const orgById = useMemo(() => {
    const m = new Map<string, OrganisationRead>()
    for (const o of organisations) m.set(o.id, o)
    return m
  }, [organisations])

  const [activeId, setActiveId] = useState<string | null>(null)
  const [offsetLeft, setOffsetLeft] = useState(0)
  const [overId, setOverId] = useState<string | null>(null)

  const projection: Projection | null = useMemo(() => {
    if (!activeId || !overId) return null
    return projectDepth(items, activeId, overId, offsetLeft, TREE_INDENT_PX)
  }, [items, activeId, overId, offsetLeft])

  const reset = (): void => {
    setActiveId(null)
    setOverId(null)
    setOffsetLeft(0)
  }

  const handleDragStart = (event: DragStartEvent): void => {
    setActiveId(String(event.active.id))
    setOverId(String(event.active.id))
  }

  const handleDragMove = (event: DragMoveEvent): void => {
    setOffsetLeft(event.delta.x)
  }

  const handleDragOver = (event: DragOverEvent): void => {
    setOverId(event.over?.id ? String(event.over.id) : null)
  }

  const handleDragEnd = (event: DragEndEvent): void => {
    const dragged = String(event.active.id)
    const over = event.over?.id ? String(event.over.id) : null
    if (!over || !projection) {
      reset()
      return
    }
    const overlayed = applyMovesOverlay(organisations, pendingMoves)
    // Recompute sort_index inside the new parent's sibling group, dropping
    // the dragged node first so we don't count it twice.
    const newParent = projection.parentId
    const siblings = overlayed
      .filter((o) => o.parent_organisation_id === newParent && o.id !== dragged)
      .sort(
        (a, b) =>
          a.sort_index - b.sort_index || a.name.localeCompare(b.name),
      )
    // Find drop position inside that sibling list. Walk the projected flat
    // list backwards from the over-item to count how many of those siblings
    // come before the drop slot.
    const flatAfter = items.filter((i) => i.id !== dragged)
    const overIdx = flatAfter.findIndex((i) => i.id === over)
    const siblingsBefore = new Set<string>()
    for (let i = 0; i <= overIdx; i++) {
      if (i < 0) break
      const id = flatAfter[i]?.id
      if (!id) continue
      const o = orgById.get(id)
      if (!o) continue
      if (siblings.some((s) => s.id === id)) siblingsBefore.add(id)
    }
    const sortIndex = siblingsBefore.size
    onMove({
      id: dragged,
      parent_organisation_id: newParent,
      sort_index: sortIndex,
    })
    reset()
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={reset}
    >
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <ul className="flex flex-col gap-1" role="tree">
          {items.map((item) => {
            const org = orgById.get(item.id)
            if (!org) return null
            const isActive = activeId === item.id
            const projectedDepth = isActive && projection ? projection.depth : item.depth
            return (
              <SortableTreeRow
                key={item.id}
                org={org}
                item={item}
                depth={projectedDepth}
                expanded={expanded.has(item.id)}
                onToggleExpand={onToggleExpand}
                isDropTarget={overId === item.id && !isActive}
              />
            )
          })}
        </ul>
      </SortableContext>
    </DndContext>
  )
}

interface SortableTreeRowProps {
  org: OrganisationRead
  item: FlatItem
  depth: number
  expanded: boolean
  onToggleExpand: (id: string) => void
  isDropTarget: boolean
}

function SortableTreeRow({
  org,
  item,
  depth,
  expanded,
  onToggleExpand,
  isDropTarget,
}: SortableTreeRowProps): ReactElement {
  const { t } = useTranslation('organisations-admin-ui')
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id })

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
  }

  return (
    <TreeRow
      ref={setNodeRef}
      org={org}
      depth={depth}
      hasChildren={item.hasChildren}
      expanded={expanded}
      onToggleExpand={onToggleExpand}
      actionsDisabled
      isDragging={isDragging}
      isDropTarget={isDropTarget}
      style={style}
      dragHandle={
        <DragHandle
          label={t('tree.edit.handle', { name: org.name })}
          {...attributes}
          {...listeners}
        />
      }
    />
  )
}
