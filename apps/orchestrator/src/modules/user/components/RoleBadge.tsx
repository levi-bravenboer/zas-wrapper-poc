import { ShieldCheck } from 'lucide-react'
import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'

import { type Role } from '../schemas'

export interface RoleBadgeProps {
  role: Role
  withIcon?: boolean
}

export function RoleBadge({ role, withIcon = false }: RoleBadgeProps): ReactElement {
  const { t } = useTranslation('users')
  const isAdmin = role === 'admin'
  return (
    <Badge variant={isAdmin ? 'default' : 'soft'} className={withIcon ? 'gap-1' : undefined}>
      {withIcon && isAdmin ? <ShieldCheck className="h-3 w-3" aria-hidden /> : null}
      {t(`role.${role}`)}
    </Badge>
  )
}
