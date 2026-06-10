import { useState, type FormEvent, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { isApiError } from '@/lib/api/errors'
import { formatDateTimeOrDash } from '@/lib/utils/datetime'

import { useLinkLuscii, useLusciiData, useUnlinkLuscii } from '../hooks'
import type { LusciiMeasurement, LusciiPatientData, LusciiPlannedAction } from '../types'

// Display-only invariant (luscii-patient-data spec): values render exactly as
// Luscii reports them — no thresholds, no colour-coding by value, no derived
// indicators. Adding any requires an openspec/mdr-watchlist.md entry first.

const NOT_CONFIGURED_CODE = 'unavailable.luscii.not_configured'

export interface LusciiPanelProps {
  patientId: string
}

export function LusciiPanel({ patientId }: LusciiPanelProps): ReactElement {
  const { t } = useTranslation('patient-profile')
  const dataQuery = useLusciiData(patientId)

  if (dataQuery.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('luscii.title')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (dataQuery.error) {
    if (isApiError(dataQuery.error) && dataQuery.error.code === NOT_CONFIGURED_CODE) {
      return (
        <LusciiCardMessage title={t('luscii.title')} message={t('luscii.notConfigured')} />
      )
    }
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('luscii.title')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-3">
          <p className="text-sm text-destructive">{t('luscii.error')}</p>
          <Button variant="outline" onClick={() => void dataQuery.refetch()}>
            {t('luscii.retry')}
          </Button>
        </CardContent>
      </Card>
    )
  }

  const data = dataQuery.data
  if (!data) {
    return <LusciiCardMessage title={t('luscii.title')} message={t('luscii.error')} />
  }

  if (data.state === 'not_linked') {
    return <LusciiLinkForm patientId={patientId} />
  }

  return <LusciiDataView patientId={patientId} data={data} />
}

function LusciiCardMessage({ title, message }: { title: string; message: string }): ReactElement {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  )
}

function linkErrorKey(error: unknown): string {
  if (isApiError(error)) {
    if (error.code === 'invalid.luscii.patient_not_found') return 'luscii.link.errorNotFound'
    if (error.code === 'conflict.luscii.already_linked') return 'luscii.link.errorAlreadyLinked'
    if (error.code === NOT_CONFIGURED_CODE) return 'luscii.notConfigured'
    if (error.status === 422) return 'luscii.link.errorInvalid'
  }
  return 'luscii.link.errorUpstream'
}

function LusciiLinkForm({ patientId }: { patientId: string }): ReactElement {
  const { t } = useTranslation('patient-profile')
  const [value, setValue] = useState('')
  const link = useLinkLuscii()

  const onSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    const lusciiPatientId = value.trim()
    if (!lusciiPatientId) return
    link.mutate({ patientId, lusciiPatientId })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('luscii.title')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{t('luscii.link.empty')}</p>
        <form className="flex flex-wrap items-center gap-2" onSubmit={onSubmit}>
          <Input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={t('luscii.link.placeholder')}
            aria-label={t('luscii.link.inputLabel')}
            className="max-w-md font-mono"
          />
          <Button type="submit" disabled={link.isPending || value.trim().length === 0}>
            {link.isPending ? t('luscii.link.submitting') : t('luscii.link.submit')}
          </Button>
        </form>
        {link.error ? (
          <p className="text-sm text-destructive" role="alert">
            {t(linkErrorKey(link.error))}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

function LusciiDataView({
  patientId,
  data,
}: {
  patientId: string
  data: LusciiPatientData
}): ReactElement {
  const { t } = useTranslation('patient-profile')
  const unlink = useUnlinkLuscii()
  // Generated schema marks defaulted arrays as optional.
  const plannedActions = data.planned_actions ?? []
  const unmatchedMeasurements = data.unmatched_measurements ?? []

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>{t('luscii.title')}</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => unlink.mutate(patientId)}
            disabled={unlink.isPending}
          >
            {t('luscii.unlink')}
          </Button>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          {data.program?.name ? (
            <Badge variant="default">{data.program.name}</Badge>
          ) : (
            <Badge variant="soft">{t('luscii.noProgram')}</Badge>
          )}
          {data.protocol?.name ? <Badge variant="soft">{data.protocol.name}</Badge> : null}
          <span className="text-xs text-muted-foreground">
            {t('luscii.window', { days: data.window_days })}
          </span>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('luscii.plannedActions.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {plannedActions.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('luscii.plannedActions.empty')}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {plannedActions.map((action) => (
                <PlannedActionRow key={action.id} action={action} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {unmatchedMeasurements.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('luscii.measurements.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2">
              {unmatchedMeasurements.map((measurement, index) => (
                <li
                  key={measurement.measurement_id ?? `m-${index}`}
                  className="rounded-md border border-border px-3 py-2"
                >
                  <MeasurementBlock measurement={measurement} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

function PlannedActionRow({ action }: { action: LusciiPlannedAction }): ReactElement {
  const { t, i18n } = useTranslation('patient-profile')
  const completed = Boolean(action.completed_at)

  return (
    <li className="flex flex-col gap-2 rounded-md border border-border px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={completed ? 'default' : 'soft'}>
          {completed ? t('luscii.plannedActions.completed') : t('luscii.plannedActions.open')}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {completed
            ? formatDateTimeOrDash(action.completed_at, i18n.language)
            : t('luscii.plannedActions.dueBy', {
                date: formatDateTimeOrDash(action.expires_at, i18n.language),
              })}
        </span>
      </div>
      {action.measurement ? <MeasurementBlock measurement={action.measurement} /> : null}
    </li>
  )
}

function MeasurementBlock({ measurement }: { measurement: LusciiMeasurement }): ReactElement {
  const { t, i18n } = useTranslation('patient-profile')
  const values = measurement.values ?? []

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{measurement.instrument_name ?? t('luscii.measurements.unknownInstrument')}</span>
        <span>{formatDateTimeOrDash(measurement.created_at, i18n.language)}</span>
      </div>
      {values.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('luscii.measurements.noValues')}</p>
      ) : (
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {values.map((item, index) => {
            const texts = item.response_texts ?? []
            return (
              <li key={index} className="text-sm">
                {item.label ? <span className="text-muted-foreground">{item.label}: </span> : null}
                <span className="font-medium">
                  {texts.length > 0 ? texts.join(', ') : (item.value ?? '—')}
                </span>
                {item.unit ? <span className="text-muted-foreground"> {item.unit}</span> : null}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
