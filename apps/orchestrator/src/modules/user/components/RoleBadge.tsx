import { ShieldCheck } from 'lucide-react'
import { type ReactElement } from 'react'

import { Badge } from '@/components/ui/badge'

import { useRoleMap } from '../roles'

export interface RoleBadgeProps {
  roleId: string
  withIcon?: boolean
}

/** Resolves a user's `role_id` to the role's display name via the roles list.
 *  The `admin` system role is emphasised (filled badge + shield). */
export function RoleBadge({ roleId, withIcon = false }: RoleBadgeProps): ReactElement {
  const roles = useRoleMap()
  const role = roles.get(roleId)
  const isAdmin = role?.slug === 'admin'
  return (
    <Badge variant={isAdmin ? 'default' : 'soft'} className={withIcon ? 'gap-1' : undefined}>
      {withIcon && isAdmin ? <ShieldCheck className="h-3 w-3" aria-hidden /> : null}
      {role?.name ?? '—'}
    </Badge>
  )
}
