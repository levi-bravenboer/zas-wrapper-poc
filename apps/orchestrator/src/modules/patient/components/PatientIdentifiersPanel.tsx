import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import type { PatientIdentifierRow, PatientRow } from '../types'

function isInsz(identifier: PatientIdentifierRow): boolean {
  if (identifier.use === 'official') return true
  const system = identifier.system?.toLowerCase() ?? ''
  return system.includes('ssin') || system.includes('insz') || system.includes('2.16.56')
}

function sortIdentifiers(
  identifiers: ReadonlyArray<PatientIdentifierRow>,
): ReadonlyArray<PatientIdentifierRow> {
  return [...identifiers].sort((a, b) => {
    const ai = isInsz(a) ? 0 : 1
    const bi = isInsz(b) ? 0 : 1
    return ai - bi
  })
}

export interface PatientIdentifiersPanelProps {
  patient: PatientRow
}

export function PatientIdentifiersPanel({ patient }: PatientIdentifiersPanelProps): ReactElement {
  const { t } = useTranslation('patient-profile')
  const identifiers = sortIdentifiers(patient.identifiers ?? [])

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('identifiers.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {identifiers.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('identifiers.empty')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {identifiers.map((identifier, index) => (
              <li
                key={`${identifier.system ?? 'sys'}-${identifier.value}-${index}`}
                className="flex flex-wrap items-center gap-2 rounded-md border border-border px-3 py-2"
              >
                {isInsz(identifier) ? (
                  <Badge variant="default">{t('identifiers.insz')}</Badge>
                ) : null}
                <span className="font-mono text-sm text-foreground">{identifier.value}</span>
                {identifier.system ? (
                  <span className="text-xs text-muted-foreground">{identifier.system}</span>
                ) : null}
                {identifier.use ? (
                  <Badge variant="soft" className="ml-auto">
                    {identifier.use}
                  </Badge>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
