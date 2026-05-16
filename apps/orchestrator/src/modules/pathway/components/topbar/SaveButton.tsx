import { Save } from 'lucide-react'
import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

type Props = {
  disabled: boolean
  onClick: () => void
}

export function SaveButton({ disabled, onClick }: Props): ReactElement {
  const { t } = useTranslation('pathway')
  return (
    <Button
      type="button"
      disabled={disabled}
      onClick={onClick}
      data-testid="builder-save"
      className="text-white shadow-sm"
      style={{ background: 'var(--gradient-active)' }}
    >
      <Save className="size-4" strokeWidth={1.8} />
      {t('topbar.save')}
    </Button>
  )
}
