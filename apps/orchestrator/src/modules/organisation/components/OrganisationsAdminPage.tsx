import { useNavigate, useSearch } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useCallback, useMemo, useState, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { FilterableListPage } from '@/components/list/FilterableListPage'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { isApiError } from '@/lib/api/errors'

import { useDeleteOrganisation, useOrganisations } from '../hooks'
import type { OrganisationRead } from '../schemas'

import { CreateOrganisationDialog } from './CreateOrganisationDialog'
import { EditOrganisationDialog } from './EditOrganisationDialog'
import { OrganisationDetailSheet } from './OrganisationDetailSheet'
import { OrganisationTree } from './OrganisationTree'

type RefKey = 'organisations' | 'patients' | 'practitioner_roles'

function pickReferences(err: unknown): RefKey[] {
  if (!isApiError(err)) return []
  const refs = err.details?.['references']
  if (!Array.isArray(refs)) return []
  return refs.filter(
    (r): r is RefKey => r === 'organisations' || r === 'patients' || r === 'practitioner_roles',
  )
}

export function OrganisationsAdminPage(): ReactElement {
  const { t } = useTranslation('organisations-admin-ui')
  const { data, isLoading, error } = useOrganisations()
  const deleteMutation = useDeleteOrganisation()
  const search = useSearch({ strict: false }) as { collapsed?: unknown }
  const navigate = useNavigate()

  const [createParent, setCreateParent] = useState<OrganisationRead | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<OrganisationRead | null>(null)
  const [detail, setDetail] = useState<OrganisationRead | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<OrganisationRead | null>(null)

  const organisations = useMemo(() => data ?? [], [data])

  const byId = useMemo(() => {
    const map = new Map<string, OrganisationRead>()
    for (const org of organisations) map.set(org.id, org)
    return map
  }, [organisations])

  const collapsed = useMemo<Set<string>>(() => {
    const raw = typeof search.collapsed === 'string' ? search.collapsed : ''
    const ids = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    return new Set(ids)
  }, [search.collapsed])

  const expanded = useMemo<Set<string>>(() => {
    const next = new Set<string>()
    for (const org of organisations) {
      if (!collapsed.has(org.id)) next.add(org.id)
    }
    return next
  }, [organisations, collapsed])

  const onToggle = useCallback(
    (id: string) => {
      void navigate({
        search: ((prev: unknown) => {
          const prevObj =
            typeof prev === 'object' && prev !== null ? (prev as Record<string, unknown>) : {}
          const next = new Set(collapsed)
          if (next.has(id)) next.delete(id)
          else next.add(id)
          const csv = Array.from(next).sort().join(',')
          const { collapsed: _drop, ...rest } = prevObj
          return csv ? { ...rest, collapsed: csv } : rest
        }) as never,
      })
    },
    [navigate, collapsed],
  )

  const detailParent =
    detail?.parent_organisation_id != null
      ? (byId.get(detail.parent_organisation_id) ?? null)
      : null

  const isEmpty = !isLoading && organisations.length === 0

  const openCreateRoot = (): void => {
    setCreateParent(null)
    setCreateOpen(true)
  }

  const openCreateChild = (parent: OrganisationRead): void => {
    setCreateParent(parent)
    setCreateOpen(true)
  }

  const confirmArchive = (): void => {
    if (!archiveTarget) return
    const target = archiveTarget
    deleteMutation.mutate(target.id, {
      onSuccess: () => {
        toast.success(t('archive.success'))
        setArchiveTarget(null)
      },
      onError: (err) => {
        const refs = pickReferences(err)
        if (refs.length > 0) {
          const refLabels = refs.map((r) => t(`archive.ref.${r}`)).join(', ')
          toast.error(t('archive.in_use', { references: refLabels }))
        } else {
          toast.error(t('error.generic'))
        }
      },
    })
  }

  return (
    <>
      <FilterableListPage<OrganisationRead>
        title={t('page.title')}
        description={t('page.sub')}
        primaryAction={
          <Button onClick={openCreateRoot}>
            <Plus className="size-4" aria-hidden />
            {t('page.cta.new_root')}
          </Button>
        }
        table={
          isLoading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
              {t('error.generic')}
            </div>
          ) : (
            <OrganisationTree
              organisations={organisations}
              expanded={expanded}
              onToggle={onToggle}
              onOpenDetail={(org) => setDetail(org)}
              onEdit={(org) => setEditing(org)}
              onCreateChild={openCreateChild}
              onArchive={(org) => setArchiveTarget(org)}
            />
          )
        }
        emptyState={
          <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed p-8 text-sm text-muted-foreground">
            <Badge variant="soft">{t('page.empty')}</Badge>
            <Button onClick={openCreateRoot} variant="outline" size="sm">
              <Plus className="size-4" aria-hidden />
              {t('page.cta.new_root')}
            </Button>
          </div>
        }
        isEmpty={isEmpty}
      />
      <CreateOrganisationDialog
        open={createOpen}
        parent={createParent}
        onOpenChange={setCreateOpen}
      />
      <EditOrganisationDialog
        open={editing !== null}
        organisation={editing}
        onOpenChange={(open) => !open && setEditing(null)}
      />
      <OrganisationDetailSheet
        open={detail !== null}
        organisation={detail}
        parent={detailParent}
        onOpenChange={(open) => !open && setDetail(null)}
      />
      <AlertDialog
        open={archiveTarget !== null}
        onOpenChange={(open) => !open && setArchiveTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('archive.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('archive.description')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('archive.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                confirmArchive()
              }}
              disabled={deleteMutation.isPending}
            >
              {t('archive.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
