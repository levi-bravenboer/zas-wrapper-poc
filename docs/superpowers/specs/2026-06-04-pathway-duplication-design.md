# Pathway Duplication (ZAS-33)

Duplicate an existing pathway as a new draft. Copies the full graph (phases, lanes, blocks, edges, configs) from a user-selected version into a fresh pathway with a single concept version.

## Motivation

Hospitals often have similar pathways (e.g. rehabilitation variants for different patient populations). Starting from an existing template is faster than building from scratch. This is the "fork and tweak" workflow at the pathway level.

## User flow

1. On the pathway list page (`/pathways`), each row has a 3-dot actions menu
2. User clicks the menu, selects **Dupliceren**
3. A dialog opens showing all versions of that pathway (concept + published, with version number, status, and label)
4. User picks a version and confirms
5. Backend creates a new pathway named `"{name} (kopie)"` with a single concept version containing the copied graph
6. List refreshes, toast confirms success ("Zorgpad gedupliceerd")
7. User stays on the list page

---

## Backend

### New schema

File: `apps/backend/app/schemas/pathway/pathway.py`

```python
class PathwayDuplicateRequest(BaseModel):
    source_version_id: UUID
```

Add to `__init__.py` re-exports.

### New service method

File: `apps/backend/app/services/pathway/pathway_service.py`

Add `duplicate` method to `PathwayService`:

```python
async def duplicate(
    self,
    pathway_id: UUID,
    tenant_id: UUID,
    source_version_id: UUID,
) -> PathwaySummary:
    # 1. Load source pathway
    pathway = await self._repo.get(pathway_id, tenant_id)
    if pathway is None:
        raise PathwayNotFoundError()

    # 2. Load + validate source version belongs to this pathway
    source_version = await self._version_repo.get_in_pathway(
        source_version_id, pathway_id
    )
    if source_version is None:
        raise PathwayVersionNotFoundError()

    # 3. Create new pathway (copies identity fields)
    new_pathway = Pathway(
        name=f"{pathway.name} (kopie)",
        clinical_goal=pathway.clinical_goal,
        patient_goal=pathway.patient_goal,
    )
    await self._repo.add(new_pathway)

    # 4. Create initial concept version (standalone, no derived_from link)
    new_version = PathwayVersion(
        pathway_id=new_pathway.id,
        version_no=1,
        status="concept",
        kind="initial",
    )
    await self._version_repo.add(new_version)

    # 5. Deep-copy graph children from source version
    version_service = PathwayVersionService(self._repo, self._version_repo)
    await version_service._copy_children(source_version.id, new_version.id)

    # 6. Flush + refresh for summary rollups
    session = self._repo._session
    await session.flush()

    # 7. Return summary of the new pathway
    summaries = await self.list_summaries(tenant_id)
    return next(s for s in summaries if s.id == new_pathway.id)
```

This method needs `PathwayVersionService` imported. It calls `_copy_children` directly — the method is already used across version boundaries in `PathwayVersionService._fork()`, so cross-service access is the established pattern. Alternatively, extract `_copy_children` to a module-level function, but that's a refactor for another day.

### New endpoint

File: `apps/backend/app/api/routers/pathway/pathway_router.py`

```python
@router.post(
    "/{pathway_id}/duplicate",
    operation_id="duplicate_pathway",
    response_model=PathwaySummary,
    status_code=status.HTTP_201_CREATED,
    responses=_ERRORS_404,
)
async def duplicate_pathway(
    pathway_id: UUID,
    payload: PathwayDuplicateRequest,
    current_user: CurrentUserDep,
    service: PathwayServiceDep,
) -> PathwaySummary:
    return await service.duplicate(
        pathway_id, current_user.tenant_id, payload.source_version_id
    )
```

Place BEFORE the `/{pathway_id}` GET route so FastAPI doesn't match `duplicate` as a path param.

Import `PathwayDuplicateRequest` from `app.schemas.pathway`.

### OpenAPI sync

After the backend changes, run `/openapi-sync` to regenerate `openapi.json` and orchestrator TypeScript types.

---

## Frontend

### API function

File: `apps/orchestrator/src/modules/pathway/api.ts`

```typescript
export async function duplicatePathway(
  pathwayId: string,
  body: { source_version_id: string },
): Promise<PathwaySummary> {
  const result = await api.POST('/pathways/{pathway_id}/duplicate', {
    params: { path: { pathway_id: pathwayId } },
    body,
  })
  if (!result.data) {
    throw errorFromResponse('Failed to duplicate pathway', result.response.status, result.error)
  }
  return result.data
}
```

### Type alias

