import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Textarea } from '@/components/ui/textarea'

import type { ConfigForSemantics } from '../../../configSchemas'
import type { PathwayBlockBranch } from '../../../types'

import { InspectorField } from './InspectorField'

type Props = {
  config: ConfigForSemantics<'decision'>
  branches: PathwayBlockBranch[]
  onChange: (next: ConfigForSemantics<'decision'>) => void
}

export function DecisionInspector({ config, branches, onChange }: Props): ReactElement {
  const { t } = useTranslation('pathway')
  return (
    <div className="flex flex-col gap-3">
      <InspectorField
        label={t('inspector.decision.criterion')}
        htmlFor="decision-criterion"
        hint={t('inspector.decision.criterionHint')}
      >
        <Textarea
          id="decision-criterion"
          value={config.criterion ?? ''}
          onChange={(e) => onChange({ ...config, criterion: e.target.value || undefined })}
          placeholder={t('inspector.decision.criterionPlaceholder')}
        />
      </InspectorField>
      <InspectorField label={t('inspector.decision.branches')}>
        {branches.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t('inspector.decision.noBranches')}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {branches.map((b) => (
              <li
                key={b.id}
                className="flex items-center justify-between rounded-md border border-input bg-muted/30 px-3 py-2 text-sm"
              >
                <span>{b.label}</span>
              </li>
            ))}
          </ul>
        )}
      </InspectorField>
    </div>
  )
}
