import {
  forwardRef,
  useRef,
  type HTMLAttributes,
  type ReactNode,
  type Ref,
  type TdHTMLAttributes,
  type ThHTMLAttributes,
} from 'react'

import { cn } from '@/lib/style/cn'

import { useStickyHorizontalScroll } from '../hooks/use-sticky-horizontal-scroll'
import {
  bodyCell,
  bodyRow,
  headerCell,
  headerRow,
  scrollContainer,
  tableCard,
  tableEl,
} from '../styles'

export interface RootProps extends HTMLAttributes<HTMLDivElement> {
  ariaLabelledBy?: string
  children: ReactNode
}

export const Root = forwardRef<HTMLDivElement, RootProps>(function Root(
  { children, className, ariaLabelledBy, ...rest },
  ref,
) {
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const scrolled = useStickyHorizontalScroll(scrollerRef)
  return (
    <div ref={ref} className={cn(tableCard, className)} data-slot="table-root" {...rest}>
      <div
        ref={scrollerRef}
        className={scrollContainer}
        data-scrolled={scrolled ? 'true' : 'false'}
      >
        <table className={tableEl} aria-labelledby={ariaLabelledBy}>
          {children}
        </table>
      </div>
    </div>
  )
})

export function Header({ children, className }: { children: ReactNode; className?: string }) {
  return <thead className={cn(headerRow, className)}>{children}</thead>
}

export function HeaderRow({ children }: { children: ReactNode }) {
  return <tr>{children}</tr>
}

export interface HeaderCellProps extends ThHTMLAttributes<HTMLTableCellElement> {
  children?: ReactNode
}

export function HeaderCell({ children, className, ...rest }: HeaderCellProps) {
  return (
    <th scope="col" className={cn(headerCell, className)} {...rest}>
      {children}
    </th>
  )
}

export function Body({ children, className }: { children: ReactNode; className?: string }) {
  return <tbody className={className}>{children}</tbody>
}

export interface RowProps extends HTMLAttributes<HTMLTableRowElement> {
  children: ReactNode
  rowRef?: Ref<HTMLTableRowElement>
}

export function Row({ children, className, rowRef, ...rest }: RowProps) {
  return (
    <tr ref={rowRef} className={cn(bodyRow, className)} {...rest}>
      {children}
    </tr>
  )
}

export interface CellProps extends TdHTMLAttributes<HTMLTableCellElement> {
  children?: ReactNode
}

export function Cell({ children, className, ...rest }: CellProps) {
  return (
    <td className={cn(bodyCell, className)} {...rest}>
      {children}
    </td>
  )
}
