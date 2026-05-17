import type { FlatItem, OrganisationRead } from './types'

// Materialise a server-shape org list into the depth-first flat list the
// dnd-kit sortable-tree pattern expects. Children of a collapsed parent
// are dropped from the output; expose collapsed=true on the parent so the
// caller can render a chevron, but emit nothing for its subtree.

export function flattenTree(
  orgs: readonly OrganisationRead[],
  collapsedIds: ReadonlySet<string> = new Set(),
): FlatItem[] {
  const byParent = new Map<string | null, OrganisationRead[]>()
  for (const org of orgs) {
    const list = byParent.get(org.parent_organisation_id) ?? []
    list.push(org)
    byParent.set(org.parent_organisation_id, list)
  }
  for (const siblings of byParent.values()) {
    siblings.sort((a, b) => {
      if (a.sort_index !== b.sort_index) return a.sort_index - b.sort_index
      return a.name.localeCompare(b.name)
    })
  }

  const out: FlatItem[] = []
  const walk = (parentId: string | null, depth: number): void => {
    const siblings = byParent.get(parentId) ?? []
    for (const node of siblings) {
      const children = byParent.get(node.id) ?? []
      const hasChildren = children.length > 0
      const collapsed = collapsedIds.has(node.id)
      out.push({
        id: node.id,
        parentId,
        depth,
        hasChildren,
        collapsed,
      })
      if (!collapsed && hasChildren) walk(node.id, depth + 1)
    }
  }
  walk(null, 0)
  return out
}
