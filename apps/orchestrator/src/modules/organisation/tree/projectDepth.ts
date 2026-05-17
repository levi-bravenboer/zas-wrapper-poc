import type { FlatItem } from './types'

// Project the depth + parent of an in-flight drag. Mirrors the
// dnd-kit sortable-tree example: arrayMove the active item into the
// over slot, then derive depth from the horizontal offset clamped to
// what's geometrically valid (no deeper than prev.depth+1, no shallower
// than the following sibling's depth).

export interface Projection {
  depth: number
  parentId: string | null
}

function arrayMove<T>(arr: readonly T[], from: number, to: number): T[] {
  const next = arr.slice()
  const [item] = next.splice(from, 1)
  if (item !== undefined) next.splice(to, 0, item)
  return next
}

export function projectDepth(
  items: readonly FlatItem[],
  activeId: string,
  overId: string,
  offsetLeft: number,
  indent: number,
): Projection {
  const overIndex = items.findIndex((i) => i.id === overId)
  const activeIndex = items.findIndex((i) => i.id === activeId)
  if (overIndex < 0 || activeIndex < 0) return { depth: 0, parentId: null }
  const activeItem = items[activeIndex]
  if (!activeItem) return { depth: 0, parentId: null }
  const newItems = arrayMove(items, activeIndex, overIndex)
  const previousItem = newItems[overIndex - 1]
  const nextItem = newItems[overIndex + 1]
  const dragDepth = Math.round(offsetLeft / indent)
  const projectedDepth = activeItem.depth + dragDepth
  const maxDepth = previousItem ? previousItem.depth + 1 : 0
  const minDepth = nextItem ? nextItem.depth : 0
  let depth = projectedDepth
  if (depth >= maxDepth) depth = maxDepth
  else if (depth < minDepth) depth = minDepth

  const parentId = computeParentId(depth, overIndex, newItems, previousItem)
  return { depth, parentId }
}

function computeParentId(
  depth: number,
  overIndex: number,
  newItems: readonly FlatItem[],
  previousItem: FlatItem | undefined,
): string | null {
  if (depth === 0 || !previousItem) return null
  if (depth === previousItem.depth) return previousItem.parentId
  if (depth > previousItem.depth) return previousItem.id
  for (let i = overIndex - 1; i >= 0; i--) {
    const item = newItems[i]
    if (item && item.depth === depth) return item.parentId
  }
  return null
}
