import { type ReactElement, type ReactNode } from 'react'

import { cn } from '@/lib/style/cn'

export type RailRowProps = {
  leading?: ReactNode
  primary: ReactNode
  secondary?: ReactNode
  trailing?: ReactNode
  selected?: boolean
  onClick?: () => void
  /**
   * Link-wrapping seam: instead of hardcoding a router `<Link>` (which would
   * couple this primitive to a routing library), the caller may pass `render`
   * to make their own anchor/link BE the row. It receives the row content plus
   * the row `className` so the link element itself carries the full layout +
   * selected styling (so the accent + hit-area land on the link), e.g.
   * `render={({ content, className }) => <Link to="/x" className={className}>{content}</Link>}`.
   * When omitted the row falls back to a `<button>` driven by `onClick`.
   */
  render?: (args: { content: ReactNode; className: string }) => ReactNode
}

/**
 * Generic, domain-neutral rail row. Reproduces the tasks rail visual: leading
 * slot + truncated primary line + truncated muted secondary line + optional
 * trailing slot, with a tinted background and 3px primary left accent when
 * `selected`. No router coupling — see the `render` prop above.
 */
export function RailRow({
  leading,
  primary,
  secondary,
  trailing,
  selected,
  onClick,
  render,
}: RailRowProps): ReactElement {
  const rowClassName = cn(
    'relative flex w-full items-center gap-2.5 border-b border-border/60 px-3 py-2.5 text-left transition-colors hover:bg-surface-1',
    selected &&
      'bg-[color-mix(in_srgb,var(--color-primary-soft)_55%,var(--color-background))] before:absolute before:bottom-2 before:left-0 before:top-2 before:w-[3px] before:rounded-r-sm before:bg-primary',
  )

  const content = (
    <>
      {leading}

      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[13px] font-medium text-foreground">{primary}</span>
        {secondary != null && (
          <span className="truncate text-[11px] tabular-nums text-foreground-muted">
            {secondary}
          </span>
        )}
      </div>

      {trailing}
    </>
  )

  if (render) {
    return <>{render({ content, className: rowClassName })}</>
  }

  return (
    <button
      type="button"
      data-active={selected ? 'true' : undefined}
      onClick={onClick}
      className={rowClassName}
    >
      {content}
    </button>
  )
}
