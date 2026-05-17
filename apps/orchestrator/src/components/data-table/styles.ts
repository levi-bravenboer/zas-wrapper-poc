export const tableCard =
  'overflow-hidden rounded-lg border border-border bg-background shadow-xs'

export const tableEl = 'w-full caption-bottom text-sm'

export const headerRow = 'bg-surface-1'
export const headerCell =
  'h-10 px-4 text-left text-xs font-medium uppercase tracking-wider text-foreground-muted border-b border-border'

export const bodyRow =
  'border-b border-border/60 last:border-b-0 transition-colors hover:bg-primary-subtle/40 data-[state=selected]:bg-primary-subtle/60'
export const bodyRowClickable = 'cursor-pointer'
export const bodyCell = 'px-4 py-3 align-middle text-foreground'

export const stickyFirst =
  'sticky left-0 z-10 bg-background data-[scrolled=true]:shadow-[inset_-8px_0_8px_-8px_rgba(16,24,40,0.08)]'

export const scrollContainer = 'relative w-full overflow-auto'

// toolbar
export const toolbarRoot = 'flex flex-wrap items-center gap-2 py-3'
export const toolbarSearchBox = 'relative min-w-[240px] max-w-[320px] flex-1'
export const toolbarSearchInput =
  'w-full rounded-md border border-input bg-background/70 py-1.5 pl-9 pr-3 text-sm text-foreground placeholder:text-foreground-muted focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20'

export const pillEmpty =
  'inline-flex items-center gap-1.5 rounded-md border border-border bg-background/60 px-2.5 py-1 text-xs font-medium text-foreground-muted hover:border-accent-mint hover:text-primary'
export const pillActive =
  'inline-flex items-center gap-1.5 rounded-md border border-accent-mint bg-primary-subtle py-1 pl-2.5 pr-1 text-xs font-medium text-primary-pressed'
export const pillX =
  'inline-flex h-4 w-4 items-center justify-center rounded text-primary hover:bg-primary/10'

export const clearAllBtn =
  'text-xs text-foreground-muted hover:text-primary px-1.5 py-1 rounded-md'

// table footer / pagination chrome
export const tableFooter =
  'flex items-center justify-between gap-3 border-t border-border bg-surface-1 px-4 py-2 text-xs text-foreground-muted'
