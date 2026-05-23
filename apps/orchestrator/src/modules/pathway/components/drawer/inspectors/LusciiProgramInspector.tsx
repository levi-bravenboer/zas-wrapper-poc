import { useQuery } from '@tanstack/react-query'
import { Check, Copy } from 'lucide-react'
import { useState, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import type { ConfigForSemantics } from '../../../configSchemas'
import { getLusciiProgram, listLusciiPrograms } from '../../canvas/nodes/external/luscii/api'
import { lusciiKeys } from '../../canvas/nodes/external/luscii/keys'
import {
  LUSCII_PROGRAM_MODES,
  type LusciiProgramData,
} from '../../canvas/nodes/external/luscii/types'

import { InspectorField } from './InspectorField'
import { LusciiProgramContentsCard } from './LusciiProgramContentsCard'

type Props = {
  config: ConfigForSemantics<'external_program'>
  onChange: (next: ConfigForSemantics<'external_program'>) => void
}

export function LusciiProgramInspector({ config, onChange }: Props): ReactElement {
  const { t } = useTranslation('pathway')

  const programsQuery = useQuery({
    queryKey: lusciiKeys.programs(),
    queryFn: listLusciiPrograms,
  })

  const programQuery = useQuery({
    queryKey: lusciiKeys.program(config.program_id ?? ''),
    queryFn: () => getLusciiProgram(config.program_id ?? ''),
    enabled: Boolean(config.program_id),
  })

  const programs = programsQuery.data ?? []
  const protocols = programQuery.data?.protocols ?? []

  return (
    <div className="flex flex-col gap-3">
      <InspectorField label={t('inspector.lusciiProgram.program')}>
        <Select
          value={config.program_id ?? ''}
          onValueChange={(v) =>
            onChange({
              ...config,
              program_id: v || undefined,
              // Reset downstream selections when program changes — protocol ids
              // are scoped per program and won't resolve in the new payload.
              protocol_id: undefined,
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder={t('inspector.lusciiProgram.programPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {programsQuery.isLoading ? (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                {t('inspector.lusciiProgram.programLoading')}
              </div>
            ) : programsQuery.isError ? (
              <div className="px-2 py-1.5 text-xs text-destructive">
                {t('inspector.lusciiProgram.programError')}
              </div>
            ) : programs.length === 0 ? (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                {t('inspector.lusciiProgram.programEmpty')}
              </div>
            ) : (
              programs.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} · {p.version}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </InspectorField>

      <InspectorField label={t('inspector.lusciiProgram.protocol')}>
        <Select
          value={config.protocol_id ?? ''}
          onValueChange={(v) => onChange({ ...config, protocol_id: v || undefined })}
          disabled={!config.program_id || programQuery.isLoading}
        >
          <SelectTrigger>
            <SelectValue
              placeholder={
                programQuery.isLoading
                  ? t('inspector.lusciiProgram.protocolLoading')
                  : t('inspector.lusciiProgram.protocolPlaceholder')
              }
            />
          </SelectTrigger>
          <SelectContent>
            {protocols.map((proto) => (
              <SelectItem key={proto.id} value={proto.id}>
                {proto.name}
                {proto.is_default ? ' ★' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </InspectorField>

      <InspectorField label={t('inspector.lusciiProgram.mode')}>
        <Select
          value={config.mode ?? ''}
          onValueChange={(v) =>
            onChange({
              ...config,
              mode: (v || undefined) as ConfigForSemantics<'external_program'>['mode'],
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder={t('inspector.lusciiProgram.modePlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {LUSCII_PROGRAM_MODES.map((m) => (
              <SelectItem key={m} value={m}>
                {t(`inspector.lusciiProgram.modeOption.${m}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </InspectorField>

      <p className="text-[11px] text-muted-foreground">
        {t('inspector.lusciiProgram.perPatientHint')}
      </p>

      {programQuery.data && (
        <>
          <ProgramMetadataStrip program={programQuery.data} />
          <ProgramIdStrip
            programId={programQuery.data.id}
            version={programQuery.data.version}
            protocolId={config.protocol_id ?? null}
          />
          <LusciiProgramContentsCard program={programQuery.data} />
        </>
      )}
    </div>
  )
}

function ProgramIdStrip({
  programId,
  version,
  protocolId,
}: {
  programId: string
  version: string
  protocolId: string | null
}): ReactElement {
  const { t } = useTranslation('pathway')
  const [copied, setCopied] = useState(false)
  const parts = [programId, version, protocolId].filter(Boolean) as string[]
  const text = parts.join(' · ')

  async function copy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div
      aria-label={t('inspector.lusciiProgram.idStrip.ariaLabel')}
      className="mt-1 flex items-center gap-2 rounded-md border bg-muted/40 px-2.5 py-1.5"
      style={{ borderColor: 'var(--hairline)' }}
    >
      <code className="flex-1 truncate font-mono text-[10.5px] text-foreground">{text}</code>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={t('inspector.lusciiProgram.idStrip.copy')}
        onClick={copy}
        className="size-6"
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </Button>
    </div>
  )
}

function ProgramMetadataStrip({ program }: { program: LusciiProgramData }): ReactElement {
  const { t } = useTranslation('pathway')
  return (
    <dl
      className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-md border bg-muted/30 px-3 py-2 text-[11px]"
      style={{ borderColor: 'var(--hairline)' }}
    >
      <MetadataRow
        label={t('inspector.lusciiProgram.metadata.version')}
        value={program.version}
      />
      <MetadataRow
        label={t('inspector.lusciiProgram.metadata.enrolledCount')}
        value={String(program.enrolled_count_org_wide)}
      />
      <MetadataRow
        label={t('inspector.lusciiProgram.metadata.twoWay')}
        value={
          program.is_two_way_messaging
            ? t('inspector.lusciiProgram.metadata.twoWayYes')
            : t('inspector.lusciiProgram.metadata.twoWayNo')
        }
      />
      <MetadataRow
        label={t('inspector.lusciiProgram.metadata.instruments')}
        value={String(program.instruments?.length ?? 0)}
      />
    </dl>
  )
}

function MetadataRow({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <>
      <dt className="font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </>
  )
}
