import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { sortByOrd } from '@/lib/utils/ordinal'

import type { PathwayPhase } from '../../types'

type Props = {
  name: string
  phaseId: string
  phases: PathwayPhase[]
  typeLabel: string
  showName: boolean
  onChangeName: (next: string) => void
  onChangePhase: (phaseId: string) => void
}

// Identity inputs that sit at the top of `BlockDialog`. Name field
// hides for kinds whose canvas shape conveys identity (end_pathway —
// the circle is enough). Phase picker always renders.
export function BlockIdentityFields({
  name,
  phaseId,
  phases,
  typeLabel,
  showName,
  onChangeName,
  onChangePhase,
}: Props): ReactElement {
  const { t } = useTranslation('pathway')
  return (
    <section className="space-y-3">
      {showName && (
        <div>
          <label
            htmlFor="block-dialog-name"
            className="mb-1 block text-[12px] font-medium text-foreground"
          >
            {t('blockDialog.name', { defaultValue: 'Naam' })}
          </label>
          <Input
            id="block-dialog-name"
            value={name}
            placeholder={typeLabel}
            onChange={(e) => onChangeName(e.target.value)}
          />
        </div>
      )}
      <div>
        <label
          htmlFor="block-dialog-phase"
          className="mb-1 block text-[12px] font-medium text-foreground"
        >
          {t('blockDialog.phase', { defaultValue: 'Fase' })}
        </label>
        <Select value={phaseId} onValueChange={onChangePhase}>
          <SelectTrigger id="block-dialog-phase">
            <SelectValue
              placeholder={t('blockDialog.phasePlaceholder', {
                defaultValue: 'Kies fase',
              })}
            />
          </SelectTrigger>
          <SelectContent>
            {sortByOrd(phases).map((phase) => (
              <SelectItem key={phase.id} value={phase.id}>
                {phase.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </section>
  )
}
