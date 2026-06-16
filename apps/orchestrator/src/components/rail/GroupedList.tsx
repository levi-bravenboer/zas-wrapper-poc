import { type ReactElement, type ReactNode } from 'react'

export type GroupedListProps = {
  children: ReactNode
}

/**
 * Column container for date/section groups in a rail. Stacks
 * `<GroupedListSection>`s vertically; styling-light by design.
 */
export function GroupedList({ children }: GroupedListProps): ReactElement {
  return <div className="flex min-w-0 flex-col">{children}</div>
}

export type GroupedListSectionProps = {
  label: string
  children: ReactNode
}

/**
 * One labelled group inside a `<GroupedList>`. Renders an uppercase muted
 * sticky header (e.g. "MORGEN" / "VR 19 JUN") above its rows. Generalised from
 * the section header in the tasks rail.
 */
export function GroupedListSection({
  label,
  children,
}: GroupedListSectionProps): ReactElement {
  return (
    <section>
      <h2 className="sticky top-0 z-10 bg-background/95 px-4 pb-1 pt-3 text-[11px] uppercase tracking-wider text-foreground-muted backdrop-blur-sm">
        {label}
      </h2>
      <div className="flex flex-col">{children}</div>
    </section>
  )
}
