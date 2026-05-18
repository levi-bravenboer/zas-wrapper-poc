import { useMemo, useState, type ReactElement } from 'react'

import type { OrganisationRead } from '../schemas'

import { TreeRow } from './TreeRow'

interface OrganisationNode {
  org: OrganisationRead
  children: OrganisationNode[]
}

function materialise(rows: OrganisationRead[]): OrganisationNode[] {
  const byId = new Map<string, OrganisationNode>()
  for (const org of rows) byId.set(org.id, { org, children: [] })
  const roots: OrganisationNode[] = []
  for (const node of byId.values()) {
    const parentId = node.org.parent_organisation_id
    const parent = parentId ? byId.get(parentId) : undefined
    if (parent) {
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  }
  const cmp = (a: OrganisationNode, b: OrganisationNode): number =>
    a.org.sort_index - b.org.sort_index || a.org.name.localeCompare(b.org.name)
  const sortRecursive = (n: OrganisationNode): void => {
    n.children.sort(cmp)
    n.children.forEach(sortRecursive)
  }
  roots.sort(cmp)
  roots.forEach(sortRecursive)
  return roots
}

export interface OrganisationTreeProps {
  organisations: OrganisationRead[]
  onOpenDetail: (org: OrganisationRead) => void
  onEdit: (org: OrganisationRead) => void
  onCreateChild: (parent: OrganisationRead) => void
  onArchive: (org: OrganisationRead) => void
  expanded?: ReadonlySet<string>
  onToggle?: (id: string) => void
  actionsDisabled?: boolean | undefined
}

export function OrganisationTree({
  organisations,
  onOpenDetail,
  onEdit,
  onCreateChild,
  onArchive,
  expanded,
  onToggle,
  actionsDisabled,
}: OrganisationTreeProps): ReactElement {
  const tree = useMemo(() => materialise(organisations), [organisations])
  const [internalExpanded, setInternalExpanded] = useState<Set<string>>(() => {
    const all = new Set<string>()
    organisations.forEach((o) => all.add(o.id))
    return all
  })

  const effectiveExpanded = expanded ?? internalExpanded

  const toggle = (id: string): void => {
    if (onToggle) {
      onToggle(id)
      return
    }
    setInternalExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <ul className="flex flex-col gap-1" role="tree">
      {tree.map((node) => (
        <TreeBranch
          key={node.org.id}
          node={node}
          depth={0}
          expanded={effectiveExpanded}
          onToggle={toggle}
          onOpenDetail={onOpenDetail}
          onEdit={onEdit}
          onCreateChild={onCreateChild}
          onArchive={onArchive}
          actionsDisabled={actionsDisabled}
        />
      ))}
    </ul>
  )
}

interface TreeBranchProps {
  node: OrganisationNode
  depth: number
  expanded: ReadonlySet<string>
  onToggle: (id: string) => void
  onOpenDetail: (org: OrganisationRead) => void
  onEdit: (org: OrganisationRead) => void
  onCreateChild: (parent: OrganisationRead) => void
  onArchive: (org: OrganisationRead) => void
  actionsDisabled?: boolean | undefined
}

function TreeBranch({
  node,
  depth,
  expanded,
  onToggle,
  onOpenDetail,
  onEdit,
  onCreateChild,
  onArchive,
  actionsDisabled,
}: TreeBranchProps): ReactElement {
  const isOpen = expanded.has(node.org.id)
  const hasChildren = node.children.length > 0

  return (
    <>
      <TreeRow
        org={node.org}
        depth={depth}
        hasChildren={hasChildren}
        expanded={isOpen}
        onToggleExpand={onToggle}
        onOpenDetail={onOpenDetail}
        onEdit={onEdit}
        onCreateChild={onCreateChild}
        onArchive={onArchive}
        actionsDisabled={actionsDisabled}
      />
      {hasChildren && isOpen && (
        <li role="none">
          <ul className="flex flex-col gap-1 pt-1" role="group">
            {node.children.map((child) => (
              <TreeBranch
                key={child.org.id}
                node={child}
                depth={depth + 1}
                expanded={expanded}
                onToggle={onToggle}
                onOpenDetail={onOpenDetail}
                onEdit={onEdit}
                onCreateChild={onCreateChild}
                onArchive={onArchive}
                actionsDisabled={actionsDisabled}
              />
            ))}
          </ul>
        </li>
      )}
    </>
  )
}
