import { useQuery } from '@tanstack/react-query'
import { Link2, Plus, Trash2 } from 'lucide-react'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { listPathways } from '../../../api'
import { PATHWAY_LINK_MODES, type ConfigForSemantics } from '../../../configSchemas'
import { pathwayKeys } from '../../../keys'

import { InspectorField } from './InspectorField'
import { InspectorHeaderChip } from './InspectorHeaderChip'

type Props = {
  config: ConfigForSemantics<'pathway_link'>
  currentPathwayId: string
  onChange: (next: ConfigForSemantics<'pathway_link'>) => void
}

export function PathwayLinkInspector({ config, currentPathwayId, onChange }: Props): ReactElement {
  const { t } = useTranslation('pathway')
  const { data: pathways = [] } = useQuery({
    queryKey: pathwayKeys.list(),
    queryFn: listPathways,
  })

  // Only pathways that have at least one published version are link-able —
  // a `pathway_link` always resolves to the latest published child at publish
  // time, so an unpublished target would produce an unresolvable snapshot.
  const candidatePathways = pathways
    .filter((p) => p.id !== currentPathwayId && p.latest_published_version_id != null)
    .toSorted((a, b) => (a.updated_at > b.updated_at ? -1 : 1))

  const mappingEntries = Object.entries(config.context_mapping ?? {})

  function updateMapping(next: Record<string, string>) {
    onChange({ ...config, context_mapping: next })
  }

  function addMapping() {
    let key = 'new_key'
    let i = 1
    const existing = config.context_mapping ?? {}
    while (key in existing) {
      key = `new_key_${i++}`
    }
    updateMapping({ ...existing, [key]: '' })
  }

  function renameKey(oldKey: string, newKey: string) {
    if (oldKey === newKey) return
    const existing = config.context_mapping ?? {}
    if (!(oldKey in existing) || newKey in existing) return
    const next: Record<string, string> = {}
    for (const [k, v] of Object.entries(existing)) {
      next[k === oldKey ? newKey : k] = v
    }
    updateMapping(next)
  }

  function setValue(key: string, value: string) {
    updateMapping({ ...(config.context_mapping ?? {}), [key]: value })
  }

  function removeKey(key: string) {
    const next: Record<string, string> = { ...(config.context_mapping ?? {}) }
    delete next[key]
    updateMapping(next)
  }

  return (
    <div className="flex flex-col gap-3">
      <InspectorHeaderChip
        source="internal"
        provider="pathway"
        kind="link"
        label={t('inspector.pathwayLink.headerLabel')}
        icon={<Link2 className="size-3.5" strokeWidth={1.8} />}
      />
      <InspectorField label={t('inspector.pathwayLink.target')}>
        <Select
          value={config.target_pathway_id ?? ''}
          onValueChange={(v) =>
            onChange({
              ...config,
              target_pathway_id: v || undefined,
              // The block always tracks the latest published version of the
              // target. Force the backend defaults so we never persist a
              // stale `pinned_version_id` from a previous target.
              version_pin: 'latest_published',
              pinned_version_id: null,
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder={t('inspector.pathwayLink.targetPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {candidatePathways.length === 0 ? (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                {t('inspector.pathwayLink.noPublishedPathways')}
              </div>
            ) : (
              candidatePathways.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </InspectorField>

      <InspectorField label={t('inspector.pathwayLink.mode')}>
        <Select
          value={config.mode ?? ''}
          onValueChange={(v) =>
            onChange({
              ...config,
              mode: (v || undefined) as ConfigForSemantics<'pathway_link'>['mode'],
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder={t('inspector.pathwayLink.modePlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {PATHWAY_LINK_MODES.map((m) => (
              <SelectItem key={m} value={m}>
                {t(`inspector.pathwayLink.modeOption.${m}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </InspectorField>

      <InspectorField
        label={t('inspector.pathwayLink.contextMapping')}
        hint={t('inspector.pathwayLink.contextMappingHint')}
      >
        <div className="flex flex-col gap-2">
          {mappingEntries.length === 0 && (
            <p className="text-xs text-muted-foreground">
              {t('inspector.pathwayLink.contextMappingEmpty')}
            </p>
          )}
          {mappingEntries.map(([key, value]) => (
            <div key={key} className="flex items-center gap-2">
              <Input
                value={key}
                onChange={(e) => renameKey(key, e.target.value)}
                placeholder={t('inspector.pathwayLink.contextKeyPlaceholder')}
                className="flex-1"
              />
              <Input
                value={value}
                onChange={(e) => setValue(key, e.target.value)}
                placeholder={t('inspector.pathwayLink.contextValuePlaceholder')}
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeKey(key)}
                aria-label={t('inspector.pathwayLink.contextRemove')}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addMapping}>
            <Plus className="size-4" />
            {t('inspector.pathwayLink.addMapping')}
          </Button>
        </div>
      </InspectorField>
    </div>
  )
}
