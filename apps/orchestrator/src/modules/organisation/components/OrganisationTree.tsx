import { ChevronDown, ChevronRight, MoreHorizontal } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import type { OrganisationRead } from '../schemas'

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
    if (parentId && byId.has(parentId)) {
      byId.get(parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }
  const sortRecursive = (n: OrganisationNode): void => {
    n.children.sort((a, b) => a.org.name.localeCompare(b.org.name))
    n.children.forEach(sortRecursive)
  }
  roots.sort((a, b) => a.org.name.localeCompare(b.org.name))
  roots.forEach(sortRecursive)
  return roots
}

export interface OrganisationTreeProps {
  organisations: OrganisationRead[]
  onOpenDetail: (org: OrganisationRead) => void
  onEdit: (org: OrganisationRead) => void
  onCreateChild: (parent: OrganisationRead) => void
  onArchive: (org: OrganisationRead) => void
}

export function OrganisationTree({
  organisations,
  onOpenDetail,
  onEdit,
  onCreateChild,
  onArchive,
}: OrganisationTreeProps) {
  const tree = useMemo(() => materialise(organisations), [organisations])
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const all = new Set<string>()
    organisations.forEach((o) => all.add(o.id))
    return all
  })

  const toggle = (id: string): void => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  return (
    <ul className="flex flex-col gap-1" role="tree">
      {tree.map((node) => (
        <TreeNode
          key={node.org.id}
          node={node}
          depth={0}
          expanded={expanded}
          onToggle={toggle}
          onOpenDetail={onOpenDetail}
          onEdit={onEdit}
          onCreateChild={onCreateChild}
          onArchive={onArchive}
        />
      ))}
    </ul>
  )
}

interface TreeNodeProps {
  node: OrganisationNode
  depth: number
  expanded: Set<string>
  onToggle: (id: string) => void
  onOpenDetail: (org: OrganisationRead) => void
  onEdit: (org: OrganisationRead) => void
  onCreateChild: (parent: OrganisationRead) => void
  onArchive: (org: OrganisationRead) => void
}

function TreeNode({
  node,
  depth,
  expanded,
  onToggle,
  onOpenDetail,
  onEdit,
  onCreateChild,
  onArchive,
}: TreeNodeProps) {
  const { t } = useTranslation('organisations-admin-ui')
  const isOpen = expanded.has(node.org.id)
  const hasChildren = node.children.length > 0

  return (
    <li role="treeitem" aria-expanded={hasChildren ? isOpen : undefined}>
      <div
        className="flex items-center gap-2 rounded-md border bg-card px-2 py-1.5"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {hasChildren ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={isOpen ? t('tree.collapse') : t('tree.expand')}
            onClick={() => onToggle(node.org.id)}
          >
            {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </Button>
        ) : (
          <span className="size-9" aria-hidden="true" />
        )}
        <button
          type="button"
          className="flex flex-1 items-center gap-2 text-left"
          onClick={() => onOpenDetail(node.org)}
        >
          <span className="font-medium">{node.org.name}</span>
          <Badge variant="outline">{node.org.type_display ?? node.org.type_code}</Badge>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon" aria-label={t('tree.actions')}>
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onEdit(node.org)}>
              {t('node.action.edit')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onCreateChild(node.org)}>
              {t('node.action.create_child')}
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onSelect={() => onArchive(node.org)}>
              {t('node.action.archive')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {hasChildren && isOpen && (
        <ul className="flex flex-col gap-1 pt-1" role="group">
          {node.children.map((child) => (
            <TreeNode
              key={child.org.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              onOpenDetail={onOpenDetail}
              onEdit={onEdit}
              onCreateChild={onCreateChild}
              onArchive={onArchive}
            />
          ))}
        </ul>
      )}
    </li>
  )
}
