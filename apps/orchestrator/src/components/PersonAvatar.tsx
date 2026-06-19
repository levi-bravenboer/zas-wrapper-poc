import { type ReactElement } from 'react'

import { PersonHoverCard, type PersonRef } from '@/components/PersonHoverCard'
import { Avatar, AvatarFallback, type AvatarProps } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { initials } from '@/lib/utils/initials'

export type { PersonRef }

export type PersonAvatarProps = Omit<AvatarProps, 'tintBy' | 'children'> & {
  /** Display name — drives the initials fallback. */
  name: string
  /** Stable id to tint by (so the same person keeps one colour). Defaults to
   *  `name` when omitted. */
  tintId?: string
  /** When set, hovering shows a card with that person's info (patient or
   *  caregiver). Omit for a plain, non-interactive avatar. */
  person?: PersonRef
}

/** Initials avatar for a person: `<Avatar>` + tinted `<AvatarFallback>` with the
 *  name's initials. With `person`, hovering reveals a detail card. */
export function PersonAvatar({ name, tintId, person, ...rest }: PersonAvatarProps): ReactElement {
  const avatar = (
    <Avatar tintBy={tintId ?? name} {...rest}>
      <AvatarFallback tinted>{initials(name)}</AvatarFallback>
    </Avatar>
  )

  if (!person) return avatar

  // Self-contained provider so the avatar works standalone (e.g. in tests /
  // isolated renders); the app's global provider still governs in-app delays.
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex cursor-default">{avatar}</span>
        </TooltipTrigger>
        <TooltipContent className="border bg-popover p-3 text-popover-foreground shadow-md">
          <PersonHoverCard person={person} name={name} />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