File: `apps/orchestrator/src/modules/pathway/types.ts`

```typescript
export type PathwayDuplicateRequest = components['schemas']['PathwayDuplicateRequest']
```

### React Query hook

File: `apps/orchestrator/src/modules/pathway/hooks.ts`

```typescript
export function useDuplicatePathway() {
  const qc = useQueryClient()
  return useMutation<PathwaySummary, Error, { pathwayId: string; sourceVersionId: string }>({
    mutationFn: ({ pathwayId, sourceVersionId }) =>
      duplicatePathway(pathwayId, { source_version_id: sourceVersionId }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: pathwayKeys.list() })
    },
  })
}
```

### DuplicatePathwayDialog component

File: `apps/orchestrator/src/modules/pathway/components/DuplicatePathwayDialog.tsx`

Props:
```typescript
type Props = {
  pathwayId: string
  pathwayName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}
```

Behavior:
- Fetches versions via `usePathwayVersions(pathwayId)`, enabled only when `open` is true
- Renders a `Select` with versions listed as: `v{version_no} — {status label}` + label if set
- Default selection: latest published version (highest `version_no` with status `published`), falling back to concept
- Cancel + "Dupliceren" buttons
- On confirm: calls `useDuplicatePathway().mutate()` with selected version
- On success: `toast.success(t('duplicate.success'))`, close dialog
- On error: inline error message (`t('duplicate.error')`)

Structure mirrors `CreatePathwayDialog` — same Dialog/DialogContent/DialogHeader/DialogFooter pattern from `@/components/ui/dialog`.

### Pathway list — row actions

File: `apps/orchestrator/src/routes/_auth/pathways/index.tsx`

Changes:
1. Import `DuplicatePathwayDialog` and `Copy` icon from lucide
2. Add state: `const [duplicateTarget, setDuplicateTarget] = useState<PathwaySummary | null>(null)`
3. Add `rowActions` callback to `DataTable`:

```typescript
rowActions={(row) => [
  {
    label: t('duplicate.action'),
    icon: <Copy className="size-4" />,
    onClick: () => setDuplicateTarget(row),
  },
]}
```

4. Render dialog after `CreatePathwayDialog`:

```tsx
{duplicateTarget && (
  <DuplicatePathwayDialog
    pathwayId={duplicateTarget.id}
    pathwayName={duplicateTarget.name}
    open={!!duplicateTarget}
    onOpenChange={(open) => { if (!open) setDuplicateTarget(null) }}
  />
)}
```

### i18n strings

File: `apps/orchestrator/src/lib/i18n/locales/nl/pathway.json`

Add top-level `"duplicate"` key:

```json
"duplicate": {
  "action": "Dupliceren",
  "title": "Zorgpad dupliceren",
  "sub": "Kies een versie om te dupliceren als nieuw concept.",
  "versionLabel": "Versie",
  "versionPlaceholder": "Kies een versie",
  "submit": "Dupliceren",
  "cancel": "Annuleren",
  "success": "Zorgpad gedupliceerd.",
  "error": "Dupliceren mislukt."
}
```

---

## What we reuse

| Component | Location | Usage |
|-----------|----------|-------|
| `_copy_children()` | `pathway_version_service.py:163` | Deep-copy with UUID remapping |
| `DataTable` `rowActions` prop | `DataTable.tsx:62` | 3-dot menu per row |
| `DataTableRowAction` type | `data-table/types.ts:12` | Action descriptor |
| `usePathwayVersions()` | `hooks.ts:127` | Fetch version list for picker |
| `Dialog` / `DialogContent` etc. | `@/components/ui/dialog` | Dialog chrome |
| `Select` | `@/components/ui/select` | Version picker |
| `toast` (sonner) | `@/components/ui/sonner` | Success toast |
| `pathwayKeys.list()` | `keys.ts:3` | Cache invalidation |

## What's new

| Artifact | File |
|----------|------|
| `PathwayDuplicateRequest` schema | `schemas/pathway/pathway.py` |
| `PathwayService.duplicate()` | `services/pathway/pathway_service.py` |
| `duplicate_pathway` endpoint | `api/routers/pathway/pathway_router.py` |
| `duplicatePathway()` API fn | `modules/pathway/api.ts` |
| `useDuplicatePathway()` hook | `modules/pathway/hooks.ts` |
| `DuplicatePathwayDialog` | `modules/pathway/components/DuplicatePathwayDialog.tsx` |
| `rowActions` on pathway list | `routes/_auth/pathways/index.tsx` |
| `duplicate.*` i18n keys | `locales/nl/pathway.json` |
