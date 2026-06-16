import { type ReactElement } from 'react'

import { Avatar, AvatarFallback, type AvatarProps } from '@/components/ui/avatar'
import { initials } from '@/lib/utils/initials'

export type PersonAvatarProps = Omit<AvatarProps, 'tintBy' | 'children'> & {
  /** Display name — drives the initials fallback. */
  name: string
  /** Stable id to tint by (so the same person keeps one colour). Defaults to
   *  `name` when omitted. */
  tintId?: string
}

/** Initials avatar for a person: `<Avatar>` + tinted `<AvatarFallback>` with the
 *  name's initials. Wraps the repeated Avatar + fallback + initials pattern. */
export function PersonAvatar({ name, tintId, ...rest }: PersonAvatarProps): ReactElement {
  return (
    <Avatar tintBy={tintId ?? name} {...rest}>
      <AvatarFallback tinted>{initials(name)}</AvatarFallback>
    </Avatar>
  )
}
